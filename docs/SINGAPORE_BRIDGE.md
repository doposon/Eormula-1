# 2.17.6: opaque, coloured Singapore bridge deck

The bridge section in the user's follow-up screenshot uses original material 29, not asphalt material 182 addressed in 2.17.5. Material 29 is marked BLEND and its texture alpha ranges from 87 to 203 out of 255. It covers roughly 64,234 square world units near road height. The previous asphalt-only probe did not cover this deck.

Material 29 now joins Singapore's opaque ground pass: texture alpha is ignored and the surface writes depth, hiding columns and geometry beneath the deck. Bridge deck 29 and asphalt 182 receive the same dark grey tint [0.55, 0.57, 0.60, 1] while retaining their texture detail. Other road markings, kerbs and glass/foliage retain their existing materials. Spa contact and camera code are unchanged.

`tools/bridge_opacity_smoke.py` loads the actual Singapore GLB, positions a camera over material 29 geometry, checks its opaque/non-blended state, and substitutes a zero-alpha texture to verify that the bridge remains visible. It compares rendered pixels against removing the deck entirely and saves screenshots under test-results/singapore-bridge. Camera, Spa slope-alignment and 28 resource integrity checks are also run.

Outcome: bridge material 29 remained visible under a deliberately zero-alpha texture, affecting 50.5% of the comparison viewport relative to removing the deck. The dark road screenshot was visually inspected; lane markings and kerbs remained visible. No uncaught browser exceptions occurred. Five camera tests, 90 Spa road-alignment cases, and all 28 resource checks passed.
