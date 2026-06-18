import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
	test('root redirects first-time visitors to onboarding', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/onboarding$/);
	});

	test('login page shows sign-in UI when onboarding is complete', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('nexus_onboarding_complete', '1'));
		await page.goto('/login');
		await expect(page).toHaveTitle(/NEXUS — Iniciar sesión/i);
		await expect(page.getByRole('heading', { name: 'NEXUS' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
	});
});
