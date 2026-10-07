/**
 * The kiosk browser: browser mode, and Ontime and Companion mode, which show their views in it.
 *
 * Everything set here lasts until the device restarts; the permanent start page is part of the device
 * configuration. ShowPlayPI reports no browser state yet (current URL, page reachable – planned with the
 * feedback subscription), so there are no feedbacks or variables for it.
 */
import type { CompanionActionDefinitions } from '@companion-module/base'
import type ModuleInstance from '../main.js'
import { secondsToMs } from '../format.js'
import { oscInt, oscString } from '../osc.js'

export type BrowserActionsSchema = {
	browser_url: { options: { url: string } }
	browser_idle: { options: { seconds: number } }
	browser_home: { options: Record<string, never> }
	browser_refresh: { options: Record<string, never> }
	browser_restart: { options: Record<string, never> }
}

/** The longest idle timeout ShowPlayPI accepts: 24 hours. */
export const MAX_IDLE_SECONDS = 86_400

/** ShowPlayPI shows only pages with these schemes. */
export function isShowableUrl(url: string): boolean {
	return /^(https?|file):\/\/\S/i.test(url)
}

export function browserActions(self: ModuleInstance): CompanionActionDefinitions<BrowserActionsSchema> {
	return {
		browser_url: {
			name: 'Browser: show web page',
			description:
				'Shows a web page until the device restarts. It also becomes the page the idle timeout ' +
				'returns to. The browser restarts for this, which takes 2 to 5 seconds.',
			options: [
				{
					type: 'textinput',
					id: 'url',
					label: 'Address (http://, https:// or file://)',
					default: 'https://',
					useVariables: true,
				},
			],
			callback: (action) => {
				const url = String(action.options.url ?? '').trim()
				if (!isShowableUrl(url)) {
					self.log('warn', `Not sent: the address must start with http://, https:// or file:// (${url})`)
					return
				}
				self.send('/showplaypi/browser/url', [oscString(url)])
			},
		},
		browser_idle: {
			name: 'Browser: idle timeout',
			description:
				'After this time without touch, mouse or keyboard input, the page shown last with ' +
				'"show web page" (or else the start page) comes back. 0 switches the timeout off. ' +
				'Lasts until the device restarts.',
			options: [
				{
					type: 'number',
					id: 'seconds',
					label: 'Seconds (0 = off)',
					default: 120,
					min: 0,
					max: MAX_IDLE_SECONDS,
				},
			],
			callback: (action) => {
				const milliseconds = Math.min(secondsToMs(action.options.seconds), MAX_IDLE_SECONDS * 1000)
				self.send('/showplaypi/browser/idle', [oscInt(milliseconds)])
			},
		},
		browser_home: {
			name: 'Browser: start page',
			description:
				'Shows the start page from the device configuration again and forgets the page set with ' +
				'"show web page". In Companion mode this is the emulator chooser.',
			options: [],
			callback: () => self.send('/showplaypi/browser/home'),
		},
		browser_refresh: {
			name: 'Browser: reload page',
			description: 'Reloads the current page, like pressing Ctrl+R.',
			options: [],
			callback: () => self.send('/showplaypi/browser/refresh'),
		},
		browser_restart: {
			name: 'Browser: restart',
			description: 'Restarts the browser and shows the current page again. The HDMI signal is kept.',
			options: [],
			callback: () => self.send('/showplaypi/browser/restart'),
		},
	}
}
