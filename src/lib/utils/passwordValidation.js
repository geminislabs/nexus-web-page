/** @param {string} password */
export function validatePassword(password) {
	const errors = [];
	if (!password || password.length < 8) errors.push('al menos 8 caracteres');
	if (password && password.length > 72) errors.push('máximo 72 caracteres');
	if (!/[A-Z]/.test(password)) errors.push('una mayúscula');
	if (!/\d/.test(password)) errors.push('un número');
	if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\];~]/.test(password)) errors.push('un carácter especial');
	return errors;
}
