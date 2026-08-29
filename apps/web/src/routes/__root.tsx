import { RiLoginBoxLine, RiMenu3Line, RiSettings3Line } from '@remixicon/react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ModuleNavigation } from '#components/module-navigation'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import {
  APP_BRAND_NAME_DEFAULT,
  APP_BRAND_SETTINGS_CHANGED_EVENT,
  getBrandIconComponent,
  normalizeBrandSettings,
  readBrandSettingsFromStorage,
} from '#lib/app-brand'
import { defaultWebModule } from '#modules'

type AppBrandSettings = ReturnType<typeof normalizeBrandSettings>

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [appSettings, setAppSettings] = useState<AppBrandSettings>(readBrandSettingsFromStorage)

  useEffect(() => {
    const updateSettings = (event: Event) => {
      const next =
        event instanceof CustomEvent
          ? normalizeBrandSettings(event.detail)
          : readBrandSettingsFromStorage()
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
          className="group justify-self-start rounded-lg font-heading text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          href={defaultWebModule.path}
          aria-label={appName}
        >
          <span className="inline-flex items-center gap-2.5">
            {AppIcon && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors group-hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]">
                <AppIcon aria-hidden="true" className="size-5" />
              </span>
            )}
            <span className="text-[1.375rem] leading-none font-extrabold tracking-[-0.04em]">
              {appName}
            </span>
          </span>
        </a>
        <ModuleNavigation className="col-start-2 max-[720px]:col-start-1 max-[720px]:row-start-2" />
        <DropdownMenuTrigger>
          <Button
            aria-label="Otwórz menu aplikacji"
            className="justify-self-end max-[720px]:col-start-1 max-[720px]:row-start-3"
            size="icon"
            type="button"
            variant="ghost"
          >
            <RiMenu3Line aria-hidden="true" />
          </Button>
          <DropdownMenu aria-label="Menu aplikacji" className="min-w-52" placement="bottom end">
            <DropdownMenuItem href="/settings" id="settings">
              <RiSettings3Line aria-hidden="true" />
              Ustawienia
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem id="login" isDisabled textValue="Zaloguj się — wkrótce">
              <RiLoginBoxLine aria-hidden="true" />
              <span>Zaloguj się</span>
              <span className="ml-auto text-sm text-muted-foreground">Wkrótce</span>
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
      </header>
      <Outlet />
    </div>
  )
}
