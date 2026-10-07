import type { CompanionVariableDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonVariableDefinitions, commonVariableValues, type CommonVariablesSchema } from './areas/common.js'

export type VariablesSchema = CommonVariablesSchema

/** The variables of the areas active right now; the others are left out, so they do not appear. */
export function variableDefinitions(_self: ModuleInstance): CompanionVariableDefinitions<VariablesSchema> {
	return {
		...commonVariableDefinitions(),
	}
}

/** The current values of the variables defined by variableDefinitions(). */
export function variableValues(self: ModuleInstance): Partial<VariablesSchema> {
	return {
		...commonVariableValues(self),
	}
}
