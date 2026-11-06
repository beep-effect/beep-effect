# Map

<!--
Stage 4. Decomposition into candidate goal packets. Every major component
cites an existing repo capability or is explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `packet-archive-mechanics` | Ship `beep goals harvest` and `beep goals archive`, the manifest `archive` block and `retentionReason`, doctor and INDEX support, archive-repo creation, then sweep every terminal packet off `main` in sequential hash-verified batches | none | the `packet-core` capability (packet-control-plane-core), the `graph` capability (knowledge-surface-automation), `beep refs` members (`packages/tooling/tool/cli/src/commands/Refs`), knowledge link parser (`commands/Knowledge/Knowledge.refs.ts`), `goals index` / `goals doctor`; NET-NEW: archive push + hash verify, tombstone writer, link rewriter, harvest projector |
| `harvested-alpha-triage` | Run the harvest, judge it with three provider sessions into row-keyed verdict JSONL, merge deterministically, and seed a new exploration packet `harvested-alpha-2026-11` at stage `shape` | `packet-archive-mechanics` P0 (ledger committed) | `beep goals harvest` (goal A), reflection schema (`commands/Lint/ReflectionArtifact.ts`), proxy and Codex routes (`docs/runbooks/agent-pools.md`); NET-NEW: verdict schema, merge step, exploration seeder |

## Sequencing

1. `packet-archive-mechanics` P0: tooling PR (schemas, commands, doctor,
   INDEX, README doctrine), public-CLI smoke on one packet, ledger committed
   at a named `main` SHA.
2. `harvested-alpha-triage` starts as soon as the ledger merges; it does not
   wait for the sweep.
3. `packet-archive-mechanics` P1–P3: archive repo created, batches of about
   50 packets one PR at a time (goals first, then explorations), tag on the
   last batch, `beep refs` member added, `goals archive` wired into the
   closeout skill.
4. `harvested-alpha-triage` closes by graduating nothing itself: its
   deliverable is the seeded exploration whose MAP produces the concrete
   goals.

## First Vertical Slice

`beep goals archive --kind goals <one completed slug>` on a lane: pushes the
packet to the archive repo, verifies the tree hash, leaves manifest + stub
README + reflections + OPPORTUNITIES on `main`, rewrites that packet's inbound
links, and `goals doctor`, `goals catalog`, `goals index --check` and the
knowledge link lint all stay green. Verified by the hosted gates on the PR.

## Open Risks Inherited From The Brief

- Link rewriter must use the shared link parser; regex rewrites corrupt prose.
- `researchReports` projections and `goals doctor` must tolerate archived
  packets without treating missing files as drift.
- Public CLI runtime smoke before any batch (2026-08 lesson).
- Exploration manifest needs its own archive-block schema home.
