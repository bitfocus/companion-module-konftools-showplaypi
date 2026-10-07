import type { CompanionVariableDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonVariableDefinitions, commonVariableValues, type CommonVariablesSchema } from './areas/common.js'
import { videoVariableDefinitions, videoVariableValues, type VideoVariablesSchema } from './areas/video.js'
import { audioVariableDefinitions, audioVariableValues, type AudioVariablesSchema } from './areas/audio.js'

export type VariablesSchema = CommonVariablesSchema & VideoVariablesSchema & AudioVariablesSchema

/**
 * The variables of the areas active right now; the others are left out, so they do not appear.
 * Companion's type wants every id, but a variable without a definition is simply not offered.
 */
export function variableDefinitions(self: ModuleInstance): CompanionVariableDefinitions<VariablesSchema> {
	return {
		...commonVariableDefinitions(),
		...(self.areas.has('video') ? videoVariableDefinitions() : {}),
		...(self.areas.has('audio') ? audioVariableDefinitions() : {}),
	} as CompanionVariableDefinitions<VariablesSchema>
}

/** The current values of the variables defined by variableDefinitions(). */
export function variableValues(self: ModuleInstance): Partial<VariablesSchema> {
	return {
		...commonVariableValues(self),
		...(self.areas.has('video') ? videoVariableValues(self) : {}),
		...(self.areas.has('audio') ? audioVariableValues(self) : {}),
	}
}
