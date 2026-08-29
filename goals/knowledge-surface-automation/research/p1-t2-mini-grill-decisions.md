# T2 mini-grill decisions — ratified 2026-08-06

Outcome record of the mini-grill over the fourteen open questions flagged by the
merged T2 design docs (`p1-refs-tree-design.md`, `p1-bootstrap-adopt-plan-design.md`,
PR #568), held per execution decision E7 before T2 implementation starts. Like the
P2 and E-series records, do not relitigate in implementation PRs. Numbering follows
each design doc's "Open questions for the mini-grill" section.

## refs-tree (`beep knowledge refs --tree`)

- **A1. Speculative paths:** the Stage-1 fence-decoy rule fully covers Workstream A.
  Prose paths must resolve; speculative trees go in fences. No A-specific marker
  syntax is introduced. (Same rule as C — decided once, settles both.)
- **A2. JSON/JSONC scanning:** line-wise as text in v1, preserving comparability
  with the line-wise surface-inventory baseline and its baseline-agreement test.
  Structural key-path scanning is a v2 candidate if the JSON FP rate demands it.
- **A3. Documented-convention sets:** code-level `HashSet` in the CLI, not a tracked
  JSONC allowlist. Widening a convention set is a deliberate CLI PR; this avoids
  growing a tracked exemption surface toward the laundering-API stop-condition.
- **A4. Heading anchors:** `#fragment` validation is a planned later version, not
  permanently out of scope. v1 strips anchors before resolution.
- **A5. `upstream://` bus:** stays reserved with no member class until Workstream
  B's `skills-lock/v2` provenance lands and owns it. The census does not emit
  GitHub-URL rows in v1.
- **A6. Tracked symlinks:** reported as skipped, never followed. The `.agents/skills`
  and `.claude/skills` trees stay independently auditable, consistent with B's
  mode-120000 symlink identity handling.
- **A7. roadmap-refs:** the `lint roadmap-refs` command keeps its name and CI step;
  only its implementation folds into the shared link parser during P3.
  `docs/ROADMAP.md` additionally joins the census corpus.

## bootstrap / adopt (`beep goals bootstrap|adopt --plan`)

- **E1. Flag surface:** hand-authored in v1, with help text written to match the
  schema annotations verbatim; annotation-reflection derivation is a later helper
  for the executor era. Ratified direction preserved, mechanism deferred.
- **E2. Interactivity:** flags-only in v1. TTY prompting belongs to the executor
  era; the pure-plan slice is agent-driven and keeps the zero-write argument simple.
- **E3. Exploration back-links:** cross-tree provenance edges (packet ↔
  exploration) belong to Workstream A's reference bus, which already measures the
  seven asymmetric pairs. `adopt --plan` plans packet-internal artifacts only.
- **E4. PacketId beacon:** a manifest key beside `initiative.id`, minted by
  bootstrap in v1 and preserved by adoption under the byte-preserving rule. No
  sidecar file; C6's `beep:ref` grammar stays a display-reference carrier, not an
  identity store.
- **E5. GOAL.md ownership:** `generated-seed`, like the other prose files — written
  once from mission/scope inputs, human-owned after, never rematerialized without
  a three-way merge. The doctor's 4,000-character budget applies regardless.
- **E6. Adoption patch payloads:** full payload bytes, hash-pinned — the committed
  patch is independently CI-replayable without recompilation, per the decided
  contract that the plan is the complete deterministic description. Adoption
  payloads are small in practice, so diff size stays bounded.
- **E7. Template drift:** `adopt` takes optional `--toward <archetype>`
  (`standard-delivery` | `report-first`), defaulting to inference from the
  packet's phase shape. The chosen archetype and the `_template` snapshot hash
  are recorded in the plan, making the measurement basis explicit and the plan
  deterministic under template drift.

## Effect on sequencing

With these ratified and all three FP-eyeball verdicts approved
(`p1-fp-eyeball-verdicts.md`), T2 implementation (PR-A refs joins the merged
Knowledge family; PR-E pure-plan reports) and the per-workstream P3/P4 unlocks
may proceed without further doctrine decisions.
