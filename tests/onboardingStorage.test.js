import { describe, it, expect, beforeEach } from 'vitest';
import { isOnboardingComplete, setOnboardingComplete } from '../src/lib/utils/onboardingStorage.js';

describe('onboardingStorage', () => {
	beforeEach(() => {
		localStorage.getItem.mockReturnValue(null);
		localStorage.setItem.mockClear();
	});

	it('isOnboardingComplete is false by default', () => {
		expect(isOnboardingComplete()).toBe(false);
	});

	it('setOnboardingComplete marks flow as done', () => {
		setOnboardingComplete();
		expect(localStorage.setItem).toHaveBeenCalledWith('nexus_onboarding_complete', '1');
	});
});
