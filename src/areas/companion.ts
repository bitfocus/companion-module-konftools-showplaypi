/**
 * Companion mode: Bitfocus Companion runs on the device and the kiosk browser shows one of its views.
 *
 * Only the views are controlled here. Pressing buttons, switching pages or setting variables of that
 * Companion is done through Companion's own interfaces, which ShowPlayPI does not duplicate – and
 * neither does this module.
 */
import type { CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import { optionText } from '../options.js'
import { oscInt, oscString, type OscArgument } from '../osc.js'
import type { Emulator } from '../players.js'

export type CompanionActionsSchema = {
	companion_emulator: { options: { emulator: string } }
	companion_tablet: { options: { allPages: boolean; pages: string; limitGrid: boolean; columns: number; rows: number } }
	companion_restart: { options: Record<string, never> }
}

export type CompanionVariablesSchema = {
	companion_connections: number | undefined
	companion_emulator_count: number
}

/** The dropdown value for the emulator chooser (Companion's page that lists all emulators). */
export const CHOOSER = ''

/** The largest grid ShowPlayPI accepts for the tablet view. */
export const MAX_GRID = 32

export function emulatorChoices(emulators: Emulator[]): DropdownChoice<string>[] {
	return [
		{ id: CHOOSER, label: 'Emulator chooser (list of all emulators)' },
		...emulators.map((emulator) => ({
			id: emulator.id,
			label:
				emulator.columns && emulator.rows ? `${emulator.name} (${emulator.columns} × ${emulator.rows})` : emulator.name,
		})),
	]
}

/** Page numbers as ShowPlayPI wants them: "3" or "1,2" – or nothing if the text is not a page list. */
export function pageList(text: unknown): string | undefined {
	const pages = optionText(text).replace(/\s+/g, '')
	return /^\d+(,\d+)*$/.test(pages) ? pages : undefined
}

/** The arguments of /showplaypi/companion/tablet, or undefined if the options make no sense. */
export function tabletArgs(
	options: Partial<CompanionActionsSchema['companion_tablet']['options']>,
): OscArgument[] | undefined {
	const args: OscArgument[] = []
	if (!options.allPages) {
		const pages = pageList(options.pages)
		if (!pages) return undefined
		args.push(oscString(pages))
	}
	// Columns and rows follow the page list, so ShowPlayPI only takes them together with one
	if (options.limitGrid && args.length > 0) {
		const columns = Math.round(Number(options.columns))
		const rows = Math.round(Number(options.rows))
		if (!(columns >= 1 && columns <= MAX_GRID && rows >= 1 && rows <= MAX_GRID)) return undefined
		args.push(oscInt(columns), oscInt(rows))
	}
	return args
}

export function companionActions(self: ModuleInstance): CompanionActionDefinitions<CompanionActionsSchema> {
	return {
		companion_emulator: {
			name: 'Companion: show emulator',
			description:
				'Shows an emulator of the Companion running on the device, or the chooser that lists them. ' +
				'Until the device restarts; afterwards the chooser is shown again.',
			options: [
				{
					type: 'dropdown',
					id: 'emulator',
					label: 'Emulator',
					tooltip: 'The list comes from the device. A name or ID can also be typed in.',
					default: CHOOSER,
					choices: emulatorChoices(self.emulators),
					allowCustom: true,
				},
			],
			callback: (action) => {
				const emulator = optionText(action.options.emulator)
				self.send('/showplaypi/companion/emulator', emulator ? [oscString(emulator)] : [])
			},
		},
		companion_tablet: {
			name: 'Companion: show web buttons',
			description:
				'Shows the web buttons view of the Companion on the device: all pages, or only some, ' +
				'optionally cut down to a grid of columns × rows for a small touch screen. Until the device restarts.',
			options: [
				{
					type: 'checkbox',
					id: 'allPages',
					label: 'All pages',
					default: true,
					disableAutoExpression: true,
				},
				{
					type: 'textinput',
					id: 'pages',
					label: 'Pages (e.g. 3 or 1,2)',
					default: '1',
					useVariables: true,
					isVisibleExpression: '!$(options:allPages)',
				},
				{
					type: 'checkbox',
					id: 'limitGrid',
					label: 'Limit the grid',
					tooltip: 'Only together with a page list. Shows the top left columns × rows buttons of each page.',
					default: false,
					disableAutoExpression: true,
					isVisibleExpression: '!$(options:allPages)',
				},
				{
					type: 'number',
					id: 'columns',
					label: 'Columns',
					default: 4,
					min: 1,
					max: MAX_GRID,
					isVisibleExpression: '!$(options:allPages) && $(options:limitGrid)',
				},
				{
					type: 'number',
					id: 'rows',
					label: 'Rows',
					default: 2,
					min: 1,
					max: MAX_GRID,
					isVisibleExpression: '!$(options:allPages) && $(options:limitGrid)',
				},
			],
			callback: (action) => {
				const args = tabletArgs(action.options)
				if (!args) {
					self.log('warn', 'Not sent: the web buttons view needs a page list such as "3" or "1,2"')
					return
				}
				self.send('/showplaypi/companion/tablet', args)
			},
		},
		companion_restart: {
			name: 'Companion: restart',
			description: 'Restarts the Companion on the device, e.g. if it hangs. The browser reconnects by itself.',
			options: [],
			callback: () => self.send('/showplaypi/companion/restart'),
		},
	}
}

export function companionVariableDefinitions(): Record<keyof CompanionVariablesSchema, { name: string }> {
	return {
		companion_connections: { name: 'Companion: number of connections on the device' },
		companion_emulator_count: { name: 'Companion: number of emulators' },
	}
}

export function companionVariableValues(self: ModuleInstance): CompanionVariablesSchema {
	return {
		companion_connections: self.system?.companionConnections,
		companion_emulator_count: self.emulators.length,
	}
}
