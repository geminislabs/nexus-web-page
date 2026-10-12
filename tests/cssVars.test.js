import { describe, it, expect } from 'vitest';
import { brandVars, swatch } from '../src/lib/actions/cssVars.js';

describe('brandVars', () => {
	it('escribe las variables por CSSOM, sin atributo style en el HTML de origen', () => {
		const node = document.createElement('div');
		brandVars(node, { '--color-brand-primary': '#0e7490', '--color-brand-on-primary': '#ffffff' });
		expect(node.style.getPropertyValue('--color-brand-primary')).toBe('#0e7490');
		expect(node.style.getPropertyValue('--color-brand-on-primary')).toBe('#ffffff');
	});

	it('al actualizar, quita las que ya no vienen', () => {
		const node = document.createElement('div');
		const action = brandVars(node, {
			'--color-brand-primary': '#0e7490',
			'--color-brand-accent': '#f59e0b'
		});
		action.update({ '--color-brand-primary': '#1d4ed8' });
		expect(node.style.getPropertyValue('--color-brand-primary')).toBe('#1d4ed8');
		expect(node.style.getPropertyValue('--color-brand-accent')).toBe('');

		action.update(null);
		expect(node.style.getPropertyValue('--color-brand-primary')).toBe('');
	});

	it('no escribe nada que no sea --color-brand-* con un #rrggbb', () => {
		const node = document.createElement('div');
		brandVars(node, { '--color-brand-link': 'red', color: '#ffffff' });
		expect(node.style.getPropertyValue('--color-brand-link')).toBe('');
		expect(node.style.getPropertyValue('color')).toBe('');
	});
});

describe('swatch', () => {
	it('pinta el fondo y lo quita si el color no es válido', () => {
		const node = document.createElement('span');
		const action = swatch(node, '#0e7490');
		expect(node.style.getPropertyValue('background-color')).not.toBe('');
		action.update('nada');
		expect(node.style.getPropertyValue('background-color')).toBe('');
	});
});
