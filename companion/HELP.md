## ShowPlayPI

Controls a [ShowPlayPI](https://github.com/robertskiba/ShowPlayPI) player over OSC. ShowPlayPI turns a
Raspberry Pi into a playout device for events: a full-screen web page, a video and slideshow player,
Bitfocus Companion or Ontime running on the device, and an optional audio player for background music and
jingles.

One Companion connection talks to one device. For several players, add one connection per device.

### Configuration

| Field                  | Meaning                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Device                 | IP address or device name of the player, e.g. `192.168.1.50` or `showplaypi-e84042.local`    |
| Operating mode         | Automatic asks the device. Choose a mode by hand to prepare buttons while the device is away |
| Audio player           | Automatic asks the device; or state whether the audio player is enabled                      |
| Player status interval | How often the video and audio player state is requested, in seconds (1 by default)           |
| Device load interval   | How often CPU, memory and temperature are requested, in seconds (5 by default)               |

The device name is shown on the setup page of the device and on its display during start-up. OSC uses UDP
port 23878, which cannot be changed on the device, so there is no port field. OSC has no authentication:
anyone on the network can control the device, which is intended on isolated event networks.

### Operating modes – why only some actions are offered

A ShowPlayPI device runs in exactly one operating mode, set in its configuration and changed only with a
restart: **browser** (a web page), **video** (videos and still images from the SHOWPLAYPI drive),
**Companion** (Bitfocus Companion on the device, shown in the browser) or **Ontime** (an Ontime server on
the device, shown in the browser). The **audio player** is an optional extra in every mode.

Commands of an inactive mode are ignored by the device. The module therefore offers only the actions,
feedbacks, variables and presets that work right now:

| Mode                 | Offered                                        |
| -------------------- | ---------------------------------------------- |
| every mode           | Blackout, device load and connection           |
| browser              | + Browser                                      |
| Ontime               | + Browser, Ontime views                        |
| Companion            | + Browser, Companion emulators and web buttons |
| video                | + Video player (no browser)                    |
| audio player enabled | + Audio player, in addition to the mode        |

The connection status line in Companion shows the mode the module works with, e.g. "Video mode, audio
player".

**Automatic detection.** The module asks the device what it runs. Devices that do not report their mode
yet are probed: the module sends the status requests of each mode, and the ones that are answered show
what is active. Browser and Ontime mode look the same from outside, so for those devices the Ontime
actions are offered in both; the status line then says "Browser or Ontime mode". The detected mode is
remembered, so the right buttons are there when Companion starts while the device is still switched off.
After a restart of the device the module checks again.

**Choosing by hand.** Set the operating mode and the audio player in the configuration to prepare buttons
for a device that is not reachable yet, or when automatic detection does not work in your network. A
mode chosen by hand wins over detection.

### Times and volumes

All times in this module are entered in **seconds** (the device itself works in milliseconds); fade times
accept decimals such as `0.5`. Volumes are **percent**, 0 to 100.

Where an action has a fade checkbox, leaving it off sends the command without a fade: the video player
then uses its default fade time (see "Video: default fade time"), the audio player changes at once.

Everything set through this module lasts until the device restarts. Permanent settings – the start page,
the operating mode, default volumes – are made in the device configuration.

### Actions

**Every mode**

| Action   | Effect                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Blackout | Picture black or visible. The HDMI signal is kept, so the display does not lose it. In video mode the picture fades |

**Browser** (browser, Ontime and Companion mode)

| Action                 | Effect                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Browser: show web page | Shows a page (`http://`, `https://` or `file://`) until the device restarts; the browser restarts for this, 2–5 s |
| Browser: idle timeout  | After this time without input the page shown last comes back; 0 switches the timeout off                          |
| Browser: start page    | Back to the start page from the device configuration (in Companion mode: the emulator chooser)                    |
| Browser: reload page   | Like Ctrl+R                                                                                                       |
| Browser: restart       | Restarts the browser, keeps the current page                                                                      |

**Ontime** (Ontime mode)

| Action            | Effect                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ontime: show view | Shows an Ontime view (timer, backstage, countdown, studio, timeline, cuesheet, op or any other). The settings field takes the options of the view as Ontime writes them after the `?` in its address, e.g. `stopCycle=true` |

**Companion** (Companion mode)

| Action                      | Effect                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Companion: show emulator    | An emulator of the Companion on the device, chosen from a list the device sends, or the chooser        |
| Companion: show web buttons | The web buttons view: all pages, or a page list such as `3` or `1,2`, optionally cut to columns × rows |
| Companion: restart          | Restarts the Companion on the device, e.g. if it hangs                                                 |

Buttons, pages and variables of the Companion on the device are controlled through that Companion's own
interfaces (its OSC or HTTP API, or a Companion-to-Companion connection), not through ShowPlayPI.

**Video** (video mode)

| Action                               | Effect                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Video: play, pause, play/pause, stop | Transport. Stop fades to black and stays black; the next play starts at the beginning |
| Video: next, previous, restart entry | Within the current playlist                                                           |
| Video: jump to time                  | Playhead of the current entry, counted from the start or from the end                 |
| Video: play entry                    | An entry of the current playlist, chosen from the file list, by name or by number     |
| Video: cue entry                     | Shows the first frame and waits; "Video: play" then starts it without delay           |
| Video: switch playlist               | The VIDEO folder is playlist 1, its subfolders follow; starts with the first entry    |
| Video: repeat                        | Loop the playlist, loop the entry, or play the playlist once                          |
| Video: default fade time             | For every command without a fade time of its own                                      |
| Video: still image duration          | Unless the file name says otherwise, e.g. `Sponsors [15sec].jpg`                      |
| Video: volume, mute                  | Set, raise or lower the volume; mute on, off or toggle                                |

**Audio player** (when enabled)

| Action                                                      | Effect                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Audio playlist: play, pause, play/pause, stop               | Transport of the playlist (background music), each with an optional fade                    |
| Audio playlist: next, previous, restart track, jump to time | Within the current track or playlist                                                        |
| Audio playlist: play track                                  | A track of the current playlist, from the file list                                         |
| Audio playlist: switch playlist                             | The AUDIO/LOOP folder is playlist 1, its subfolders follow; keeps playing if it was playing |
| Audio playlist: repeat, shuffle, volume                     | Playlist settings                                                                           |
| Jingle: play                                                | A jingle from the AUDIO folder, played once; optionally with a volume                       |
| Jingle: stop, volume                                        | Stop the jingle; the jingle volume                                                          |
| Jingle: playlist behaviour                                  | What the playlist does while a jingle plays: lowered to a percentage, or paused             |
| Audio: master volume, mute                                  | For everything                                                                              |
| Audio: stop all                                             | Stops playlist and jingle, e.g. an emergency button                                         |

Entries, tracks, playlists and jingles are chosen from lists the device sends; the lists are refreshed
every ten seconds, so a file added to the drive shows up shortly after. Files are sent by name, which
stays valid when files are added or removed; a number can be typed in instead and counts within the
current playlist.

### Feedbacks

| Feedback                                                                                                    | True when                                                  |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Device: connected                                                                                           | The device answers                                         |
| Device: memory warning                                                                                      | Memory is running low; critical means the device may stall |
| Device: temperature above                                                                                   | The processor is hotter than the limit                     |
| Device: power or heat problem                                                                               | Under-voltage, or throttling now or since the start        |
| Device: clock not synchronised                                                                              | The device has no time source                              |
| Blackout (video mode)                                                                                       | The picture is black because of a blackout                 |
| Video: player state, entry is current, playlist is current, repeat mode, muted, remaining time below        | The state of the video player                              |
| Audio playlist: state, track is current, playlist is current, remaining time below, repeat mode, shuffle on | The state of the playlist                                  |
| Jingle: playing (any or a chosen one), playlist behaviour                                                   | The state of the jingles                                   |
| Audio: muted                                                                                                | The master mute is on                                      |

"Entry is current", "track is current" and "jingle playing" make the button of the file that is playing
light up – the presets use them for one button per file.

### Variables

Device: `mode`, `audio_player`, `cpu`, `ram_percent`, `ram_available`, `ram_state`, `swap_percent`,
`temperature`, `uptime`, `free_system`, `free_media`, `time_synchronized`, `time_source`, `undervoltage`,
`throttled`, and `version`, `device_name`, `model` when the device reports them.

Video: `video_state`, `video_playlist`, `video_number`, `video_file`, `video_title`, `video_type`,
`video_elapsed`, `video_remaining`, `video_duration` (as `m:ss`), `video_elapsed_ms`, `video_remaining_ms`,
`video_repeat`, `video_volume`, `video_mute`, `video_fade`, `video_playlist_count`, `video_entry_count`,
`blackout`.

Audio: `audio_loop_state`, `audio_loop_playlist`, `audio_loop_number`, `audio_loop_file`, `audio_loop_title`,
`audio_loop_elapsed`, `audio_loop_remaining`, `audio_loop_duration`, `audio_loop_elapsed_ms`,
`audio_loop_remaining_ms`, `audio_loop_volume`, `audio_loop_repeat`, `audio_loop_shuffle`, `audio_jingle_state`,
`audio_jingle_file`, `audio_jingle_title`, `audio_jingle_elapsed`, `audio_jingle_remaining`,
`audio_jingle_remaining_ms`, `audio_jingle_volume`, `audio_jingle_mode`, `audio_jingle_duck`, `audio_volume`,
`audio_mute`, `audio_playlist_count`, `audio_track_count`, `audio_jingle_count`.

Companion mode: `companion_connections`, `companion_emulator_count`.

Remaining times are rounded up, so a countdown on a button shows `0:01` until the very end and `0:00`
only when nothing is left. The variables of an inactive mode are not defined.

### Presets

One section per area, offered for the active areas only: blackout and device tiles; the browser buttons
of the demo page that ships with ShowPlayPI; one button per Ontime view; one button per emulator; video
transport, status tiles, one button per entry (play and cue) and per playlist, repeat and sound; audio
playlist transport and status, one button per jingle, track and playlist, volumes, jingle behaviour,
shuffle and repeat. The buttons for files, playlists and emulators follow the lists of the device.

### Deliberately not included

- **Changing the operating mode.** ShowPlayPI changes it only through its configuration, with a restart.
- **Buttons, pages and variables of the Companion on the device.** They belong to that Companion's own
  interfaces.
- **Permanent settings.** Nothing set here survives a restart of the device; that is how ShowPlayPI
  works.

### Known limits

- The device does not yet report its operating mode, so browser and Ontime mode cannot be told apart and
  the Ontime actions are offered in both. A newer ShowPlayPI will report the mode, and the module will use
  it.
- The browser, Ontime and Companion views report no state yet (current page, page reachable, Companion
  running), so there are no feedbacks or variables for them. The blackout state is reported by the video
  player only.
- Video entries and audio tracks can only be played from the current playlist; switch the playlist first.
- The duration of a video or track is known once it has played; the file lists show it from then on.
- The state is polled, at the intervals set in the configuration. A one second interval keeps countdowns
  smooth; with both players running, two seconds is gentler on the device.
