/** Presets for the audio player: playlist transport and status, tracks, playlists, jingles, volumes. */
import type ModuleInstance from '../main.js'
import {
	ACTIVE,
	ALARM,
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
const FADE_2S = { useFade: true, fade: 2 } as const

export function audioPresets(self: ModuleInstance): PresetSet {
	const v = (name: string) => variable(self, name)

	const presets: PresetSet['presets'] = {
		audio_loop_play: button({
			name: 'Playlist: play, fading in over 2 seconds (green while playing)',
			text: 'MUSIC\nPLAY',
			bgcolor: GREY,
			keywords: ['audio', 'playlist', 'play'],
			down: [{ actionId: 'audio_loop_play', options: FADE_2S }],
			feedbacks: [{ feedbackId: 'audio_loop_state', options: { state: 'playing' }, style: ACTIVE }],
		}),
		audio_loop_pause: button({
			name: 'Playlist: pause, fading out over 2 seconds (amber while paused)',
			text: 'MUSIC\nPAUSE',
			bgcolor: GREY,
			keywords: ['audio', 'playlist', 'pause'],
			down: [{ actionId: 'audio_loop_pause', options: FADE_2S }],
			feedbacks: [{ feedbackId: 'audio_loop_state', options: { state: 'paused' }, style: WARNING }],
		}),
		audio_loop_toggle: button({
			name: 'Playlist: play/pause with a 2 second fade',
			text: 'MUSIC\nPLAY/PAUSE',
			bgcolor: GREY,
			keywords: ['audio', 'playlist', 'play', 'pause', 'toggle'],
			down: [{ actionId: 'audio_loop_toggle', options: FADE_2S }],
			feedbacks: [
				{ feedbackId: 'audio_loop_state', options: { state: 'playing' }, style: ACTIVE },
				{ feedbackId: 'audio_loop_state', options: { state: 'paused' }, style: WARNING },
			],
		}),
		audio_loop_stop: button({
			name: 'Playlist: stop, fading out over 2 seconds',
			text: 'MUSIC\nSTOP',
			bgcolor: RED,
			keywords: ['audio', 'playlist', 'stop'],
			down: [{ actionId: 'audio_loop_stop', options: FADE_2S }],
		}),
		audio_loop_previous: button({
			name: 'Playlist: previous track',
			text: '⏮',
			bgcolor: GREY,
			keywords: ['audio', 'playlist', 'previous'],
			down: [{ actionId: 'audio_loop_previous', options: {} }],
		}),
		audio_loop_next: button({
			name: 'Playlist: next track',
			text: '⏭',
			bgcolor: GREY,
			keywords: ['audio', 'playlist', 'next'],
			down: [{ actionId: 'audio_loop_next', options: {} }],
		}),
		audio_now_playing: button({
			name: 'Playlist: track and remaining time',
			text: `${v('audio_loop_title')}\n${v('audio_loop_remaining')}`,
			bgcolor: GREY,
			keywords: ['audio', 'status', 'remaining'],
			feedbacks: [
				{ feedbackId: 'audio_loop_state', options: { state: 'paused' }, style: WARNING },
				{ feedbackId: 'audio_loop_remaining_below', options: { seconds: 10 }, style: ALARM },
			],
		}),
		audio_playlist_status: button({
			name: 'Playlist: name and track number',
			text: `${v('audio_loop_playlist')}\n${v('audio_loop_number')} / ${v('audio_track_count')}`,
			bgcolor: GREY,
			keywords: ['audio', 'status', 'playlist'],
		}),
		audio_jingle_status: button({
			name: 'Jingle playing and its remaining time (red while a jingle plays)',
			text: `${v('audio_jingle_title')}\n${v('audio_jingle_remaining')}`,
			bgcolor: GREY,
			keywords: ['audio', 'jingle', 'status'],
			feedbacks: [{ feedbackId: 'audio_jingle_playing', options: { jingle: '' }, style: ALARM }],
		}),
		audio_jingle_stop: button({
			name: 'Jingle: stop',
			text: 'JINGLE\nSTOP',
			bgcolor: RED,
			keywords: ['audio', 'jingle', 'stop'],
			down: [{ actionId: 'audio_jingle_stop', options: NO_FADE }],
		}),
		audio_stop_all: button({
			name: 'Stop all audio',
			text: 'STOP\nALL AUDIO',
			bgcolor: RED,
			keywords: ['audio', 'stop', 'emergency'],
			down: [{ actionId: 'audio_stop_all', options: NO_FADE }],
		}),
		audio_volume_up: button({
			name: 'Master volume +10 %',
			text: `MASTER +\n${v('audio_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'master'],
			down: [{ actionId: 'audio_volume', options: { change: 'up', percent: 10, ...NO_FADE } }],
		}),
		audio_volume_down: button({
			name: 'Master volume −10 %',
			text: `MASTER −\n${v('audio_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'master'],
			down: [{ actionId: 'audio_volume', options: { change: 'down', percent: 10, ...NO_FADE } }],
		}),
		audio_mute: button({
			name: 'Master mute (amber while muted)',
			text: 'AUDIO\nMUTE',
			bgcolor: BLUE,
			keywords: ['audio', 'mute'],
			down: [{ actionId: 'audio_mute', options: { mute: 'toggle' } }],
			feedbacks: [{ feedbackId: 'audio_muted', options: {}, style: WARNING }],
		}),
		audio_loop_volume_up: button({
			name: 'Playlist volume +10 %',
			text: `MUSIC +\n${v('audio_loop_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'playlist'],
			down: [{ actionId: 'audio_loop_volume', options: { change: 'up', percent: 10, ...NO_FADE } }],
		}),
		audio_loop_volume_down: button({
			name: 'Playlist volume −10 %',
			text: `MUSIC −\n${v('audio_loop_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'playlist'],
			down: [{ actionId: 'audio_loop_volume', options: { change: 'down', percent: 10, ...NO_FADE } }],
		}),
		audio_jingle_volume_up: button({
			name: 'Jingle volume +10 %',
			text: `JINGLE +\n${v('audio_jingle_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'jingle'],
			down: [{ actionId: 'audio_jingle_volume', options: { change: 'up', percent: 10 } }],
		}),
		audio_jingle_volume_down: button({
			name: 'Jingle volume −10 %',
			text: `JINGLE −\n${v('audio_jingle_volume')}%`,
			bgcolor: BLUE,
			keywords: ['audio', 'volume', 'jingle'],
			down: [{ actionId: 'audio_jingle_volume', options: { change: 'down', percent: 10 } }],
		}),
		audio_jingle_duck: button({
			name: 'Playlist is lowered to 30 % while a jingle plays',
			text: 'JINGLE\nDUCK',
			bgcolor: PURPLE,
			keywords: ['audio', 'jingle', 'duck'],
			down: [{ actionId: 'audio_jingle_mode', options: { mode: 'duck', duck: 30 } }],
			feedbacks: [{ feedbackId: 'audio_jingle_mode', options: { mode: 'duck' }, style: ACTIVE }],
		}),
		audio_jingle_pause: button({
			name: 'Playlist pauses while a jingle plays',
			text: 'JINGLE\nPAUSES',
			bgcolor: PURPLE,
			keywords: ['audio', 'jingle', 'pause'],
			down: [{ actionId: 'audio_jingle_mode', options: { mode: 'pause', duck: 30 } }],
			feedbacks: [{ feedbackId: 'audio_jingle_mode', options: { mode: 'pause' }, style: ACTIVE }],
		}),
		audio_shuffle: button({
			name: 'Shuffle (green while on)',
			text: 'SHUFFLE',
			bgcolor: PURPLE,
			keywords: ['audio', 'shuffle'],
			down: [{ actionId: 'audio_loop_shuffle', options: { shuffle: 'toggle' } }],
			feedbacks: [{ feedbackId: 'audio_loop_shuffle', options: {}, style: ACTIVE }],
		}),
		audio_repeat_all: button({
			name: 'Repeat: loop the playlist',
			text: 'LOOP\nALL',
			bgcolor: PURPLE,
			keywords: ['audio', 'repeat', 'loop'],
			down: [{ actionId: 'audio_loop_repeat', options: { repeat: 'all' } }],
			feedbacks: [{ feedbackId: 'audio_loop_repeat', options: { repeat: 'all' }, style: ACTIVE }],
		}),
		audio_repeat_one: button({
			name: 'Repeat: loop the current track',
			text: 'LOOP\nONE',
			bgcolor: PURPLE,
			keywords: ['audio', 'repeat', 'loop'],
			down: [{ actionId: 'audio_loop_repeat', options: { repeat: 'one' } }],
			feedbacks: [{ feedbackId: 'audio_loop_repeat', options: { repeat: 'one' }, style: ACTIVE }],
		}),
		audio_repeat_off: button({
			name: 'Repeat: play the playlist once',
			text: 'PLAY\nONCE',
			bgcolor: PURPLE,
			keywords: ['audio', 'repeat', 'once'],
			down: [{ actionId: 'audio_loop_repeat', options: { repeat: 'off' } }],
			feedbacks: [{ feedbackId: 'audio_loop_repeat', options: { repeat: 'off' }, style: ACTIVE }],
		}),
	}

	const jingleIds: string[] = []
	for (const jingle of self.audioFiles.jingles) {
		const id = listId('audio_jingle', jingle.file)
		jingleIds.push(id)
		presets[id] = button({
			name: `Jingle: ${jingle.title}`,
			text: jingle.title,
			bgcolor: ORANGE,
			keywords: ['audio', 'jingle', jingle.title],
			down: [{ actionId: 'audio_jingle_play', options: { jingle: jingle.file, setVolume: false, volume: 100 } }],
			feedbacks: [{ feedbackId: 'audio_jingle_playing', options: { jingle: jingle.file }, style: ALARM }],
		})
	}

	const trackIds: string[] = []
	const seen = new Set<string>()
	for (const playlist of self.audioFiles.playlists) {
		for (const track of playlist.entries) {
			const key = track.file.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			const id = listId('audio_track', track.file)
			trackIds.push(id)
			presets[id] = button({
				name: self.audioFiles.playlists.length > 1 ? `Track ${playlist.name}: ${track.title}` : `Track ${track.title}`,
				text: track.title,
				bgcolor: BLUE,
				keywords: ['audio', 'track', track.title],
				down: [{ actionId: 'audio_loop_select', options: { track: track.file } }],
				feedbacks: [{ feedbackId: 'audio_loop_track_active', options: { track: track.file }, style: ACTIVE }],
			})
		}
	}

	const playlistIds: string[] = []
	for (const playlist of self.audioFiles.playlists) {
		const id = listId('audio_playlist', playlist.name)
		playlistIds.push(id)
		presets[id] = button({
			name: `Playlist ${playlist.name}`,
			text: `♫ ${playlist.name}`,
			bgcolor: GREEN,
			keywords: ['audio', 'playlist', playlist.name],
			down: [{ actionId: 'audio_loop_playlist', options: { playlist: playlist.name } }],
			feedbacks: [{ feedbackId: 'audio_loop_playlist_active', options: { playlist: playlist.name }, style: ACTIVE }],
		})
	}

	return {
		sections: [
			section('audio', 'Audio', [
				{
					id: 'audio_transport',
					name: 'Playlist',
					presets: [
						'audio_loop_play',
						'audio_loop_pause',
						'audio_loop_toggle',
						'audio_loop_stop',
						'audio_loop_previous',
						'audio_loop_next',
						'audio_now_playing',
						'audio_playlist_status',
					],
				},
				{
					id: 'audio_jingles',
					name: 'Jingles',
					description: 'One button per jingle; it lights up red while the jingle plays.',
					presets: [...jingleIds, 'audio_jingle_status', 'audio_jingle_stop'],
				},
				{
					id: 'audio_tracks',
					name: 'Tracks',
					description: 'One button per track. Tracks only play if they are in the current playlist.',
					presets: trackIds,
				},
				{ id: 'audio_playlists', name: 'Playlists', presets: playlistIds },
				{
					id: 'audio_volumes',
					name: 'Volumes',
					presets: [
						'audio_stop_all',
						'audio_mute',
						'audio_volume_up',
						'audio_volume_down',
						'audio_loop_volume_up',
						'audio_loop_volume_down',
						'audio_jingle_volume_up',
						'audio_jingle_volume_down',
					],
				},
				{
					id: 'audio_settings',
					name: 'Jingle behaviour, shuffle and repeat',
					presets: [
						'audio_jingle_duck',
						'audio_jingle_pause',
						'audio_shuffle',
						'audio_repeat_all',
						'audio_repeat_one',
						'audio_repeat_off',
					],
				},
			]),
		],
		presets,
	}
}
