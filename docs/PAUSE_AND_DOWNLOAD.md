# 2.17.2: practice pause and offline download

During an active practice session, Escape freezes driving, suspension updates, ghost replay and lap timing, clears held controls and opens Quit / View Track / Settings. View Track and Settings keep the session paused. Escape returns to the pause menu, then Escape or Space starts the existing three-second resume countdown. Quit clears session/ghost/lap state and returns to track selection. Reset is ignored while paused. Pause is available once the start lights finish.

The website's DOWNLOAD OFFLINE HTML button builds a single HTML from the maintained source, CSS and all 28 already-loaded assets. It saves the file through the browser download mechanism. This avoids a separate release API upload and large chat attachments. The resulting file has no runtime resource fetches and hides its own download button. The browser must have enough memory and disk space for the roughly 309 MiB HTML.

`models/RB22.glb` and `models/SF26.glb` are exact zlib decompressions of the existing embedded models; no geometry, texture or node changes were applied. RB22 has one node; SF26 has material-based nodes, not four independent wheel assemblies. Wheel separation and runtime wheel animation remain future work after the edited GLBs are provided.

Validation: `node tools/camera.test.mjs`, `python3 tools/verify_assets.py`, `python3 tools/pause_smoke.py`. The browser smoke test drives, pauses, checks a frozen position, opens both submenus, resumes with corrected timer origin, quits, starts again with a different team, downloads the actual HTML and runs its pause menu through local HTTP. Cloud browser policy prohibits file:// navigation, so Windows double-click remains a user check.
