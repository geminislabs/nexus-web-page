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

	test('apple-app-site-association is served as JSON from the built server', async ({
		request
	}) => {
		const response = await request.get('/.well-known/apple-app-site-association', {
			maxRedirects: 0
		});
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('application/json');
		const body = await response.json();
		expect(body.applinks.details[0].appIDs).toEqual(['GCNV65DKL8.GeminisLabs.INexus']);
	});

	test('assetlinks.json is served as JSON from the built server', async ({ request }) => {
		const response = await request.get('/.well-known/assetlinks.json', { maxRedirects: 0 });
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('application/json');
		const [statement] = await response.json();
		expect(statement.target.package_name).toBe('com.geminislabs.nexus');
	});

	test('invite page opens without a session and points to the app', async ({ page }) => {
		const response = await page.goto('/invite/TOKEN_DE_PRUEBA');
		expect(response?.headers()['referrer-policy']).toBe('no-referrer');
		await expect(page).toHaveURL(/\/invite\/TOKEN_DE_PRUEBA$/);
		await expect(page.getByRole('heading', { name: 'Te invitaron a un equipo' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Abrir en la app' })).toHaveAttribute(
			'href',
			'inexus://invite/TOKEN_DE_PRUEBA'
		);
	});
});
