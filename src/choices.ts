/**
 * Option building blocks shared by the video and the audio player: dropdowns filled from the file
 * lists, entries chosen by name or number, and volume changes.
 *
 * Files and playlists are sent by name, not by number: numbers follow the alphabetical order and shift
 * as soon as a file or folder is added, names do not. Typed-in numbers still work, as ShowPlayPI accepts
 * both.
 */
import type { CompanionInputFieldDropdown, CompanionInputFieldNumber, DropdownChoice } from '@companion-module/base'
import { optionText } from './options.js'
import { oscInt, oscString, type OscArgument } from './osc.js'
import type { MediaEntry, Playlist } from './players.js'

export function playlistChoices(playlists: Playlist[], defaultName: string): DropdownChoice<string>[] {
	if (playlists.length === 0) return [{ id: defaultName, label: `1 · ${defaultName}` }]
	return playlists.map((playlist) => ({ id: playlist.name, label: `${playlist.number} · ${playlist.name}` }))
}

/** A list of files by file name. */
export function fileChoices(entries: MediaEntry[]): DropdownChoice<string>[] {
	return entries.map((entry) => ({ id: entry.file, label: `${entry.number} · ${entry.title}` }))
}

/**
 * The files of all playlists, by file name. With several playlists, the label names the playlist;
 * a file that appears in more than one playlist is listed once.
 */
export function entryChoices(playlists: Playlist[]): DropdownChoice<string>[] {
	const seen = new Set<string>()
	const choices: DropdownChoice<string>[] = []
	for (const playlist of playlists) {
		for (const entry of playlist.entries) {
			const key = entry.file.toLowerCase()
			if (seen.has(key)) continue
			seen.add(key)
			const prefix = playlists.length > 1 ? `${playlist.name} › ` : ''
			choices.push({ id: entry.file, label: `${prefix}${entry.number} · ${entry.title}` })
		}
	}
	return choices
}

/** Whether a chosen file (file name, name without extension, title, or number) is the current one. */
export function isCurrentEntry(
	chosen: unknown,
	current: { file?: string | null; title?: string | null; number?: number | null },
): boolean {
	const text = optionText(chosen).toLowerCase()
	if (!text) return false
	if (/^\d+$/.test(text)) return current.number === Number(text)
	const file = current.file?.toLowerCase()
	if (!file) return false
	return text === file || text === file.replace(/\.[^.]+$/, '') || text === current.title?.toLowerCase()
}

/** Whether a chosen playlist (name, any case, or number) is the current one. */
export function isCurrentPlaylist(chosen: unknown, current: string | undefined, playlists: Playlist[]): boolean {
	const text = optionText(chosen)
	if (!current || !text) return false
	if (/^\d+$/.test(text)) return playlists.find((playlist) => playlist.name === current)?.number === Number(text)
	return current.toLowerCase() === text.toLowerCase()
}

/** A file or playlist option as an OSC argument: numbers typed in go out as numbers. */
export function nameOrNumber(value: unknown): OscArgument | undefined {
	const text = optionText(value)
	if (!text) return undefined
	return /^\d+$/.test(text) ? oscInt(Number(text)) : oscString(text)
}

/** A dropdown of files that also accepts a typed-in file name or number. */
export function fileDropdown<TKey extends string>(
	id: TKey,
	label: string,
	choices: DropdownChoice<string>[],
	tooltip?: string,
): CompanionInputFieldDropdown<TKey, string> {
	return { type: 'dropdown', id, label, tooltip, default: choices[0]?.id ?? '1', choices, allowCustom: true }
}

export type VolumeChange = 'set' | 'up' | 'down'

export type VolumeOptions = {
	change: VolumeChange
	percent: number
}

export function volumeOptions(): [
	CompanionInputFieldDropdown<'change', VolumeChange>,
	CompanionInputFieldNumber<'percent'>,
] {
	return [
		{
			type: 'dropdown',
			id: 'change',
			label: 'Change',
			default: 'set',
			choices: [
				{ id: 'set', label: 'Set to' },
				{ id: 'up', label: 'Raise by' },
				{ id: 'down', label: 'Lower by' },
			],
		},
		{ type: 'number', id: 'percent', label: 'Percent', default: 100, min: 0, max: 100 },
	]
}

/**
 * The volume to send, 0 to 100. Raising or lowering needs the current volume; without it (no state
 * received yet) there is nothing to send.
 */
export function volumeTarget(options: Partial<VolumeOptions>, current: number | undefined): number | undefined {
	const percent = Number(options.percent) || 0
	let target = percent
	if (options.change === 'up' || options.change === 'down') {
		if (current === undefined) return undefined
		target = options.change === 'up' ? current + percent : current - percent
	}
	return Math.max(0, Math.min(100, Math.round(target)))
}

export type SwitchChoice = 'on' | 'off' | 'toggle'

/** On, off or toggle, as ShowPlayPI's mute commands take it: 1, 0 or "toggle". */
export function switchArgument(choice: unknown): OscArgument {
	if (choice === 'toggle') return oscString('toggle')
	return oscInt(choice === 'on' ? 1 : 0)
}
