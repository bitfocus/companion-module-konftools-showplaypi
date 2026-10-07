/** Presets for the kiosk browser and the Ontime views – the demo page of ShowPlayPI, extended. */
import { ONTIME_VIEWS } from '../areas/ontime.js'
import type ModuleInstance from '../main.js'
import { BLUE, button, GREEN, ORANGE, PURPLE, RED, section, type PresetSet } from './helpers.js'

export function browserPresets(_self: ModuleInstance): PresetSet {
	return {
		sections: [
			section('browser', 'Browser', [
				{
					id: 'browser_pages',
					name: 'Pages',
					presets: ['browser_url', 'browser_home', 'browser_refresh', 'browser_restart'],
				},
				{ id: 'browser_idle', name: 'Idle timeout', presets: ['browser_idle_off', 'browser_idle_2min'] },
			]),
		],
		presets: {
			browser_url: button({
				name: 'Show a web page (edit the address in the action)',
				text: 'OPEN\nURL',
				bgcolor: BLUE,
				keywords: ['url', 'page', 'website'],
				down: [{ actionId: 'browser_url', options: { url: 'https://example.com' } }],
			}),
			browser_home: button({
				name: 'Start page',
				text: 'HOME',
				bgcolor: ORANGE,
				keywords: ['home', 'start page'],
				down: [{ actionId: 'browser_home', options: {} }],
			}),
			browser_refresh: button({
				name: 'Reload the page',
				text: 'REFRESH',
				bgcolor: GREEN,
				keywords: ['reload'],
				down: [{ actionId: 'browser_refresh', options: {} }],
			}),
			browser_restart: button({
				name: 'Restart the browser',
				text: 'RE\nSTART',
				bgcolor: RED,
				keywords: ['chromium'],
				down: [{ actionId: 'browser_restart', options: {} }],
			}),
			browser_idle_off: button({
				name: 'Idle timeout off',
				text: 'IDLE\nOFF',
				bgcolor: PURPLE,
				keywords: ['idle', 'timeout'],
				down: [{ actionId: 'browser_idle', options: { seconds: 0 } }],
			}),
			browser_idle_2min: button({
				name: 'Idle timeout 2 minutes',
				text: 'IDLE\n2 MIN',
				bgcolor: PURPLE,
				keywords: ['idle', 'timeout'],
				down: [{ actionId: 'browser_idle', options: { seconds: 120 } }],
			}),
		},
	}
}

export function ontimePresets(_self: ModuleInstance): PresetSet {
	const presets: PresetSet['presets'] = {}
	const ids: string[] = []

	for (const view of ONTIME_VIEWS) {
		const id = `ontime_view_${view.id}`
		ids.push(id)
		presets[id] = button({
			name: `Ontime: ${view.label}`,
			text: `Ontime\n${view.label}`,
			bgcolor: BLUE,
			keywords: ['ontime', 'view', view.id],
			down: [{ actionId: 'ontime_view', options: { view: view.id, parameters: '' } }],
		})
	}

	return {
		sections: [section('ontime', 'Ontime', [{ id: 'ontime_views', name: 'Views', presets: ids }])],
		presets,
	}
}
