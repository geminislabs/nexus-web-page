import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// no-useless-assignment (ESLint 10 / @eslint/js 10) analiza el script
		// como JS plano y no ve que un bloque `$:` se re-ejecuta cuando cambian
		// sus dependencias: el patrón "recordar el valor anterior" (asignar a
		// una variable que el propio bloque lee en la siguiente pasada, p.ej.
		// para resetear estado solo cuando cambia un id) le parece codigo
		// muerto y no lo es. Falso positivo confirmado en 6 componentes al
		// subir a @eslint/js 10; los .js planos no tienen este problema y
		// siguen con la regla activa.
		files: ['**/*.svelte'],
		rules: {
			'no-useless-assignment': 'off'
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'coverage/',
			'test-results/',
			'playwright-report/',
			'e2e/'
		]
	}
];
