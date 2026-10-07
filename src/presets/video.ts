/** Presets for the video player: transport, status, one button per entry and playlist, settings. */
import type ModuleInstance from '../main.js'
import {
	ACTIVE,
	ALARM,
	AMBER,
	BLACK,
	BLUE,
	button,
	GREEN,
	GREY,
	listId,
	ORANGE,
	PURPLE,
	RED,
	section,
	variable,
	WARNING,
	type PresetSet,
} from './helpers.js'

const NO_FADE = { useFade: false, fade: 1 } as const

export function videoPresets(self: ModuleInstance): PresetSet {
	const v = (name: string) => variable(self, name)

	const presets: PresetSet['presets'] = {
		video_play: button({
			name: 'Play (green while playing)',
			text: 'PLAY',
			bgcolor: GREY,
			keywords: ['video', 'play'],
			down: [{ actionId: 'video_play', options: NO_FADE }],
			feedbacks: [{ feedbackId: 'video_state', options: { state: 'playing' }, style: ACTIVE }],
		}),
		video_pause: button({
			name: 'Pause (amber while paused)',
			text: 'PAUSE',
			bgcolor: GREY,
			keywords: ['video', 'pause'],
			down: [{ actionId: 'video_pause', options: {} }],
			feedbacks: [{ feedbackId: 'video_state', options: { state: 'paused' }, style: WARNING }],
		}),
		video_toggle: button({
			name: 'Play/pause',
			text: 'PLAY\nPAUSE',
			bgcolor: GREY,
			keywords: ['video', 'play', 'pause', 'toggle'],
			down: [{ actionId: 'video_toggle', options: {} }],
			feedbacks: [
				{ feedbackId: 'video_state', options: { state: 'playing' }, style: ACTIVE },
				{ feedbackId: 'video_state', options: { state: 'paused' }, style: WARNING },
			],
		}),
		video_stop: button({
			name: 'Stop (fade to black)',
			text: 'STOP',
			bgcolor: RED,
			keywords: ['video', 'stop'],
			down: [{ actionId: 'video_stop', options: NO_FADE }],
			feedbacks: [{ feedbackId: 'video_state', options: { state: 'stopped' }, style: { bgcolor: BLACK, color: RED } }],
		}),
		video_previous: button({
			name: 'Previous entry',
			text: '⏮',
			bgcolor: GREY,
			keywords: ['video', 'previous'],
			down: [{ actionId: 'video_previous', options: NO_FADE }],
		}),
		video_next: button({
			name: 'Next entry',
			text: '⏭',
			bgcolor: GREY,
			keywords: ['video', 'next'],
			down: [{ actionId: 'video_next', options: NO_FADE }],
		}),
		video_restart: button({
			name: 'Restart the current entry',
			text: 'FROM\nSTART',
			bgcolor: GREY,
			keywords: ['video', 'restart'],
			down: [{ actionId: 'video_restart', options: {} }],
		}),
		video_now_playing: button({
			name: 'Title and remaining time (red in the last 10 seconds)',
			text: `${v('video_title')}\n${v('video_remaining')}`,
			bgcolor: GREY,
			keywords: ['video', 'status', 'remaining', 'countdown'],
			feedbacks: [
				{ feedbackId: 'video_state', options: { state: 'paused' }, style: WARNING },
				{ feedbackId: 'video_remaining_below', options: { seconds: 10 }, style: ALARM },
			],
		}),
		video_times: button({
			name: 'Elapsed and total time',
			text: `${v('video_elapsed')}\n${v('video_duration')}`,
			bgcolor: GREY,
			keywords: ['video', 'status', 'elapsed', 'duration'],
		}),
		video_playlist_status: button({
			name: 'Current playlist and entry number',
			text: `${v('video_playlist')}\n${v('video_number')} / ${v('video_entry_count')}`,
			bgcolor: GREY,
			keywords: ['video', 'status', 'playlist'],
		}),
		video_repeat_all: button({
			name: 'Repeat: loop the playlist',
			text: 'LOOP\nALL',
			bgcolor: PURPLE,
			keywords: ['video', 'repeat', 'loop'],
			down: [{ actionId: 'video_repeat', options: { repeat: 'all' } }],
			feedbacks: [{ feedbackId: 'video_repeat', options: { repeat: 'all' }, style: ACTIVE }],
		}),
		video_repeat_one: button({
			name: 'Repeat: loop the current entry',
			text: 'LOOP\nONE',
			bgcolor: PURPLE,
			keywords: ['video', 'repeat', 'loop'],
			down: [{ actionId: 'video_repeat', options: { repeat: 'one' } }],
			feedbacks: [{ feedbackId: 'video_repeat', options: { repeat: 'one' }, style: ACTIVE }],
		}),
		video_repeat_off: button({
			name: 'Repeat: play the playlist once',
			text: 'PLAY\nONCE',
			bgcolor: PURPLE,
			keywords: ['video', 'repeat', 'once'],
			down: [{ actionId: 'video_repeat', options: { repeat: 'off' } }],
			feedbacks: [{ feedbackId: 'video_repeat', options: { repeat: 'off' }, style: ACTIVE }],
		}),
		video_volume_up: button({
			name: 'Volume +10 %',
			text: `VOL +\n${v('video_volume')}%`,
			bgcolor: BLUE,
			keywords: ['video', 'volume'],
			down: [{ actionId: 'video_volume', options: { change: 'up', percent: 10, ...NO_FADE } }],
		}),
		video_volume_down: button({
			name: 'Volume −10 %',
			text: `VOL −\n${v('video_volume')}%`,
			bgcolor: BLUE,
			keywords: ['video', 'volume'],
			down: [{ actionId: 'video_volume', options: { change: 'down', percent: 10, ...NO_FADE } }],
		}),
		video_mute: button({
			name: 'Mute (amber while muted)',
			text: 'MUTE',
			bgcolor: BLUE,
			keywords: ['video', 'mute'],
			down: [{ actionId: 'video_mute', options: { mute: 'toggle' } }],
			feedbacks: [{ feedbackId: 'video_muted', options: {}, style: WARNING }],
		}),
	}

	// One button per entry: play it, and cue it – the current entry lights up in both groups
	const playIds: string[] = []
	const cueIds: string[] = []
	const seen = new Set<string>()
	for (const playlist of self.videoPlaylists) {
		for (const entry of playlist.entries) {
			const key = entry.file.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			const label = self.videoPlaylists.length > 1 ? `${playlist.name}: ${entry.title}` : entry.title

			const playId = listId('video_entry', entry.file)
			playIds.push(playId)
			presets[playId] = button({
				name: `Play ${label}`,
				text: entry.title,
				bgcolor: entry.type === 'still' ? ORANGE : BLUE,
				keywords: ['video', 'entry', entry.title],
				down: [{ actionId: 'video_select', options: { entry: entry.file, ...NO_FADE } }],
				feedbacks: [{ feedbackId: 'video_entry_active', options: { entry: entry.file }, style: ACTIVE }],
			})

			const cueId = listId('video_cue', entry.file)
			cueIds.push(cueId)
			presets[cueId] = button({
				name: `Cue ${label}`,
				text: `CUE\n${entry.title}`,
				bgcolor: GREY,
				keywords: ['video', 'cue', entry.title],
				down: [{ actionId: 'video_cue', options: { entry: entry.file } }],
				feedbacks: [
					{ feedbackId: 'video_entry_active', options: { entry: entry.file }, style: { bgcolor: AMBER, color: BLACK } },
				],
			})
		}
	}

	const playlistIds: string[] = []
	for (const playlist of self.videoPlaylists) {
		const id = listId('video_playlist', playlist.name)
		playlistIds.push(id)
		presets[id] = button({
			name: `Playlist ${playlist.name}`,
			text: `▶ ${playlist.name}`,
			bgcolor: GREEN,
			keywords: ['video', 'playlist', playlist.name],
			down: [{ actionId: 'video_playlist', options: { playlist: playlist.name, ...NO_FADE } }],
			feedbacks: [{ feedbackId: 'video_playlist_active', options: { playlist: playlist.name }, style: ACTIVE }],
		})
	}

	return {
		sections: [
			section('video', 'Video', [
				{
					id: 'video_transport',
					name: 'Transport',
					presets: [
						'video_play',
						'video_pause',
						'video_toggle',
						'video_stop',
						'video_previous',
						'video_next',
						'video_restart',
					],
				},
				{ id: 'video_status', name: 'Status', presets: ['video_now_playing', 'video_times', 'video_playlist_status'] },
				{
					id: 'video_entries',
					name: 'Play entry',
					description: 'One button per file. Entries only play if they are in the current playlist.',
					presets: playIds,
				},
				{
					id: 'video_cues',
					name: 'Cue entry',
					description: 'Shows the first frame and waits; "Play" starts it without delay.',
					presets: cueIds,
				},
				{ id: 'video_playlists', name: 'Playlists', presets: playlistIds },
				{
					id: 'video_settings',
					name: 'Repeat and sound',
					presets: [
						'video_repeat_all',
						'video_repeat_one',
						'video_repeat_off',
						'video_volume_up',
						'video_volume_down',
						'video_mute',
					],
				},
			]),
		],
		presets,
	}
}
