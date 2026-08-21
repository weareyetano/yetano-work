import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { Button } from '#components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#components/ui/card'
import { Field, FieldContent, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import {
  APP_BRAND_ICON_OPTIONS,
  APP_BRAND_NAME_DEFAULT,
  getBrandIconComponent,
  notifyBrandSettingsChanged,
  normalizeBrandSettings,
  readBrandSettingsFromStorage,
  writeBrandSettingsToStorage,
} from '#lib/app-brand'

type AppBrandSettings = ReturnType<typeof normalizeBrandSettings>

const NO_ICON_ID = 'none'

function SettingsPage() {
  const [settings, setSettings] = useState<AppBrandSettings>(() => readBrandSettingsFromStorage())
  const [status, setStatus] = useState('')

  const SelectedIcon = getBrandIconComponent(settings.iconId)
  const PreviewIcon = getBrandIconComponent(settings.iconId)
  const previewLabel = settings.appName.trim() || APP_BRAND_NAME_DEFAULT

  const selectedOptionLabel = useMemo(() => {
    if (!settings.iconId) return 'Brak ikonki'
    return APP_BRAND_ICON_OPTIONS.find((option) => option.id === settings.iconId)?.label ?? 'Brak ikonki'
  }, [settings.iconId])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextSettings = normalizeBrandSettings({
      appName: settings.appName.trim() || APP_BRAND_NAME_DEFAULT,
      iconId: settings.iconId,
    })

    writeBrandSettingsToStorage(nextSettings)
    notifyBrandSettingsChanged(nextSettings)
    setSettings(nextSettings)
    setStatus('Zapisano ustawienia.')
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-2">
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia</CardTitle>
          <CardDescription>
            Zmień nazwę apki oraz ikonę wyświetlaną przy nazwie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field>
              <FieldLabel htmlFor="app-name">Nazwa aplikacji</FieldLabel>
              <FieldContent>
                <Input
                  id="app-name"
                  maxLength={120}
                  onChange={(event) =>
                    setSettings((next) => ({ ...next, appName: event.target.value }))
                  }
                  value={settings.appName}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Ikona logotypu (opcjonalnie)</FieldLabel>
              <FieldContent>
                <Select
                  aria-label="Ikona logotypu"
                  className="w-full min-w-64"
                  selectedKey={settings.iconId ?? NO_ICON_ID}
                  onSelectionChange={(iconId) =>
                    setSettings((next) => ({
                      ...next,
                      iconId: iconId === NO_ICON_ID ? null : String(iconId),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      <span className="inline-flex items-center gap-2">
                        {SelectedIcon && <SelectedIcon className="size-4 shrink-0 text-foreground/80" />}
                        {selectedOptionLabel}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem id={NO_ICON_ID}>Brak ikonki</SelectItem>
                    {APP_BRAND_ICON_OPTIONS.map((option) => {
                      const Icon = getBrandIconComponent(option.id)
                      return (
                        <SelectItem id={option.id} key={option.id}>
                          <span className="inline-flex items-center gap-2">
                            {Icon && <Icon className="size-4 shrink-0 text-foreground/80" />}
                            {option.label}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <div className="flex items-center justify-between gap-2">
              <Button size="default" type="submit">
                Zapisz ustawienia
              </Button>
              {status ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {status}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/50 px-3 py-2 text-sm">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Podgląd logotypu
              </p>
              <p className="inline-flex items-center gap-2 font-heading text-base">
                {PreviewIcon && <PreviewIcon className="size-4 shrink-0" />}
                {previewLabel}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { SettingsPage }
