# P1 report — skills provenance pilot, shadcn (Workstream B)

Phase-0 evidence for the FP-eyeball gate (execution decision E4). The read-only
`bun run beep skills provenance shadcn --json` command was run live (network-enabled)
on 2026-08-04 against the pinned upstream; no lock file or skill file was written.

## Live-run result (abridged; full JSON reproducible by rerunning)

| Field | Value |
| --- | --- |
| upstream | `shadcn-ui/ui`, treePath `skills/shadcn`, tracking `main` |
| sourceRevision | `91f21dfe1328585670275781b4525fff2507f917` (exact historical pin) |
| observedHeadRevision | `cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4` |
| observedPathRevision | `6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37` |
| snapshot | 15-entry ordered tree manifest (path, git mode, sha256) |
| license | MIT, `LICENSE.md` bytes hashed at the pinned revision |
| provenance | `status: exact`, `confidence: high`, 15/15 files matched, evidence `exact-tree` + `path-history` |
| patches | `required: false`, empty series (patchSetHash = empty-set SHA-256) |
| effective | reconstructed treeHash + cross-target aggregate over `.claude/skills/shadcn` and `.agents/skills/shadcn` |

## Independent verification of the no-drift verdict

The P0 audit (`p1-skill-upstream-resolution.md`, 2026-07-31) recorded real local
drift in `rules/composition.md`. The live run instead reports byte-exact 15/15. To
rule out a false-negative drift detector, the pinned upstream file was fetched
independently (`raw.githubusercontent.com` at the sourceRevision) and byte-compared:
local and upstream `rules/composition.md` share SHA-256
`012d2a44373766fd9c13059ac1b971581fbe3982f2b1e92186a963c9990cfdcf` — identical.

**Verdict: true negative.** The installed skill was synced to upstream after the P0
audit; the audit's drift claim is stale, not the detector. Consequence: on the current
corpus the patch-generation path is exercised only by the test fixtures (which
simulate `composition.md` drift and binary assets), not by live data.

## Fail-closed behavior (verified in the sandboxed implementation run)

With network denied, the same command exits 1 with a typed operational transport
error naming the exact pinned-tree URL; no JSON is emitted and nothing is written.
Binary local drift also fails closed in the pilot: the P1 plain-patch generator
refuses to encode it rather than emit a dishonest patch.

## False-positive annotations

- Fabricated drift on live corpus: **none** (0 patch entries; verified independently).
- Fabricated provenance claims: **none** — `exact`/`high` is backed by a 15/15
  matched-tree comparison at the pinned revision; the ratified oracle representation
  (`inferred`/`medium`/`d6e773a…`) survives decode→encode byte-identically in the
  fixture suite, proving the schema cannot launder inferred into exact.
- Stale prior reconciled: the P0 drift claim for `rules/composition.md` (see above).

## Suite summary

6/6 tests pass (`skills-provenance` + existing `skills-command`): lock-schema
round-trips for every `skills-lock/v2` block, shadcn drift fixture (modified
`composition.md`, byte-identical PNG, exact pin), oracle epistemic-representation
fixture. One implementation-review correction: the patch `owner` field initially
recorded the local Unix username and was corrected to the resolvable GitHub handle
`@kriegcloud`.

## Open question carried to lock materialization (P4)

The repo has no `CODEOWNERS`; patch `owner` is `@kriegcloud` by construction. The
materialization phase should bind this field to a real ownership policy.

## Eyeball ask

Confirm (a) the `exact`/`high` shadcn verdict and the stale-drift reconciliation,
(b) fixture-only coverage of the drift/patch path is acceptable evidence for the
pilot (or name a currently-drifted skill to add as a second live probe), and (c)
nothing else blocks unlocking Workstream B mutation work (lock materialization,
patch series, Renovate wiring — P4/P5).
