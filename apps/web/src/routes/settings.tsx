import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../modules/settings/ui/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  return <SettingsPage />
}
