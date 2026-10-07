import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonActions, type CommonActionsSchema } from './areas/common.js'

export type ActionsSchema = CommonActionsSchema

/** The actions of the areas active right now; the others are left out, so they do not appear. */
export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions<ActionsSchema> = {
		...commonActions(self),
	}
	self.setActionDefinitions(actions)
}
