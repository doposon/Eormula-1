## Continuous sound update

Coasting now fades to 30% of its starting level, rather than silence. Brake gear 1 retains progressively spaced replays but sustains the last 0.2 seconds between them. Automatic gear durations are unchanged.

# Engine sound integration

After loading, the game opens an engine sound dialog before race mode selection. Select the same approximately 75.392-second video/audio used in the sound lab, wait for confirmation and click 进入游戏. 暂时跳过 enters without sound. The mode menu and Settings both have an ENGINE SOUND button to reopen the dialog. The file remains local and is decoded by the browser; the recording is not distributed with the game. Reloading the game requires selecting it again.

The approved version-6 upload is preserved verbatim in `sound-lab/approved-markers.json`. Its exact nodes are embedded in `src/marked-audio.mjs`, imported by both game and Lab 07.1. Both offline exporters inline this same module. No rounding or stable-window trimming is applied to the approved geared ranges.

The sound clock and HUD gear use the marked clip durations, independently of vehicle speed thresholds. Gears 6 and 7 use gear 5 with the approved 1.25/1.5 duration factors and the same final 0.2-second tail loop as Lab 07. All playback rates are 1. Subsequent gear boundaries are scheduled in advance on Web Audio's clock, so a slow render frame cannot skip a sound segment. Pause cancels scheduled nodes and freezes elapsed clip time; resume reconstructs the schedule from that position. Game acceleration and braking physics retain their existing tuning; the sound controller determines gear timing, not vehicle motion.

Releasing both pedals always loops the selected 0.2377289157-second coast clip. Its volume follows `exp(-elapsed/6)` and returns to normal on renewed acceleration or braking. Holding the brake after reaching gear 1 replays the complete gear-1 braking clip indefinitely; the silent gaps are 0.15, 0.30, 0.45 seconds and continue increasing by 0.15 seconds per repeat. Repeats are scheduled 30 seconds ahead on the audio clock. Releasing the brake cancels every queued repeat and starts the fading coast loop. These terminal-state behaviors do not change any earlier gear timing.

Validation: `node tools/marked_audio.test.mjs` checks exact equality with uploaded nodes, all up/down boundaries, progressively spaced gear-1 repeats, unconditional fading coast and pause freezing. Browser checks cover the shared lab controller and game audio/HUD. Both offline exporters continue to inline this same module. Tests use synthetic audio; the user auditioned the real recording in the lab.
