import { describe, it, expect } from 'vitest';
import {
	getGpsIndicator,
	getCellularIndicator,
	inferNetworkTech,
	rxLvlToDbm,
	networkTechLabel
} from '../src/lib/utils/signalIndicators.js';

describe('getGpsIndicator', () => {
	it('clasifica satélites según la propuesta', () => {
		expect(getGpsIndicator(0)?.label).toBe('Sin señal');
		expect(getGpsIndicator(0)?.bars).toBe(1);
		expect(getGpsIndicator(3)?.label).toBe('Bajo');
		expect(getGpsIndicator(6)?.label).toBe('Regular');
		expect(getGpsIndicator(9)?.label).toBe('Bueno');
		expect(getGpsIndicator(14)?.label).toBe('Excelente');
		expect(getGpsIndicator(14)?.detail).toBe('14 Sat');
	});

	it('incluye fix en detalle técnico', () => {
		expect(getGpsIndicator(12, { fixStatus: 'VALID' })?.tech.Fix).toBe('VALID');
	});
});

describe('inferNetworkTech', () => {
	it('detecta 2G y LTE desde delivery_type', () => {
		expect(inferNetworkTech({ deliveryType: 'GPRS' })).toBe('2g');
		expect(inferNetworkTech({ delivery_type: 'LTE' })).toBe('lte');
		expect(inferNetworkTech({})).toBe('lte');
	});
});

describe('getCellularIndicator + rxLvlToDbm', () => {
	it('2G: ejemplos de la propuesta', () => {
		expect(rxLvlToDbm(10, '2g')).toBe(-101);
		expect(rxLvlToDbm(25, '2g')).toBe(-86);
		expect(rxLvlToDbm(38, '2g')).toBe(-73);

		expect(getCellularIndicator(10, '2g')?.label).toBe('Bajo');
		expect(getCellularIndicator(25, '2g')?.label).toBe('Regular');
		expect(getCellularIndicator(38, '2g')?.label).toBe('Bueno');
		expect(getCellularIndicator(50, '2g')?.label).toBe('Excelente');
	});

	it('LTE: ejemplos de la propuesta', () => {
		expect(rxLvlToDbm(12, 'lte')).toBe(-93);
		expect(rxLvlToDbm(25, 'lte')).toBe(-80);
		expect(rxLvlToDbm(38, 'lte')).toBe(-67);
		expect(rxLvlToDbm(52, 'lte')).toBe(-53);

		expect(getCellularIndicator(12, 'lte')?.label).toBe('Bajo');
		expect(getCellularIndicator(25, 'lte')?.label).toBe('Regular');
		expect(getCellularIndicator(52, 'lte')?.label).toBe('Excelente');
		expect(getCellularIndicator(52, 'lte')?.detail).toContain('-53');
	});

	it('usa deliveryType del vehículo para etiquetar tecnología', () => {
		const ind = getCellularIndicator(25, { deliveryType: 'GPRS' });
		expect(ind?.tech.Tecnología).toBe('2G');
		expect(networkTechLabel('lte')).toBe('LTE');
	});
});
