/**
 * What the module knows about the device, and how it works out the active operating mode.
 *
 * ShowPlayPI runs in exactly one mode (browser, video, Companion or Ontime), set in its configuration and
 * changed only with a restart; the audio player is an optional extra in every mode. Commands of an
 * inactive mode are silently ignored by the device, so the module offers only the actions, feedbacks,
 * variables and presets of the active mode and services.
 */

export const DEVICE_MODES = ['browser', 'video', 'companion', 'ontime'] as const
export type DeviceMode = (typeof DEVICE_MODES)[number]

/**
 * The mode as far as the module can tell. Until the device reports its mode itself, browser and Ontime
 * mode cannot be told apart (neither answers any request of its own), so they stay one value.
 */
export type DetectedMode = DeviceMode | 'browser-or-ontime'

/** Groups of commands that are available or not, depending on mode and services. */
export type Area = 'browser' | 'ontime' | 'companion' | 'video' | 'audio'

export function isDeviceMode(value: unknown): value is DeviceMode {
	return typeof value === 'string' && (DEVICE_MODES as readonly string[]).includes(value)
}

export function isDetectedMode(value: unknown): value is DetectedMode {
	return value === 'browser-or-ontime' || isDeviceMode(value)
}

/** The areas that work in a mode. Unknown mode: none, only what works everywhere (blackout, system). */
export function activeAreas(mode: DetectedMode | undefined, audio: boolean): Set<Area> {
	const areas = new Set<Area>()

	switch (mode) {
		case 'browser':
			areas.add('browser')
			break
		case 'ontime':
		case 'browser-or-ontime':
			// Browser mode and Ontime mode look the same from outside, so the Ontime commands are offered
			// in both until the device says which one it is
			areas.add('browser').add('ontime')
			break
		case 'companion':
			areas.add('browser').add('companion')
			break
		case 'video':
			areas.add('video')
			break
		case undefined:
			break
	}

	if (audio) areas.add('audio')
	return areas
}

/** The reply to /showplaypi/system. Every field is optional: older or newer devices may differ. */
export interface SystemStatus {
	cpu?: number
	ramPercent?: number
	ramAvailable?: number
	ramTotal?: number
	ramState?: string
	swapPercent?: number
	temperature?: number
	timeSynchronized?: boolean
	timeSource?: string
	stratum?: number
	undervoltage?: boolean
	throttledNow?: boolean
	throttledSinceBoot?: boolean
	/** Milliseconds since the device started */
	uptime?: number
	freeSystem?: number
	freeMedia?: number
	companionConnections?: number
	// Identification, proposed for /showplaypi/system and planned for /showplaypi/hello
	product?: string
	version?: string
	api?: number
	name?: string
	model?: string
	mode?: DeviceMode
	services?: string[]
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function num(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

function bool(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined
}

/** Reads the JSON of a /showplaypi/system reply. Throws if it is not a JSON object. */
export function parseSystemStatus(json: string): SystemStatus {
	const parsed: unknown = JSON.parse(json)
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('The system reply is not a JSON object')
	}

	const data = parsed as JsonRecord
	const ram = record(data.ram)
	const time = record(data.time)
	const throttled = record(data.throttled)
	const drives = record(data.drives)

	return {
		cpu: num(data.cpu),
		ramPercent: num(ram.percent),
		ramAvailable: num(ram.available),
		ramTotal: num(ram.total),
		ramState: str(ram.state),
		swapPercent: num(ram.swap_percent),
		temperature: num(data.temperature),
		timeSynchronized: bool(time.synchronized),
		timeSource: str(time.source),
		stratum: num(time.stratum),
		undervoltage: bool(throttled.undervoltage),
		throttledNow: bool(throttled.now),
		throttledSinceBoot: bool(throttled.since_boot),
		uptime: num(data.uptime),
		freeSystem: num(record(drives.system).free),
		freeMedia: num(record(drives.media).free),
		companionConnections: num(data.companion_connections),
		product: str(data.product),
		version: str(data.version),
		api: num(data.api),
		name: str(data.name),
		model: str(data.model),
		mode: isDeviceMode(data.mode) ? data.mode : undefined,
		services: Array.isArray(data.services)
			? data.services.filter((service): service is string => typeof service === 'string')
			: undefined,
	}
}

/** Requests whose answer shows that a mode or service is active. */
export type ProbeKind = 'video' | 'companion' | 'audio'

/**
 * How long to wait for the answers of a probe round before concluding that a mode or service is not
 * active. ShowPlayPI answers status requests after about 0.2 seconds.
 */
export const PROBE_WAIT_MS = 2500

/**
 * Works out the operating mode and whether the audio player runs.
 *
 * Preferably from the device's own report (the mode and services fields of /showplaypi/system). Devices
 * that do not report them yet are probed: /showplaypi/video/status, /showplaypi/companion/emulators and
 * /showplaypi/audio/status are only answered in their mode or with the audio player enabled. An answer
 * proves the mode at once; the absence of an answer counts only if the device answered the system
 * request of the same round, so a device that is simply offline never changes the result.
 *
 * Pure bookkeeping with explicit timestamps, so it can be tested without a device.
 */
export class ModeDetector {
	mode: DetectedMode | undefined
	audio: boolean | undefined

	#probeStartedAt: number | undefined
	#lastSystem = -Infinity
	#lastReply: Record<ProbeKind, number> = { video: -Infinity, companion: -Infinity, audio: -Infinity }
	#reportedMode: DeviceMode | undefined
	#reportedAudio: boolean | undefined

	constructor(initialMode?: DetectedMode, initialAudio?: boolean) {
		this.mode = initialMode
		this.audio = initialAudio
	}

	/** Whether the device reports its mode itself, so probing is unnecessary. */
	get reportsMode(): boolean {
		return this.#reportedMode !== undefined
	}

	/** Forget the device's own report, e.g. when it restarted with other software. */
	reset(): void {
		this.#probeStartedAt = undefined
		this.#reportedMode = undefined
		this.#reportedAudio = undefined
	}

	startProbe(now: number): void {
		this.#probeStartedAt = now
	}

	noteSystem(status: SystemStatus, now: number): void {
		this.#lastSystem = now
		this.#reportedMode = status.mode
		this.#reportedAudio = status.services ? status.services.includes('audio') : undefined
		this.#apply(now)
	}

	noteReply(kind: ProbeKind, now: number): void {
		this.#lastReply[kind] = now
		this.#apply(now)
	}

	/** Call regularly; draws conclusions from missing answers once a probe round has had its time. */
	evaluate(now: number): void {
		this.#apply(now)
	}

	#apply(now: number): void {
		const started = this.#probeStartedAt
		const roundOver = started !== undefined && now - started >= PROBE_WAIT_MS && this.#lastSystem >= started
		const answered = (kind: ProbeKind): boolean => started !== undefined && this.#lastReply[kind] >= started

		if (this.#reportedMode) {
			this.mode = this.#reportedMode
		} else if (answered('video')) {
			this.mode = 'video'
		} else if (answered('companion')) {
			this.mode = 'companion'
		} else if (roundOver) {
			this.mode = 'browser-or-ontime'
		}

		if (this.#reportedAudio !== undefined) {
			this.audio = this.#reportedAudio
		} else if (answered('audio')) {
			this.audio = true
		} else if (roundOver) {
			this.audio = false
		}
	}
}
