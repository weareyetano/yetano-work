import { expect, test } from '@playwright/test'

test('creates and resolves a case through the generated API client', async ({ page }) => {
  const title = `Playwright case ${crypto.randomUUID()}`
  await page.goto('/cases')

  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toBeVisible()
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
  await expect(page).toHaveURL(/caseId=/)
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)
  await page.reload()
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)
  await page.getByRole('button', { name: 'Rozwiąż' }).click()
  await expect(view).toHaveValue('all')
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
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
