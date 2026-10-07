/** Presets that work in every mode: blackout and the device. */
import type ModuleInstance from '../main.js'
import {
	ALARM,
	BLACK,
	button,
	DARK_GREEN,
	GREY,
	section,
	variable,
	WARNING,
	type PresetFeedback,
	type PresetSet,
} from './helpers.js'

export function generalPresets(self: ModuleInstance): PresetSet {
	const v = (name: string) => variable(self, name)
	// The blackout state is only reported by the video player so far
	const blackoutFeedback: PresetFeedback[] = self.areas.has('video')
		? [{ feedbackId: 'blackout', options: {}, style: ALARM }]
		: []

	return {
		sections: [
			section('general', 'General', [
				{ id: 'general_blackout', name: 'Blackout', presets: ['blackout_on', 'blackout_off'] },
				{ id: 'general_device', name: 'Device', presets: ['device_connection', 'device_load', 'device_time'] },
			]),
		],
		presets: {
			blackout_on: button({
				name: 'Blackout on',
				text: 'BLACK\nOUT',
				bgcolor: BLACK,
				keywords: ['black', 'picture'],
				down: [{ actionId: 'blackout', options: { state: 'on', useFade: false, fade: 1 } }],
				feedbacks: blackoutFeedback,
			}),
			blackout_off: button({
				name: 'Picture on (blackout off)',
				text: 'PICTURE\nON',
				bgcolor: DARK_GREEN,
				keywords: ['black', 'picture'],
				down: [{ actionId: 'blackout', options: { state: 'off', useFade: false, fade: 1 } }],
			}),
			device_connection: button({
				name: 'Connection and mode (red while the device does not answer)',
				text: `ShowPlayPI\n${v('mode')}`,
				bgcolor: GREY,
				keywords: ['status', 'connected'],
				feedbacks: [{ feedbackId: 'connected', options: {}, style: ALARM, isInverted: true }],
			}),
			device_load: button({
				name: 'CPU, memory and temperature (amber on a memory warning, red when critical)',
				text: `CPU ${v('cpu')}%\nRAM ${v('ram_percent')}%\n${v('temperature')} °C`,
				bgcolor: GREY,
				keywords: ['status', 'cpu', 'memory', 'temperature'],
				feedbacks: [
					{ feedbackId: 'ram_state', options: { level: 'warning' }, style: WARNING },
					{ feedbackId: 'ram_state', options: { level: 'critical' }, style: ALARM },
					{ feedbackId: 'throttled', options: { kind: 'undervoltage' }, style: ALARM },
				],
			}),
			device_time: button({
				name: 'Uptime and clock (amber while the clock is not synchronised)',
				text: `Up ${v('uptime')}\n${v('time_source')}`,
				bgcolor: GREY,
				keywords: ['status', 'uptime', 'clock', 'time'],
				feedbacks: [{ feedbackId: 'time_not_synchronized', options: {}, style: WARNING }],
			}),
		},
	}
}
