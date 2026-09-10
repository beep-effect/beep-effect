# Round 27 driver G–M carrier audit

Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.

The independent `r27-drivers-g-m` census completed all seven assigned roots
with exit zero, an end-turn event and a valid empty report. Its completion
footnote flags three seed records. This source audit adjudicates that footnote;
it does not replace independent census coverage or the pending P3 review.

| Inventory id | Decision | Current source evidence |
| --- | --- | --- |
| `r2-drivers-arch-graph-3d-mount-latches` | Withdraw from the live census; preserve the old row in history. | `cancelled` is local to the React effect in `packages/drivers/graph-3d/src/Graph3D.react.ts:69`. `destroyed` is local to `mountRenderer` in `packages/drivers/graph-3d/src/Graph3D.renderer.ts:359`. No named carrier or same-module sibling-state cluster contains both. Their interaction through a destroy method does not establish the same-scope net. The old D1 note explicitly combined sibling files. |
| `tool-name-collision-row-truncated-digest` | Retain the qualified E3 pair and existing design. | `ToolNameCollisionRow` carries `digest: S.NullOr(S.String)` at `packages/drivers/gov-legal-mcp/src/ToolNames.ts:147` and `truncated: S.Boolean` at `:153`. The writer derives an optional digest from `truncated` at `:439-440` and projects it to null/string at `:448-456`. Digest presence is an actual nullable member, not an invented required-string predicate. |
| `m365-tool-error-retryability` | Retain the qualified E4 pair and existing design. | `M365ToolError` carries an optional-key reason decoded as `Option<M365ErrorReason>` at `packages/drivers/m365-mcp/src/M365Tools.ts:78` beside `retryable: S.Boolean` at `:81`. The handler constructs both at `M365Handlers.ts:36-47`. The existing design counts all eight reason literals plus the supported absent-reason case: 18 representable combinations and nine legal tuples. Calling reason a payload does not invalidate its real alternatives. |

The collision-row design also had a prose-only anchor label error: line 153
identifies `truncated`; `digest` is at line 147. Correcting that description
changes neither qualification nor the compatibility design. No product source,
test, dependency, lockfile or generated file changes are required by this audit.
