// End-to-end checks: the real module instance against a fake ShowPlayPI on this computer, through
// Companion's instance contract. Uses UDP port 23878 on 127.0.0.1, so no other ShowPlayPI test may run.
import dgram from 'node:dgram'
import { createChecker } from './helpers.mjs'
const ModuleInstance = (await import('../dist/main.js')).default
const { encodeOscMessage, decodeOscMessage, oscString } = await import('../dist/osc.js')
const { check, finish } = createChecker()

const waitFor = async (predicate, what, timeoutMs = 8000) => {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (predicate()) return true
		await new Promise((resolve) => setTimeout(resolve, 25))
	}
	console.log(`  (timed out waiting for ${what})`)
	return false
}

/** A stand-in for what Companion hands a module instance. */
function makeContext() {
	const record = {
		statuses: [],
		variables: {},
		variableDefinitions: {},
		actions: {},
		feedbacks: {},
		savedConfig: undefined,
	}

	const context = {
		_isInstanceContext: true,
		id: 'test-instance',
		label: 'showplaypi',
		upgradeScripts: [],
		saveConfig: (config) => {
			record.savedConfig = config
		},
		updateStatus: (status, message) => record.statuses.push({ status, message }),
		oscSend: () => {},
		recordAction: () => {},
		setActionDefinitions: (actions) => {
			record.actions = actions
		},
		subscribeActions: () => {},
		unsubscribeActions: () => {},
		setFeedbackDefinitions: (feedbacks) => {
			record.feedbacks = feedbacks
		},
		unsubscribeFeedbacks: () => {},
		checkFeedbacks: () => {},
		checkAllFeedbacks: () => {},
		checkFeedbacksById: () => {},
		setPresetDefinitions: () => {},
		setVariableDefinitions: (definitions) => {
			record.variableDefinitions = definitions
		},
		setVariableValues: (values) => Object.assign(record.variables, values),
		getVariableValue: (id) => record.variables[id],
	}

	return { context, record }
}

/**
 * A fake ShowPlayPI: answers like the real one does in the given mode, to the sender's address and
 * source port, and remembers every command it received.
 */
async function startFakeDevice() {
	const device = {
		mode: 'video',
		audio: true,
		reportMode: false,
		received: [],
		videoStatus: {
			state: 'playing',
			playlist: 'VIDEO',
			number: 1,
			file: '010_Intro.mp4',
			title: '010_Intro',
			type: 'video',
			elapsed: 30_200,
			remaining: 8_100,
			repeat: 'all',
			fade: 1000,
			volume: 60,
			mute: false,
			blackout: false,
		},
		audioStatus: {
			loop: {
				state: 'playing',
				playlist: 'LOOP',
				number: 1,
				file: 'Lounge 01.mp3',
				title: 'Lounge 01',
				elapsed: 61_000,
				remaining: 5_500,
				volume: 60,
				repeat: 'all',
				shuffle: false,
			},
			jingle: {
				state: 'playing',
				file: '02_Applause.mp3',
				elapsed: 2_000,
				remaining: 10_000,
				volume: 90,
				mode: 'duck',
				duck: 30,
			},
			volume: 80,
			mute: true,
		},
		audioFiles: {
			jingles: [
				{ number: 1, file: '01_Opening.wav', title: '01_Opening', duration: 8_400 },
				{ number: 2, file: '02_Applause.mp3', title: '02_Applause', duration: 12_000 },
			],
			playlists: [
				{
					number: 1,
					name: 'LOOP',
					default: true,
					tracks: [{ number: 1, file: 'Lounge 01.mp3', title: 'Lounge 01', duration: 66_500 }],
				},
				{
					number: 2,
					name: 'Admission',
					default: false,
					tracks: [{ number: 1, file: 'Walk-in.mp3', title: 'Walk-in', duration: null }],
				},
			],
		},
		videoFiles: {
			playlists: [
				{
					number: 1,
					name: 'VIDEO',
					default: true,
					entries: [
						{ number: 1, file: '010_Intro.mp4', title: '010_Intro', type: 'video', duration: 38_300 },
						{ number: 2, file: '020_Sponsors [15sec].jpg', title: '020_Sponsors', type: 'still', duration: 15_000 },
					],
				},
				{ number: 2, name: 'Morning', default: false, entries: [] },
			],
		},
	}
	const socket = dgram.createSocket('udp4')
	const reply = (rinfo, address, body) =>
		socket.send(encodeOscMessage(address, [oscString(JSON.stringify(body))]), rinfo.port, rinfo.address)

	socket.on('message', (data, rinfo) => {
		const message = decodeOscMessage(data)
		device.received.push(message)
		switch (message.address) {
			case '/showplaypi/system': {
				const body = { cpu: 12, ram: { percent: 40, available: 500, state: 'warning' }, uptime: 60_000 }
				if (device.reportMode) Object.assign(body, { mode: device.mode, services: device.audio ? ['audio'] : [] })
				return reply(rinfo, '/showplaypi/system', body)
			}
			case '/showplaypi/video/status':
				return device.mode === 'video' && reply(rinfo, '/showplaypi/video/status', device.videoStatus)
			case '/showplaypi/video/list':
				return device.mode === 'video' && reply(rinfo, '/showplaypi/video/files', device.videoFiles)
			case '/showplaypi/companion/emulators':
				return (
					device.mode === 'companion' &&
					reply(rinfo, '/showplaypi/companion/emulators', {
						emulators: [
							{ id: 'JGogBBWueb55Y9MWfTphX', name: 'Stage left', columns: 8, rows: 4 },
							{ id: 'k2', name: 'FOH', columns: 4, rows: 2 },
						],
					})
				)
			case '/showplaypi/audio/status':
				return device.audio && reply(rinfo, '/showplaypi/audio/status', device.audioStatus)
			case '/showplaypi/audio/list':
				return device.audio && reply(rinfo, '/showplaypi/audio/files', device.audioFiles)
		}
	})

	await new Promise((resolve, reject) => {
		socket.once('error', reject)
		socket.bind(23878, '127.0.0.1', resolve)
	})
	device.close = () => socket.close()
	return device
}

const config = (over = {}) => ({
	host: '127.0.0.1',
	mode: 'auto',
	audio: 'auto',
	statusInterval: 1,
	systemInterval: 1,
	...over,
})

async function startInstance(over) {
	const { context, record } = makeContext()
	const instance = new ModuleInstance(context)
	await instance.init(config(over), true, undefined)
	return { instance, record }
}

const lastStatus = (record) => record.statuses[record.statuses.length - 1] ?? {}
/** The ids that have a definition, i.e. are offered to the user. */
const offered = (definitions) =>
	Object.keys(definitions)
		.filter((id) => definitions[id])
		.sort()
		.join()

/** Runs an action and returns the commands the device received for it. */
async function run(device, record, actionId, options) {
	device.received.length = 0
	await record.actions[actionId].callback({ options })
	await new Promise((resolve) => setTimeout(resolve, 150))
	return device.received.filter(
		(message) => message.address !== '/showplaypi/system' && !message.address.endsWith('/status'),
	)
}
const sent = (messages) => messages.map((m) => [m.address, ...m.args].join(' ')).join(' | ')

// Without a host
{
	const { instance, record } = await startInstance({ host: '' })
	check('no host: bad config', lastStatus(record).status === 'bad_config')
	check('no host: only blackout is offered', offered(record.actions) === 'blackout', offered(record.actions))
	await instance.destroy()
}

const device = await startFakeDevice()

// Video mode with the audio player, detected by probing
{
	device.mode = 'video'
	device.audio = true
	const { instance, record } = await startInstance()
	await waitFor(() => instance.areas.has('video') && instance.areas.has('audio'), 'video and audio')
	check('video mode detected', instance.mode === 'video')
	check('audio player detected', instance.audio === true)
	check('status ok with the mode', lastStatus(record).status === 'ok' && /Video mode/.test(lastStatus(record).message))
	check(
		'detected mode is remembered',
		record.savedConfig?.lastMode === 'video' && record.savedConfig?.lastAudio === true,
	)
	check('system variables are set', record.variables.cpu === 12 && record.variables.ram_state === 'warning')
	check('mode variable', record.variables.mode === 'video')
	check(
		'blackout offers a fade in video mode',
		record.actions.blackout.options.some((option) => option.id === 'fade'),
	)
	check(
		'memory warning feedback is on',
		record.feedbacks.ram_state.callback({ options: { level: 'warning' } }) === true,
	)
	check(
		'critical memory feedback is off',
		record.feedbacks.ram_state.callback({ options: { level: 'critical' } }) === false,
	)
	check('connected feedback', record.feedbacks.connected.callback({ options: {} }) === true)
	check('no browser or ontime actions in video mode', !/browser_|ontime_/.test(offered(record.actions)))

	device.received.length = 0
	await record.actions.blackout.callback({ options: { state: 'on', useFade: true, fade: 1.5 } })
	await waitFor(() => device.received.some((m) => m.address === '/showplaypi/blackout'), 'blackout command')
	const blackout = device.received.find((m) => m.address === '/showplaypi/blackout')
	check(
		'blackout with fade in milliseconds',
		JSON.stringify(blackout?.args) === '[1,1500]',
		JSON.stringify(blackout?.args),
	)

	// The video player: state, file lists and dropdowns
	await waitFor(() => record.variables.video_state === 'playing', 'video state')
	check('video variables', record.variables.video_title === '010_Intro' && record.variables.video_volume === 60)
	check(
		'elapsed and remaining as text',
		record.variables.video_elapsed === '0:30' && record.variables.video_remaining === '0:09',
	)
	check(
		'duration from elapsed and remaining',
		record.variables.video_duration === '0:38',
		record.variables.video_duration,
	)
	check('remaining in milliseconds', record.variables.video_remaining_ms === 8_100)
	check('fade in seconds', record.variables.video_fade === 1)
	check('blackout variable', record.variables.blackout === false)
	await waitFor(() => record.variables.video_playlist_count === 2, 'video file list')
	check('playlists counted', record.variables.video_playlist_count === 2 && record.variables.video_entry_count === 2)
	const entryOption = record.actions.video_select.options.find((o) => o.id === 'entry')
	check(
		'entry dropdown from the file list',
		entryOption.choices.map((c) => c.id).join() === '010_Intro.mp4,020_Sponsors [15sec].jpg',
		JSON.stringify(entryOption.choices),
	)
	const playlistOption = record.actions.video_playlist.options.find((o) => o.id === 'playlist')
	check('playlist dropdown from the file list', playlistOption.choices.map((c) => c.id).join() === 'VIDEO,Morning')

	check('state feedback', record.feedbacks.video_state.callback({ options: { state: 'playing' } }) === true)
	check(
		'entry feedback',
		record.feedbacks.video_entry_active.callback({ options: { entry: '010_Intro.mp4' } }) === true,
	)
	check(
		'other entry feedback',
		record.feedbacks.video_entry_active.callback({ options: { entry: '020_Sponsors [15sec].jpg' } }) === false,
	)
	check(
		'playlist feedback by name',
		record.feedbacks.video_playlist_active.callback({ options: { playlist: 'video' } }) === true,
	)
	check(
		'playlist feedback by number',
		record.feedbacks.video_playlist_active.callback({ options: { playlist: '1' } }) === true,
	)
	check('remaining below 10 s', record.feedbacks.video_remaining_below.callback({ options: { seconds: 10 } }) === true)
	check(
		'remaining not below 5 s',
		record.feedbacks.video_remaining_below.callback({ options: { seconds: 5 } }) === false,
	)
	check('blackout feedback', record.feedbacks.blackout.callback({ options: {} }) === false)
	check('muted feedback', record.feedbacks.video_muted.callback({ options: {} }) === false)

	const commands = [
		['video_play', {}, '/showplaypi/video/play'],
		['video_play', { useFade: true, fade: 2 }, '/showplaypi/video/play 2000'],
		['video_pause', {}, '/showplaypi/video/pause'],
		['video_toggle', {}, '/showplaypi/video/toggle'],
		['video_stop', { useFade: true, fade: 0.5 }, '/showplaypi/video/stop 500'],
		['video_next', {}, '/showplaypi/video/next'],
		['video_previous', {}, '/showplaypi/video/previous'],
		['video_restart', {}, '/showplaypi/video/restart'],
		['video_playhead', { from: 'start', seconds: 30 }, '/showplaypi/video/playhead 30000'],
		['video_playhead', { from: 'end', seconds: 10 }, '/showplaypi/video/playhead/end 10000'],
		['video_select', { entry: '020_Sponsors [15sec].jpg' }, '/showplaypi/video/select 020_Sponsors [15sec].jpg'],
		['video_select', { entry: '2', useFade: true, fade: 0 }, '/showplaypi/video/select 2 0'],
		['video_cue', { entry: '010_Intro.mp4' }, '/showplaypi/video/cue 010_Intro.mp4'],
		['video_playlist', { playlist: 'Morning' }, '/showplaypi/video/playlist Morning'],
		['video_repeat', { repeat: 'one' }, '/showplaypi/video/repeat one'],
		['video_fade', { seconds: 1.5 }, '/showplaypi/video/fade 1500'],
		['video_still_duration', { seconds: 8 }, '/showplaypi/video/stillduration 8000'],
		['video_volume', { change: 'set', percent: 75 }, '/showplaypi/video/volume 75'],
		['video_volume', { change: 'up', percent: 50 }, '/showplaypi/video/volume 100'],
		['video_volume', { change: 'down', percent: 10, useFade: true, fade: 3 }, '/showplaypi/video/volume 50 3000'],
		['video_mute', { mute: 'toggle' }, '/showplaypi/video/mute toggle'],
		['video_mute', { mute: 'on' }, '/showplaypi/video/mute 1'],
	]
	for (const [id, options, expected] of commands) {
		const messages = await run(device, record, id, options)
		check(`${id} ${JSON.stringify(options)}`, sent(messages) === expected, sent(messages))
	}

	// The audio player
	await waitFor(() => record.variables.audio_jingle_count === 2, 'audio file list')
	check(
		'audio loop variables',
		record.variables.audio_loop_title === 'Lounge 01' && record.variables.audio_loop_remaining === '0:06',
	)
	check('audio loop duration', record.variables.audio_loop_duration === '1:06', record.variables.audio_loop_duration)
	check(
		'jingle variables',
		record.variables.audio_jingle_title === '02_Applause' && record.variables.audio_jingle_remaining === '0:10',
	)
	check('audio master variables', record.variables.audio_volume === 80 && record.variables.audio_mute === true)
	check('audio counts', record.variables.audio_playlist_count === 2 && record.variables.audio_track_count === 1)
	const jingleOption = record.actions.audio_jingle_play.options.find((o) => o.id === 'jingle')
	check(
		'jingle dropdown from the file list',
		jingleOption.choices.map((c) => c.id).join() === '01_Opening.wav,02_Applause.mp3',
	)
	const trackOption = record.actions.audio_loop_select.options.find((o) => o.id === 'track')
	check(
		'track dropdown from all playlists',
		trackOption.choices.map((c) => c.id).join() === 'Lounge 01.mp3,Walk-in.mp3',
	)
	check('any jingle playing', record.feedbacks.audio_jingle_playing.callback({ options: { jingle: '' } }) === true)
	check(
		'this jingle playing',
		record.feedbacks.audio_jingle_playing.callback({ options: { jingle: '02_Applause.mp3' } }) === true,
	)
	check('jingle by number', record.feedbacks.audio_jingle_playing.callback({ options: { jingle: '2' } }) === true)
	check(
		'other jingle not playing',
		record.feedbacks.audio_jingle_playing.callback({ options: { jingle: '01_Opening.wav' } }) === false,
	)
	check('loop state feedback', record.feedbacks.audio_loop_state.callback({ options: { state: 'playing' } }) === true)
	check(
		'track feedback',
		record.feedbacks.audio_loop_track_active.callback({ options: { track: 'Lounge 01' } }) === true,
	)
	check(
		'audio playlist feedback',
		record.feedbacks.audio_loop_playlist_active.callback({ options: { playlist: 'LOOP' } }) === true,
	)
	check(
		'audio remaining below',
		record.feedbacks.audio_loop_remaining_below.callback({ options: { seconds: 10 } }) === true,
	)
	check('audio muted feedback', record.feedbacks.audio_muted.callback({ options: {} }) === true)
	check('duck mode feedback', record.feedbacks.audio_jingle_mode.callback({ options: { mode: 'duck' } }) === true)

	const audioCommands = [
		['audio_loop_play', {}, '/showplaypi/audio/loop/play'],
		['audio_loop_play', { useFade: true, fade: 3 }, '/showplaypi/audio/loop/play 3000'],
		['audio_loop_pause', { useFade: true, fade: 1 }, '/showplaypi/audio/loop/pause 1000'],
		['audio_loop_toggle', {}, '/showplaypi/audio/loop/toggle'],
		['audio_loop_stop', {}, '/showplaypi/audio/loop/stop'],
		['audio_loop_next', {}, '/showplaypi/audio/loop/next'],
		['audio_loop_previous', {}, '/showplaypi/audio/loop/previous'],
		['audio_loop_restart', {}, '/showplaypi/audio/loop/restart'],
		['audio_loop_playhead', { from: 'end', seconds: 10 }, '/showplaypi/audio/loop/playhead/end 10000'],
		['audio_loop_select', { track: 'Walk-in.mp3' }, '/showplaypi/audio/loop/select Walk-in.mp3'],
		['audio_loop_playlist', { playlist: 'Admission' }, '/showplaypi/audio/loop/playlist Admission'],
		['audio_loop_playlist', { playlist: '2' }, '/showplaypi/audio/loop/playlist 2'],
		['audio_loop_repeat', { repeat: 'off' }, '/showplaypi/audio/loop/repeat off'],
		['audio_loop_shuffle', { shuffle: 'toggle' }, '/showplaypi/audio/loop/shuffle 1'],
		['audio_loop_shuffle', { shuffle: 'off' }, '/showplaypi/audio/loop/shuffle 0'],
		[
			'audio_loop_volume',
			{ change: 'down', percent: 20, useFade: true, fade: 2 },
			'/showplaypi/audio/loop/volume 40 2000',
		],
		[
			'audio_jingle_play',
			{ jingle: '01_Opening.wav', setVolume: false },
			'/showplaypi/audio/jingle/play 01_Opening.wav',
		],
		['audio_jingle_play', { jingle: '1', setVolume: true, volume: 70 }, '/showplaypi/audio/jingle/play 1 70'],
		['audio_jingle_stop', { useFade: true, fade: 0.5 }, '/showplaypi/audio/jingle/stop 500'],
		['audio_jingle_volume', { change: 'up', percent: 20 }, '/showplaypi/audio/jingle/volume 100'],
		['audio_jingle_mode', { mode: 'duck', duck: 25 }, '/showplaypi/audio/jingle/mode duck 25'],
		['audio_jingle_mode', { mode: 'pause', duck: 25 }, '/showplaypi/audio/jingle/mode pause'],
		['audio_volume', { change: 'set', percent: 55 }, '/showplaypi/audio/volume 55'],
		['audio_mute', { mute: 'off' }, '/showplaypi/audio/mute 0'],
		['audio_stop_all', {}, '/showplaypi/audio/stopall'],
	]
	for (const [id, options, expected] of audioCommands) {
		const messages = await run(device, record, id, options)
		check(id + ' ' + JSON.stringify(options), sent(messages) === expected, sent(messages))
	}

	await waitFor(() => device.received.some((m) => m.address === '/showplaypi/video/status'), 'status polling')
	check(
		'video status is polled',
		device.received.some((m) => m.address === '/showplaypi/video/status'),
	)
	await instance.destroy()
}

// Browser or Ontime mode without the audio player: nothing but the system request is answered
{
	device.mode = 'browser'
	device.audio = false
	const { instance, record } = await startInstance()
	await waitFor(() => instance.mode !== undefined, 'mode', 6000)
	check('browser or ontime detected', instance.mode === 'browser-or-ontime')
	check('no audio player', instance.audio === false)
	check('no audio actions without the audio player', !/audio_/.test(offered(record.actions)))
	check(
		'no audio variables without the audio player',
		!Object.keys(record.variableDefinitions).some((id) => id.startsWith('audio_') && id !== 'audio_player'),
		Object.keys(record.variableDefinitions)
			.filter((id) => id.startsWith('audio_') && id !== 'audio_player')
			.join(),
	)
	check('mode variable', record.variables.mode === 'browser or ontime')

	device.received.length = 0
	await record.actions.blackout.callback({ options: { state: 'off' } })
	await waitFor(() => device.received.some((m) => m.address === '/showplaypi/blackout'), 'blackout command')
	const blackout = device.received.find((m) => m.address === '/showplaypi/blackout')
	check('blackout off without fade', JSON.stringify(blackout?.args) === '[0]', JSON.stringify(blackout?.args))
	check('blackout offers no fade outside video mode', !record.actions.blackout.options.some((o) => o.id === 'fade'))

	check(
		'browser and ontime actions are offered',
		offered(record.actions) ===
			'blackout,browser_home,browser_idle,browser_refresh,browser_restart,browser_url,ontime_view',
		offered(record.actions),
	)
	const url = await run(device, record, 'browser_url', { url: ' https://müller.de/zeit plan ' })
	check('url', sent(url) === '/showplaypi/browser/url https://müller.de/zeit plan', sent(url))
	const badUrl = await run(device, record, 'browser_url', { url: 'www.example.com' })
	check('an address without scheme is not sent', badUrl.length === 0, sent(badUrl))
	const idle = await run(device, record, 'browser_idle', { seconds: 90 })
	check('idle in milliseconds', sent(idle) === '/showplaypi/browser/idle 90000', sent(idle))
	const idleOff = await run(device, record, 'browser_idle', { seconds: 0 })
	check('idle off', sent(idleOff) === '/showplaypi/browser/idle 0', sent(idleOff))
	const idleMax = await run(device, record, 'browser_idle', { seconds: 999999 })
	check('idle at most 24 hours', sent(idleMax) === '/showplaypi/browser/idle 86400000', sent(idleMax))
	for (const [id, address] of [
		['browser_home', '/showplaypi/browser/home'],
		['browser_refresh', '/showplaypi/browser/refresh'],
		['browser_restart', '/showplaypi/browser/restart'],
	]) {
		const messages = await run(device, record, id, {})
		check(`${id} without arguments`, sent(messages) === address, sent(messages))
	}
	const view = await run(device, record, 'ontime_view', { view: 'backstage', parameters: '?stopCycle=true' })
	check('ontime view with settings', sent(view) === '/showplaypi/ontime/view backstage stopCycle=true', sent(view))
	const plainView = await run(device, record, 'ontime_view', { view: 'timer', parameters: '' })
	check('ontime view without settings', sent(plainView) === '/showplaypi/ontime/view timer', sent(plainView))
	const badView = await run(device, record, 'ontime_view', { view: '../admin', parameters: '' })
	check('an invalid view name is not sent', badView.length === 0, sent(badView))
	await instance.destroy()
}

// A device that reports its mode in the system reply (proposed for ShowPlayPI)
{
	device.mode = 'ontime'
	device.audio = false
	device.reportMode = true
	const { instance, record } = await startInstance()
	await waitFor(() => instance.mode === 'ontime', 'reported mode', 3000)
	check('reported ontime mode is used', instance.mode === 'ontime')
	check('ontime mode offers the browser and ontime', /browser_url.*ontime_view/.test(offered(record.actions)))
	device.reportMode = false
	await instance.destroy()
}

// Companion mode, detected by probing: emulator list and views
{
	device.mode = 'companion'
	device.audio = false
	const { instance, record } = await startInstance()
	await waitFor(
		() => instance.mode === 'companion' && record.variables.companion_emulator_count === 2,
		'companion mode',
	)
	check('companion mode detected', instance.mode === 'companion')
	check(
		'companion offers browser and companion actions',
		/browser_url.*companion_emulator/.test(offered(record.actions)),
	)
	check('no ontime in companion mode', !/ontime_/.test(offered(record.actions)))
	check('emulator count variable', record.variables.companion_emulator_count === 2)
	const emulatorOption = record.actions.companion_emulator.options.find((o) => o.id === 'emulator')
	check(
		'emulator dropdown from the device',
		emulatorOption.choices.map((c) => c.id).join() === ',JGogBBWueb55Y9MWfTphX,k2',
		JSON.stringify(emulatorOption.choices),
	)
	const companionCommands = [
		['companion_emulator', { emulator: '' }, '/showplaypi/companion/emulator'],
		['companion_emulator', { emulator: 'k2' }, '/showplaypi/companion/emulator k2'],
		['companion_emulator', { emulator: 'Stage left' }, '/showplaypi/companion/emulator Stage left'],
		['companion_tablet', { allPages: true }, '/showplaypi/companion/tablet'],
		['companion_tablet', { allPages: false, pages: '1,2' }, '/showplaypi/companion/tablet 1,2'],
		[
			'companion_tablet',
			{ allPages: false, pages: '3', limitGrid: true, columns: 4, rows: 2 },
			'/showplaypi/companion/tablet 3 4 2',
		],
		['companion_tablet', { allPages: false, pages: '' }, ''],
		['companion_restart', {}, '/showplaypi/companion/restart'],
	]
	for (const [id, options, expected] of companionCommands) {
		const messages = (await run(device, record, id, options)).filter(
			(m) => m.address !== '/showplaypi/companion/emulators',
		)
		check(id + ' ' + JSON.stringify(options), sent(messages) === expected, sent(messages))
	}
	await instance.destroy()
}

// A mode chosen by hand wins over detection
{
	device.mode = 'video'
	device.audio = true
	const { instance, record } = await startInstance({ mode: 'companion', audio: 'off' })
	await new Promise((resolve) => setTimeout(resolve, 3000))
	check('manual mode', instance.mode === 'companion' && [...instance.areas].sort().join() === 'browser,companion')
	check(
		'companion mode offers the browser but not ontime',
		/browser_url/.test(offered(record.actions)) && !/ontime_/.test(offered(record.actions)),
	)
	await instance.destroy()
}

device.close()

// The device does not answer
{
	const { instance, record } = await startInstance({ mode: 'video' })
	await waitFor(() => lastStatus(record).status === 'connection_failure', 'connection failure', 14000)
	check('no answer: connection failure', lastStatus(record).status === 'connection_failure')
	check('manual mode stays available offline', instance.areas.has('video'))
	await instance.destroy()
}

finish()
