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
