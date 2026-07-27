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

  test('typing a question offers an Ask-AI action and enters chat mode', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Command palette' })

    await dialog.getByRole('combobox').fill('what is your aws experience')
    const askOption = dialog.getByRole('option', { name: /Ask my résumé/ })
    await expect(askOption).toBeVisible()
    await askOption.click()

    // Now in chat mode: the question shows and an answer resolves (the static
    // test server has no /api/chat, so this is the graceful fallback reply).
    await expect(dialog.getByText('Ask my résumé · esc to exit')).toBeVisible()
    await expect(dialog.getByText('what is your aws experience')).toBeVisible()

    // Esc returns to command mode without closing the palette.
    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('listbox')).toBeVisible()
    await expect(dialog).toBeVisible()
  })
})
