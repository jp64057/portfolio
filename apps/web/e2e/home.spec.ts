import { test, expect } from '@playwright/test'

test.describe('home page', () => {
  test('loads with the hero heading and title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Jacob Prue/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Jacob Prue')
  })

  test('nav link scrolls to the projects section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Projects', exact: true }).click()
    await expect(page).toHaveURL(/#projects/)
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeInViewport()
  })

  test('theme toggle switches the document theme class', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/light/)
    await page.getByRole('button', { name: 'Toggle theme' }).click()
    await expect(html).toHaveClass(/dark/)
  })
})
