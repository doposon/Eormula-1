# Weather and engine source

Practice setup and Settings share five presets, saved in local browser storage:
Sunny / Cloudy / Light Rain / Medium Rain / Heavy Rain. Dry grip is unchanged;
rain multiplies axle grip and braking by 0.82 / 0.64 / 0.46 respectively.
The selected tyre compound and tyre wear still apply. Changing weather applies
immediately, including when paused. Intermediate and wet compounds retain their
existing tuning; these presets do not simulate standing-water aquaplaning.

Sunny uses a larger sun disc and halo. Cloudy increases sky cloud coverage and
softens the scene tone. Rain uses one static vertex buffer and one draw call,
with 536 / 1032 / 1600 GPU-animated streaks. Track geometry, textures and collision
meshes remain full quality. Horizontal asphalt-like materials become darker and
cooler; distance haze grows with rain intensity. There are no real-time reflections
or per-drop physics. Actual frame rate depends on the device and selected circuit.

## Recording

The supplied 75.392-second engine recording is bundled at `assets/engine-source.mp3` and loads automatically for hosted play.
Alternatively choose it once in ENGINE AUDIO: the validated original bytes are
stored in IndexedDB and restored automatically on subsequent visits to that origin.
Storage permission/clearing/private browsing may prevent persistence. Playback is
unlocked by the first user gesture, as required by browser autoplay policies.

The in-game offline HTML download embeds the currently loaded original bytes.
The Python exporter also embeds `assets/engine-source.mp3` if present, or accepts
`--engine-source /path/to/original.mp4`. The approved markers and audio scheduling
remain unchanged. No video frames are rendered during driving.

Validation: `python tools/weather_smoke.py` covers shader compilation, all presets,
synchronized menus, grip/braking order, Settings during pause, reload persistence,
and audio decoding/cache restoration using a synthetic 75.392-second WAV. It does
not validate the missing original recording's sound or measure hardware performance.

The browser check also exposed an existing NPOT Ferrari mipmap error. Model texture loaders now keep NPOT image dimensions and use WebGL 1 compatible linear/clamped sampling. Power-of-two textures retain mipmaps and repeat wrapping.
