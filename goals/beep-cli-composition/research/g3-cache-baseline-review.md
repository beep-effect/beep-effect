# Cache baseline review: G3 lazy dispatch reseal (2026-10-31)

Reviewer: Claude Opus 5.5 (G3 lane, `claude/beep-lazy-dispatch-369e54`).

`beep lint policy-fingerprint --write` resealed seven generated tasks under
subject `//`. These are the only configuration-drift BLOCKs in
`beep cache audit`. Each input change, compared with `main` at `b30cd9e6dd`:

| Task | Inputs added | Inputs removed | Cause |
| --- | --- | --- | --- |
| `//#lint:policy-fingerprint:shared` | `packages/tooling/tool/cli/src/internal/dispatch/Dispatch.manifest.ts`, `Dispatch.schemas.ts`, `Dispatch.ts` | none | This PR: `bin-main.ts` now imports the lazy dispatch modules, which are part of the shared root seal. |
| `//#lint:policy-fingerprint:goals-doctor` | none | `packages/tooling/tool/cli/src/internal/GlobPattern.ts` | Inherited: #2381 (`0cb11741db`) deleted the file before #2390 sealed. |
| `//#lint:policy-fingerprint:goals-index` | none | same | same |
| `//#lint:policy-fingerprint:knowledge` | none | same | same |
| `//#lint:policy-fingerprint:lint-deprecated-apis` | none | same | same |
| `//#lint:policy-fingerprint:lint-roadmap-refs` | none | same | same |
| `//#lint:policy-fingerprint:quality` | `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocNodes.ts` | same | Inherited: #2381 moved the docgen quality subjects onto `JsDocNodes.ts`. |

No task, flag or edge outside these input lists changed. No qualification is
granted, and no exception row or standards debt is added. Scope, profile and
epoch are copied unchanged.
