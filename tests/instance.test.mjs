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

// Without a host
{
	const { instance, record } = await startInstance({ host: '' })
	check('no host: bad config', lastStatus(record).status === 'bad_config')
	check('no host: only blackout is offered', Object.keys(record.actions).join() === 'blackout')
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
	await instance.destroy()
}

// A device that reports its mode in the system reply (proposed for ShowPlayPI)
{
	device.mode = 'ontime'
	device.audio = false
	device.reportMode = true
	const { instance } = await startInstance()
	await waitFor(() => instance.mode === 'ontime', 'reported mode', 3000)
	check('reported ontime mode is used', instance.mode === 'ontime')
	device.reportMode = false
	await instance.destroy()
}

// A mode chosen by hand wins over detection
{
	device.mode = 'video'
	device.audio = true
	const { instance } = await startInstance({ mode: 'companion', audio: 'off' })
	await new Promise((resolve) => setTimeout(resolve, 3000))
	check('manual mode', instance.mode === 'companion' && [...instance.areas].sort().join() === 'browser,companion')
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
