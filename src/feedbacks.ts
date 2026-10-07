import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonFeedbacks, type CommonFeedbacksSchema } from './areas/common.js'

export type FeedbacksSchema = CommonFeedbacksSchema

/** The feedbacks of the areas active right now; the others are left out, so they do not appear. */
export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {
		...commonFeedbacks(self),
	}
	self.setFeedbackDefinitions(feedbacks)
}
