# @beep/semantica

Construction-side canary lab for D13. It is headless-first and exports nothing
reusable.

## Surface

- Headless entry: `bun run canary c0|c1|c2 [--manifest <path>] [--paper <id>] [--offline]`.
- Keep the generated React shell intact and minimal. It is not the proof surface.
- `src-tauri` is frozen through C2 under S4.
- W1 remains out of the repository and is referenced only by its B3 manifest.
- D14's local-only corpus must not appear in committed inputs or documentation.
- Keep app internals app-local through `@/*`.
- This app publishes no `@beep/semantica` source exports. Do not add a package root export or docgen surface.

- Contract: `goals/semantica-canary/SPEC.md`; law table: `explorations/semantica-lab/DECISIONS.md`.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this app; record only genuinely app-specific deltas here.
