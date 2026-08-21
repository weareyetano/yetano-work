import { expect, test } from '@playwright/test'

const organizationId = 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb'

function workspaceCase(index: number) {
  return {
    closedAt: null,
    createdAt: '2026-08-21T10:00:00.000Z',
    customerId: null,
    description: `Opis sprawy ${index}`,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    organizationId,
    status: 'new',
    statusNote: null,
    title: `Sprawa ${index}`,
    updatedAt: '2026-08-21T10:00:00.000Z',
    version: 1,
  }
}

function workspaceHistory(caseId: string) {
  return Array.from({ length: 30 }, (_, index) => ({
    actorId: 'development-user',
    actorType: 'user',
    caseId,
    caseVersion: index + 1,
    changedAt: new Date(Date.UTC(2026, 7, 21, 10, index)).toISOString(),
    fromStatus: null,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    note: `Wpis historii ${index + 1}`,
    source: 'runtime',
    toStatus: 'new',
    transitionId: null,
    type: 'created',
  }))
}

test('uses the preset select for case views', async ({ page }) => {
  await page.goto('/cases')

  const view = page.getByRole('button', { name: /Widok spraw/ })
  await expect(view).toContainText('Otwarte')
  await view.click()

  const content = page.locator('[data-slot="select-content"]')
  await expect(content).toBeVisible()
  await expect(content).toHaveClass(/dark/)
  await expect(content).toHaveClass(/rounded-lg/)
  await expect(content).toHaveClass(/bg-popover\/70/)
  await expect(content).toHaveClass(/ring-foreground\/10/)
  expect(await content.getByRole('option').allTextContents()).toEqual([
    'Otwarte',
    'Odłożone',
    'Zamknięte',
  ])
})

test('keeps the desktop case list and details in independent scroll panes', async ({ page }) => {
  const firstPage = Array.from({ length: 25 }, (_, index) => workspaceCase(index + 1))
  const secondPage = Array.from({ length: 5 }, (_, index) => workspaceCase(index + 26))

  await page.route(/\/api\/v1\/cases(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    const isNextPage = url.searchParams.has('cursor')
    await route.fulfill({
      contentType: 'application/json',
      json: {
        items: isNextPage ? secondPage : firstPage,
        nextCursor: isNextPage ? null : 'next-page',
      },
      status: 200,
    })
  })
  await page.route(/\/api\/v1\/cases\/[^/]+\/status-history(?:\?.*)?$/, async (route) => {
    const caseId = new URL(route.request().url()).pathname.split('/').at(-2) as string
    await route.fulfill({
      contentType: 'application/json',
      json: { items: workspaceHistory(caseId), nextCursor: null },
      status: 200,
    })
  })

  await page.goto('/cases')

  const listPanel = page.getByRole('region', { name: 'Panel listy spraw' })
  const detailPanel = page.getByRole('region', { name: 'Panel szczegółów sprawy' })
  await expect(page.getByRole('button', { name: /Sprawa 25/ })).toBeAttached()
  await expect(listPanel).toHaveCSS('overflow-y', 'auto')
  await expect(detailPanel).toHaveCSS('overflow-y', 'auto')
  await expect
    .poll(() => listPanel.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  await expect
    .poll(() => detailPanel.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    ),
  ).toBe(true)

  await listPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  await listPanel.getByRole('button', { name: 'Pokaż kolejne' }).click()
  const nextPageCase = page.getByRole('button', { name: /Sprawa 26/ })
  await expect(nextPageCase).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(documentHeight)

  await detailPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  expect(await detailPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await nextPageCase.scrollIntoViewIfNeeded()
  const listPosition = await listPanel.evaluate((element) => element.scrollTop)
  await nextPageCase.click()

  await expect(detailPanel.getByLabel('Tytuł')).toHaveValue('Sprawa 26')
  expect(await listPanel.evaluate((element) => element.scrollTop)).toBe(listPosition)
  expect(await detailPanel.evaluate((element) => element.scrollTop)).toBe(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(nextPageCase).toBeFocused()
  expect(
    await nextPageCase.evaluate((element) => {
      const row = element.getBoundingClientRect()
      const panel = element.closest('[aria-label="Panel listy spraw"]')?.getBoundingClientRect()
      return Boolean(panel && row.top >= panel.top && row.bottom <= panel.bottom)
    }),
  ).toBe(true)
})

test('creates, postpones, restores, and resolves a case through the generated API client', async ({
  page,
}) => {
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
  const view = page.getByRole('button', { name: /Widok spraw/ })
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

  const search = page.getByRole('searchbox', { name: 'Szukaj spraw' })
  await search.fill(`Missing ${crypto.randomUUID()}`)
  await expect(page.getByText('Brak pasujących spraw.')).toBeVisible()
  await expect(caseRow).toBeHidden()
  await search.fill(title.slice(0, 24))
  await expect(caseRow).toBeVisible()
  await page.getByRole('button', { name: 'Wyczyść wyszukiwanie' }).click()
  await expect(search).toHaveValue('')
  await search.fill(title.slice(0, 24))
  await expect(caseRow).toBeVisible()
  await page.reload()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(title)
  await page.getByRole('button', { name: 'Odłóż' }).click()
  await expect(view).toContainText('Odłożone')
  await expect(page.getByText('Odłożona')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Przywróć' }).click()
  await expect(view).toContainText('Otwarte')
  await expect(page.getByRole('button', { name: 'Odłóż' })).toBeVisible()
  await page.getByRole('button', { name: 'Rozwiąż' }).click()
  await expect(view).toContainText('Zamknięte')
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  const history = page.getByRole('region', { name: 'Historia statusu' })
  const historyRows = history.getByRole('listitem')
  await expect(historyRows).toHaveCount(4)
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
