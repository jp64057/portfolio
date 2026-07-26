import { test, expect } from '@playwright/test'

test.describe('command palette', () => {
  test('opens with Ctrl+K, filters, and closes with Escape', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Command palette' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('combobox').fill('skills')
    await expect(dialog.getByRole('option', { name: /Go to Skills/ })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('can be opened from the Nav trigger button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open command palette' }).click()
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  })
})
