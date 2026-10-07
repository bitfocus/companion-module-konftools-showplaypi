import dgram from 'node:dgram'
import { decodeOscMessage, encodeOscMessage, type OscArgument, type OscMessage } from './osc.js'

/** ShowPlayPI listens for OSC on this UDP port; it cannot be changed on the device. */
export const SHOWPLAYPI_PORT = 23878

export interface ConnectionEvents {
	/** A message from the device */
	message: (message: OscMessage) => void
	/** Sending failed, e.g. the device name could not be resolved */
	error: (error: Error) => void
}

/**
 * One UDP socket on a free local port, used for sending and receiving.
 *
 * ShowPlayPI answers requests (system, status, lists) to the address and source port they came from,
 * so requests must leave from the socket that listens for the answers. Messages from anywhere other
 * than ShowPlayPI's port are ignored.
 */
export class ShowPlayPiConnection {
	readonly host: string
	#socket: dgram.Socket
	#handlers: ConnectionEvents
	#closed = false

	constructor(host: string, handlers: ConnectionEvents) {
		this.host = host
		this.#handlers = handlers
		this.#socket = dgram.createSocket('udp4')

		this.#socket.on('error', (error) => {
			if (!this.#closed) this.#handlers.error(error)
		})
		this.#socket.on('message', (data, rinfo) => {
			if (this.#closed || rinfo.port !== SHOWPLAYPI_PORT) return
			let message: OscMessage
			try {
				message = decodeOscMessage(data)
			} catch (error) {
				this.#handlers.error(new Error(`Unreadable message from ${rinfo.address}: ${(error as Error).message}`))
				return
			}
			this.#handlers.message(message)
		})
		this.#socket.bind(0)
	}

	/** Sends one OSC message. Errors (e.g. an unknown host name) are reported through the error handler. */
	send(address: string, args: OscArgument[] = []): void {
		if (this.#closed) return
		const data = encodeOscMessage(address, args)
		this.#socket.send(data, SHOWPLAYPI_PORT, this.host, (error) => {
			if (error && !this.#closed) this.#handlers.error(error)
		})
	}

	close(): void {
		if (this.#closed) return
		this.#closed = true
		try {
			this.#socket.close()
		} catch {
			// Already closed
		}
	}
}
