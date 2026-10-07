import type { CompanionInputFieldCheckbox, CompanionInputFieldNumber } from '@companion-module/base'
import { secondsToMs } from './format.js'
import { oscInt, type OscArgument } from './osc.js'

/** The options of an optional fade: without it, the device uses its own default fade time. */
export type FadeOptions = {
	useFade: boolean
	fade: number
}

/**
 * A checkbox to override the fade time and the time itself in seconds (the device works in
 * milliseconds; the module converts). Without the checkbox the command goes out without a fade
 * argument and the default from the device configuration applies.
 */
export function fadeOptions(
	label = 'Fade time (seconds)',
): [CompanionInputFieldCheckbox<'useFade'>, CompanionInputFieldNumber<'fade'>] {
	return [
		{
			type: 'checkbox',
			id: 'useFade',
			label: 'Own fade time',
			tooltip: 'Off: the default fade time from the device configuration applies.',
			default: false,
			// Referenced by isVisibleExpression, which only works with fields that are never expressions
			disableAutoExpression: true,
		},
		{
			type: 'number',
			id: 'fade',
			label,
			default: 1,
			min: 0,
			max: 60,
			step: 0.1,
			isVisibleExpression: '$(options:useFade)',
		},
	]
}

/** The optional fade argument (milliseconds) for an OSC command. */
export function fadeArgs(options: Partial<FadeOptions>): OscArgument[] {
	return options.useFade ? [oscInt(secondsToMs(options.fade))] : []
}
