import { expect, type Locator, test } from '@playwright/test'

test('redirects the former home page to cases', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/cases(?:\?.*)?$/)
  await expect(page.getByRole('link', { name: 'Yet Another Company — sprawy' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Sprawy' })).toBeVisible()
  await expect(page.getByText('Sprawy bez utraconego kontekstu.')).toHaveCount(0)
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
  const detailTitle = page.getByRole('heading', { level: 1, name: 'Mobile case 12' })
  await expect(detailTitle).toBeVisible()
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
    status: 'open',
    title: `Mobile case ${index}`,
    updatedAt: '2026-08-20T10:00:00.000Z',
    version: 1,
  }
}
