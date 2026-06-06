const ONBOARDING_KEY = 'nexus_onboarding_complete';

export function isOnboardingComplete() {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function setOnboardingComplete() {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(ONBOARDING_KEY, '1');
}
