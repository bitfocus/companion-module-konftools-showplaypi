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
				return device.mode === 'video' && reply(rinfo, '/showplaypi/video/status', { state: 'stopped' })
			case '/showplaypi/companion/emulators':
				return device.mode === 'companion' && reply(rinfo, '/showplaypi/companion/emulators', { emulators: [] })
			case '/showplaypi/audio/status':
				return device.audio && reply(rinfo, '/showplaypi/audio/status', { loop: { state: 'stopped' } })
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
