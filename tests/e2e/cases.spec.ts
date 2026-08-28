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

function workspaceActivities(caseId: string) {
  return Array.from({ length: 30 }, (_, index) => ({
    actorId: 'development-user',
    actorType: 'user',
    caseId,
    content: `Wpis aktywności ${index + 1}`,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    occurredAt: new Date(Date.UTC(2026, 7, 21, 10, index)).toISOString(),
    type: 'note',
  }))
}

test('uses the preset select for case views', async ({ page }) => {
  await page.goto('/cases')

  const view = page.getByRole('button', { name: /Widok spraw/ })
  await expect(view).toContainText('Otwarte')
  await expect(view).toHaveCSS('height', '40px')
  await view.click()

  const content = page.locator('[data-slot="select-content"]')
  await expect(content).toBeVisible()
  await expect(content).not.toHaveClass(/dark/)
  await expect(content).toHaveClass(/rounded-lg/)
  await expect(content).toHaveClass(/bg-popover/)
  await expect(content).toHaveClass(/ring-border/)
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
  await page.route(/\/api\/v1\/activities\/cases\/[^/]+(?:\?.*)?$/, async (route) => {
    const caseId = new URL(route.request().url()).pathname.split('/').at(-1) as string
    await route.fulfill({
      contentType: 'application/json',
      json: { items: workspaceActivities(caseId), nextCursor: null },
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
  await detailPanel.getByRole('button', { name: 'Pokaż aktywność' }).click()
  await expect(detailPanel.getByRole('region', { name: 'Aktywność' })).toBeVisible()
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
  await expect(page.locator('body')).toHaveCSS('background-color', 'oklch(0.965 0.007 250)')
  expect(
    await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily),
  ).toContain('Instrument Sans Variable')
  expect(
    await page
      .locator(':root')
      .evaluate((root) => getComputedStyle(root).getPropertyValue('--muted-foreground').trim()),
  ).toBe('oklch(43% .03 255)')
  await expect(page.locator('[data-slot="card"]').first()).toHaveCSS(
    'background-color',
    'oklch(0.995 0.002 250)',
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
  await expect(caseRow).toHaveCSS('background-color', 'oklch(0.925 0.035 250)')
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
  const details = page.getByRole('article')
  const titleInput = details.getByLabel('Tytuł')
  await expect(titleInput).toHaveValue(title)
  await titleInput.fill(`${title} unsaved`)
  await page.getByRole('button', { name: 'Odłóż' }).click()
  const unsavedDialog = page.getByRole('dialog', { name: 'Niezapisane zmiany' })
  await expect(unsavedDialog).toBeVisible()
  await unsavedDialog.getByRole('button', { name: 'Zostań przy edycji' }).click()
  await expect(titleInput).toHaveValue(`${title} unsaved`)
  await expect(view).toContainText('Otwarte')
  await page.getByRole('button', { name: 'Odłóż' }).click()
  await unsavedDialog.getByRole('button', { name: 'Odrzuć zmiany' }).click()
  await expect(view).toContainText('Odłożone')
  await expect(caseRow).toContainText('Odłożona')
  await expect(titleInput).toHaveValue(title)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Przywróć' }).click()
  await expect(view).toContainText('Otwarte')
  await expect(page.getByRole('button', { name: 'Odłóż' })).toBeVisible()
  await page.getByRole('button', { name: 'Rozwiąż' }).click()
  await expect(view).toContainText('Zamknięte')
  await expect(page.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  await expect(details).toContainText('Status sprawy: Rozwiązana')
  await expect(details.getByRole('time')).toBeVisible()
  await expect(details.getByRole('region', { name: 'Aktywność' })).toHaveCount(0)
  await details.getByRole('button', { name: 'Pokaż aktywność' }).click()
  const timeline = page.getByRole('region', { name: 'Aktywność' })
  const timelineRows = timeline.getByRole('list', { name: 'Oś czasu sprawy' }).getByRole('listitem')
  await expect(timelineRows).toHaveCount(4)
  await expect(timeline.getByRole('heading', { name: 'Aktywność' })).toBeVisible()
  await timeline.getByLabel('Treść notatki').fill('Ustalenie z testu przeglądarkowego')
  await timeline.getByRole('button', { name: 'Dodaj notatkę' }).click()
  await expect(timeline.getByText('Ustalenie z testu przeglądarkowego')).toBeVisible()
  await expect(timelineRows).toHaveCount(5)
  await expect(page.getByText('Historia statusu')).toHaveCount(0)
  await expect(timelineRows.first()).toHaveClass(/bg-muted/)
  await expect(timelineRows.first()).toHaveClass(/px-3/)
  await expect(timelineRows.first()).toHaveClass(/py-3/)
  await expect(timelineRows.first()).toHaveCSS('border-top-width', '0px')
  await expect(timelineRows.first()).toHaveCSS('border-radius', '14px')
  await timeline.getByRole('button', { name: /Wróć do sprawy/ }).click()
  await expect(details.getByLabel('Tytuł')).toHaveValue(title)
  await expect(details.getByRole('button', { name: 'Pokaż aktywność' })).toBeFocused()
  await page.reload()
  await expect(details).toContainText('Status sprawy: Rozwiązana')
  await expect(details.getByRole('region', { name: 'Aktywność' })).toHaveCount(0)
  await details.getByRole('button', { name: 'Pokaż aktywność' }).click()
  await expect(timeline.getByText('Ustalenie z testu przeglądarkowego')).toBeVisible()
  await expect(timeline).toContainText('Użytkownik zmienił status na Rozwiązana.')
  await expect(timelineRows).toHaveCount(5)
  await expect(page.getByText('Historia statusu')).toHaveCount(0)
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
  await expect(details.getByRole('alert')).toContainText('Lokalny szkic został zachowany')
  await expect(details.getByRole('alert')).toContainText(changedElsewhere)
  await expect(details.getByLabel('Tytuł')).toHaveValue(`${title} local edit`)
  await details.getByRole('button', { name: 'Załaduj wersję z serwera' }).click()
  await expect(details.getByLabel('Tytuł')).toHaveValue(changedElsewhere)
})
