import { describe, it, expect } from 'vitest';
import {
	httpUrlToWebSocketUrl,
	parsePositionStreamMessage
} from '../src/lib/services/vehiclePositionStream.js';

describe('vehiclePositionStream', () => {
	it('httpUrlToWebSocketUrl maps http/https to ws/wss', () => {
		expect(httpUrlToWebSocketUrl('http://localhost:8000')).toBe('ws://localhost:8000/');
		expect(httpUrlToWebSocketUrl('https://api.example.com')).toBe('wss://api.example.com/');
		expect(httpUrlToWebSocketUrl('ws://localhost:8000')).toBe('ws://localhost:8000');
	});

	it('parsePositionStreamMessage extracts nested Kafka position', () => {
		const pos = parsePositionStreamMessage({
			event: 'message',
			data: {
				data: {
					device_id: '867564050638581',
					latitude: 19.43,
					longitude: -99.13,
					speed: 42
				}
			}
		});

		expect(pos).toEqual({
			deviceId: '867564050638581',
			latitude: 19.43,
			longitude: -99.13,
			speed: 42
		});
	});

	it('parsePositionStreamMessage ignores ping and alerts', () => {
		expect(parsePositionStreamMessage({ event: 'ping', data: {} })).toBeNull();
		expect(
			parsePositionStreamMessage({
				event: 'alert',
				data: { message_type: 'alert', data: { device_id: 'x' } }
			})
		).toBeNull();
	});
});
