import { expect, test } from '@playwright/test'

test('serves the application and connects to the typed API', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Praca operacyjna')
  await expect(page.getByRole('heading', { name: 'Gotowy fundament' })).toBeVisible()
  await expect(page.getByLabel('Status API')).toContainText('Połączono')
  await expect(page.getByRole('table')).toBeVisible()
})
