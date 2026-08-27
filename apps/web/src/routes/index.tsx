import { createFileRoute, redirect } from '@tanstack/react-router'

import { defaultWebModule } from '#modules'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: defaultWebModule.path })
  },
})
