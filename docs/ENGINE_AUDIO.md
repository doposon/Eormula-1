# Engine sound integration

After loading, the game opens an engine sound dialog before race mode selection. Select the same approximately 75.392-second video/audio used in the sound lab, wait for confirmation and click 进入游戏. 暂时跳过 enters without sound. The mode menu and Settings both have an ENGINE SOUND button to reopen the dialog. The file remains local and is decoded by the browser; the recording is not distributed with the game. Reloading the game requires selecting it again.

The four calibrated source ranges are preserved. The stable-window loop builder and mixer from the sound lab are embedded inside `src/game.js` so both offline exporters remain self-contained. Changes to the shared audio algorithm should be mirrored here and verified with the game audio smoke test.

Audio follows real game speed, the HUD automatic gear, throttle/brake keys and cockpit view. Gear changes trigger a short cut or blip. Pause, menus and hidden tabs mute output. The initial virtual RPM is 5500 with the slower pitch response accepted in the lab. Physics is not driven by the audio simulation.

Validation: `python3 tools/game_audio_smoke.py` generates synthetic audio and checks loading, acceleration response and pause mute. `python3 tools/pause_smoke.py` checks gameplay and exported offline HTML. Actual F1 recording quality was auditioned by the user in the sound lab; synthetic tests do not establish realism.
