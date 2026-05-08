## Kenney extra kits (local-only)

This folder is for **local testing** of additional Kenney asset packs that are **not committed to Git**.

### Where to unzip

Unzip your packs into:

- `frontend/public/assets/kenney_extra/city_suburban/`
- `frontend/public/assets/kenney_extra/fantasy_town/`
- `frontend/public/assets/kenney_extra/holiday_3/`

### How it works

The game catalog uses `srcCandidates` (preferred) and falls back to built-in assets when a file is missing.

If your filenames differ, update `frontend/src/game/assets/catalog.js` so the `srcCandidates` match your real PNG paths.

