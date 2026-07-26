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
    await page.getByLabel('Name').fill('Ada Lovelace')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Message').fill('This is a sufficiently long message.')
    await page.getByRole('button', { name: /send message/i }).click()
    await expect(page.getByText('Invalid email address')).toBeVisible()
  })
})
