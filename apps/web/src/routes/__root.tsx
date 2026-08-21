import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RiSettings3Line } from '@remixicon/react'

import { ModuleNavigation } from '#components/module-navigation'
import { LinkButton } from '#components/ui/button'
import {
  APP_BRAND_NAME_DEFAULT,
  APP_BRAND_SETTINGS_CHANGED_EVENT,
  getBrandIconComponent,
  normalizeBrandSettings,
  readBrandSettingsFromStorage,
} from '#lib/app-brand'

type AppBrandSettings = ReturnType<typeof normalizeBrandSettings>

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [appSettings, setAppSettings] = useState<AppBrandSettings>(
    readBrandSettingsFromStorage,
  )

  useEffect(() => {
    const updateSettings = (event: Event) => {
      const next =
        event instanceof CustomEvent ? normalizeBrandSettings(event.detail) : readBrandSettingsFromStorage()
      setAppSettings(next)
    }

    window.addEventListener(APP_BRAND_SETTINGS_CHANGED_EVENT, updateSettings)
    return () => {
      window.removeEventListener(APP_BRAND_SETTINGS_CHANGED_EVENT, updateSettings)
    }
  }, [])

  const AppIcon = getBrandIconComponent(appSettings.iconId)
  const appName = appSettings.appName || APP_BRAND_NAME_DEFAULT

  return (
    <div className="mx-auto w-[calc(100%_-_2.5rem)] max-w-[100rem] max-[720px]:w-[calc(100%_-_1.75rem)]">
      <header className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 max-[720px]:grid-cols-1 max-[720px]:gap-2 max-[720px]:py-3">
        <a
          className="font-heading text-base font-semibold text-foreground no-underline"
          href="/cases"
          aria-label={appName}
        >
          <span className="inline-flex items-center gap-2">
            {AppIcon && <AppIcon className="size-4 shrink-0 text-foreground/80" />}
            <span>{appName}</span>
          </span>
        </a>
        <ModuleNavigation className="col-start-2 max-[720px]:col-start-1 max-[720px]:row-start-2" />
        <LinkButton
          className="justify-self-end max-[720px]:col-start-1 max-[720px]:row-start-3"
          href="/settings"
          size="sm"
          variant="ghost"
        >
          <RiSettings3Line aria-hidden="true" />
          <span className="sr-only">Ustawienia</span>
          <span className="max-[720px]:hidden">Ustawienia</span>
        </LinkButton>
      </header>
      <Outlet />
    </div>
  )
}
