import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonActions, type CommonActionsSchema } from './areas/common.js'
import { browserActions, type BrowserActionsSchema } from './areas/browser.js'
import { ontimeActions, type OntimeActionsSchema } from './areas/ontime.js'
import { onlyIf } from './util.js'

export type ActionsSchema = CommonActionsSchema & BrowserActionsSchema & OntimeActionsSchema

/** The actions of the areas active right now; the others are left out, so they do not appear. */
export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions<ActionsSchema> = {
		...commonActions(self),
		...onlyIf(self.areas.has('browser'), browserActions(self)),
		...onlyIf(self.areas.has('ontime'), ontimeActions(self)),
	}
	self.setActionDefinitions(actions)
}
