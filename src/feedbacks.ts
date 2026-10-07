import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { commonFeedbacks, type CommonFeedbacksSchema } from './areas/common.js'
import { videoFeedbacks, type VideoFeedbacksSchema } from './areas/video.js'
import { audioFeedbacks, type AudioFeedbacksSchema } from './areas/audio.js'
import { onlyIf } from './util.js'

export type FeedbacksSchema = CommonFeedbacksSchema & VideoFeedbacksSchema & AudioFeedbacksSchema

/** The feedbacks of the areas active right now; the others are left out, so they do not appear. */
export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {
		...commonFeedbacks(self),
		...onlyIf(self.areas.has('video'), videoFeedbacks(self)),
		...onlyIf(self.areas.has('audio'), audioFeedbacks(self)),
	}
	self.setFeedbackDefinitions(feedbacks)
}
