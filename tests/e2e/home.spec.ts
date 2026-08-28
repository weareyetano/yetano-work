import { expect, type Locator, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/activities/**', (route) =>
    route.fulfill({ contentType: 'application/json', json: { items: [], nextCursor: null } }),
  )
})

test('redirects the former home page to cases', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/cases(?:\?.*)?$/)
  await expect(page.getByRole('link', { name: 'Yet Another Company' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sprawy' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toHaveClass(/sr-only/)
  await expect(page.getByText('Sprawy bez utraconego kontekstu.')).toHaveCount(0)
})

test('derives the active module from the current route', async ({ page }) => {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/settings')

  const cases = page.getByRole('link', { name: 'Sprawy' })
  await expect(cases).not.toHaveAttribute('aria-current')

  await cases.click()

  await expect(page).toHaveURL(/\/cases$/)
  await expect(cases).toHaveAttribute('aria-current', 'page')
})

test('centers module navigation and keeps placeholder modules on the cases route', async ({
  page,
}) => {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/cases')

  const navigation = page.getByRole('navigation', { name: 'Moduły' })
  const navigationBox = await navigation.boundingBox()
  expect(navigationBox).not.toBeNull()
  expect(Math.abs((navigationBox?.x ?? 0) + (navigationBox?.width ?? 0) / 2 - 720)).toBeLessThan(1)

  const initialUrl = page.url()
  const tasks = page.getByRole('button', { name: 'Zadania' })
  await tasks.click()

  await expect(page).toHaveURL(initialUrl)
  await expect(page.getByRole('dialog', { name: 'To tylko atrapa' })).toContainText(
    'Moduł „Zadania”',
  )

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tasks).toBeFocused()
})

test('uses compact module navigation below 1280px without horizontal overflow', async ({
  page,
}) => {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.setViewportSize({ height: 844, width: 320 })
  await page.goto('/cases')

  const navigation = page.getByRole('navigation', { name: 'Moduły' })
  const navigationBox = await navigation.boundingBox()
  expect(navigationBox).not.toBeNull()
  expect(navigationBox?.x).toBeGreaterThanOrEqual(0)
  expect((navigationBox?.x ?? 0) + (navigationBox?.width ?? 0)).toBeLessThanOrEqual(320)

  const trigger = page.getByRole('button', { name: 'Wybierz moduł, aktualnie: Sprawy' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toContainText('Sprawy')
  await expect(page.getByRole('link', { name: 'Sprawy' })).toHaveCount(0)
  await trigger.click()
  await expect(page.getByRole('menuitemradio')).toHaveCount(3)
  await page.getByRole('menuitemradio', { name: 'Wiadomości' }).click()

  await expect(page.getByRole('dialog', { name: 'To tylko atrapa' })).toContainText(
    'Moduł „Wiadomości”',
  )
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()

  for (const width of [768, 1279]) {
    await page.setViewportSize({ height: 844, width })
    await expect(trigger).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sprawy' })).toHaveCount(0)
  }

  await page.setViewportSize({ height: 844, width: 1280 })
  await expect(page.getByRole('link', { name: 'Sprawy' })).toBeVisible()
  await expect(trigger).toHaveCount(0)

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )
})

test('grows the case list while details fill the remaining space on wide screens', async ({
  page,
}) => {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )

  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/cases')

  const workspace = page.locator('main > section')
  const desktopColumns = await gridColumnWidths(workspace)
  expect(desktopColumns[1]).toBeGreaterThan(desktopColumns[0])

  await page.setViewportSize({ height: 900, width: 2560 })

  const ultrawideColumns = await gridColumnWidths(workspace)
  const ultrawideWorkspace = await workspace.boundingBox()
  expect(ultrawideWorkspace).not.toBeNull()
  expect(ultrawideWorkspace?.width).toBeLessThanOrEqual(1600)
  expect(ultrawideWorkspace?.x).toBeGreaterThan(400)
  expect(ultrawideColumns[0]).toBeGreaterThan(desktopColumns[0])
  expect(ultrawideColumns[1]).toBeGreaterThan(ultrawideColumns[0])
})

test('keeps desktop creation in the URL and cancels back to the previous case', async ({
  page,
}) => {
  const caseItem = mobileCase(1)
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [caseItem], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.goto('/cases')

  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(caseItem.title)
  await page.getByRole('button', { name: 'Dodaj sprawę' }).click()
  await expect(page).toHaveURL(/mode=new/)
  const createForm = page.getByRole('form', { name: 'Nowa sprawa' })
  await createForm.getByLabel('Tytuł').fill('Niezapisany szkic')

  await page.reload()

  await expect(page).toHaveURL(/mode=new/)
  await expect(page.getByRole('form', { name: 'Nowa sprawa' }).getByLabel('Tytuł')).toHaveValue('')
  await page
    .getByRole('form', { name: 'Nowa sprawa' })
    .getByRole('button', { name: 'Anuluj' })
    .click()

  await expect(page).toHaveURL(new RegExp(`caseId=${caseItem.id}`))
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(caseItem.title)
  await expect(page.getByRole('button', { name: 'Dodaj sprawę' })).toBeFocused()
})

test('opens mobile creation in place and restores the list through both back controls', async ({
  page,
}) => {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: [], nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.setViewportSize({ height: 900, width: 616 })
  await page.goto('/cases')

  const listTitle = page.getByRole('heading', { level: 1, name: 'Sprawy' })
  const add = page.getByRole('button', { name: 'Dodaj sprawę' })
  await add.click()

  await expect(page).toHaveURL(/mode=new/)
  await expect(listTitle).toBeHidden()
  await expect(page.getByRole('form', { name: 'Nowa sprawa' })).toBeVisible()
  await expect(page.getByLabel('Tytuł')).toBeFocused()

  await page.goBack()

  await expect(page).toHaveURL(/\/cases$/)
  await expect(listTitle).toBeVisible()
  await expect(add).toBeFocused()

  await add.click()
  await page.getByRole('button', { name: 'Wróć do listy spraw' }).click()

  await expect(page).toHaveURL(/\/cases$/)
  await expect(listTitle).toBeVisible()
  await expect(add).toBeFocused()
})

test('opens mobile case details in place and restores the list through both back controls', async ({
  page,
}) => {
  const cases = Array.from({ length: 12 }, (_, index) => mobileCase(index + 1))
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ items: cases, nextCursor: null }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.setViewportSize({ height: 900, width: 616 })
  await page.goto('/cases')

  const listTitle = page.getByRole('heading', { level: 1, name: 'Sprawy' })
  const targetCase = page.getByRole('button', { name: /Mobile case 12/ })
  await targetCase.scrollIntoViewIfNeeded()
  const listScrollPosition = await page.evaluate(() => window.scrollY)

  await targetCase.click()

  await expect(page).toHaveURL(new RegExp(`caseId=${cases[11]?.id}`))
  await expect(listTitle).toBeHidden()
  const detailTitle = page.getByRole('article').getByLabel('Tytuł')
  await expect(detailTitle).toHaveValue('Mobile case 12')
  await expect(detailTitle).toBeFocused()
  const detailBox = await detailTitle.boundingBox()
  expect(detailBox).not.toBeNull()
  expect(detailBox?.y).toBeGreaterThanOrEqual(0)
  expect(detailBox?.y).toBeLessThan(900)

  await page.goBack()

  await expect(page).toHaveURL(/\/cases$/)
  await expect(listTitle).toBeVisible()
  await expect(targetCase).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listScrollPosition)

  await targetCase.click()
  const back = page.getByRole('button', { name: 'Wróć do listy spraw' })
  await expect(back).toBeVisible()
  await expect(back).toHaveText('')
  await back.click()

  await expect(page).toHaveURL(/\/cases$/)
  await expect(listTitle).toBeVisible()
  await expect(targetCase).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listScrollPosition)
})

async function gridColumnWidths(locator: Locator) {
  return locator.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').map(Number.parseFloat),
  )
}

function mobileCase(index: number) {
  return {
    closedAt: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    customerId: null,
    description: `Mobile case ${index} description`,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
    status: 'new',
    statusNote: null,
    title: `Mobile case ${index}`,
    updatedAt: '2026-08-20T10:00:00.000Z',
    version: 1,
  }
}
