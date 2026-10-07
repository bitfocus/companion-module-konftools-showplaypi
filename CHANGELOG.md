# Changelog

All notable changes to this module are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

First version, built against the OSC interface of ShowPlayPI 1.0.

### Connection and modes

- Talks to one ShowPlayPI device over OSC on UDP port 23878, sending and receiving on one socket so the
  device's replies reach the module.
- Detects the operating mode (browser, video, Companion or Ontime) and whether the audio player runs,
  from the device's own report where available, otherwise by probing which status requests the device
  answers. Browser and Ontime mode cannot be told apart that way and are treated as one.
- Offers only the actions, feedbacks, variables and presets of the active mode and services. The mode
  and the audio player can also be chosen by hand.
- Remembers the detected mode, so the right definitions are there when Companion starts while the
  device is off. Notices a restart of the device from its uptime and checks again.
- Shows the mode in the connection status line; reports the device as unreachable after about ten
  seconds without an answer.

### Every mode

- Blackout action, with a fade in video mode.
- Device load from `/showplaypi/system`: CPU, memory, swap, temperature, throttling, uptime, free space,
  time synchronisation as variables; feedbacks for connection, memory warning, temperature, power or
  heat problems and a clock without time source.

### Browser, Ontime and Companion

- Browser: show a web page, idle timeout, start page, reload and restart.
- Ontime: show a view with its settings.
- Companion: show an emulator (list from the device) or the chooser, the web buttons view with a page
  list and grid, restart Companion; variables for connections and emulators.

### Video and audio player

- Video: play, pause, play/pause, stop, next, previous, restart, playhead, play and cue entries, switch
  playlists, repeat, default fade time, still image duration, volume (set, raise, lower) and mute.
  Feedbacks for the player state, the current entry and playlist, repeat, mute, remaining time and
  blackout; variables for the entry, elapsed, remaining and total time, settings and counts.
- Audio: playlist transport with fades, tracks, playlists, playhead, repeat, shuffle and volume; jingles
  with volume and duck or pause behaviour; master volume, mute and stop all. Feedbacks and variables for
  the playlist, the jingle playing and the master section.
- Entry, track, playlist and jingle dropdowns are filled from the file lists of the device and refreshed
  every ten seconds. Files are sent by name, so buttons stay valid when files are added or removed.
- Times are entered in seconds and shown as `m:ss`; remaining times round up for countdowns.

### Presets

- One section per area, for the active areas only: blackout and device tiles, the browser buttons of
  ShowPlayPI's demo page, one button per Ontime view and per emulator, video and audio transport and
  status tiles, and one button per video entry (play and cue), playlist, jingle and track from the
  device's lists.
