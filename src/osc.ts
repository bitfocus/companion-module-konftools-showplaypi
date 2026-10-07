/**
 * A minimal OSC 1.0 encoder and decoder for the message types ShowPlayPI uses.
 *
 * ShowPlayPI accepts single messages (no bundles) with the argument types s, i, f, T and F, and answers
 * with one string argument holding JSON (docs/OSC.md in the ShowPlayPI repository). That small subset
 * does not justify a dependency, and keeping it here lets the module send and receive on one socket:
 * Companion's own oscSend() goes out from a shared socket, so the replies, which ShowPlayPI sends back to
 * the source port, would never reach this module.
 */

export type OscArgument =
	| { type: 's'; value: string }
	| { type: 'i'; value: number }
	| { type: 'f'; value: number }
	| { type: 'T' }
	| { type: 'F' }

export type OscValue = string | number | boolean | null

export interface OscMessage {
	address: string
	args: OscValue[]
}

export const oscString = (value: string): OscArgument => ({ type: 's', value })
/** A whole number, rounded and kept within the 32-bit range OSC allows. */
export const oscInt = (value: number): OscArgument => ({
	type: 'i',
	value: Math.max(-2147483648, Math.min(2147483647, Math.round(value))),
})
export const oscFloat = (value: number): OscArgument => ({ type: 'f', value })
export const oscBool = (value: boolean): OscArgument => (value ? { type: 'T' } : { type: 'F' })

/** An OSC string: UTF-8, terminated by at least one zero byte and padded to a multiple of four. */
function encodeString(text: string): Buffer {
	const data = Buffer.from(text, 'utf-8')
	const length = (data.length + 4) & ~3
	const padded = Buffer.alloc(length)
	data.copy(padded)
	return padded
}

export function encodeOscMessage(address: string, args: OscArgument[] = []): Buffer {
	if (!address.startsWith('/')) throw new Error(`OSC address must start with "/": ${address}`)

	const parts: Buffer[] = [encodeString(address), encodeString(',' + args.map((arg) => arg.type).join(''))]

	for (const arg of args) {
		if (arg.type === 's') {
			parts.push(encodeString(arg.value))
		} else if (arg.type === 'i') {
			const data = Buffer.alloc(4)
			data.writeInt32BE(arg.value)
			parts.push(data)
		} else if (arg.type === 'f') {
			const data = Buffer.alloc(4)
			data.writeFloatBE(arg.value)
			parts.push(data)
		}
		// T and F carry no data, the type tag is the value
	}

	return Buffer.concat(parts)
}

function readString(data: Buffer, offset: number): [string, number] {
	const end = data.indexOf(0, offset)
	if (end < 0) throw new Error('OSC string is not terminated')
	return [data.toString('utf-8', offset, end), (end + 4) & ~3]
}

/** Decodes one OSC message. Throws on bundles, truncated data and argument types ShowPlayPI never sends. */
export function decodeOscMessage(data: Buffer): OscMessage {
	if (data.length === 0 || data[0] !== 0x2f) throw new Error('Not an OSC message')

	const [address, afterAddress] = readString(data, 0)
	// A message without a type tag string is allowed by OSC 1.0 and means: no arguments
	if (afterAddress >= data.length) return { address, args: [] }

	const [tags, afterTags] = readString(data, afterAddress)
	if (!tags.startsWith(',')) throw new Error('OSC type tag string is missing')

	const args: OscValue[] = []
	let offset = afterTags

	for (const tag of tags.slice(1)) {
		switch (tag) {
			case 's':
			case 'S': {
				const [value, next] = readString(data, offset)
				args.push(value)
				offset = next
				break
			}
			case 'i':
				if (offset + 4 > data.length) throw new Error('OSC message is truncated')
				args.push(data.readInt32BE(offset))
				offset += 4
				break
			case 'f':
				if (offset + 4 > data.length) throw new Error('OSC message is truncated')
				args.push(data.readFloatBE(offset))
				offset += 4
				break
			case 'T':
				args.push(true)
				break
			case 'F':
				args.push(false)
				break
			case 'N':
				args.push(null)
				break
			default:
				throw new Error(`Unsupported OSC type tag: ${tag}`)
		}
	}

	return { address, args }
}
