// Reading the system reply and working out the mode.
import { createChecker } from './helpers.mjs'
const { parseSystemStatus, activeAreas, ModeDetector, PROBE_WAIT_MS } = await import('../dist/state.js')
const { check, finish } = createChecker()

// The example from docs/OSC.md in the ShowPlayPI repository
const documented = `{"cpu": 23, "cores": [30, 18, 25, 19],
 "ram": {"total": 986, "available": 305, "used": 681, "percent": 69,
         "swap_total": 985, "swap_used": 516, "swap_percent": 52, "state": "normal"},
 "temperature": 48.0, "time": {"synchronized": true, "source": "192.53.103.108", "stratum": 2},
 "throttled": {"undervoltage": false, "now": false, "since_boot": false},
 "uptime": 392820, "drives": {"system": {"free": 5107}, "media": {"free": 2640}},
 "companion_connections": 2}`
const system = parseSystemStatus(documented)
check('cpu', system.cpu === 23)
check('ram', system.ramPercent === 69 && system.ramAvailable === 305 && system.ramState === 'normal')
check('swap', system.swapPercent === 52)
check('temperature', system.temperature === 48)
check('time', system.timeSynchronized === true && system.timeSource === '192.53.103.108')
check('throttled', system.undervoltage === false && system.throttledNow === false)
check('uptime', system.uptime === 392820)
check('drives', system.freeSystem === 5107 && system.freeMedia === 2640)
check('companion connections', system.companionConnections === 2)
check('no mode reported yet', system.mode === undefined && system.services === undefined)

const proposed = parseSystemStatus('{"mode": "ontime", "services": ["audio"], "version": "1.1.0", "ram": "nonsense"}')
check('reported mode and services', proposed.mode === 'ontime' && proposed.services.includes('audio'))
check('wrong types are ignored', proposed.ramPercent === undefined)
check('an unknown mode is ignored', parseSystemStatus('{"mode": "disco"}').mode === undefined)

let rejected = false
try {
	parseSystemStatus('[1, 2]')
} catch {
	rejected = true
}
check('a JSON array is rejected', rejected)

const areas = (mode, audio) => [...activeAreas(mode, audio)].sort().join(',')
check('unknown mode offers nothing extra', areas(undefined, false) === '')
check('browser', areas('browser', false) === 'browser')
check('ontime has the browser too', areas('ontime', false) === 'browser,ontime')
check('browser or ontime offers both', areas('browser-or-ontime', false) === 'browser,ontime')
check('companion has the browser too', areas('companion', false) === 'browser,companion')
check('video has no browser', areas('video', false) === 'video')
check('audio comes on top of any mode', areas('video', true) === 'audio,video')

// Probing a device that does not report its mode
{
	const detector = new ModeDetector()
	detector.startProbe(1000)
	detector.noteSystem({}, 1100)
	detector.noteReply('video', 1200)
	check('a video answer proves video mode at once', detector.mode === 'video')
	detector.evaluate(1000 + PROBE_WAIT_MS)
	check('no audio answer after the wait: audio off', detector.audio === false)
}
{
	const detector = new ModeDetector()
	detector.startProbe(1000)
	detector.noteSystem({}, 1100)
	detector.evaluate(1500)
	check('no conclusion before the wait is over', detector.mode === undefined)
	detector.noteReply('audio', 1300)
	detector.evaluate(1000 + PROBE_WAIT_MS)
	check('no video or companion answer: browser or ontime', detector.mode === 'browser-or-ontime')
	check('an audio answer: audio on', detector.audio === true)
}
{
	const detector = new ModeDetector('companion', true)
	detector.startProbe(1000)
	detector.evaluate(1000 + PROBE_WAIT_MS * 2)
	check('an offline device keeps the remembered mode', detector.mode === 'companion' && detector.audio === true)
}
{
	const detector = new ModeDetector('video', false)
	detector.noteReply('video', 2000)
	detector.startProbe(5000)
	detector.noteSystem({}, 5100)
	detector.evaluate(5000 + PROBE_WAIT_MS)
	check('an answer from before the round does not count', detector.mode === 'browser-or-ontime')
}
{
	const detector = new ModeDetector()
	detector.startProbe(1000)
	detector.noteSystem({ mode: 'ontime', services: [] }, 1100)
	check('a reported mode wins at once', detector.mode === 'ontime' && detector.reportsMode)
	check('reported services decide audio', detector.audio === false)
	detector.noteReply('video', 1200)
	check('the report wins over probing', detector.mode === 'ontime')
}

finish()
