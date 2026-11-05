import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully and redirect to dashboard', async ({ page }) => {
    // Go to the login page
    await page.goto('/login');

    // Expect a title or heading
    await expect(page).toHaveTitle(/SYGIM/i);

    // Fill in the login form (Assuming standard admin credentials for E2E testing)
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'Admin2026!');

    // Click the submit button
    await page.click('button:has-text("Se connecter")');

    // Should redirect to dashboard (we wait for URL to contain /dashboard)
    await page.waitForURL('**/dashboard');

    // Check if some dashboard element is visible
    // We assume there's a heading or an element containing 'Tableau de bord' or similar
    await expect(page.locator('text=Tableau de bord')).toBeVisible({ timeout: 10000 });
  });

  test('should fail login with incorrect credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="text"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button:has-text("Se connecter")');

    // Should show error message (assuming the UI displays an error toaster or text)
    // We check for typical error keywords or roles
    await expect(page.locator('text=Identifiants invalides').or(page.locator('[role="alert"]'))).toBeVisible();
    
    // URL should still be /login
    expect(page.url()).toContain('/login');
  });
});
