/**
 * Building blocks for the presets: one button, a section, and the colours of the demo page that
 * ships with ShowPlayPI.
 */
import {
	combineRgb,
	type CompanionPresetAction,
	type CompanionPresetDefinitions,
	type CompanionPresetFeedback,
	type CompanionPresetSection,
} from '@companion-module/base'
import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'

export type Preset = NonNullable<CompanionPresetDefinitions<ModuleSchema>[string]>
export type PresetAction = CompanionPresetAction<ModuleSchema['actions']>
export type PresetFeedback = CompanionPresetFeedback<ModuleSchema['feedbacks']>
export type Section = CompanionPresetSection<ModuleSchema>

/** The presets of one area, with the sections that arrange them. */
export interface PresetSet {
	sections: Section[]
	presets: CompanionPresetDefinitions<ModuleSchema>
}

export const WHITE = combineRgb(255, 255, 255)
export const BLACK = combineRgb(0, 0, 0)
export const GREY = combineRgb(40, 40, 40)
/** Buttons that stop or restart something */
export const RED = combineRgb(176, 0, 32)
export const GREEN = combineRgb(0, 128, 0)
export const DARK_GREEN = combineRgb(0, 100, 0)
export const AMBER = combineRgb(230, 160, 0)
export const BLUE = combineRgb(0, 102, 204)
export const ORANGE = combineRgb(192, 96, 0)
export const PURPLE = combineRgb(96, 48, 160)

export const ACTIVE = { bgcolor: GREEN, color: WHITE }
export const WARNING = { bgcolor: AMBER, color: BLACK }
export const ALARM = { bgcolor: RED, color: WHITE }

export interface ButtonOptions {
	name: string
	text: string
	bgcolor: number
	color?: number
	/** Actions run when the button is pressed */
	down?: PresetAction[]
	feedbacks?: PresetFeedback[]
	keywords?: string[]
}

export function button(options: ButtonOptions): Preset {
	return {
		type: 'simple',
		name: options.name,
		keywords: options.keywords,
		style: {
			text: options.text,
			size: 'auto',
			color: options.color ?? WHITE,
			bgcolor: options.bgcolor,
			show_topbar: false,
		},
		steps: [{ down: options.down ?? [], up: [] }],
		feedbacks: options.feedbacks ?? [],
	}
}

/**
 * A variable reference for button text. Variables are addressed by the connection's label, which the
 * user can change at any time; building the reference from it keeps presets working after a rename.
 */
export function variable(self: ModuleInstance, name: string): string {
	return `$(${self.label}:${name})`
}

/** A stable, readable preset id for a file or name from one of the device's lists. */
export function listId(prefix: string, name: string): string {
	return `${prefix}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

/** A section with one group per entry of `groups`; groups without presets are left out. */
export function section(
	id: string,
	name: string,
	groups: { id: string; name: string; description?: string; presets: string[] }[],
	description?: string,
): Section {
	return {
		id,
		name,
		description,
		definitions: groups
			.filter((group) => group.presets.length > 0)
			.map((group) => ({
				type: 'simple' as const,
				id: group.id,
				name: group.name,
				description: group.description,
				presets: group.presets,
			})),
	}
}
