import type { CompanionPresetDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'
import { audioPresets } from './presets/audio.js'
import { browserPresets, ontimePresets } from './presets/browser.js'
import { companionPresets } from './presets/companion.js'
import { generalPresets } from './presets/general.js'
import type { PresetSet, Section } from './presets/helpers.js'
import { videoPresets } from './presets/video.js'

/**
 * The presets of the areas active right now, one section per area. Buttons for files, playlists and
 * emulators come from the lists the device sends, so this runs again whenever a list changes.
 */
export function UpdatePresets(self: ModuleInstance): void {
	const sets: PresetSet[] = [generalPresets(self)]
	if (self.areas.has('browser')) sets.push(browserPresets(self))
	if (self.areas.has('ontime')) sets.push(ontimePresets(self))
	if (self.areas.has('companion')) sets.push(companionPresets(self))
	if (self.areas.has('video')) sets.push(videoPresets(self))
	if (self.areas.has('audio')) sets.push(audioPresets(self))

	const structure: Section[] = []
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}
	for (const set of sets) {
		structure.push(...set.sections)
		Object.assign(presets, set.presets)
	}

	self.setPresetDefinitions(structure, presets)
}
