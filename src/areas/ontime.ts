/**
 * Ontime mode: an Ontime server runs on the device and the kiosk browser shows one of its views.
 */
import type { CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import { oscString } from '../osc.js'

export type OntimeActionsSchema = {
	ontime_view: { options: { view: string; parameters: string } }
}

/** The views named in ShowPlayPI's OSC reference; others can be typed in. */
export const ONTIME_VIEWS: DropdownChoice<string>[] = [
	{ id: 'timer', label: 'Timer' },
	{ id: 'backstage', label: 'Backstage' },
	{ id: 'countdown', label: 'Countdown' },
	{ id: 'studio', label: 'Studio clock' },
	{ id: 'timeline', label: 'Timeline' },
	{ id: 'cuesheet', label: 'Cuesheet' },
	{ id: 'op', label: 'Operator' },
]

/** ShowPlayPI accepts view names of letters, digits, hyphens and underscores. */
export function isViewName(view: string): boolean {
	return /^[A-Za-z0-9_-]+$/.test(view)
}

export function ontimeActions(self: ModuleInstance): CompanionActionDefinitions<OntimeActionsSchema> {
	return {
		ontime_view: {
			name: 'Ontime: show view',
			description:
				'Shows a view of the Ontime server on the device, until the device restarts. The settings ' +
				'are the options of the view, as Ontime shows them in the address after the "?" when you ' +
				'change them in the settings panel of the view.',
			options: [
				{
					type: 'dropdown',
					id: 'view',
					label: 'View',
					default: 'timer',
					choices: ONTIME_VIEWS,
					allowCustom: true,
					regex: '/^[A-Za-z0-9_-]+$/',
				},
				{
					type: 'textinput',
					id: 'parameters',
					label: 'Settings (optional)',
					tooltip: 'e.g. stopCycle=true&extra-info=0-Custom+data',
					default: '',
					useVariables: true,
				},
			],
			callback: (action) => {
				const view = String(action.options.view ?? '')
					.trim()
					.replace(/^\/+|\/+$/g, '')
				if (!isViewName(view)) {
					self.log('warn', `Not sent: invalid Ontime view name "${view}"`)
					return
				}
				const parameters = String(action.options.parameters ?? '')
					.trim()
					.replace(/^\?/, '')
				self.send('/showplaypi/ontime/view', parameters ? [oscString(view), oscString(parameters)] : [oscString(view)])
			},
		},
	}
}
