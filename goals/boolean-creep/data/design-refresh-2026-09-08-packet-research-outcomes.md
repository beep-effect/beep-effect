# Packet and research outcome design refresh — 2026-09-08

## Source

- Repository source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Compared package/app corpus: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Correction inputs: `data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-cli-d-k-contract-correction1.jsonl` and `data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-cli-r-z-contract-correction1.jsonl`

## Designs refreshed

- `designs/goals-packet-snapshot-presence.md` — confirmed full cluster `[exists,files]`, 4 representable / 3 legal, derived internal Tier 1. Missing, empty-existing, and nonempty-existing remain distinct. `templateFiles` and its digest are independent.
- `designs/goals-packet-migration-kind.md` — corrected the provisional pair to full cluster `[isBackfill,parked,manifestText,readmeText,edits]`, 48 / 6, stored internal Tier 1. The six cases are unchanged; manifest-only, README-only, both mechanical changes; backfill; and parked. No writer, fixture, documentation, decoder, or persisted input supports explicit `isBackfill:false`; optional-Boolean schema permissiveness alone does not make it legal. Parked has no texts/edits, backfill has manifest text/nonempty edits, and all mechanical outputs correspond to nonempty ordered edits.
- `designs/goals-transition-plan-disposition.md` — corrected the pair to full cluster `[streamPresent,disposition,currentRevision,currentTip,events,derivedAfter]`, 192 / 4, stored internal Tier 1. Streamless, skipped, append-from-empty-stream, and append-from-established-stream cases now own exact revision/tip/event/derived payloads.
- `designs/r2-tooling-packet-transition-stream-trace.md` — repaired the old cross-carrier design onto `PacketTransitionOutcome` at `PacketTransitionWriter.ts:304`; full cluster `[disposition,traceWritten,appended,tip]`, 24 / 4, stored internal Tier 1. It preserves streamless, skipped-fresh, skipped-refreshed, and append, including CAS before skipped trace repair and event append before trace projection.
- `designs/skills-patch-series-presence.md` — confirmed `[required,series]`, 4 / 2, derived wire Tier 2. The design preserves the existing lock-shaped JSON, ordered patch bytes, patch hashes, and stable empty-set hash. The provenance command remains read-only.
- `designs/data-sync-target-changed-files.md` — confirmed `[changed,changedFiles]`, 4 / 2, derived persisted Tier 2. The legacy `data-sync-report/v1` keys/bytes remain, and `canonicalPatch` stays independent because canonical-only drift need not change generated files.
- `designs/research-capture-outcome.md` — confirmed `[skipped,cardPath,id,title]`, 16 / 2, stored internal Tier 1. Already-seen returns the empty skipped case; capture returns three nonempty payloads. Title filtering trims/rejects empty metadata and falls back to normalized URL. Card/frontmatter/database/log bytes and write order remain unchanged.

## Exposure and sequencing findings

`PacketSnapshot`, `GoalPacketMigration`, `PacketTransitionPlan`, `PacketTransitionOutcome`, and `ResearchCaptureSummary` are transient decoded values with no live serialization boundary. Their designs use atomic decoded TypeScript migrations and do not invent compatibility transforms solely because their schemas are exported. Skills provenance has a real JSON wire codec, and data sync has a persisted report, so those Tier 2 designs preserve the old encoded projections exactly.

Implement the Tier 1 packet/research migrations serially so shared CLI source and tests move atomically. Follow with the skills and data-sync Tier 2 migrations as singleton batches. No product source, tests, inventory/status, generated files, dependencies, or git refs were changed in this refresh.

## Verification

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` — passed: `design coverage OK: 147 qualified ids`.
- Scoped status/diff review covered only the seven owned designs and this handoff.

## Remaining blockers

No design blocker remains. The orchestrator reconciled all three expanded full clusters into the canonical inventory: migration 48/6, transition plan 192/4, and transition outcome 24/4. All seven records now have designed status; independent P3 review remains pending.
