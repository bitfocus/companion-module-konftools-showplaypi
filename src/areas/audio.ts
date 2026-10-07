/**
 * The audio player, an optional extra in every mode: playlists (AUDIO/LOOP and its subfolders) and
 * jingles (single files in AUDIO). Files and playlists are sent by name (see choices.ts); volumes are
 * percent; without a fade the audio player changes at once.
 */
import type { CompanionActionDefinitions, CompanionFeedbackDefinitions, DropdownChoice } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import {
	entryChoices,
	fileChoices,
	fileDropdown,
	isCurrentEntry,
	isCurrentPlaylist,
	nameOrNumber,
	playlistChoices,
	switchArgument,
	volumeOptions,
	volumeTarget,
	type SwitchChoice,
	type VolumeOptions,
} from '../choices.js'
import { formatDuration, secondsToMs } from '../format.js'
import { fadeArgs, fadeOptions, type FadeOptions } from '../options.js'
import { oscInt, oscString } from '../osc.js'
import type { LoopState } from '../players.js'
import { AMBER, BLACK, GREEN, RED, WHITE } from './common.js'

type NoOptions = Record<string, never>
type Repeat = 'off' | 'all' | 'one'

export type AudioActionsSchema = {
	audio_loop_play: { options: FadeOptions }
	audio_loop_pause: { options: FadeOptions }
	audio_loop_toggle: { options: FadeOptions }
	audio_loop_stop: { options: FadeOptions }
	audio_loop_next: { options: NoOptions }
	audio_loop_previous: { options: NoOptions }
	audio_loop_restart: { options: NoOptions }
	audio_loop_playhead: { options: { from: 'start' | 'end'; seconds: number } }
	audio_loop_select: { options: { track: string } }
	audio_loop_playlist: { options: { playlist: string } }
	audio_loop_repeat: { options: { repeat: Repeat } }
	audio_loop_shuffle: { options: { shuffle: SwitchChoice } }
	audio_loop_volume: { options: VolumeOptions & FadeOptions }
	audio_jingle_play: { options: { jingle: string; setVolume: boolean; volume: number } }
	audio_jingle_stop: { options: FadeOptions }
	audio_jingle_volume: { options: VolumeOptions }
	audio_jingle_mode: { options: { mode: 'duck' | 'pause'; duck: number } }
	audio_volume: { options: VolumeOptions & FadeOptions }
	audio_mute: { options: { mute: SwitchChoice } }
	audio_stop_all: { options: FadeOptions }
}

export type AudioFeedbacksSchema = {
	audio_loop_state: { type: 'boolean'; options: { state: LoopState } }
	audio_loop_track_active: { type: 'boolean'; options: { track: string } }
	audio_loop_playlist_active: { type: 'boolean'; options: { playlist: string } }
	audio_loop_remaining_below: { type: 'boolean'; options: { seconds: number } }
	audio_loop_repeat: { type: 'boolean'; options: { repeat: Repeat } }
	audio_loop_shuffle: { type: 'boolean'; options: NoOptions }
	audio_jingle_playing: { type: 'boolean'; options: { jingle: string } }
	audio_jingle_mode: { type: 'boolean'; options: { mode: 'duck' | 'pause' } }
	audio_muted: { type: 'boolean'; options: NoOptions }
}

export type AudioVariablesSchema = {
	audio_loop_state: string
	audio_loop_playlist: string
	audio_loop_number: number | undefined
	audio_loop_file: string
	audio_loop_title: string
	audio_loop_elapsed: string
	audio_loop_remaining: string
	audio_loop_duration: string
	audio_loop_elapsed_ms: number | undefined
	audio_loop_remaining_ms: number | undefined
	audio_loop_volume: number | undefined
	audio_loop_repeat: string
	audio_loop_shuffle: boolean | undefined
	audio_jingle_state: string
	audio_jingle_file: string
	audio_jingle_title: string
	audio_jingle_elapsed: string
	audio_jingle_remaining: string
	audio_jingle_remaining_ms: number | undefined
	audio_jingle_volume: number | undefined
	audio_jingle_mode: string
	audio_jingle_duck: number | undefined
	audio_volume: number | undefined
	audio_mute: boolean | undefined
	audio_playlist_count: number
	audio_track_count: number | undefined
	audio_jingle_count: number
}

/** Playlist 1, the AUDIO/LOOP folder itself, always exists. */
const DEFAULT_PLAYLIST = 'LOOP'

const REPEAT_CHOICES: DropdownChoice<Repeat>[] = [
	{ id: 'all', label: 'Loop the playlist' },
	{ id: 'one', label: 'Loop the current track' },
	{ id: 'off', label: 'Play the playlist once' },
]

const STATE_CHOICES: DropdownChoice<LoopState>[] = [
	{ id: 'playing', label: 'Playing' },
	{ id: 'paused', label: 'Paused' },
	{ id: 'stopped', label: 'Stopped' },
]

const SWITCH_CHOICES: DropdownChoice<SwitchChoice>[] = [
	{ id: 'on', label: 'On' },
	{ id: 'off', label: 'Off' },
	{ id: 'toggle', label: 'Toggle' },
]

const MUTE_CHOICES: DropdownChoice<SwitchChoice>[] = [
	{ id: 'on', label: 'Mute' },
	{ id: 'off', label: 'Unmute' },
	{ id: 'toggle', label: 'Toggle' },
]

/** The title of the jingle playing: from the file list, or the file name without extension. */
function jingleTitle(self: ModuleInstance, file: string | undefined): string {
	if (!file) return ''
	const entry = self.audioFiles.jingles.find((jingle) => jingle.file.toLowerCase() === file.toLowerCase())
	return entry?.title ?? file.replace(/\.[^.]+$/, '')
}

export function audioActions(self: ModuleInstance): CompanionActionDefinitions<AudioActionsSchema> {
	const tracks = entryChoices(self.audioFiles.playlists)
	const playlists = playlistChoices(self.audioFiles.playlists, DEFAULT_PLAYLIST)
	const jingles = fileChoices(self.audioFiles.jingles)

	/** Sends a volume change; raising or lowering needs the current value from the status. */
	const sendVolume = (
		address: string,
		options: Partial<VolumeOptions & FadeOptions>,
		current: number | undefined,
		what: string,
	) => {
		const target = volumeTarget(options, current)
		if (target === undefined) {
			self.log('warn', `Volume not changed: the current ${what} volume is not known yet`)
			return
		}
		self.send(address, [oscInt(target), ...fadeArgs(options)])
	}

	return {
		audio_loop_play: {
			name: 'Audio playlist: play',
			description: 'Starts or resumes the current playlist.',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/loop/play', fadeArgs(action.options)),
		},
		audio_loop_pause: {
			name: 'Audio playlist: pause',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/loop/pause', fadeArgs(action.options)),
		},
		audio_loop_toggle: {
			name: 'Audio playlist: play/pause',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/loop/toggle', fadeArgs(action.options)),
		},
		audio_loop_stop: {
			name: 'Audio playlist: stop',
			description: 'The next play starts the playlist at the beginning.',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/loop/stop', fadeArgs(action.options)),
		},
		audio_loop_next: {
			name: 'Audio playlist: next track',
			options: [],
			callback: () => self.send('/showplaypi/audio/loop/next'),
		},
		audio_loop_previous: {
			name: 'Audio playlist: previous track',
			options: [],
			callback: () => self.send('/showplaypi/audio/loop/previous'),
		},
		audio_loop_restart: {
			name: 'Audio playlist: restart track',
			description: 'Plays the current track from the beginning.',
			options: [],
			callback: () => self.send('/showplaypi/audio/loop/restart'),
		},
		audio_loop_playhead: {
			name: 'Audio playlist: jump to time',
			description: 'Sets the playhead of the current track. From the end: e.g. 10 = ten seconds before the end.',
			options: [
				{
					type: 'dropdown',
					id: 'from',
					label: 'Counted from',
					default: 'start',
					choices: [
						{ id: 'start', label: 'the start' },
						{ id: 'end', label: 'the end' },
					],
				},
				{ type: 'number', id: 'seconds', label: 'Seconds', default: 0, min: 0, max: 86_400, step: 0.1 },
			],
			callback: (action) => {
				const address =
					action.options.from === 'end' ? '/showplaypi/audio/loop/playhead/end' : '/showplaypi/audio/loop/playhead'
				self.send(address, [oscInt(secondsToMs(action.options.seconds))])
			},
		},
		audio_loop_select: {
			name: 'Audio playlist: play track',
			description: 'Plays a track of the current playlist.',
			options: [
				fileDropdown(
					'track',
					'Track (file name or number)',
					tracks,
					'Plays the track if it is in the current playlist. A number counts within the current playlist.',
				),
			],
			callback: (action) => {
				const track = nameOrNumber(action.options.track)
				if (track) self.send('/showplaypi/audio/loop/select', [track])
			},
		},
		audio_loop_playlist: {
			name: 'Audio playlist: switch playlist',
			description: 'Switches to a playlist (a folder in AUDIO/LOOP); keeps playing if it was playing.',
			options: [
				{
					type: 'dropdown',
					id: 'playlist',
					label: 'Playlist (name or number)',
					default: playlists[0].id,
					choices: playlists,
					allowCustom: true,
				},
			],
			callback: (action) => {
				const playlist = nameOrNumber(action.options.playlist)
				if (playlist) self.send('/showplaypi/audio/loop/playlist', [playlist])
			},
		},
		audio_loop_repeat: {
			name: 'Audio playlist: repeat',
			options: [{ type: 'dropdown', id: 'repeat', label: 'Repeat', default: 'all', choices: REPEAT_CHOICES }],
			callback: (action) => self.send('/showplaypi/audio/loop/repeat', [oscString(String(action.options.repeat))]),
		},
		audio_loop_shuffle: {
			name: 'Audio playlist: shuffle',
			options: [{ type: 'dropdown', id: 'shuffle', label: 'Shuffle', default: 'toggle', choices: SWITCH_CHOICES }],
			callback: (action) => {
				let shuffle = action.options.shuffle === 'on'
				if (action.options.shuffle === 'toggle') {
					const current = self.audioStatus?.loop.shuffle
					if (current === undefined) {
						self.log('warn', 'Shuffle not changed: the current setting is not known yet')
						return
					}
					shuffle = !current
				}
				self.send('/showplaypi/audio/loop/shuffle', [oscInt(shuffle ? 1 : 0)])
			},
		},
		audio_loop_volume: {
			name: 'Audio playlist: volume',
			description: 'Volume of the playlist in percent.',
			options: [...volumeOptions(), ...fadeOptions('immediate')],
			callback: (action) =>
				sendVolume('/showplaypi/audio/loop/volume', action.options, self.audioStatus?.loop.volume, 'playlist'),
		},
		audio_jingle_play: {
			name: 'Jingle: play',
			description:
				'Plays a jingle once; a new jingle replaces a running one. While it plays, the playlist is ' +
				'lowered or paused (see "Jingle: playlist behaviour").',
			options: [
				fileDropdown('jingle', 'Jingle (file name or number)', jingles),
				{
					type: 'checkbox',
					id: 'setVolume',
					label: 'Set the jingle volume',
					tooltip: 'Sets the jingle volume before playing; it then applies to the following jingles too.',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'number',
					id: 'volume',
					label: 'Jingle volume (%)',
					default: 100,
					min: 0,
					max: 100,
					isVisibleExpression: '$(options:setVolume)',
				},
			],
			callback: (action) => {
				const jingle = nameOrNumber(action.options.jingle)
				if (!jingle) return
				const volume = action.options.setVolume
					? [oscInt(volumeTarget({ percent: action.options.volume }, undefined) ?? 100)]
					: []
				self.send('/showplaypi/audio/jingle/play', [jingle, ...volume])
			},
		},
		audio_jingle_stop: {
			name: 'Jingle: stop',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/jingle/stop', fadeArgs(action.options)),
		},
		audio_jingle_volume: {
			name: 'Jingle: volume',
			description: 'Volume of the jingles in percent.',
			options: volumeOptions(),
			callback: (action) =>
				sendVolume('/showplaypi/audio/jingle/volume', action.options, self.audioStatus?.jingle.volume, 'jingle'),
		},
		audio_jingle_mode: {
			name: 'Jingle: playlist behaviour',
			description: 'What the playlist does while a jingle plays; afterwards it continues.',
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Playlist',
					default: 'duck',
					choices: [
						{ id: 'duck', label: 'Lower it (duck)' },
						{ id: 'pause', label: 'Pause it' },
					],
					disableAutoExpression: true,
				},
				{
					type: 'number',
					id: 'duck',
					label: 'Lower to (% of its volume)',
					tooltip: '100 = unchanged',
					default: 30,
					min: 0,
					max: 100,
					isVisibleExpression: `$(options:mode) == 'duck'`,
				},
			],
			callback: (action) => {
				if (action.options.mode === 'pause') {
					self.send('/showplaypi/audio/jingle/mode', [oscString('pause')])
				} else {
					const duck = volumeTarget({ percent: action.options.duck }, undefined) ?? 30
					self.send('/showplaypi/audio/jingle/mode', [oscString('duck'), oscInt(duck)])
				}
			},
		},
		audio_volume: {
			name: 'Audio: master volume',
			description: 'Volume of all audio (playlist and jingles) in percent.',
			options: [...volumeOptions(), ...fadeOptions('immediate')],
			callback: (action) => sendVolume('/showplaypi/audio/volume', action.options, self.audioStatus?.volume, 'master'),
		},
		audio_mute: {
			name: 'Audio: mute',
			options: [{ type: 'dropdown', id: 'mute', label: 'Sound', default: 'toggle', choices: MUTE_CHOICES }],
			callback: (action) => self.send('/showplaypi/audio/mute', [switchArgument(action.options.mute)]),
		},
		audio_stop_all: {
			name: 'Audio: stop all',
			description: 'Stops playlist and jingle, e.g. as an emergency button.',
			options: fadeOptions('immediate'),
			callback: (action) => self.send('/showplaypi/audio/stopall', fadeArgs(action.options)),
		},
	}
}

export function audioFeedbacks(self: ModuleInstance): CompanionFeedbackDefinitions<AudioFeedbacksSchema> {
	const tracks = entryChoices(self.audioFiles.playlists)
	const playlists = playlistChoices(self.audioFiles.playlists, DEFAULT_PLAYLIST)
	const jingles: DropdownChoice<string>[] = [{ id: '', label: 'Any jingle' }, ...fileChoices(self.audioFiles.jingles)]
	const status = (): ModuleInstance['audioStatus'] => self.audioStatus

	return {
		audio_loop_state: {
			type: 'boolean',
			name: 'Audio playlist: state',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [{ type: 'dropdown', id: 'state', label: 'State', default: 'playing', choices: STATE_CHOICES }],
			callback: (feedback) => status()?.loop.state === feedback.options.state,
		},
		audio_loop_track_active: {
			type: 'boolean',
			name: 'Audio playlist: track is current',
			description: 'The track is playing or paused.',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [fileDropdown('track', 'Track (file name or number)', tracks)],
			callback: (feedback) => {
				const loop = status()?.loop
				return !!loop && loop.state !== 'stopped' && isCurrentEntry(feedback.options.track, loop)
			},
		},
		audio_loop_playlist_active: {
			type: 'boolean',
			name: 'Audio playlist: playlist is current',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'playlist',
					label: 'Playlist',
					default: playlists[0].id,
					choices: playlists,
					allowCustom: true,
				},
			],
			callback: (feedback) =>
				isCurrentPlaylist(feedback.options.playlist, status()?.loop.playlist, self.audioFiles.playlists),
		},
		audio_loop_remaining_below: {
			type: 'boolean',
			name: 'Audio playlist: remaining time below',
			description: 'The current track is playing or paused and ends within the given time.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [{ type: 'number', id: 'seconds', label: 'Seconds', default: 10, min: 0, max: 86_400 }],
			callback: (feedback) => {
				const loop = status()?.loop
				if (!loop || (loop.state !== 'playing' && loop.state !== 'paused')) return false
				return loop.remaining !== undefined && loop.remaining <= secondsToMs(feedback.options.seconds)
			},
		},
		audio_loop_repeat: {
			type: 'boolean',
			name: 'Audio playlist: repeat mode',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [{ type: 'dropdown', id: 'repeat', label: 'Repeat', default: 'all', choices: REPEAT_CHOICES }],
			callback: (feedback) => status()?.loop.repeat === feedback.options.repeat,
		},
		audio_loop_shuffle: {
			type: 'boolean',
			name: 'Audio playlist: shuffle on',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => status()?.loop.shuffle === true,
		},
		audio_jingle_playing: {
			type: 'boolean',
			name: 'Jingle: playing',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'jingle',
					label: 'Jingle',
					default: '',
					choices: jingles,
					allowCustom: true,
				},
			],
			callback: (feedback) => {
				const jingle = status()?.jingle
				if (jingle?.state !== 'playing') return false
				if (!feedback.options.jingle) return true
				const number = self.audioFiles.jingles.find(
					(entry) => entry.file.toLowerCase() === jingle.file?.toLowerCase(),
				)?.number
				return isCurrentEntry(feedback.options.jingle, {
					file: jingle.file,
					title: jingleTitle(self, jingle.file),
					number,
				})
			},
		},
		audio_jingle_mode: {
			type: 'boolean',
			name: 'Jingle: playlist behaviour',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Playlist',
					default: 'duck',
					choices: [
						{ id: 'duck', label: 'Lowered (duck)' },
						{ id: 'pause', label: 'Paused' },
					],
				},
			],
			callback: (feedback) => status()?.jingle.mode === feedback.options.mode,
		},
		audio_muted: {
			type: 'boolean',
			name: 'Audio: muted',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => status()?.mute === true,
		},
	}
}

export function audioVariableDefinitions(): Record<keyof AudioVariablesSchema, { name: string }> {
	return {
		audio_loop_state: { name: 'Audio playlist: state (playing, paused, stopped)' },
		audio_loop_playlist: { name: 'Audio playlist: current playlist' },
		audio_loop_number: { name: 'Audio playlist: number of the current track' },
		audio_loop_file: { name: 'Audio playlist: file name of the current track' },
		audio_loop_title: { name: 'Audio playlist: title of the current track' },
		audio_loop_elapsed: { name: 'Audio playlist: elapsed time (m:ss)' },
		audio_loop_remaining: { name: 'Audio playlist: remaining time (m:ss)' },
		audio_loop_duration: { name: 'Audio playlist: duration of the current track (m:ss)' },
		audio_loop_elapsed_ms: { name: 'Audio playlist: elapsed time (milliseconds)' },
		audio_loop_remaining_ms: { name: 'Audio playlist: remaining time (milliseconds)' },
		audio_loop_volume: { name: 'Audio playlist: volume (%)' },
		audio_loop_repeat: { name: 'Audio playlist: repeat (all, one, off)' },
		audio_loop_shuffle: { name: 'Audio playlist: shuffle on' },
		audio_jingle_state: { name: 'Jingle: state (playing, stopped)' },
		audio_jingle_file: { name: 'Jingle: file name of the jingle playing' },
		audio_jingle_title: { name: 'Jingle: title of the jingle playing' },
		audio_jingle_elapsed: { name: 'Jingle: elapsed time (m:ss)' },
		audio_jingle_remaining: { name: 'Jingle: remaining time (m:ss)' },
		audio_jingle_remaining_ms: { name: 'Jingle: remaining time (milliseconds)' },
		audio_jingle_volume: { name: 'Jingle: volume (%)' },
		audio_jingle_mode: { name: 'Jingle: playlist behaviour (duck, pause)' },
		audio_jingle_duck: { name: 'Jingle: playlist lowered to (%)' },
		audio_volume: { name: 'Audio: master volume (%)' },
		audio_mute: { name: 'Audio: muted' },
		audio_playlist_count: { name: 'Audio: number of playlists' },
		audio_track_count: { name: 'Audio: number of tracks in the current playlist' },
		audio_jingle_count: { name: 'Audio: number of jingles' },
	}
}

export function audioVariableValues(self: ModuleInstance): AudioVariablesSchema {
	const status = self.audioStatus
	const loop = status?.loop
	const jingle = status?.jingle
	const loopActive = loop?.file !== undefined && loop.state !== 'stopped'
	const jingleActive = jingle?.state === 'playing'
	const loopDuration =
		loopActive && loop?.elapsed !== undefined && loop.remaining !== undefined
			? loop.elapsed + loop.remaining
			: undefined
	const playlist = self.audioFiles.playlists.find((candidate) => candidate.name === loop?.playlist)

	return {
		audio_loop_state: loop?.state ?? '',
		audio_loop_playlist: loop?.playlist ?? '',
		audio_loop_number: loop?.number,
		audio_loop_file: loop?.file ?? '',
		audio_loop_title: loop?.title ?? '',
		audio_loop_elapsed: loopActive ? formatDuration(loop?.elapsed) : '',
		audio_loop_remaining: loopActive ? formatDuration(loop?.remaining, true) : '',
		audio_loop_duration: formatDuration(loopDuration),
		audio_loop_elapsed_ms: loopActive ? loop?.elapsed : undefined,
		audio_loop_remaining_ms: loopActive ? loop?.remaining : undefined,
		audio_loop_volume: loop?.volume,
		audio_loop_repeat: loop?.repeat ?? '',
		audio_loop_shuffle: loop?.shuffle,
		audio_jingle_state: jingle?.state ?? '',
		audio_jingle_file: jingleActive ? (jingle?.file ?? '') : '',
		audio_jingle_title: jingleActive ? jingleTitle(self, jingle?.file) : '',
		audio_jingle_elapsed: jingleActive ? formatDuration(jingle?.elapsed) : '',
		audio_jingle_remaining: jingleActive ? formatDuration(jingle?.remaining, true) : '',
		audio_jingle_remaining_ms: jingleActive ? jingle?.remaining : undefined,
		audio_jingle_volume: jingle?.volume,
		audio_jingle_mode: jingle?.mode ?? '',
		audio_jingle_duck: jingle?.duck,
		audio_volume: status?.volume,
		audio_mute: status?.mute,
		audio_playlist_count: self.audioFiles.playlists.length,
		audio_track_count: playlist?.entries.length,
		audio_jingle_count: self.audioFiles.jingles.length,
	}
}
