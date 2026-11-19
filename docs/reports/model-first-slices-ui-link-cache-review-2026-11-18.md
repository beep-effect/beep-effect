# Cache review for the `@beep/ui` link in the model-first-slices prototype

Reviewed on `@slop/11-18-26`. Reviewer: Claude Fable 5.2 (model-first-slices lane). No command,
cache flag, output or environment variable changed; no qualification is granted.

## Audit

`bun run beep cache audit` reports one blocking `configuration-drift` finding in one subject:

| Subject | Drifted computations |
| --- | --- |
| `//` | `check:model-first-slices` |

The one `REVIEW configuration-source-drift` line names the root `turbo.json`, the file the
change below is in.

## `//#check:model-first-slices`

A lint fix on this branch replaced the two plain buttons in the prototype's screens with `Button`
from `@beep/ui/components/button`. The prototype did not link `@beep/ui`, so its tests loaded a
second React. `scratchpad/model-first-slices/party/web/package.json` now links it
(`link:../../../../packages/foundation/ui-system/ui`), and
`scratchpad/model-first-slices/package.json` points `react` and `react-dom` at the root install
through `overrides`.

The task's `inputs` in the root `turbo.json` gain the manifest and sources of that package:

- `packages/foundation/ui-system/ui/package.json`
- `packages/foundation/ui-system/ui/src/**`

`tsrs -p party/web --listFilesOnly`, run in the prototype, lists five files under
`packages/foundation/ui-system/ui`, so the check reads them and they belong in the key. The other
packages it lists (`@beep/identity`, `@beep/schema`, `@beep/utils`, `@beep/types`) were inputs
already. The root `bun.lock`, already an input, pins the `react` and `react-dom` the prototype now
resolves. `docs/runbooks/turbo-cache-inputs.md` records the new inputs in the task's row. The
command, `cache: true`, `outputs: []` and the absent `env` are unchanged.

## Request

`docs/reports/model-first-slices-ui-link-cache-request-2026-11-18.json` names this one subject,
binds `previous` to the exact current text of `standards/cache-baseline/_root.json`, and copies
`scope`, `profile` and `epoch` from it.
