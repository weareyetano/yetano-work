import { RiProhibitedLine } from '@remixicon/react'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { Button } from '#components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card'
import { Field, FieldContent, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import {
  APP_BRAND_ICON_OPTIONS,
  APP_BRAND_NAME_DEFAULT,
  getBrandIconComponent,
  normalizeBrandSettings,
  notifyBrandSettingsChanged,
  readBrandSettingsFromStorage,
  writeBrandSettingsToStorage,
} from '#lib/app-brand'

type AppBrandSettings = ReturnType<typeof normalizeBrandSettings>

function SettingsPage() {
  const [settings, setSettings] = useState<AppBrandSettings>(() => readBrandSettingsFromStorage())

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextSettings = normalizeBrandSettings({
      appName: settings.appName.trim() || APP_BRAND_NAME_DEFAULT,
      iconId: settings.iconId,
    })

    writeBrandSettingsToStorage(nextSettings)
    notifyBrandSettingsChanged(nextSettings)
    setSettings(nextSettings)
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-2">
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field>
              <FieldLabel htmlFor="app-name">
                Nazwa aplikacji{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="app-name"
                  maxLength={120}
                  onChange={(event) =>
                    setSettings((next) => ({ ...next, appName: event.target.value }))
                  }
                  required
                  value={settings.appName}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel id="app-icon-label">Ikona logotypu</FieldLabel>
              <FieldContent>
                <fieldset
                  aria-labelledby="app-icon-label"
                  className="grid grid-cols-5 gap-2 sm:grid-cols-10"
                >
                  <Button
                    aria-label="Bez ikony"
                    aria-pressed={settings.iconId === null}
                    className="size-11"
                    onPress={() => setSettings((next) => ({ ...next, iconId: null }))}
                    size="icon"
                    type="button"
                    variant={settings.iconId === null ? 'default' : 'outline'}
                  >
                    <RiProhibitedLine aria-hidden="true" />
                  </Button>
                  {APP_BRAND_ICON_OPTIONS.map((option) => {
                    const Icon = getBrandIconComponent(option.id)
                    if (!Icon) return null

                    return (
                      <Button
                        aria-label={`Wybierz ikonę: ${option.label}`}
                        aria-pressed={settings.iconId === option.id}
                        className="size-11"
                        key={option.id}
                        onPress={() => setSettings((next) => ({ ...next, iconId: option.id }))}
                        size="icon"
                        type="button"
                        variant={settings.iconId === option.id ? 'default' : 'outline'}
                      >
                        <Icon aria-hidden="true" />
                      </Button>
                    )
                  })}
                </fieldset>
              </FieldContent>
            </Field>

            <Button size="default" type="submit">
              Zapisz
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { SettingsPage }
