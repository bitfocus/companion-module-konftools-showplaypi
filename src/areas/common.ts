/**
 * What works in every mode: blackout, and the device load reported by /showplaypi/system.
 */
import { combineRgb, type CompanionActionDefinitions, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import { formatUptime } from '../format.js'
import { fadeArgs, fadeOptions } from '../options.js'
import { oscInt } from '../osc.js'

export type CommonActionsSchema = {
	blackout: {
		options: {
			state: 'on' | 'off'
			useFade: boolean
			fade: number
		}
	}
}

export type CommonFeedbacksSchema = {
	connected: { type: 'boolean'; options: Record<string, never> }
	ram_state: { type: 'boolean'; options: { level: 'warning' | 'critical' } }
	temperature_above: { type: 'boolean'; options: { limit: number } }
	throttled: { type: 'boolean'; options: { kind: 'undervoltage' | 'now' | 'since_boot' } }
	time_not_synchronized: { type: 'boolean'; options: Record<string, never> }
}

export type CommonVariablesSchema = {
	mode: string
	audio_player: boolean
	version: string
	device_name: string
	model: string
	cpu: number | undefined
	ram_percent: number | undefined
	ram_available: number | undefined
	ram_state: string
	swap_percent: number | undefined
	temperature: number | undefined
	uptime: string
	free_system: number | undefined
	free_media: number | undefined
	time_synchronized: boolean | undefined
	time_source: string
	undervoltage: boolean | undefined
	throttled: boolean | undefined
}

export const WHITE = combineRgb(255, 255, 255)
export const BLACK = combineRgb(0, 0, 0)
export const RED = combineRgb(176, 0, 32)
export const GREEN = combineRgb(0, 128, 0)
export const AMBER = combineRgb(230, 160, 0)

export function commonActions(self: ModuleInstance): CompanionActionDefinitions<CommonActionsSchema> {
	// Only the video player fades the blackout so far; elsewhere the picture switches at once
	const canFade = self.areas.has('video')

	return {
		blackout: {
			name: 'Blackout',
			description: canFade
				? 'Fades the picture to black or back. The HDMI signal is kept.'
				: 'Turns the picture black or back on. The HDMI signal is kept, so the display does not lose it.',
			options: [
				{
					type: 'dropdown',
					id: 'state',
					label: 'Picture',
					default: 'on',
					choices: [
						{ id: 'on', label: 'Black (blackout on)' },
						{ id: 'off', label: 'Visible (blackout off)' },
					],
				},
				...(canFade ? fadeOptions() : []),
			],
			callback: (action) => {
				const black = action.options.state !== 'off'
				self.send('/showplaypi/blackout', [oscInt(black ? 1 : 0), ...(canFade ? fadeArgs(action.options) : [])])
			},
		},
	}
}

export function commonFeedbacks(self: ModuleInstance): CompanionFeedbackDefinitions<CommonFeedbacksSchema> {
	return {
		connected: {
			type: 'boolean',
			name: 'Device: connected',
			description: 'The device answers.',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => self.connected,
		},
		ram_state: {
			type: 'boolean',
			name: 'Device: memory warning',
			description:
				'The memory of the device is running low. Critical means the device may stall – ' +
				'in Companion mode, use fewer connections.',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [
				{
					type: 'dropdown',
					id: 'level',
					label: 'From',
					default: 'warning',
					choices: [
						{ id: 'warning', label: 'Warning (or critical)' },
						{ id: 'critical', label: 'Critical only' },
					],
				},
			],
			callback: (feedback) => {
				const state = self.system?.ramState
				return feedback.options.level === 'critical'
					? state === 'critical'
					: state === 'warning' || state === 'critical'
			},
		},
		temperature_above: {
			type: 'boolean',
			name: 'Device: temperature above',
			description: 'The processor temperature is above a limit. The Raspberry Pi slows down from 80 °C.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{
					type: 'number',
					id: 'limit',
					label: 'Limit (°C)',
					default: 75,
					min: 30,
					max: 100,
				},
			],
			callback: (feedback) => {
				const temperature = self.system?.temperature
				return temperature !== undefined && temperature > Number(feedback.options.limit)
			},
		},
		throttled: {
			type: 'boolean',
			name: 'Device: power or heat problem',
			description: 'Reported by the firmware of the Raspberry Pi. Under-voltage points to a weak power supply.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'kind',
					label: 'Problem',
					default: 'undervoltage',
					choices: [
						{ id: 'undervoltage', label: 'Under-voltage now' },
						{ id: 'now', label: 'Slowed down (throttled) now' },
						{ id: 'since_boot', label: 'Slowed down at any time since the start' },
					],
				},
			],
			callback: (feedback) => {
				const system = self.system
				if (!system) return false
				switch (feedback.options.kind) {
					case 'now':
						return system.throttledNow === true
					case 'since_boot':
						return system.throttledSinceBoot === true
					default:
						return system.undervoltage === true
				}
			},
		},
		time_not_synchronized: {
			type: 'boolean',
			name: 'Device: clock not synchronised',
			description: 'The clock of the device has no time source, so timers and clocks may be off.',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => self.system?.timeSynchronized === false,
		},
	}
}

export function commonVariableDefinitions(): Record<keyof CommonVariablesSchema, { name: string }> {
	return {
		mode: { name: 'Operating mode (browser, video, companion, ontime; "browser or ontime" while undetermined)' },
		audio_player: { name: 'Audio player enabled' },
		version: { name: 'ShowPlayPI version (when the device reports it)' },
		device_name: { name: 'Device name (when the device reports it)' },
		model: { name: 'Raspberry Pi model (when the device reports it)' },
		cpu: { name: 'CPU load (%)' },
		ram_percent: { name: 'Memory used (%)' },
		ram_available: { name: 'Memory available (MB)' },
		ram_state: { name: 'Memory state (normal, warning, critical)' },
		swap_percent: { name: 'Swap used (%)' },
		temperature: { name: 'Temperature (°C)' },
		uptime: { name: 'Time since the device started' },
		free_system: { name: 'Free space on the system (MB)' },
		free_media: { name: 'Free space on the SHOWPLAYPI drive (MB)' },
		time_synchronized: { name: 'Clock synchronised' },
		time_source: { name: 'Time source (address of the time server)' },
		undervoltage: { name: 'Under-voltage now' },
		throttled: { name: 'Slowed down (throttled) now' },
	}
}

export function commonVariableValues(self: ModuleInstance): CommonVariablesSchema {
	const system = self.system
	const mode = self.mode

	return {
		mode: mode === 'browser-or-ontime' ? 'browser or ontime' : (mode ?? ''),
		audio_player: self.audio,
		version: system?.version ?? '',
		device_name: system?.name ?? '',
		model: system?.model ?? '',
		cpu: system?.cpu,
		ram_percent: system?.ramPercent,
		ram_available: system?.ramAvailable,
		ram_state: system?.ramState ?? '',
		swap_percent: system?.swapPercent,
		temperature: system?.temperature,
		uptime: formatUptime(system?.uptime),
		free_system: system?.freeSystem,
		free_media: system?.freeMedia,
		time_synchronized: system?.timeSynchronized,
		time_source: system?.timeSource ?? '',
		undervoltage: system?.undervoltage,
		throttled: system?.throttledNow,
	}
}
