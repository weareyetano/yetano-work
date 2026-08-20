import { expect, test } from '@playwright/test'

test('redirects the former home page to cases', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/cases(?:\?.*)?$/)
  await expect(page.getByRole('link', { name: 'Yetano Work — sprawy' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toBeVisible()
  await expect(page.getByText('Sprawy bez utraconego kontekstu.')).toHaveCount(0)
})
