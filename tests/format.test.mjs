// Text forms of times.
import { createChecker } from './helpers.mjs'
const { formatUptime, formatDuration, secondsToMs } = await import('../dist/format.js')
const { check, finish } = createChecker()

check('uptime under an hour', formatUptime(392_820) === '0:06', formatUptime(392_820))
check('uptime in hours', formatUptime(3 * 3_600_000 + 5 * 60_000) === '3:05')
check('uptime with days', formatUptime(2 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000) === '2d 04:12')
check('no uptime gives empty text', formatUptime(undefined) === '')

check('elapsed is rounded down', formatDuration(83_900) === '1:23', formatDuration(83_900))
check('remaining is rounded up', formatDuration(83_100, true) === '1:24', formatDuration(83_100, true))
check('a countdown shows 0:01 until the end', formatDuration(200, true) === '0:01')
check('nothing left is 0:00', formatDuration(0, true) === '0:00')
check('hours are shown from one hour on', formatDuration(3_725_000) === '1:02:05')
check('null duration gives empty text', formatDuration(null) === '')

check('seconds to milliseconds', secondsToMs(1.5) === 1500)
check('text seconds are accepted', secondsToMs('2') === 2000)
check('negative becomes zero', secondsToMs(-1) === 0)
check('garbage becomes zero', secondsToMs('abc') === 0)

finish()
