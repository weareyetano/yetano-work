import { expect, test } from '@playwright/test'

test('creates and closes a case through the generated API client', async ({ page }) => {
  const title = `Playwright case ${Date.now()}`
  await page.goto('/cases')

  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toBeVisible()
  const createForm = page.getByRole('form', { name: 'Nowa sprawa' })
  await createForm.getByLabel('Tytuł').fill(title)
  await createForm.getByRole('button', { name: 'Utwórz sprawę' }).click()

  const caseRow = page.getByRole('button', { name: new RegExp(title) })
  await expect(caseRow).toBeVisible()
  await caseRow.click()
  await expect(page).toHaveURL(/caseId=/)
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Zamknij sprawę' }).click()
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
})

test('refreshes stale case details after a concurrent update', async ({ page, request }) => {
  const title = `Concurrent Playwright case ${Date.now()}`
  const changedElsewhere = `${title} changed elsewhere`
  await page.goto('/cases')

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
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()

  const concurrentUpdate = await request.patch(`/api/v1/cases/${created.id}`, {
    data: { expectedVersion: created.version, title: changedElsewhere },
  })
  expect(concurrentUpdate.ok()).toBe(true)

  const details = page.getByRole('article')
  await details.getByLabel('Tytuł').fill(`${title} local edit`)
  await details.getByRole('button', { name: 'Zapisz zmiany' }).click()

  await expect(details.getByRole('alert')).toContainText('Sprawa została zmieniona')
  await expect(page.getByRole('heading', { level: 2, name: changedElsewhere })).toBeVisible()
})
