import { expect, test } from '@playwright/test'

test('creates and closes a case through the generated API client', async ({ page }) => {
  const title = `Playwright case ${Date.now()}`
  await page.goto('/cases')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Sprawy bez utraconego kontekstu.' }),
  ).toBeVisible()
  await page.getByLabel('Tytuł').fill(title)
  await page.getByLabel('Opis (opcjonalnie)').fill('Critical user path exercised by Playwright.')
  await page.getByRole('button', { name: 'Utwórz sprawę' }).click()

  const caseRow = page.getByRole('button', { name: new RegExp(title) })
  await expect(caseRow).toBeVisible()
  await caseRow.click()
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Zamknij sprawę' }).click()
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
})
