/** Text forms of times for button labels. ShowPlayPI reports all times in milliseconds. */

const pad = (value: number): string => String(value).padStart(2, '0')

/** Uptime as `h:mm`, with days in front once it is a day or more, e.g. `3d 04:12`. */
export function formatUptime(milliseconds: number | undefined): string {
	if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds < 0) return ''

	const totalMinutes = Math.floor(milliseconds / 60_000)
	const days = Math.floor(totalMinutes / 1440)
	const hours = Math.floor((totalMinutes % 1440) / 60)
	const minutes = totalMinutes % 60

	return days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}` : `${hours}:${pad(minutes)}`
}

/**
 * A playing time as `m:ss`, or `h:mm:ss` from one hour on. Elapsed time is rounded down; remaining time
 * should be rounded up (`roundUp`), so a countdown shows 0:01 until the very end and reaches 0:00 only
 * when nothing is left.
 */
export function formatDuration(milliseconds: number | undefined | null, roundUp = false): string {
	if (milliseconds === undefined || milliseconds === null || !Number.isFinite(milliseconds)) return ''

	const exact = Math.max(0, milliseconds) / 1000
	const totalSeconds = roundUp ? Math.ceil(exact) : Math.floor(exact)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Seconds as entered in the user interface to the milliseconds of the OSC interface. */
export function secondsToMs(seconds: unknown): number {
	const value = typeof seconds === 'number' ? seconds : Number(seconds)
	return Number.isFinite(value) ? Math.max(0, Math.round(value * 1000)) : 0
}
