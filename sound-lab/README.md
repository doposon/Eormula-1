# Three waveform banks and live acceptance lab (Lab 07.1)

The approved user markers in `approved-markers.json` are loaded for the matching-length source. Lab and game now both import `src/marked-audio.mjs`. Automatic shift durations are unchanged; both sides use the exact source offsets and fifth-gear extension factors. The new requested behavior is conditional one-shot coasting: ordinary throttle release is silent unless a downward gear change has occurred; braking through gear 1 plays the coast clip once and then remains silent. This supersedes the earlier infinite-coast behavior below. Web Audio schedules gear boundaries in advance; game frame rate and vehicle speed do not alter their timing.

The main page now loads `v7/`: three permanently visible, independent editors (acceleration, braking/downshifts and coasting), followed by a live WASD/QE acceptance console. Each geared editor accepts 5/6/7 recorded gears with separately draggable boundaries. Missing high gears extend the fifth-gear sample by looping only its last 0.2 seconds, retaining the original pitch. The braking editor runs in descending gear order.

After Apply All, W plays acceleration in the current gear, S plays the independent braking range and releasing both loops the entire selected coast range indefinitely with a seam crossfade. A/D show steering, Q/E shift manually. Automatic gear changes wait for the full marked segment (including extension duration); disabling automatic changes holds the current gear and loops its final tail. Speed and RPM are sound-test references. This is a standalone acceptance lab, not updated game physics or in-game integration.

Version-6 exports contain three banks `{key,count,nodes}`, source identity and extension factors. Version 4/5 waveform markers can be imported; separate one-shot shift markers from the previous UI are not used in this range-based workflow. Files do not contain audio. Validation: `python3 tools/driving_audio_lab_smoke.py` tests independent waveforms, coast beyond source duration, W/S switching, automatic and manual shifts and marker round-trip using synthetic audio.

## Legacy Lab 06.1

Update: there are five independent banks: per-gear acceleration, per-gear braking, a single upshift event, a single downshift event and no-throttle coasting. The last three each use one start/end range. Each geared bank supports recordings ending in gear 5, 6 or 7 (default 5). Changing the recorded gear count redistributes the current range and requires recalibration. Missing gears use the gear-5 range repeated at playbackRate 1 for 1.25× (gear 6) or 1.5× (gear 7) duration. Per-gear previews audition these extensions; whole-range playback stays faithful to the original recording.

Exports now use version 5, with `recordedGears`, independent `coast`, `upshift`, `downshift` ranges and explicit `extensions` metadata. Version-4 imports remain supported as seven recorded gears with no single-event/coasting ranges. These are editor markers and previews; the updated behavior has not been wired back into the game.

The main `/sound-lab/` page now loads the waveform editor in `v6/`. Pick a local video/audio recording of any length. The complete decoded waveform uses per-bin minima/maxima across all channels, representing amplitude rather than pitch. Zoom and horizontal scrolling allow fine alignment.

Acceleration and braking have independent banks of eight increasing time boundaries, defining seven intervals. Acceleration maps these to gears 1 through 7; braking maps them to 7 through 1. Drag a range to create evenly spaced placeholder boundaries, then calibrate the six internal shift markers by dragging, clicking or editing seconds. Marker order is bounded with a 20 ms minimum gap. Editing invalidates that bank’s applied snapshot.

Apply copies the current bank for a full-range audition. Per-gear previews and applied playback use the exact decoded source offset and duration through Web Audio at playbackRate 1; the recorded pitch and gear transitions are preserved. This editor does not yet synthesize arbitrary driving or change the game. Five-state and prior four-layer prototypes remain available in their version folders.

Version-4 JSON exports include source filename, duration and nullable acceleration/braking arrays of eight times. Imports validate source identity, bounds and strict ordering. Markers do not include the recording. `python3 tools/waveform_smoke.py` checks waveform decoding, drag selection, exact time edits, marker bounds, zoom/scroll sizing, both gear orders, finite playback and marker round-trip with synthetic audio. Actual shift points are marked by the user.

---

# Five-state sound lab (Lab 05)

The main `/sound-lab/` page now opens the five-state editor in `v5/`. Prior four-layer prototypes remain in `v3/` and `v4/`. This iteration changes the independent lab only.

Mark upshift and downshift as complete single events; they play once per actual gear event, at the recording’s original pitch. Mark acceleration, braking in the same gear and no-throttle coasting independently. Only one continuous state plays at a time; loops mute while shift samples play. Unmarked states are silent. The old low/mid/high/coast markers cannot identify these five states and are not automatically reused. Five-state JSON exports use version 3.

Manual gear control is the default. Automatic upshifts wait until the smoothed RPM exceeds 11800 for half a second, allowing the high-pitch section to be heard. Automatic downshifts occur only during braking. The source recording is still chosen locally and is not shipped in the repository.

Validation: `node tools/five_state.test.mjs` checks the full manual RPM sweep, five driving states and automatic shift dwell; `python3 tools/five_state_smoke.py` checks independent markers, throttle/brake/coast routing, single-shot shifts, stop and JSON round-trip in Chromium. These tests use synthetic sound; selection quality for the user’s actual recording requires auditioning.

---

Legacy four-layer lab documentation follows.

# Sound lab prototype

Independent static Web Audio test page. Open `/sound-lab/` on the published site and select a local video/audio file. Audio is decoded in the user's browser; the video is not uploaded. The original supplied MP4 exceeded the workspace's 32 MiB transfer limit, so its contents have not been analysed or auditioned by the developer. No source clip or finished engine sound bank is shipped.

Automatic candidates use approximate zero-crossing bands and short-window amplitude stability, not engine RPM recognition. Users can audition the source, set low/mid/high/coast loops, and export/reimport time markers tied to the source filename and duration. Loop edges are crossfaded. Four persistent looping AudioBufferSources blend and change pitch according to a virtual eight-speed drivetrain, with shift cuts, downshift blips, volume and cockpit filtering. This is a tuning prototype, not a faithful reconstruction of the original engine or a physical gearbox. It deliberately does not alter the game.

Browser decoding support depends on the input codec; MP4 with AAC should work in supported Chrome/Edge builds. If decoding fails, the original media player remains available and the UI requests a supported audio export. Backgrounding stops engine playback. Keyboard: W/up throttle, S/down brake, Q/E shift, Space stop. Pointer release/cancel and window blur clear held pedals.

Validation: `node tools/sound_lab.test.mjs` covers acceleration, automatic upshifts, coasting, braking/downshifts, overrev prevention and silent-input rejection. `python3 tools/sound_lab_smoke.py` creates a synthetic MP4/AAC fixture with ffmpeg and verifies browser decoding, four source layers, nonzero audio output, stopped silence, keyboard control, high-gear mode, clip editing, original playback and marker round-trip. These checks do not evaluate the user's actual F1 recording or establish its subjective realism.

## User-calibrated preset (Lab 02)

The uploaded `Formula-Racing-audio-markers.json` identifies `屏幕录制 2026-10-30 091321.mp4` of duration 75.392 seconds. The four edited time windows and reference RPMs are preserved in `preset.json` (low 0–3 s, mid 3–6 s, high 16–19 s, coast 23–24 s). The preset is loaded automatically only for that filename and matching duration (±0.15 s), and then passed unchanged to the existing four-layer engine. A different file receives fresh approximate candidates and an explicit mismatch message. The original 75-second recording itself is not included in this repository or available to this executor; auditory quality of its selected windows remains a user listening check.
