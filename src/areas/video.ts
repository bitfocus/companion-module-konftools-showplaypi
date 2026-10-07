/**
 * Video mode: the full-screen player for videos and still images from the SHOWPLAYPI drive.
 * Entries and playlists are sent by name (see choices.ts).
 */
import type { CompanionActionDefinitions, CompanionFeedbackDefinitions, DropdownChoice } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import { formatDuration, secondsToMs } from '../format.js'
import {
	entryChoices,
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
import { fadeArgs, fadeOptions, type FadeOptions } from '../options.js'
import { oscInt, oscString } from '../osc.js'
import type { VideoState } from '../players.js'
import { AMBER, BLACK, GREEN, RED, WHITE } from './common.js'

type NoOptions = Record<string, never>

export type VideoActionsSchema = {
	video_play: { options: FadeOptions }
	video_pause: { options: NoOptions }
	video_toggle: { options: NoOptions }
	video_stop: { options: FadeOptions }
	video_next: { options: FadeOptions }
	video_previous: { options: FadeOptions }
	video_restart: { options: NoOptions }
	video_playhead: { options: { from: 'start' | 'end'; seconds: number } }
	video_select: { options: { entry: string } & FadeOptions }
	video_cue: { options: { entry: string } }
	video_playlist: { options: { playlist: string } & FadeOptions }
	video_repeat: { options: { repeat: 'all' | 'one' | 'off' } }
	video_fade: { options: { seconds: number } }
	video_still_duration: { options: { seconds: number } }
	video_volume: { options: VolumeOptions & FadeOptions }
	video_mute: { options: { mute: SwitchChoice } }
}

export type VideoFeedbacksSchema = {
	video_state: { type: 'boolean'; options: { state: VideoState } }
	video_entry_active: { type: 'boolean'; options: { entry: string } }
	video_playlist_active: { type: 'boolean'; options: { playlist: string } }
	video_repeat: { type: 'boolean'; options: { repeat: 'all' | 'one' | 'off' } }
	video_muted: { type: 'boolean'; options: NoOptions }
	video_remaining_below: { type: 'boolean'; options: { seconds: number } }
	blackout: { type: 'boolean'; options: NoOptions }
}

export type VideoVariablesSchema = {
	video_state: string
	video_playlist: string
	video_number: number | undefined
	video_file: string
	video_title: string
	video_type: string
	video_elapsed: string
	video_remaining: string
	video_duration: string
	video_elapsed_ms: number | undefined
	video_remaining_ms: number | undefined
	video_repeat: string
	video_volume: number | undefined
	video_mute: boolean | undefined
	video_fade: number | undefined
	video_playlist_count: number
	video_entry_count: number | undefined
	blackout: boolean | undefined
}

/** Playlist 1, the VIDEO folder itself, always exists. */
const DEFAULT_PLAYLIST = 'VIDEO'

const REPEAT_CHOICES: DropdownChoice<'all' | 'one' | 'off'>[] = [
	{ id: 'all', label: 'Loop the playlist' },
	{ id: 'one', label: 'Loop the current entry' },
	{ id: 'off', label: 'Play the playlist once' },
]

const STATE_CHOICES: DropdownChoice<VideoState>[] = [
	{ id: 'playing', label: 'Playing' },
	{ id: 'paused', label: 'Paused' },
	{ id: 'cued', label: 'Cued (first frame, waiting for play)' },
	{ id: 'stopped', label: 'Stopped (black)' },
]

export function videoActions(self: ModuleInstance): CompanionActionDefinitions<VideoActionsSchema> {
	const playlists = self.videoPlaylists
	const entries = entryChoices(playlists)
	const playlistOptions = playlistChoices(playlists, DEFAULT_PLAYLIST)
	const entryOption = fileDropdown(
		'entry',
		'Entry (file name or number)',
		entries,
		'Plays the entry if it is in the current playlist. A number counts within the current playlist.',
	)

	return {
		video_play: {
			name: 'Video: play',
			description: 'Starts or resumes playback.',
			options: fadeOptions(),
			callback: (action) => self.send('/showplaypi/video/play', fadeArgs(action.options)),
		},
		video_pause: {
			name: 'Video: pause',
			description: 'A video holds its frame, a still image stays and its timer stops.',
			options: [],
			callback: () => self.send('/showplaypi/video/pause'),
		},
		video_toggle: {
			name: 'Video: play/pause',
			description: 'Pauses while playing, plays otherwise.',
			options: [],
			callback: () => self.send('/showplaypi/video/toggle'),
		},
		video_stop: {
			name: 'Video: stop',
			description: 'Fades to black and stays black; the HDMI signal is kept. The next play starts at the beginning.',
			options: fadeOptions(),
			callback: (action) => self.send('/showplaypi/video/stop', fadeArgs(action.options)),
		},
		video_next: {
			name: 'Video: next entry',
			options: fadeOptions(),
			callback: (action) => self.send('/showplaypi/video/next', fadeArgs(action.options)),
		},
		video_previous: {
			name: 'Video: previous entry',
			options: fadeOptions(),
			callback: (action) => self.send('/showplaypi/video/previous', fadeArgs(action.options)),
		},
		video_restart: {
			name: 'Video: restart entry',
			description: 'Plays the current entry from the beginning.',
			options: [],
			callback: () => self.send('/showplaypi/video/restart'),
		},
		video_playhead: {
			name: 'Video: jump to time',
			description:
				'Sets the playhead of the current entry. Playing stays playing, paused stays paused. ' +
				'From the end: e.g. 10 = ten seconds before the end.',
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
				const address = action.options.from === 'end' ? '/showplaypi/video/playhead/end' : '/showplaypi/video/playhead'
				self.send(address, [oscInt(secondsToMs(action.options.seconds))])
			},
		},
		video_select: {
			name: 'Video: play entry',
			description: 'Jumps to an entry of the current playlist and plays it.',
			options: [entryOption, ...fadeOptions()],
			callback: (action) => {
				const entry = nameOrNumber(action.options.entry)
				if (!entry) return
				self.send('/showplaypi/video/select', [entry, ...fadeArgs(action.options)])
			},
		},
		video_cue: {
			name: 'Video: cue entry',
			description:
				'Shows the first frame of an entry of the current playlist and waits: "Video: play" then ' +
				'starts it without delay, e.g. a walk-in video on cue.',
			options: [entryOption],
			callback: (action) => {
				const entry = nameOrNumber(action.options.entry)
				if (entry) self.send('/showplaypi/video/cue', [entry])
			},
		},
		video_playlist: {
			name: 'Video: switch playlist',
			description: 'Switches to a playlist (a folder in VIDEO) and starts its first entry.',
			options: [
				{
					type: 'dropdown',
					id: 'playlist',
					label: 'Playlist (name or number)',
					default: playlistOptions[0].id,
					choices: playlistOptions,
					allowCustom: true,
				},
				...fadeOptions(),
			],
			callback: (action) => {
				const playlist = nameOrNumber(action.options.playlist)
				if (playlist) self.send('/showplaypi/video/playlist', [playlist, ...fadeArgs(action.options)])
			},
		},
		video_repeat: {
			name: 'Video: repeat',
			description: 'At the end of a playlist played once, the picture fades to black.',
			options: [{ type: 'dropdown', id: 'repeat', label: 'Repeat', default: 'all', choices: REPEAT_CHOICES }],
			callback: (action) => self.send('/showplaypi/video/repeat', [oscString(String(action.options.repeat))]),
		},
		video_fade: {
			name: 'Video: default fade time',
			description: 'The fade time used whenever a command has no fade time of its own. Until the device restarts.',
			options: [{ type: 'number', id: 'seconds', label: 'Seconds', default: 1, min: 0, max: 60, step: 0.1 }],
			callback: (action) => self.send('/showplaypi/video/fade', [oscInt(secondsToMs(action.options.seconds))]),
		},
		video_still_duration: {
			name: 'Video: still image duration',
			description:
				'How long still images stay, unless the file name says otherwise (e.g. "Sponsors [15sec].jpg"). ' +
				'Until the device restarts.',
			options: [{ type: 'number', id: 'seconds', label: 'Seconds', default: 10, min: 0.1, max: 86_400, step: 0.1 }],
			callback: (action) =>
				self.send('/showplaypi/video/stillduration', [oscInt(Math.max(100, secondsToMs(action.options.seconds)))]),
		},
		video_volume: {
			name: 'Video: volume',
			description: 'Volume of the videos in percent.',
			options: [...volumeOptions(), ...fadeOptions()],
			callback: (action) => {
				const target = volumeTarget(action.options, self.videoStatus?.volume)
				if (target === undefined) {
					self.log('warn', 'Volume not changed: the current video volume is not known yet')
					return
				}
				self.send('/showplaypi/video/volume', [oscInt(target), ...fadeArgs(action.options)])
			},
		},
		video_mute: {
			name: 'Video: mute',
			options: [
				{
					type: 'dropdown',
					id: 'mute',
					label: 'Sound',
					default: 'toggle',
					choices: [
						{ id: 'on', label: 'Mute' },
						{ id: 'off', label: 'Unmute' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: (action) => self.send('/showplaypi/video/mute', [switchArgument(action.options.mute)]),
		},
	}
}

export function videoFeedbacks(self: ModuleInstance): CompanionFeedbackDefinitions<VideoFeedbacksSchema> {
	const entries = entryChoices(self.videoPlaylists)
	const playlistOptions = playlistChoices(self.videoPlaylists, DEFAULT_PLAYLIST)
	const status = (): ModuleInstance['videoStatus'] => self.videoStatus

	return {
		video_state: {
			type: 'boolean',
			name: 'Video: player state',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [{ type: 'dropdown', id: 'state', label: 'State', default: 'playing', choices: STATE_CHOICES }],
			callback: (feedback) => status()?.state === feedback.options.state,
		},
		video_entry_active: {
			type: 'boolean',
			name: 'Video: entry is current',
			description: 'The entry is playing, paused or cued.',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [fileDropdown('entry', 'Entry (file name or number)', entries)],
			callback: (feedback) => {
				const current = status()
				return !!current && current.state !== 'stopped' && isCurrentEntry(feedback.options.entry, current)
			},
		},
		video_playlist_active: {
			type: 'boolean',
			name: 'Video: playlist is current',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'playlist',
					label: 'Playlist',
					default: playlistOptions[0].id,
					choices: playlistOptions,
					allowCustom: true,
				},
			],
			callback: (feedback) => isCurrentPlaylist(feedback.options.playlist, status()?.playlist, self.videoPlaylists),
		},
		video_repeat: {
			type: 'boolean',
			name: 'Video: repeat mode',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [{ type: 'dropdown', id: 'repeat', label: 'Repeat', default: 'all', choices: REPEAT_CHOICES }],
			callback: (feedback) => status()?.repeat === feedback.options.repeat,
		},
		video_muted: {
			type: 'boolean',
			name: 'Video: muted',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => status()?.mute === true,
		},
		video_remaining_below: {
			type: 'boolean',
			name: 'Video: remaining time below',
			description: 'The current entry is playing or paused and ends within the given time.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [{ type: 'number', id: 'seconds', label: 'Seconds', default: 10, min: 0, max: 86_400 }],
			callback: (feedback) => {
				const current = status()
				if (!current || (current.state !== 'playing' && current.state !== 'paused')) return false
				return current.remaining !== undefined && current.remaining <= secondsToMs(feedback.options.seconds)
			},
		},
		blackout: {
			type: 'boolean',
			name: 'Blackout',
			description: 'The picture is black because of a blackout.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => status()?.blackout === true,
		},
	}
}

export function videoVariableDefinitions(): Record<keyof VideoVariablesSchema, { name: string }> {
	return {
		video_state: { name: 'Video: state (playing, paused, cued, stopped)' },
		video_playlist: { name: 'Video: current playlist' },
		video_number: { name: 'Video: number of the current entry' },
		video_file: { name: 'Video: file name of the current entry' },
		video_title: { name: 'Video: title of the current entry' },
		video_type: { name: 'Video: type of the current entry (video, still)' },
		video_elapsed: { name: 'Video: elapsed time (m:ss)' },
		video_remaining: { name: 'Video: remaining time (m:ss)' },
		video_duration: { name: 'Video: duration of the current entry (m:ss)' },
		video_elapsed_ms: { name: 'Video: elapsed time (milliseconds)' },
		video_remaining_ms: { name: 'Video: remaining time (milliseconds)' },
		video_repeat: { name: 'Video: repeat (all, one, off)' },
		video_volume: { name: 'Video: volume (%)' },
		video_mute: { name: 'Video: muted' },
		video_fade: { name: 'Video: default fade time (seconds)' },
		video_playlist_count: { name: 'Video: number of playlists' },
		video_entry_count: { name: 'Video: number of entries in the current playlist' },
		blackout: { name: 'Blackout on' },
	}
}

export function videoVariableValues(self: ModuleInstance): VideoVariablesSchema {
	const status = self.videoStatus
	const elapsed = status?.elapsed
	const remaining = status?.remaining
	const active = status?.file !== undefined
	const duration = active && elapsed !== undefined && remaining !== undefined ? elapsed + remaining : undefined
	const playlist = self.videoPlaylists.find((candidate) => candidate.name === status?.playlist)

	return {
		video_state: status?.state ?? '',
		video_playlist: status?.playlist ?? '',
		video_number: status?.number,
		video_file: status?.file ?? '',
		video_title: status?.title ?? '',
		video_type: status?.type ?? '',
		video_elapsed: active ? formatDuration(elapsed) : '',
		video_remaining: active ? formatDuration(remaining, true) : '',
		video_duration: formatDuration(duration),
		video_elapsed_ms: active ? elapsed : undefined,
		video_remaining_ms: active ? remaining : undefined,
		video_repeat: status?.repeat ?? '',
		video_volume: status?.volume,
		video_mute: status?.mute,
		video_fade: status?.fade === undefined ? undefined : status.fade / 1000,
		video_playlist_count: self.videoPlaylists.length,
		video_entry_count: playlist?.entries.length,
		blackout: status?.blackout,
	}
}
