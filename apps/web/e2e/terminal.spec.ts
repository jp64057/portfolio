import { test, expect } from '@playwright/test'

// reducedMotion is 'reduce' (playwright.config), so TerminalHero boots straight
// to the interactive prompt without the typing animation.
test.describe('interactive terminal', () => {
  test('`help` lists available commands', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('Terminal command input')
    await input.fill('help')
    await input.press('Enter')
    await expect(page.getByText('Available commands:')).toBeVisible()
  })

  test('unknown command shows a not-found hint', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('Terminal command input')
    await input.fill('definitelynotacommand')
    await input.press('Enter')
    await expect(page.getByText(/command not found: definitelynotacommand/)).toBeVisible()
  })

  test('tappable command chip runs a command', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'about', exact: true }).click()
    // This line is unique to the `about` output (the boot banner also mentions
    // the job title, which would otherwise match twice).
    await expect(page.getByText(/scalable, cloud-native systems/)).toBeVisible()
  })

  test('Tab autocompletes a command name', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('Terminal command input')
    await input.fill('ab')
    await input.press('Tab')
    await expect(input).toHaveValue('about ')
  })

  test('`echo` prints its arguments back', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('Terminal command input')
    await input.fill('echo hello world')
    await input.press('Enter')
    await expect(page.getByText('hello world', { exact: true })).toBeVisible()
  })

  test('`sudo` returns the classic easter-egg message', async ({ page }) => {
    await page.goto('/')
    const input = page.getByLabel('Terminal command input')
    await input.fill('sudo rm -rf /')
    await input.press('Enter')
    await expect(page.getByText(/sudoers file/)).toBeVisible()
  })
})
