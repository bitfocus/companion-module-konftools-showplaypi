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
	audioFingerprint,
	parseAudioFiles,
	parseAudioStatus,
	parseVideoFiles,
	parseVideoStatus,
	playlistsFingerprint,
	type AudioFiles,
	type AudioStatus,
	type Playlist,
	type VideoStatus,
} from './players.js'
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
/**
 * How often the file lists are requested. The device scans its drive every few seconds; each list
 * request costs it a moment, so this is kept slow. Dropdowns are rebuilt only when a list changed.
 */
const LIST_INTERVAL_MS = 10_000

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
	/** The last reply to /showplaypi/video/status */
	videoStatus: VideoStatus | undefined
	/** The playlists of the video player, from /showplaypi/video/list */
	videoPlaylists: Playlist[] = []
	/** The last reply to /showplaypi/audio/status */
	audioStatus: AudioStatus | undefined
	/** Jingles and playlists of the audio player, from /showplaypi/audio/list */
	audioFiles: AudioFiles = { jingles: [], playlists: [] }

	#detector = new ModeDetector()
	#connection: ShowPlayPiConnection | undefined
	#timers: NodeJS.Timeout[] = []
	#probeTimeout: NodeJS.Timeout | undefined
	#lastSystemAt = 0
	#startedAt = 0
	/** Identifies the definitions currently set, so they are only rebuilt when areas or lists change. */
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
			this.videoStatus = undefined
			this.videoPlaylists = []
			this.audioStatus = undefined
			this.audioFiles = { jingles: [], playlists: [] }
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
			setInterval(() => this.#pollLists(), LIST_INTERVAL_MS),
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

	/** The file lists, only for what runs in the active mode. */
	#pollLists(): void {
		if (!this.connected) return
		if (this.areas.has('video')) this.send('/showplaypi/video/list')
		if (this.areas.has('audio')) this.send('/showplaypi/audio/list')
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
		if (!kind) {
			this.log('debug', `Unexpected message from the device: ${message.address}`)
			return
		}

		this.#detector.noteReply(kind, now)
		this.#applyDetection()

		const json = message.args[0]
		if (typeof json !== 'string') return
		try {
			switch (message.address) {
				case '/showplaypi/video/status':
					this.#handleVideoStatus(parseVideoStatus(json))
					break
				case '/showplaypi/video/files':
					this.#handleVideoFiles(parseVideoFiles(json))
					break
				case '/showplaypi/audio/status':
					this.#handleAudioStatus(parseAudioStatus(json))
					break
				case '/showplaypi/audio/files':
					this.#handleAudioFiles(parseAudioFiles(json))
					break
			}
		} catch (error) {
			this.log('warn', `Unreadable reply ${message.address}: ${(error as Error).message}`)
		}
	}

	#handleVideoStatus(status: VideoStatus): void {
		const previous = this.videoStatus
		this.videoStatus = status
		this.#updateVariableValues()
		this.checkFeedbacks(
			'video_state',
			'video_entry_active',
			'video_playlist_active',
			'video_repeat',
			'video_muted',
			'video_remaining_below',
			'blackout',
		)
		// The file list is current as soon as a playlist is chosen that the list does not know yet
		if (status.playlist && !this.videoPlaylists.some((playlist) => playlist.name === status.playlist)) {
			if (status.playlist !== previous?.playlist) this.send('/showplaypi/video/list')
		}
	}

	#handleVideoFiles(playlists: Playlist[]): void {
		this.videoPlaylists = playlists
		this.#updateDefinitions()
		this.#updateVariableValues()
	}

	#handleAudioStatus(status: AudioStatus): void {
		const previous = this.audioStatus
		this.audioStatus = status
		this.#updateVariableValues()
		this.checkFeedbacks(
			'audio_loop_state',
			'audio_loop_track_active',
			'audio_loop_playlist_active',
			'audio_loop_remaining_below',
			'audio_loop_repeat',
			'audio_loop_shuffle',
			'audio_jingle_playing',
			'audio_jingle_mode',
			'audio_muted',
		)
		const playlist = status.loop.playlist
		if (playlist && playlist !== previous?.loop.playlist) {
			if (!this.audioFiles.playlists.some((candidate) => candidate.name === playlist))
				this.send('/showplaypi/audio/list')
		}
	}

	#handleAudioFiles(files: AudioFiles): void {
		this.audioFiles = files
		this.#updateDefinitions()
		this.#updateVariableValues()
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
			this.#pollLists()
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
		// Back in touch: the lists may have changed in the meantime
		if (changed && connected) this.#pollLists()
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
		const areasKey = [...areas].sort().join(',')
		const key = JSON.stringify([
			areasKey,
			areas.has('video') ? playlistsFingerprint(this.videoPlaylists) : '',
			areas.has('audio') ? audioFingerprint(this.audioFiles) : '',
		])
		if (!force && key === this.#definitionsKey) return

		const areasChanged = areasKey !== [...this.areas].sort().join(',')
		if (!force && areasChanged) this.log('info', `Offering the commands for: ${this.#describeMode()}`)
		const videoAdded = areas.has('video') && !this.areas.has('video')
		const audioAdded = areas.has('audio') && !this.areas.has('audio')
		this.areas = areas
		this.#definitionsKey = key

		UpdateActions(this)
		UpdateFeedbacks(this)
		this.setVariableDefinitions(variableDefinitions(this))
		UpdatePresets(this)
		this.#updateVariableValues()
		this.checkAllFeedbacks()

		// Fill the dropdowns of a newly active player straight away
		if (videoAdded && this.connected) this.send('/showplaypi/video/list')
		if (audioAdded && this.connected) this.send('/showplaypi/audio/list')
	}

	#updateVariableValues(): void {
		this.setVariableValues(variableValues(this))
	}
}
