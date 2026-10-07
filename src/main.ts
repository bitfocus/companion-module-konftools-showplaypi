import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, normaliseConfig, type ModuleConfig } from './config.js'
import { variableDefinitions, variableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { ShowPlayPiConnection } from './connection.js'
import type { OscArgument, OscMessage } from './osc.js'
import {
	activeAreas,
	isDetectedMode,
	ModeDetector,
	parseSystemStatus,
	PROBE_WAIT_MS,
	type Area,
	type DetectedMode,
	type ProbeKind,
	type SystemStatus,
} from './state.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

/**
 * How often the device is probed for its mode while it does not report it itself. The mode only
 * changes with a restart of the device, which is also noticed from its uptime, so this is a safety net.
 */
const PROBE_INTERVAL_MS = 30_000
/** Without an answer to this many system requests in a row, the device counts as unreachable. */
const MISSED_ANSWERS = 3
/** ...but never sooner than this, so a short interval does not make the status flicker. */
const MIN_FAILURE_MS = 10_000

/** The replies that prove a mode or service is active (docs/OSC.md of ShowPlayPI). */
const PROBE_REPLIES: Record<string, ProbeKind> = {
	'/showplaypi/video/status': 'video',
	'/showplaypi/video/files': 'video',
	'/showplaypi/companion/emulators': 'companion',
	'/showplaypi/audio/status': 'audio',
	'/showplaypi/audio/files': 'audio',
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config: ModuleConfig = normaliseConfig(undefined)
	/** The last reply to /showplaypi/system */
	system: SystemStatus | undefined
	/** Whether the device has answered recently */
	connected = false
	/** The command groups available in the active mode, see activeAreas() */
	areas: Set<Area> = new Set()

	#detector = new ModeDetector()
	#connection: ShowPlayPiConnection | undefined
	#timers: NodeJS.Timeout[] = []
	#probeTimeout: NodeJS.Timeout | undefined
	#lastSystemAt = 0
	#startedAt = 0
	/** Identifies the definitions currently set, so they are only rebuilt when the areas change. */
	#definitionsKey = ''
	/** The connection settings in use, so saving only the detected mode does not reconnect. */
	#connectionKey = ''
	/** The last reported problem, so the log is not flooded while the device is offline. */
	#lastProblem: string | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	/** The operating mode: chosen in the configuration, or detected. */
	get mode(): DetectedMode | undefined {
		return this.config.mode === 'auto' ? this.#detector.mode : this.config.mode
	}

	/** Whether the audio player runs: chosen in the configuration, or detected. */
	get audio(): boolean {
		if (this.config.audio === 'on') return true
		if (this.config.audio === 'off') return false
		return this.#detector.audio ?? false
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = normaliseConfig(config)
		this.#detector = new ModeDetector(
			isDetectedMode(this.config.lastMode) ? this.config.lastMode : undefined,
			typeof this.config.lastAudio === 'boolean' ? this.config.lastAudio : undefined,
		)
		this.#updateDefinitions(true)
		this.#start()
	}

	async destroy(): Promise<void> {
		this.#stop()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const previousHost = this.config.host
		this.config = normaliseConfig(config)

		if (this.config.host !== previousHost) {
			// Another device: what was detected for the old one does not apply
			this.#detector = new ModeDetector()
			this.system = undefined
		}

		if (this.#connectionSettings() !== this.#connectionKey) {
			this.#stop()
			this.#start()
		}
		this.#updateDefinitions()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/** Sends one OSC command to the device. Without a connection (no host set) it is dropped. */
	send(address: string, args: OscArgument[] = []): void {
		if (!this.#connection) {
			this.log('debug', `Not sent, no device set: ${address}`)
			return
		}
		this.#connection.send(address, args)
	}

	#connectionSettings(): string {
		return JSON.stringify([this.config.host, this.config.statusInterval, this.config.systemInterval])
	}

	#start(): void {
		this.#connectionKey = this.#connectionSettings()
		this.connected = false
		this.#lastProblem = undefined

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Enter the IP address or name of the device')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.#startedAt = Date.now()
		this.#connection = new ShowPlayPiConnection(this.config.host, {
			message: (message) => this.#handleMessage(message),
			error: (error) => this.#reportProblem(error.message),
		})

		this.#probe()
		this.#timers.push(
			setInterval(() => this.#pollSystem(), this.config.systemInterval * 1000),
			setInterval(() => this.#pollStatus(), this.config.statusInterval * 1000),
			setInterval(() => this.#probe(), PROBE_INTERVAL_MS),
		)
	}

	#stop(): void {
		for (const timer of this.#timers) clearInterval(timer)
		this.#timers = []
		if (this.#probeTimeout) clearTimeout(this.#probeTimeout)
		this.#probeTimeout = undefined
		this.#connection?.close()
		this.#connection = undefined
		this.connected = false
	}

	#pollSystem(): void {
		this.send('/showplaypi/system')

		const now = Date.now()
		const limit = Math.max(MISSED_ANSWERS * this.config.systemInterval * 1000, MIN_FAILURE_MS)
		const since = this.#lastSystemAt || this.#startedAt
		if (now - since > limit) {
			this.#setConnected(false, `No answer from ${this.config.host}`)
		}
	}

	/** The player states, only for what runs in the active mode. */
	#pollStatus(): void {
		if (!this.connected) return
		if (this.areas.has('video')) this.send('/showplaypi/video/status')
		if (this.areas.has('audio')) this.send('/showplaypi/audio/status')
	}

	/**
	 * Asks what the device runs, if anything is left to find out: requests that are only answered in a
	 * mode or with a service, together with the system request that proves the device is there.
	 */
	#probe(): void {
		const needMode = this.config.mode === 'auto' && !this.#detector.reportsMode
		const needAudio = this.config.audio === 'auto' && !this.#detector.reportsMode
		if (!needMode && !needAudio) {
			this.send('/showplaypi/system')
			return
		}

		this.#detector.startProbe(Date.now())
		this.send('/showplaypi/system')
		if (needMode) {
			this.send('/showplaypi/video/status')
			this.send('/showplaypi/companion/emulators')
		}
		if (needAudio) this.send('/showplaypi/audio/status')

		if (this.#probeTimeout) clearTimeout(this.#probeTimeout)
		this.#probeTimeout = setTimeout(() => {
			this.#probeTimeout = undefined
			this.#detector.evaluate(Date.now())
			this.#applyDetection()
		}, PROBE_WAIT_MS + 100)
	}

	#handleMessage(message: OscMessage): void {
		const now = Date.now()

		if (message.address === '/showplaypi/system') {
			this.#handleSystem(message, now)
			return
		}

		const kind = PROBE_REPLIES[message.address]
		if (kind) {
			this.#detector.noteReply(kind, now)
			this.#applyDetection()
			return
		}

		this.log('debug', `Unexpected message from the device: ${message.address}`)
	}

	#handleSystem(message: OscMessage, now: number): void {
		const json = message.args[0]
		if (typeof json !== 'string') return

		let status: SystemStatus
		try {
			status = parseSystemStatus(json)
		} catch (error) {
			this.log('warn', `Unreadable system reply: ${(error as Error).message}`)
			return
		}

		// A shorter uptime than before means the device has restarted, perhaps in another mode or with
		// other software: find out again what it runs
		const restarted =
			this.system?.uptime !== undefined && status.uptime !== undefined && status.uptime < this.system.uptime
		if (restarted) this.log('info', 'The device has restarted')

		this.system = status
		this.#lastSystemAt = now
		this.#detector.noteSystem(status, now)
		this.#setConnected(true)

		if (restarted) {
			this.#detector.reset()
			this.#probe()
		}

		this.#applyDetection()
		this.#updateVariableValues()
		this.checkAllFeedbacks()
	}

	#setConnected(connected: boolean, problem?: string): void {
		const changed = connected !== this.connected
		this.connected = connected

		if (connected) {
			this.#lastProblem = undefined
			this.updateStatus(InstanceStatus.Ok, this.#describeMode())
		} else if (problem) {
			this.#reportProblem(problem)
		}

		if (changed) this.checkFeedbacks('connected')
	}

	#reportProblem(problem: string): void {
		this.connected = false
		this.updateStatus(InstanceStatus.ConnectionFailure, problem)
		if (problem !== this.#lastProblem) {
			this.log('warn', problem)
			this.#lastProblem = problem
		}
		this.checkFeedbacks('connected')
	}

	#describeMode(): string {
		const names: Record<DetectedMode, string> = {
			browser: 'Browser mode',
			video: 'Video mode',
			companion: 'Companion mode',
			ontime: 'Ontime mode',
			'browser-or-ontime': 'Browser or Ontime mode',
		}
		const mode = this.mode ? names[this.mode] : 'Mode not yet known'
		return this.audio ? `${mode}, audio player` : mode
	}

	/** Takes over a changed detection: definitions, status text, and the remembered mode. */
	#applyDetection(): void {
		this.#updateDefinitions()
		this.#updateVariableValues()
		if (this.connected) this.updateStatus(InstanceStatus.Ok, this.#describeMode())

		const mode = this.#detector.mode
		const audio = this.#detector.audio
		if (
			(mode !== undefined && mode !== this.config.lastMode) ||
			(audio !== undefined && audio !== this.config.lastAudio)
		) {
			this.config = {
				...this.config,
				lastMode: mode ?? this.config.lastMode,
				lastAudio: audio ?? this.config.lastAudio,
			}
			this.saveConfig(this.config)
		}
	}

	/** Sets actions, feedbacks, variables and presets for the active areas, if they have changed. */
	#updateDefinitions(force = false): void {
		const areas = activeAreas(this.mode, this.audio)
		const key = [...areas].sort().join(',')
		if (!force && key === this.#definitionsKey) return

		if (!force) this.log('info', `Offering the commands for: ${this.#describeMode()}`)
		this.areas = areas
		this.#definitionsKey = key

		UpdateActions(this)
		UpdateFeedbacks(this)
		this.setVariableDefinitions(variableDefinitions(this))
		UpdatePresets(this)
		this.#updateVariableValues()
		this.checkAllFeedbacks()
	}

	#updateVariableValues(): void {
		this.setVariableValues(variableValues(this))
	}
}
