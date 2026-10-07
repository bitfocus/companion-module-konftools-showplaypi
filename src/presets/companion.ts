/** Presets for the Companion on the device: one button per emulator, the web buttons, restart. */
import { CHOOSER } from '../areas/companion.js'
import type ModuleInstance from '../main.js'
import { BLUE, button, GREY, listId, ORANGE, RED, section, variable, type PresetSet } from './helpers.js'

export function companionPresets(self: ModuleInstance): PresetSet {
	const presets: PresetSet['presets'] = {
		companion_chooser: button({
			name: 'Emulator chooser',
			text: 'EMULATOR\nCHOOSER',
			bgcolor: ORANGE,
			keywords: ['emulator', 'chooser'],
			down: [{ actionId: 'companion_emulator', options: { emulator: CHOOSER } }],
		}),
		companion_tablet: button({
			name: 'Web buttons, all pages',
			text: 'WEB\nBUTTONS',
			bgcolor: BLUE,
			keywords: ['tablet', 'web buttons'],
			down: [
				{
					actionId: 'companion_tablet',
					options: { allPages: true, pages: '1', limitGrid: false, columns: 4, rows: 2 },
				},
			],
		}),
		companion_restart: button({
			name: 'Restart Companion on the device',
			text: 'RESTART\nCOMPANION',
			bgcolor: RED,
			keywords: ['restart'],
			down: [{ actionId: 'companion_restart', options: {} }],
		}),
		companion_connections: button({
			name: 'Number of connections and emulators on the device',
			text: `${variable(self, 'companion_connections')} conn.\n${variable(self, 'companion_emulator_count')} emu.`,
			bgcolor: GREY,
			keywords: ['connections', 'status'],
		}),
	}

	const emulatorIds: string[] = []
	for (const emulator of self.emulators) {
		const id = listId('companion_emulator', emulator.id)
		emulatorIds.push(id)
		presets[id] = button({
			name: `Emulator: ${emulator.name}`,
			text: emulator.name,
			bgcolor: BLUE,
			keywords: ['emulator', emulator.name],
			down: [{ actionId: 'companion_emulator', options: { emulator: emulator.id } }],
		})
	}

	return {
		sections: [
			section('companion', 'Companion on the device', [
				{ id: 'companion_views', name: 'Views', presets: ['companion_chooser', 'companion_tablet'] },
				{
					id: 'companion_emulators',
					name: 'Emulators',
					description: 'One button per emulator of the Companion on the device.',
					presets: emulatorIds,
				},
				{ id: 'companion_system', name: 'System', presets: ['companion_restart', 'companion_connections'] },
			]),
		],
		presets,
	}
}
