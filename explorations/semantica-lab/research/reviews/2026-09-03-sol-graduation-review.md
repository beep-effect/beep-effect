<!-- Adversarial review of the 2026-09-03 graduation ceremony by a GPT-5.6 Sol xhigh codex exec lane (read-only over this worktree; report written to the handoff directory and archived here verbatim). Disposition: all nine findings verified against source and folded the same day; see DECISIONS.md "2026-09-03 (graduation ceremony)" -> Review fold. -->

# Semantica re-entry graduation adversarial review

## Verdict

**FIX-THEN-SHIP** — the ceremony is structurally sound, but three binding
execution statements do not faithfully carry the ratified design. They can be
repaired as focused documentation edits; the packet does not need to be
redesigned.

Counts: **P1 3 · P2 3 · P3 3**.

Review scope: the six named edited exploration files and the six named files in
each of the three new goal packets. Authority was applied in the requested
order: `DECISIONS.md` Current law and the full ratification entry, then MAP v1.1,
then the graduation/goal packet standards and template, then the canary record
and live source.

## P1 findings

### P1-1 — The storage non-goal forbids the claim-row deletion required by physical erasure

- **Location:** `goals/semantica-storage-inversion/SPEC.md:55-56`
- **Packet quote:**

  > No in-place `UPDATE` or `DELETE` of a claim row; retraction is an event
  > whose reach is derived, never stored (R1.a).

- **Conflicting authority:** `explorations/semantica-lab/DECISIONS.md:864-872`
  ratifies a document-targeted `Redacted` event whose computed closure has
  “derived rows deleted”; `DECISIONS.md:1039-1045` is more explicit:

  > closure rows are deleted in one transaction, followed by a
  > copy-to-fresh-`dataDir` or `VACUUM FULL` step to purge dead tuples

- **Issue:** The sentence is placed under global Non-Goals and categorically
  prohibits `DELETE` of a claim row, while P-S2 is required to physically delete
  the document’s computed closure, including its claim rows. The intended ban
  applies to logical retraction, not to ratified physical erasure. The later
  P-S2 text does not cure a contradiction in the normative non-goals.
- **Minimal wording fix:** Replace it with: “No in-place `UPDATE`, and no row
  `DELETE` as the implementation of logical retraction; retraction is an event
  whose reach is derived. Physical `Redacted` erasure deletes its computed
  closure atomically under R1.b/R1.h.” Qualify the corresponding P-S1 kill text
  the same way if it is meant to govern only retraction.

### P1-2 — The reasoning telemetry law moves the deterministic R-d budget out of the fixture contract

- **Location:** `goals/semantica-reasoning-spike/SPEC.md:164-165`
- **Packet quote:**

  > **Telemetry law.** Budgets, wall-clock and truncation counts live in the
  > `EvalRunTelemetry` sidecar; digests carry none of it (R1 of PR #802).

- **Conflicting authority:** `explorations/semantica-lab/DECISIONS.md:950-955`
  requires R-d to have EYE’s complete closure plus a *lab-owned budgeted run
  emitting `InferenceTruncated`*. `explorations/semantica-lab/MAP.md:286-292`
  makes the budget a declared part of every R-d fixture case and requires a
  deterministic budget-prefix witness. The packet itself repeats that binding
  requirement at `SPEC.md:131-139` and `SPEC.md:205-217`.
- **Live-source check:**

  ```sh
  nl -ba apps/labs/semantica/src/schema/Telemetry.ts | sed -n '30,48p'
  ```

  `EvalRunTelemetry` currently contains timing and byte measurements only; it
  has no semantic reasoning-budget or truncation-count field. Its documentation
  says it is non-replay-stable.
- **Issue:** PR #802’s R1 law covers Tier-L/Tier-D performance measurements,
  not the new R-d semantic budget. The broad word “Budgets,” coupled with
  “truncation counts,” tells an executor to place replay-defining R-d inputs and
  outputs in a nondeterministic sidecar. That conflicts with the declared
  fixture budget and deterministic `InferenceTruncated` witness.
- **Minimal wording fix:** Replace the sentence with: “Tier-L/Tier-D
  performance measurements and wall-clock values live in `EvalRunTelemetry`
  and never enter a digest. Each R-d case’s declared depth/fan-out budget and
  its proof-linked `InferenceTruncated` fact/witness remain in the
  replay-stable fixture/run contract.” Apply the same correction to
  `goals/semantica-reasoning-spike/GOAL.md:63-64`.

### P1-3 — The atlas packet broadens R3.g’s facts-lane gate

- **Location:** `goals/semantica-atlas-sync/SPEC.md:10-12`
- **Packet quote:**

  > The IR-driven facts lane stays a gated P2 until semantica 0.6.7+ ships or a
  > dated `DECISIONS.md` entry re-fires O3.

- **Conflicting authority:** `explorations/semantica-lab/DECISIONS.md:927-933`
  ratifies “the IR extractor lane stays queued on semantica 0.6.7+” and rejects
  running both lanes now. R3.g at `DECISIONS.md:984-989` again says:

  > keep the IR lane queued on semantica 0.6.7+

  MAP v1.1 repeats “Facts lane (stays queued on O3’s version trigger)” at
  `explorations/semantica-lab/MAP.md:334-338` and “queued on 0.6.7+” at
  `MAP.md:372-374`. The already-fired atlas-edit need owns only the verdict
  lane.
- **Issue:** A generic future “O3 re-fire” is not the ratified facts-lane gate;
  it could be another atlas-edit need. A later dated decision can amend any
  contract, but that does not make an unratified alternate trigger part of the
  current contract.
- **Minimal wording fix:** Make the current gate only “semantica 0.6.7+ ships,”
  with the firing recorded in a dated `DECISIONS.md` entry. Remove the alternate
  `or a dated ... re-fire` wording from `SPEC.md:131-134`, `PLAN.md:7-9` and
  `61-62`, `GOAL.md:52-55`, `README.md:78-80`, and
  `ops/manifest.json:94`. A future operator decision may amend those files when
  it is actually ratified.

## P2 findings

### P2-1 — MAP’s gate-status table leaves P-S0 outside the four-probe candidate

- **Location:** `explorations/semantica-lab/MAP.md:190`
- **MAP quote:**

  > | `semantica-storage-inversion` | C2 pass | fired | one candidate with three ordered probes (P-S1..3) |

- **Conflicting authority:** R1.e at
  `explorations/semantica-lab/DECISIONS.md:906-912` ratifies “P-S0..3 are one
  stage of one S1 candidate” and explicitly rejects “P-S0 outside the breaker
  as prerequisite evidence.” The new storage SPEC and PLAN correctly carry four
  probes.
- **Issue:** The v1.1 gate-status summary retains the pre-amendment three-probe
  wording and contradicts the ratified phase/breaker boundary.
- **Minimal wording fix:** Change the final cell to “one candidate with four
  ordered probes (P-S0..3).”

### P2-2 — MAP states an incomplete redacted-event commitment tuple

- **Location:** `explorations/semantica-lab/MAP.md:227-229`
- **MAP quote:**

  > A redacted event's id cannot be recomputed once its body is gone;
  > `(id, bodyDigest)` is a commitment, not a proof.

- **Conflicting authority:** R1.d at
  `explorations/semantica-lab/DECISIONS.md:937-949` says redacted events are
  checked only as `(id, prev, body_digest)` commitments and the id scheme stays
  `(prev, body)`. R1.c at `DECISIONS.md:897-905` requires the same three-field
  tuple and a separate `prev` column. MAP’s very next sentence uses the correct
  tuple, making the local inconsistency explicit.
- **Issue:** Omitting `prev` from the commitment description erases the field
  that makes the continuity walk possible; `bodyDigest` also drifts from the
  ratified `body_digest` column spelling.
- **Minimal wording fix:** Use `(id, prev, body_digest)` in this sentence and at
  `MAP.md:223-224`; keep `(prev, body)` solely for the unchanged event-id
  preimage.

### P2-3 — MAP assigns the Semantica upstream source the wrong license

- **Location:** `explorations/semantica-lab/MAP.md:255`
- **MAP quote:**

  > reference only (Apache-2.0, `research/SOURCES.md`)

- **Verification commands run:**

  ```sh
  git -C ~/YeeBois/workstation-apps/semantica rev-parse --short=10 HEAD
  git -C ~/YeeBois/workstation-apps/semantica branch --show-current
  sed -n '1,3p' ~/YeeBois/workstation-apps/semantica/LICENSE
  nl -ba explorations/semantica-lab/research/SOURCES.md | sed -n '20,24p'
  ```

  The clone is `add1c006cd` on `danklocal`; its LICENSE begins “MIT License”
  with Hawksight AI copyright. The primary source ledger also records MIT at
  `research/SOURCES.md:22`. Apache-2.0 belongs to the separate
  `beep-effect-logos` row.
- **Issue:** This is a concrete license fabrication inside the capability table.
- **Minimal wording fix:** Change `Apache-2.0` to `MIT (Hawksight AI)`.

## P3 findings

### P3-1 — The storage source ledger drops the non-empty premises invariant

- **Location:** `goals/semantica-storage-inversion/research/SOURCES.md:58`
- **Packet quote:**

  > `InferenceEvent.premises: StatementId[]`

- **Verification command run:**

  ```sh
  rg -n 'premises: S.NonEmptyArray\(StatementId\)' \
    apps/labs/semantica/src/schema/Reasoning.ts
  ```

  The live declaration is `premises: S.NonEmptyArray(StatementId)` at
  `apps/labs/semantica/src/schema/Reasoning.ts:351-357`; inferred proof nodes
  carry the same invariant at `Reasoning.ts:280-286`.
- **Issue:** `StatementId[]` is a weaker and imprecise description of the exact
  recorded-premises substrate that R1.a/S8 make authoritative.
- **Minimal wording fix:** Write
  `InferenceEvent.premises: NonEmptyArray<StatementId>` (or quote the exact
  schema form `S.NonEmptyArray(StatementId)`).

### P3-2 — The exploration source ledger cites a nonexistent `Witness` symbol

- **Location:** `explorations/semantica-lab/research/SOURCES.md:104`
- **Packet quote:**

  > `GEntailmentExpectation`/`Witness`

- **Verification command run:**

  ```sh
  rg -n 'GEntailmentExpectation|GEntailmentWitness|export .*Witness' \
    apps/labs/semantica/src/schema/Reasoning.ts
  ```

  The live exported symbols are `GEntailmentExpectation` at
  `Reasoning.ts:504-514` and `GEntailmentWitness` at `Reasoning.ts:541-546`.
  There is no exported symbol named `Witness`.
- **Issue:** The slash shorthand reads as an exact symbol citation in a table
  otherwise made entirely of exact symbol names.
- **Minimal wording fix:** Change it to
  `GEntailmentExpectation` / `GEntailmentWitness`.

### P3-3 — The README undercounts the ratified sub-decisions and omits R4.a from its round summary

- **Location:** `explorations/semantica-lab/README.md:249-253`
- **README quote:**

  > seven rounds, 23 sub-decisions, amendments
  > R0.a/R1.b/R1.c/R1.d/R1.h/R1.i/R2.g/R3.b/R3.d applied inline in MAP v1.1
  > and logged in DECISIONS.

- **Verification command run:**

  ```sh
  sed -n '841,1070p' explorations/semantica-lab/DECISIONS.md \
    | rg -o 'R[0-4]\.[a-i]' | sort -u
  ```

  This yields 25 unique ratified labels: R0.a; R1.a–R1.i; R2.a–R2.g;
  R3.a–R3.g; and R4.a. R1–R3 alone total 23, but the cited seven-round grill
  includes the R0.a and R4.a bookends. R4.a’s delivery shape is applied in MAP
  v1.1 at `MAP.md:358-361`.
- **Issue:** The ceremony trail describes all seven rounds but counts only the
  middle three groups and does not name R4.a in its inline-delivery summary.
- **Minimal wording fix:** Say “25 labelled sub-decisions (R0.a, R1.a–R1.i,
  R2.a–R2.g, R3.a–R3.g, R4.a)” and include R4.a in the applied-inline summary.

## Checks with no findings

- `bun run beep goals doctor` — 175 packets, `blocking_new=0`,
  `blocking_inherited=0`, `advisories=0`.
- `bun run beep goals index --check` — current.
- `bun run beep explore atlas --check` — current.
- `git diff --check -- <review scope>` — clean.
- GOAL character counts: atlas 3,531; storage 3,785; reasoning 3,785. All are
  below the 4,000-character hard limit and all retain `SPEC.md` as the manifest
  anchor.
- Manifest-vs-PLAN phase sequences match exactly: atlas `P0,P1,P2,P3`;
  storage `P0,P1,P2,P3,P4`; reasoning `P1,P2,P3,P4,P5`.
- Every `currentSourceOfTruth[]` and packet-relative `researchReports[]` path
  exists. Each new SOURCES file is registered in both required arrays.
- Capability slug shapes, lifecycle/phase vocabularies, completion gates,
  launcher commands, exploration↔goal manifest links, and deterministic packet
  ids pass the live `GoalManifest`/doctor checks.
- A local Markdown resolver checked 178 relative links and fragments across the
  reviewed Markdown files using the requested GitHub slug rule (punctuation,
  including the em dash, removed before spaces become hyphens): 0 broken paths,
  0 broken anchors.
- Hygiene searches found no Notion page URL/id, UUID-shaped session/machine id,
  absolute `/home/<user>/...` path, or credential/token pattern in the reviewed
  files. Policy prose mentioning those categories was not treated as a leak.
- Targeted `rg`/`ls`/`git cat-file` checks confirmed the live Semantica and
  PGlite source paths, CLI `c2 --offline` surface, provider-cache env name,
  `makeLayer({ dataDir })`, EYE pins/caps, C2 report digest and archive files,
  the 33-catalog/13-park/6-park counts, the 725-row tracker, PR/commit references
  #790/#882/#802/#1077, and the three historical IR files at `fd560ca8e5`.
  The workstation provider cache was also found at 152 MiB without reading its
  contents. The recorded `beep-effect-logos` path remains absent, as the packets
  explicitly state.
