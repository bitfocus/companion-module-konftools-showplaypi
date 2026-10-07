/**
 * The replies of ShowPlayPI's players: state and file lists of the video player and the audio player.
 *
 * Formats as written by showplaypi-video and showplaypi-audio (see docs/OSC.md of ShowPlayPI). Every
 * field is read defensively, so a device with other software never breaks the module.
 */

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

function parseObject(json: string, what: string): JsonRecord {
	const parsed: unknown = JSON.parse(json)
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`The ${what} is not a JSON object`)
	}
	return parsed as JsonRecord
}

/** One file of a list: a video or still image, a jingle or a playlist track. */
export interface MediaEntry {
	/** Position in the list, from 1, in alphabetical order */
	number: number
	file: string
	/** File name without extension (and without a duration tag such as [15sec]) */
	title: string
	/** Video player only: video or still image */
	type?: 'video' | 'still'
	/** Milliseconds; unknown for videos and tracks that have not played yet */
	duration?: number
}

export interface Playlist {
	number: number
	name: string
	isDefault: boolean
	entries: MediaEntry[]
}

function parseEntries(value: unknown): MediaEntry[] {
	if (!Array.isArray(value)) return []
	const entries: MediaEntry[] = []
	for (const item of value) {
		const entry = record(item)
		const file = str(entry.file)
		if (!file) continue
		const type = entry.type === 'video' || entry.type === 'still' ? entry.type : undefined
		entries.push({
			number: num(entry.number) ?? entries.length + 1,
			file,
			title: str(entry.title) ?? file,
			type,
			duration: num(entry.duration),
		})
	}
	return entries
}

/** Playlists from a file list; `key` is where the files are: entries (video) or tracks (audio). */
function parsePlaylists(value: unknown, key: 'entries' | 'tracks'): Playlist[] {
	if (!Array.isArray(value)) return []
	const playlists: Playlist[] = []
	for (const item of value) {
		const playlist = record(item)
		const name = str(playlist.name)
		if (!name) continue
		playlists.push({
			number: num(playlist.number) ?? playlists.length + 1,
			name,
			isDefault: bool(playlist.default) ?? playlists.length === 0,
			entries: parseEntries(playlist[key]),
		})
	}
	return playlists
}

export type VideoState = 'playing' | 'paused' | 'cued' | 'stopped'
export const VIDEO_STATES: VideoState[] = ['playing', 'paused', 'cued', 'stopped']

/** The reply to /showplaypi/video/status */
export interface VideoStatus {
	state?: VideoState
	/** Name of the current playlist */
	playlist?: string
	number?: number
	file?: string
	title?: string
	type?: 'video' | 'still'
	elapsed?: number
	remaining?: number
	repeat?: string
	/** Default fade time in milliseconds */
	fade?: number
	volume?: number
	mute?: boolean
	blackout?: boolean
}

export function parseVideoStatus(json: string): VideoStatus {
	const data = parseObject(json, 'video status')
	const state = str(data.state)
	return {
		state: VIDEO_STATES.includes(state as VideoState) ? (state as VideoState) : undefined,
		playlist: str(data.playlist),
		number: num(data.number),
		file: str(data.file),
		title: str(data.title),
		type: data.type === 'video' || data.type === 'still' ? data.type : undefined,
		elapsed: num(data.elapsed),
		remaining: num(data.remaining),
		repeat: str(data.repeat),
		fade: num(data.fade),
		volume: num(data.volume),
		mute: bool(data.mute),
		blackout: bool(data.blackout),
	}
}

/** The reply to /showplaypi/video/list (address /showplaypi/video/files) */
export function parseVideoFiles(json: string): Playlist[] {
	return parsePlaylists(parseObject(json, 'video file list').playlists, 'entries')
}

/**
 * A short fingerprint of what the dropdowns and presets are built from: playlist names and file names.
 * Durations are left out on purpose; they are filled in as files play and would rebuild the
 * definitions again and again.
 */
export function playlistsFingerprint(playlists: Playlist[]): string {
	return JSON.stringify(playlists.map((playlist) => [playlist.name, playlist.entries.map((entry) => entry.file)]))
}

export type LoopState = 'playing' | 'paused' | 'stopped'
export const LOOP_STATES: LoopState[] = ['playing', 'paused', 'stopped']

/** The reply to /showplaypi/audio/status */
export interface AudioStatus {
	loop: {
		state?: LoopState
		/** Name of the current playlist */
		playlist?: string
		number?: number
		file?: string
		title?: string
		elapsed?: number
		remaining?: number
		volume?: number
		repeat?: string
		shuffle?: boolean
	}
	jingle: {
		state?: 'playing' | 'stopped'
		file?: string
		elapsed?: number
		remaining?: number
		volume?: number
		mode?: 'duck' | 'pause'
		/** Playlist volume while a jingle plays in duck mode, in percent of its volume */
		duck?: number
	}
	/** Master volume */
	volume?: number
	mute?: boolean
}

export function parseAudioStatus(json: string): AudioStatus {
	const data = parseObject(json, 'audio status')
	const loop = record(data.loop)
	const jingle = record(data.jingle)
	const loopState = str(loop.state)
	const jingleState = str(jingle.state)
	return {
		loop: {
			state: LOOP_STATES.includes(loopState as LoopState) ? (loopState as LoopState) : undefined,
			playlist: str(loop.playlist),
			number: num(loop.number),
			file: str(loop.file),
			title: str(loop.title),
			elapsed: num(loop.elapsed),
			remaining: num(loop.remaining),
			volume: num(loop.volume),
			repeat: str(loop.repeat),
			shuffle: bool(loop.shuffle),
		},
		jingle: {
			state: jingleState === 'playing' || jingleState === 'stopped' ? jingleState : undefined,
			file: str(jingle.file),
			elapsed: num(jingle.elapsed),
			remaining: num(jingle.remaining),
			volume: num(jingle.volume),
			mode: jingle.mode === 'duck' || jingle.mode === 'pause' ? jingle.mode : undefined,
			duck: num(jingle.duck),
		},
		volume: num(data.volume),
		mute: bool(data.mute),
	}
}

/** The reply to /showplaypi/audio/list (address /showplaypi/audio/files) */
export interface AudioFiles {
	jingles: MediaEntry[]
	playlists: Playlist[]
}

export function parseAudioFiles(json: string): AudioFiles {
	const data = parseObject(json, 'audio file list')
	return { jingles: parseEntries(data.jingles), playlists: parsePlaylists(data.playlists, 'tracks') }
}

export function audioFingerprint(files: AudioFiles): string {
	return JSON.stringify([files.jingles.map((jingle) => jingle.file), playlistsFingerprint(files.playlists)])
}
