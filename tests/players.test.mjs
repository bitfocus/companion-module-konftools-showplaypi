// Reading the replies of the video player, and the dropdowns built from them.
import { createChecker } from './helpers.mjs'
const {
	parseVideoStatus,
	parseVideoFiles,
	playlistsFingerprint,
	parseAudioStatus,
	parseAudioFiles,
	audioFingerprint,
	parseEmulators,
} = await import('../dist/players.js')
const { emulatorChoices, pageList, tabletArgs } = await import('../dist/areas/companion.js')
const { entryChoices, playlistChoices, isCurrentEntry } = await import('../dist/choices.js')
const { check, finish } = createChecker()

// As written by write_status() in showplaypi-video
const status = parseVideoStatus(
	JSON.stringify({
		state: 'playing',
		playlist: 'VIDEO',
		number: 2,
		file: '020_Sponsors [15sec].jpg',
		title: '020_Sponsors',
		type: 'still',
		elapsed: 4200,
		remaining: 10800,
		repeat: 'all',
		fade: 1000,
		volume: 80,
		mute: false,
		blackout: false,
	}),
)
check('state', status.state === 'playing')
check('entry', status.number === 2 && status.file === '020_Sponsors [15sec].jpg' && status.type === 'still')
check('times', status.elapsed === 4200 && status.remaining === 10800)
check('settings', status.repeat === 'all' && status.fade === 1000 && status.volume === 80 && status.mute === false)
check('blackout', status.blackout === false)

const empty = parseVideoStatus('{"state": "stopped", "number": null, "file": null, "title": null, "type": null}')
check(
	'an empty playlist has no entry',
	empty.state === 'stopped' && empty.file === undefined && empty.number === undefined,
)
check('an unknown state is ignored', parseVideoStatus('{"state": "dancing"}').state === undefined)

// The example from docs/OSC.md
const files = parseVideoFiles(`{
  "playlists": [
    {"number": 1, "name": "VIDEO", "default": true, "entries": [
      {"number": 1, "file": "010_Intro.mp4", "title": "010_Intro", "type": "video", "duration": 42000},
      {"number": 2, "file": "020_Sponsors [15sec].jpg", "title": "020_Sponsors", "type": "still", "duration": 15000}
    ]},
    {"number": 2, "name": "Morning", "default": false, "entries": [
      {"number": 1, "file": "010_Intro.mp4", "title": "010_Intro", "type": "video", "duration": null},
      {"number": 2, "file": "Welcome.mp4", "title": "Welcome", "type": "video", "duration": null}
    ]}
  ]
}`)
check('two playlists', files.length === 2 && files[0].name === 'VIDEO' && files[0].isDefault)
check('entries', files[0].entries.length === 2 && files[0].entries[1].duration === 15000)
check('unknown duration', files[1].entries[1].duration === undefined)

const playlists = playlistChoices(files, 'VIDEO')
check('playlist choices by name', playlists.map((c) => c.id).join() === 'VIDEO,Morning')
check('playlist labels with number', playlists[1].label === '2 · Morning')
check('without a list, VIDEO is offered', playlistChoices([], 'VIDEO')[0].id === 'VIDEO')

const entries = entryChoices(files)
check(
	'entry choices by file name, each file once',
	entries.map((c) => c.id).join() === '010_Intro.mp4,020_Sponsors [15sec].jpg,Welcome.mp4',
	entries.map((c) => c.id).join(),
)
check('labels name the playlist when there are several', entries[2].label === 'Morning › 2 · Welcome')
check('one playlist: no playlist in the label', entryChoices([files[0]])[0].label === '1 · 010_Intro')

const current = { file: '020_Sponsors [15sec].jpg', title: '020_Sponsors', number: 2 }
check('current entry by file name', isCurrentEntry('020_Sponsors [15sec].jpg', current))
check('current entry ignores case', isCurrentEntry('020_SPONSORS [15SEC].JPG', current))
check('current entry by name without extension', isCurrentEntry('020_Sponsors [15sec]', current))
check('current entry by title', isCurrentEntry('020_Sponsors', current))
check('current entry by number', isCurrentEntry('2', current))
check('another entry is not current', !isCurrentEntry('010_Intro.mp4', current))
check('nothing chosen is never current', !isCurrentEntry('', current))

check(
	'fingerprint ignores durations',
	playlistsFingerprint(files) ===
		playlistsFingerprint(files.map((p) => ({ ...p, entries: p.entries.map((e) => ({ ...e, duration: 1 })) }))),
)
check(
	'fingerprint notices a new file',
	playlistsFingerprint(files) !==
		playlistsFingerprint([files[0], { ...files[1], entries: [...files[1].entries, { file: 'New.mp4' }] }]),
)

// The audio player: the status example from docs/OSC.md plus the jingle fields written by showplaypi-audio
const audio = parseAudioStatus(
	JSON.stringify({
		loop: {
			state: 'playing',
			playlist: 'LOOP',
			number: 1,
			file: 'Lounge 01.mp3',
			title: 'Lounge 01',
			elapsed: 83200,
			remaining: 131300,
			volume: 60,
			repeat: 'all',
			shuffle: false,
		},
		jingle: {
			state: 'playing',
			file: '01_Opening.wav',
			elapsed: 1000,
			remaining: 7400,
			volume: 100,
			mode: 'duck',
			duck: 30,
		},
		volume: 80,
		mute: false,
	}),
)
check('audio loop', audio.loop.state === 'playing' && audio.loop.title === 'Lounge 01' && audio.loop.shuffle === false)
check('audio loop times', audio.loop.elapsed === 83200 && audio.loop.remaining === 131300)
check(
	'audio jingle',
	audio.jingle.state === 'playing' && audio.jingle.file === '01_Opening.wav' && audio.jingle.duck === 30,
)
check('audio master', audio.volume === 80 && audio.mute === false)
const quiet = parseAudioStatus(
	'{"loop": {"state": "stopped", "file": null}, "jingle": {"state": "stopped", "file": null}}',
)
check(
	'stopped audio has no file',
	quiet.loop.state === 'stopped' && quiet.loop.file === undefined && quiet.jingle.file === undefined,
)
check('missing parts do not break', parseAudioStatus('{}').loop.state === undefined)

// The file list example from docs/OSC.md
const audioFiles = parseAudioFiles(
	JSON.stringify({
		jingles: [
			{ number: 1, file: '01_Opening.wav', title: '01_Opening', duration: 8400 },
			{ number: 2, file: '02_Applause.mp3', title: '02_Applause', duration: 12000 },
		],
		playlists: [
			{
				number: 1,
				name: 'LOOP',
				default: true,
				tracks: [{ number: 1, file: 'Lounge 01.mp3', title: 'Lounge 01', duration: 214500 }],
			},
			{
				number: 2,
				name: 'Admission',
				default: false,
				tracks: [{ number: 1, file: 'Walk-in.mp3', title: 'Walk-in', duration: 187000 }],
			},
		],
	}),
)
check('jingles', audioFiles.jingles.map((j) => j.file).join() === '01_Opening.wav,02_Applause.mp3')
check(
	'audio playlists with tracks',
	audioFiles.playlists[1].name === 'Admission' && audioFiles.playlists[1].entries[0].file === 'Walk-in.mp3',
)
check(
	'audio fingerprint notices a new jingle',
	audioFingerprint(audioFiles) !==
		audioFingerprint({ ...audioFiles, jingles: [...audioFiles.jingles, { file: 'x.wav' }] }),
)

// Companion: the emulator list example from docs/OSC.md
const emulators = parseEmulators(
	'{"emulators": [{"id": "JGogBBWueb55Y9MWfTphX", "name": "Stage left", "columns": 8, "rows": 4}]}',
)
check('emulator', emulators.length === 1 && emulators[0].id === 'JGogBBWueb55Y9MWfTphX' && emulators[0].columns === 8)
check('no emulators', parseEmulators('{"emulators": []}').length === 0)
check('emulator without name uses the id', parseEmulators('{"emulators": [{"id": "abc"}]}')[0].name === 'abc')
const emulatorOptions = emulatorChoices(emulators)
check('chooser comes first', emulatorOptions[0].id === '' && emulatorOptions[1].id === 'JGogBBWueb55Y9MWfTphX')
check('emulator label shows the grid', emulatorOptions[1].label === 'Stage left (8 × 4)')

check('page list: one page', pageList(' 3 ') === '3')
check('page list: several pages', pageList('1, 2') === '1,2')
check('page list: nonsense', pageList('a,b') === undefined && pageList('') === undefined)
const tablet = (options) => (tabletArgs(options) ?? []).map((a) => a.value ?? a.type).join(' ')
check('tablet: all pages', tablet({ allPages: true }) === '')
check(
	'tablet: all pages ignores a hidden grid',
	tablet({ allPages: true, limitGrid: true, columns: 4, rows: 2 }) === '',
)
check('tablet: pages', tablet({ allPages: false, pages: '3' }) === '3')
check(
	'tablet: pages and grid',
	tablet({ allPages: false, pages: '3', limitGrid: true, columns: 4, rows: 2 }) === '3 4 2',
)
check('tablet: bad pages', tabletArgs({ allPages: false, pages: 'x' }) === undefined)
check(
	'tablet: bad grid',
	tabletArgs({ allPages: false, pages: '1', limitGrid: true, columns: 0, rows: 2 }) === undefined,
)

finish()
