import { test, expect } from '@playwright/test'

test.describe('contact form validation', () => {
  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/#contact')
    await page.getByRole('button', { name: /send message/i }).click()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Invalid email address')).toBeVisible()
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible()
  })

  test('rejects an invalid email', async ({ page }) => {
    await page.goto('/#contact')
    // Scope to the contact section — the guestbook form also has Name/Message.
    const form = page.locator('#contact')
    await form.getByLabel('Name').fill('Ada Lovelace')
    await form.getByLabel('Email').fill('not-an-email')
    await form.getByLabel('Message').fill('This is a sufficiently long message.')
    await form.getByRole('button', { name: /send message/i }).click()
    await expect(page.getByText('Invalid email address')).toBeVisible()
  })
})
