// OSC encoding and decoding, checked against bytes built the way ShowPlayPI's documentation does.
import { createChecker } from './helpers.mjs'
const { encodeOscMessage, decodeOscMessage, oscString, oscInt, oscFloat, oscBool } = await import('../dist/osc.js')
const { check, finish } = createChecker()

// As in the Python example of docs/OSC.md in the ShowPlayPI repository
const oscStringBytes = (text) => {
	const data = Buffer.concat([Buffer.from(text, 'utf-8'), Buffer.from([0])])
	return Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)])
}

const expected = Buffer.concat([
	oscStringBytes('/showplaypi/browser/url'),
	oscStringBytes(',s'),
	oscStringBytes('https://example.com'),
])
const encoded = encodeOscMessage('/showplaypi/browser/url', [oscString('https://example.com')])
check('string message matches the documented bytes', encoded.equals(expected), encoded.toString('hex'))
check('length is a multiple of four', encoded.length % 4 === 0)

const noArgs = encodeOscMessage('/showplaypi/browser/refresh')
check(
	'message without arguments has an empty type tag',
	noArgs.equals(Buffer.concat([oscStringBytes('/showplaypi/browser/refresh'), oscStringBytes(',')])),
)

const blackout = encodeOscMessage('/showplaypi/blackout', [oscInt(1), oscInt(1500)])
check(
	'integers are big-endian 32 bit',
	blackout.subarray(-8).equals(Buffer.from([0, 0, 0, 1, 0, 0, 0x05, 0xdc])),
	blackout.toString('hex'),
)

const mixed = decodeOscMessage(
	encodeOscMessage('/test', [oscString('Müller'), oscInt(-7), oscFloat(0.5), oscBool(true), oscBool(false)]),
)
check('round trip keeps the address', mixed.address === '/test')
check(
	'round trip keeps all argument types',
	JSON.stringify(mixed.args) === JSON.stringify(['Müller', -7, 0.5, true, false]),
	JSON.stringify(mixed.args),
)
check('integers are rounded', decodeOscMessage(encodeOscMessage('/x', [oscInt(2.6)])).args[0] === 3)

const json = '{"cpu": 23, "ram": {"state": "normal"}}'
check(
	'a JSON reply comes back unchanged',
	decodeOscMessage(encodeOscMessage('/showplaypi/system', [oscString(json)])).args[0] === json,
)

const throws = (fn) => {
	try {
		fn()
		return false
	} catch {
		return true
	}
}
check(
	'a bundle is rejected',
	throws(() => decodeOscMessage(Buffer.concat([oscStringBytes('#bundle'), Buffer.alloc(8)]))),
)
check(
	'truncated data is rejected',
	throws(() => decodeOscMessage(Buffer.concat([oscStringBytes('/x'), oscStringBytes(',i')]))),
)
check(
	'an unterminated string is rejected',
	throws(() => decodeOscMessage(Buffer.from('/abc'))),
)
check(
	'an address without slash is not sent',
	throws(() => encodeOscMessage('showplaypi/system')),
)
check(
	'a message without type tags means no arguments',
	decodeOscMessage(oscStringBytes('/showplaypi/system')).args.length === 0,
)

finish()
