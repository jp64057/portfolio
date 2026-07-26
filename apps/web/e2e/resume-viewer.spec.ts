import { test, expect } from '@playwright/test'

test.describe('résumé viewer', () => {
  test('opens an in-page PDF viewer instead of downloading', async ({ page }) => {
    await page.goto('/')

    // The hero CTA is now "View résumé" (no download).
    await page.getByRole('button', { name: 'View résumé' }).click()

    const dialog = page.getByRole('dialog', { name: 'Résumé viewer' })
    await expect(dialog).toBeVisible()

    // The PDF renders to a canvas (pdf.js). Allow time for lazy-load + render.
    await expect(dialog.locator('canvas').first()).toBeVisible({ timeout: 15000 })

    // Escape closes it and returns to the page.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('does not expose a download control', async ({ page }) => {
    await page.goto('/')
    // No element in the DOM triggers a résumé download anymore.
    await expect(page.locator('a[download]')).toHaveCount(0)
  })
})
