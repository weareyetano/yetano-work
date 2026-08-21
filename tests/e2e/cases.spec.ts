import { expect, test } from '@playwright/test'

test('creates and resolves a case through the generated API client', async ({ page }) => {
  const title = `Playwright case ${crypto.randomUUID()}`
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('/cases')

  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', 'oklch(0.967 0.001 286.375)')
  expect(
    await page
      .locator(':root')
      .evaluate((root) => getComputedStyle(root).getPropertyValue('--muted-foreground').trim()),
  ).toBe('oklch(55.2% .016 285.938)')
  await expect(page.locator('[data-slot="card"]').first()).toHaveCSS(
    'background-color',
    'oklch(1 0 0)',
  )
  await expect(page.locator('[data-slot="card-content"]').first()).toHaveClass(/p-4/)
  const view = page.getByRole('combobox', { name: 'Widok spraw' })
  await expect(view).toHaveValue('new')
  expect(await view.getByRole('option').allTextContents()).toEqual([
    'Nowe',
    'Pracujemy',
    'Czekamy',
    'Wszystkie',
  ])
  await page.getByRole('button', { name: 'Dodaj sprawę' }).click()
  await expect(page).toHaveURL(/mode=new/)
  const createForm = page.getByRole('form', { name: 'Nowa sprawa' })
  await createForm.getByLabel('Tytuł').fill(title)
  await createForm.getByLabel('Opis').fill('Created from the workspace panel')
  await createForm.getByRole('button', { name: 'Utwórz sprawę' }).click()

  const caseRow = page.getByRole('button', { name: new RegExp(title) })
  await expect(caseRow).toBeVisible()
  await expect(caseRow).toHaveCSS('background-color', 'oklch(0.967 0.001 286.375)')
  await expect(caseRow).toHaveCSS('border-top-width', '0px')
  await expect(page).toHaveURL(/caseId=/)
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)
  await page.reload()
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)
  await page.getByRole('button', { name: 'Rozwiąż' }).click()
  await expect(view).toHaveValue('all')
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  const history = page.getByRole('region', { name: 'Historia statusu' })
  const historyRows = history.getByRole('listitem')
  await expect(historyRows).toHaveCount(2)
  await expect(history.getByRole('heading')).toHaveCount(0)
  await expect(page.getByRole('article').getByRole('separator')).toHaveCount(0)
  await expect(historyRows.first()).toHaveClass(/bg-muted\/50/)
  await expect(historyRows.first()).toHaveClass(/px-3/)
  await expect(historyRows.first()).toHaveClass(/py-2\.5/)
  await expect(historyRows.first()).toHaveCSS('border-top-width', '0px')
  await expect(historyRows.first()).toHaveCSS('border-radius', '14px')
  expect(browserErrors).toEqual([])
})

test('refreshes stale case details after a concurrent update', async ({ page, request }) => {
  const title = `Concurrent Playwright case ${crypto.randomUUID()}`
  const changedElsewhere = `${title} changed elsewhere`
  await page.goto('/cases')

  await page.getByRole('button', { name: 'Dodaj sprawę' }).click()
  const createForm = page.getByRole('form', { name: 'Nowa sprawa' })
  await createForm.getByLabel('Tytuł').fill(title)
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/cases',
  )
  await createForm.getByRole('button', { name: 'Utwórz sprawę' }).click()
  const createResponse = await createResponsePromise
  const created = (await createResponse.json()) as { id: string; version: number }

  await page.getByRole('button', { name: new RegExp(title) }).click()
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)

  const concurrentUpdate = await request.patch(`/api/v1/cases/${created.id}`, {
    data: { expectedVersion: created.version, title: changedElsewhere },
  })
  expect(concurrentUpdate.ok()).toBe(true)

  const details = page.getByRole('article')
  await details.getByLabel('Tytuł').fill(`${title} local edit`)
  await details.getByRole('button', { name: 'Zapisz' }).click()

  await expect(details.getByRole('alert')).toContainText('Sprawa została zmieniona')
  await expect(details.getByLabel('Tytuł')).toHaveValue(changedElsewhere)
})
