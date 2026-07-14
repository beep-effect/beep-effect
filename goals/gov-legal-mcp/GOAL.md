# GOAL: ship the collision-safe gov legal MCP host

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: `packages/drivers/gov-legal-mcp` exposes bounded read-only GovInfo and
eCFR toolkits through one Effect-native stdio server, using shipped MCP-kit auth
composition and a deterministic, checked-in generated-tool-name collision
contract.

Read first:

- `goals/gov-legal-mcp/README.md`
- `goals/gov-legal-mcp/SPEC.md`
- `goals/gov-legal-mcp/PLAN.md`
- `goals/gov-legal-mcp/ops/manifest.json`
- `goals/mcp-kit/SPEC.md` and `goals/uspto-mcp/SPEC.md`
- `explorations/gov-legal-data-driver-codegen/MAP.md`
- `AGENTS.md`, `CLAUDE.md`, and standards/skills named by the spec

Scope:

- In: one new driver-sibling package; bounded GovInfo/eCFR read tools;
  `none|soft|hard` source registration; gated layer composition; sanitized
  dispatch; four MCP hints; stable driver-prefixed normalization, 64-character
  cap with digest suffix, duplicate detection, checked-in collision report,
  offline fixtures, docs, tests, and evidence.
- Out: Federal Register, DOL, CourtListener, delivery breadth, driver transport
  changes, general OpenAPI→MCP generation, writes/write-wall audit, persistence,
  live credentials/network, unrelated packages, and `goals/INDEX.md`.

Workflow:

1. Audit live public driver and mcp-kit exports; freeze the complete candidate
   name/gate/report inventory before scaffolding handlers.
2. Implement deterministic naming first. Fail closed on any normalized or
   truncated duplicate; never rely on registration order.
3. Mount eCFR as `none` and GovInfo as `hard`; preserve the shipped `soft`
   behavior contract for future sources without adding one here.
4. Compose one stdio server through gated layers and `sanitizedToolkit`; annotate
   all tools accurately as read-only.
5. Validate definitions/results against installed Effect MCP schemas and prove
   offline absent/present credential behavior.
6. Re-run report generation and require no diff. Preserve unrelated changes.
7. At P3, write a reflection and drive the PR to mergeable through Yeet.

Acceptance:

- [ ] Every `SPEC.md` criterion passes.
- [ ] Both proven drivers expose bounded real tools through one server.
- [ ] Names/report are deterministic, ≤64 chars, and collision-clean.
- [ ] Offline auth, MCP-schema, span, annotation, and repo proof pass.
- [ ] No delivery breadth or write-wall scope lands.

Verification:

```sh
test "$(wc -m < goals/gov-legal-mcp/GOAL.md)" -le 4000
jq . goals/gov-legal-mcp/ops/manifest.json
git diff --check -- goals/gov-legal-mcp
bun run beep yeet verify
```

Stop before redesigning a driver/kit, weakening duplicate detection, or pulling
paused delivery/write scope into this package. Done only when the PR is
mergeable through Yeet or a blocker is reported with file/command evidence.
