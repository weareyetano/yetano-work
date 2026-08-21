import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const caseItem = {
  closedAt: null,
  createdAt: '2026-08-20T08:00:00.000Z',
  customerId: null,
  description: 'Opis sprawy używany w teście dostępności.',
  id: '122c8615-6bcd-4a36-90e6-d18ca0c06928',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  status: 'new',
  statusNote: null,
  title: 'Dostępna sprawa',
  updatedAt: '2026-08-20T08:00:00.000Z',
  version: 1,
}

test('empty cases workspace has no detectable WCAG A or AA violations', async ({ page }) => {
  await mockCaseList(page, { items: [], nextCursor: null })
  await page.goto('/cases')

  await expect(page.getByText('Brak nowych spraw.')).toBeVisible()
  await expectNoWcagViolations(page)
})

test('populated cases workspace supports keyboard selection and WCAG checks', async ({ page }) => {
  await mockCaseList(page, { items: [caseItem], nextCursor: null })
  await page.goto('/cases')

  const caseRow = page.getByRole('button', { name: /Dostępna sprawa/ })
  await expect(caseRow).toBeVisible()
  await caseRow.focus()
  await page.keyboard.press('Space')

  await expect(caseRow).toBeFocused()
  await expect(caseRow).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('article').getByLabel('Tytuł')).toHaveValue(caseItem.title)
  await expectNoWcagViolations(page)
})

test('case creation panel supports keyboard entry and WCAG checks', async ({ page }) => {
  await mockCaseList(page, { items: [], nextCursor: null })
  await page.goto('/cases')

  const add = page.getByRole('button', { name: 'Dodaj sprawę' })
  await add.focus()
  await page.keyboard.press('Space')

  await expect(page).toHaveURL(/mode=new/)
  await expect(page.getByRole('form', { name: 'Nowa sprawa' })).toBeVisible()
  await expect(page.getByLabel('Tytuł')).toBeFocused()
  await expectNoWcagViolations(page)
})

test('error state has no detectable WCAG A or AA violations on mobile', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify({ status: 500, title: 'Błąd serwera', type: 'about:blank' }),
      contentType: 'application/problem+json',
      status: 500,
    }),
  )
  await page.goto('/cases')

  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  )
  await expectNoWcagViolations(page)
})

async function mockCaseList(page: Page, response: unknown) {
  await page.route('**/api/v1/cases**', (route) =>
    route.fulfill({
      body: JSON.stringify(
        new URL(route.request().url()).pathname.endsWith('/status-history')
          ? { items: [], nextCursor: null }
          : response,
      ),
      contentType: 'application/json',
      status: 200,
    }),
  )
}

async function expectNoWcagViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
}
