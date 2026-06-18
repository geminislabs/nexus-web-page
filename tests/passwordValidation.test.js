import { describe, it, expect } from 'vitest';
import { validatePassword } from '../src/lib/utils/passwordValidation.js';

describe('validatePassword', () => {
	it('acepta contraseña válida', () => {
		expect(validatePassword('Abcdef1!')).toEqual([]);
	});

	it('reporta reglas faltantes', () => {
		const errors = validatePassword('abc');
		expect(errors).toContain('al menos 8 caracteres');
		expect(errors).toContain('una mayúscula');
		expect(errors).toContain('un número');
		expect(errors).toContain('un carácter especial');
	});

	it('rechaza contraseñas mayores a 72 caracteres', () => {
		const long = `A1!${'a'.repeat(70)}`;
		expect(validatePassword(long)).toContain('máximo 72 caracteres');
	});
});
