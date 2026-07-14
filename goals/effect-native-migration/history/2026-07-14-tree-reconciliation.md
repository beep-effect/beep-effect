# Effect-Native Migration Tree Reconciliation — 2026-07-14

`ops/progress.json` is the historical execution ledger: all 5 phases, all 7
symbol inventories, and all 75 package entries are done. This reconciliation
performed an existence-only check of those 75 recorded paths against today's
tree; it did not re-audit live code or perform fresh discovery.

- Recorded package entries: 75
- Paths still present at HEAD: 50
- Removed since the historical run: 25

## Removed since

- `@beep/messages` — `packages/foundation/modeling/messages`
- `@beep/installer-domain` — `packages/installer/domain`
- `@beep/canvas-domain` — `packages/canvas/domain`
- `@beep/installer-use-cases` — `packages/installer/use-cases`
- `@beep/repo-codegraph` — `packages/tooling/library/repo-codegraph`
- `@beep/canvas-use-cases` — `packages/canvas/use-cases`
- `@beep/installer-server` — `packages/installer/server`
- `@beep/agent-capability-use-cases` — `packages/agent-capability/use-cases`
- `@beep/agent-capability-domain` — `packages/agent-capability/domain`
- `@beep/wealth-management-domain` — `packages/wealth-management/domain`
- `@beep/shared-server` — `packages/shared/server`
- `@beep/canvas-server` — `packages/canvas/server`
- `@beep/shared-config` — `packages/shared/config`
- `@beep/sandbox` — `packages/foundation/capability/sandbox`
- `@beep/shared-use-cases` — `packages/shared/use-cases`
- `@beep/canvas` — `apps/canvas`
- `@beep/stack-installer` — `apps/stack-installer`
- `@beep/professional-runtime-proof` — `apps/professional-runtime-proof`
- `@beep/nlp` — `packages/foundation/capability/nlp`
- `@beep/codedank-web` — `apps/codedank-web`
- `@beep/konva` — `packages/drivers/konva`
- `@beep/shared-client` — `packages/shared/client`
- `@beep/canvas-client` — `packages/canvas/client`
- `@beep/canvas-ui` — `packages/canvas/ui`
- `@beep/shared-ui` — `packages/shared/ui`

Historical waiver-marker locations remain documented in `ops/waivers.md`,
including the `@beep/nlp` native-`Set` WONTFIX marker and the
`@beep/semantic-web` `WeakSet` boundary exception as recorded by the completed
run. A removed package path does not rewrite that historical evidence.
