# companion-module-konftools-showplaypi

A [Bitfocus Companion](https://bitfocus.io/companion) module for
[ShowPlayPI](https://github.com/robertskiba/ShowPlayPI), the Raspberry Pi playout image for events by
[konftools](https://konftools.com).

ShowPlayPI shows a full-screen web page, plays videos and slideshows, runs Bitfocus Companion or Ontime
on the device, and plays background music and jingles – all controlled live over OSC. This module turns
that OSC interface into Companion actions, feedbacks, variables and presets.

- **Only what works.** A device runs in one operating mode (browser, video, Companion or Ontime), with
  the audio player as an optional extra. The module finds out what the device runs and offers only the
  actions, feedbacks, variables and presets of that mode.
- **Browser.** Show a web page, set the idle timeout, go back to the start page, reload, restart.
- **Video.** Transport, entries and playlists from the device's file list, cue, playhead, repeat, fade,
  still image duration, volume and mute – with elapsed and remaining time on buttons.
- **Audio.** Playlist transport, tracks and playlists, jingles with duck or pause behaviour, volumes,
  mute and stop all.
- **Companion and Ontime on the device.** Show an emulator or the web buttons; show an Ontime view with
  its settings.
- **Device health.** CPU, memory, temperature, power and clock as variables and warning feedbacks.
- **Presets.** One button per video entry, playlist, jingle, track and emulator, built from the lists the
  device sends, plus transport, status tiles and the buttons of ShowPlayPI's demo page.

See [HELP.md](./companion/HELP.md) for user documentation, [CHANGELOG.md](./CHANGELOG.md) for what
changed when, and [LICENSE](./LICENSE) for the license. The OSC interface the module implements is
documented in ShowPlayPI's [OSC.md](https://github.com/robertskiba/ShowPlayPI/blob/main/docs/OSC.md).
Report problems in the
[issue tracker](https://github.com/bitfocus/companion-module-konftools-showplaypi/issues).

## Development

`yarn` installs the dependencies, `yarn build` compiles the module, `yarn dev` recompiles on change,
`yarn lint` and `yarn format` check and format the code, and `yarn test` runs the tests against the
compiled module, including a fake ShowPlayPI device on the local machine. `yarn package` builds the
package Companion can import.
