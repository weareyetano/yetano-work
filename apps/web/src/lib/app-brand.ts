import * as RemixIcons from '@remixicon/react'
import type { ComponentProps, ComponentType } from 'react'

const APP_BRAND_STORAGE_KEY = 'yetano:app-brand-settings'

const APP_BRAND_SETTINGS_CHANGED_EVENT = 'yetano:app-brand-settings-changed'

const APP_BRAND_NAME_DEFAULT = 'Yet Another Company'

type AppIconRenderer = ComponentType<ComponentProps<'svg'>>

type AppBrandIconOption = {
  id: string
  label: string
  iconName: string
}

type AppBrandSettings = {
  appName: string
  iconId: string | null
}

const APP_BRAND_ICON_OPTIONS: readonly AppBrandIconOption[] = [
  { id: 'building', label: 'Budynek', iconName: 'RiBuildingLine' },
  { id: 'briefcase', label: 'Biuro', iconName: 'RiBriefcaseLine' },
  { id: 'store', label: 'Sklep', iconName: 'RiStore2Line' },
  { id: 'apps', label: 'Aplikacje', iconName: 'RiAppsLine' },
  { id: 'rocket', label: 'Rakieta', iconName: 'RiRocketLine' },
  { id: 'star', label: 'Gwiazda', iconName: 'RiStarLine' },
]

const iconRegistry = RemixIcons as Record<string, unknown>

function isBrandIconId(value: unknown): value is string {
  return typeof value === 'string' && APP_BRAND_ICON_OPTIONS.some((option) => option.id === value)
}

function normalizeBrandSettings(value: unknown): AppBrandSettings {
  const defaultSettings: AppBrandSettings = {
    appName: APP_BRAND_NAME_DEFAULT,
    iconId: null,
  }

  if (typeof value !== 'object' || value === null) {
    return defaultSettings
  }

  const candidate = value as Partial<{ appName: unknown; iconId: unknown }>

  const appNameCandidate = candidate.appName
  const iconIdCandidate = candidate.iconId

  const appName =
    typeof appNameCandidate === 'string' && appNameCandidate.trim()
      ? appNameCandidate.trim()
      : defaultSettings.appName

  const iconId = isBrandIconId(iconIdCandidate) ? iconIdCandidate : null

  return {
    appName,
    iconId,
  }
}

function getBrandIconOption(iconId: AppBrandSettings['iconId']): AppBrandIconOption | null {
  if (!iconId) {
    return null
  }

  return APP_BRAND_ICON_OPTIONS.find((option) => option.id === iconId) ?? null
}

function getBrandIconComponent(iconId: AppBrandSettings['iconId']): AppIconRenderer | null {
  const option = getBrandIconOption(iconId)
  if (!option) return null

  const icon = iconRegistry[option.iconName]
  if (typeof icon !== 'function') return null

  return icon as AppIconRenderer
}

function readBrandSettingsFromStorage(): AppBrandSettings {
  if (typeof window === 'undefined') {
    return normalizeBrandSettings(undefined)
  }

  const raw = window.localStorage.getItem(APP_BRAND_STORAGE_KEY)
  if (!raw) {
    return normalizeBrandSettings(undefined)
  }

  try {
    return normalizeBrandSettings(JSON.parse(raw))
  } catch {
    return normalizeBrandSettings(undefined)
  }
}

function writeBrandSettingsToStorage(settings: AppBrandSettings) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(APP_BRAND_STORAGE_KEY, JSON.stringify(settings))
}

function notifyBrandSettingsChanged(settings: AppBrandSettings) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(APP_BRAND_SETTINGS_CHANGED_EVENT, {
      detail: settings,
    }),
  )
}

export {
  APP_BRAND_ICON_OPTIONS,
  APP_BRAND_NAME_DEFAULT,
  APP_BRAND_SETTINGS_CHANGED_EVENT,
  getBrandIconComponent,
  normalizeBrandSettings,
  notifyBrandSettingsChanged,
  readBrandSettingsFromStorage,
  writeBrandSettingsToStorage,
}
