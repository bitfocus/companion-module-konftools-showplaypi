import type { SomeCompanionConfigField } from '@companion-module/base'
import { SHOWPLAYPI_PORT } from './connection.js'

export type ModeSetting = 'auto' | 'browser' | 'video' | 'companion' | 'ontime'
export type AudioSetting = 'auto' | 'on' | 'off'

export type ModuleConfig = {
	host: string
	mode: ModeSetting
	audio: AudioSetting
	/** Seconds between requests for the player state (video, audio) */
	statusInterval: number
	/** Seconds between requests for the device load (/showplaypi/system) */
	systemInterval: number
	/**
	 * The mode and audio player state detected last, not shown on the configuration page. They keep the
	 * matching actions available when Companion starts while the device is still switched off.
	 */
	lastMode?: string
	lastAudio?: boolean
}

export const DEFAULT_CONFIG: ModuleConfig = {
	host: '',
	mode: 'auto',
	audio: 'auto',
	statusInterval: 1,
	systemInterval: 5,
}

/**
 * What the host field accepts: an IPv4 address or a device name such as showplaypi-e84042.local, or
 * nothing. Empty has to pass, because a fresh connection starts without a host.
 */
export const HOST_REGEX =
	'/^$|^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\.?$/'

/** Fills in defaults for missing or invalid values, e.g. from an older version of the module. */
export function normaliseConfig(config: Partial<ModuleConfig> | undefined): ModuleConfig {
	const merged = { ...DEFAULT_CONFIG, ...config }
	const seconds = (value: unknown, fallback: number, min: number, max: number): number => {
		const parsed = Number(value)
		return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.max(min, parsed)) : fallback
	}

	return {
		...merged,
		host: String(merged.host ?? '').trim(),
		mode: ['auto', 'browser', 'video', 'companion', 'ontime'].includes(merged.mode) ? merged.mode : 'auto',
		audio: ['auto', 'on', 'off'].includes(merged.audio) ? merged.audio : 'auto',
		statusInterval: seconds(merged.statusInterval, DEFAULT_CONFIG.statusInterval, 0.5, 60),
		systemInterval: seconds(merged.systemInterval, DEFAULT_CONFIG.systemInterval, 1, 300),
	}
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: 'About this connection',
			width: 12,
			value:
				'Controls a ShowPlayPI player over OSC (UDP port ' +
				SHOWPLAYPI_PORT +
				', fixed). Enter the IP address or the device name shown on the setup page of the device. ' +
				'The module offers only the actions, feedbacks, variables and presets that work in the ' +
				'operating mode the device runs in; the mode itself is changed in the device configuration.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Device (IP address or name)',
			tooltip: 'e.g. 192.168.1.50 or showplaypi-e84042.local',
			width: 12,
			default: DEFAULT_CONFIG.host,
			regex: HOST_REGEX,
		},
		{
			type: 'dropdown',
			id: 'mode',
			label: 'Operating mode',
			tooltip:
				'Automatic asks the device. Choose a mode by hand to prepare buttons while the device is ' +
				'not reachable, or if automatic detection does not work in your network.',
			width: 6,
			default: DEFAULT_CONFIG.mode,
			choices: [
				{ id: 'auto', label: 'Automatic (ask the device)' },
				{ id: 'browser', label: 'Browser' },
				{ id: 'video', label: 'Video' },
				{ id: 'companion', label: 'Companion' },
				{ id: 'ontime', label: 'Ontime' },
			],
		},
		{
			type: 'dropdown',
			id: 'audio',
			label: 'Audio player',
			tooltip: 'The audio player is an optional extra in every mode. Automatic asks the device.',
			width: 6,
			default: DEFAULT_CONFIG.audio,
			choices: [
				{ id: 'auto', label: 'Automatic (ask the device)' },
				{ id: 'on', label: 'Enabled' },
				{ id: 'off', label: 'Disabled' },
			],
		},
		{
			type: 'number',
			id: 'statusInterval',
			label: 'Player status interval (seconds)',
			tooltip:
				'How often the state of the video and audio player is requested, e.g. for elapsed and ' +
				'remaining time on buttons. 1 second keeps countdowns smooth.',
			width: 6,
			min: 0.5,
			max: 60,
			step: 0.5,
			default: DEFAULT_CONFIG.statusInterval,
		},
		{
			type: 'number',
			id: 'systemInterval',
			label: 'Device load interval (seconds)',
			tooltip:
				'How often CPU, memory, temperature and the connection are checked. The device updates ' +
				'these values every 5 seconds.',
			width: 6,
			min: 1,
			max: 300,
			default: DEFAULT_CONFIG.systemInterval,
		},
	]
}
