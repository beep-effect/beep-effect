<!-- Lane brief as issued 2026-10-06 for goal phase P2; the survey notes it names live in the lane scratch, not in the repo. -->
# W5 brief (phase B): live differential replay on the run4-fleet pin

Read `brief-p2-common.md`, GD P2 Rulings 1, 8, 9 and 10, `03-replay.md` in full, `06-critic.md` D-W5a–f, the
PLAN W5 row and its 2026-10-05 prerequisite, graduation Ruling 9 and SPEC "CQ-009". Files you own:
`LAB/src/projection/Schemas.ts` ONLY inside the admission-journal section (the W6 body lane edits the planner
section of the same file concurrently: re-read before every edit, anchor on unique admission-section lines,
never rewrite the file), `LAB/src/projection/Replay.ts`, `LAB/src/projection/Evidence.ts` (only if the
report rendering helpers live there), a new `LAB/scripts/generate-live-replay-evidence.ts` plus its two
generated package scripts (`evidence:s7-live` check-by-default, `evidence:s7-live:write`), a new
`LAB/test/live-replay.test.ts`, new test fixtures under `LAB/test/fixtures/` (a surrogate-row journal and a
released-only-chain journal, built from the pinned shapes, never host bytes), and the rendered evidence
`goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md`. Never touch
`explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md`, `LAB/scripts/generate-replay-evidence.ts`'s
golden behaviour, or `LAB/test/fixtures/emission-v2.ttl`.

## Deliverables

1. **Decoder widening (Ruling 8), schema first.** In the v3 identity classes (`AdmissionJournalV3Identity`
   requires `pid`; `AdmissionJournalQueuedIdentity` requires `procStart`; see `03-replay.md` §1 for the exact
   lines and the composition through `.extend`/spread), make `pid`, `procStart` and `checkoutRoot` optional and
   add optional `ownerRef`, `ownerRefVariant` (the four run-3 variants as a `LiteralKit`) and `checkoutRef`;
   add the invariant "a v3 row carries exactly one of `pid` or `ownerRef`" as a class-level check if it
   survives the composition on effect 4.0.0 (prove it with a test), else enforce it in `decodeAdmissionJournal`
   with the same typed error; add a derived `custody` reading (`live` | `surrogate` | `redacted`) exposed where
   the report needs it. The frozen golden must decode and replay byte-identically (regression test: the
   existing evidence check stays green and the rendered golden bytes are unchanged). No fake pids.
2. **Replay window and skip rule (Ruling 9).** `ReplayOptions` gains an optional `window`
   (`ReplayWindow` S.Class: `firstRetainedInstant`, `lastRetainedInstant`, `preV3Chains: S.Natural`,
   `journalSha256`, `manifestSha256`). Inside the fold, a terminal row (release or eviction) whose admission is
   absent from the retained window is skipped and counted; enqueue-less admitted→released pairs replay; the
   count of chains the fold skipped or found enqueue-less is checked against `window.preV3Chains` (fail
   typed on disagreement); verdicts before the last skipped release carry a `ledgerCensored` mark. Event
   indexes and episode ids stay stable (skip inside the fold, never by pre-filtering rows). The golden path
   (no window) is unchanged.
3. **Report (Ruling 9).** `LiveReplayReport` wraps `ReplayReport` and adds: first-choice agreement (agreed /
   total, with the unit defined as in the golden report), the disagreements each with a diagnostic attribution
   (`same-checkout-active-lease` from the pinned rows' `checkoutRoot`, or `unattributed`), the skipped rows and
   censored verdicts, the pending-set censorship statement (withdrawn and ticket-evicted requests never
   compete), any grant active before the window's first retained row, the custody census (live / surrogate /
   redacted rows), and the CQ-009 line "temporally out of scope: 0 of N pinned rows precede #929 (graduation
   Ruling 9)" computed from the rows' instants, never a pass or a failure. Sort every census so the output is
   byte-deterministic (HashMap iteration order is not stable).
4. **Evidence script.** `scripts/generate-live-replay-evidence.ts --check | --write` reads the pinned journal
   `PIN/admission/canonical/journal.ndjson` by repo-relative path, asserts its sha256 and the manifest's
   sha256 against typed constants in the script (take both from the pinned bytes; record them in the
   rendered evidence), builds the `ReplayWindow` from typed constants that must match the manifest's
   `admission_roots[0].window` and `loss_population.chain_counts.pre-v3` (3) — the script asserts those
   constants against a minimal line-based read of `PIN/MANIFEST.yaml` for exactly those members, no YAML
   dependency, no JSON extract beside the pin — recomputes the frozen golden's 41-of-41 in the same run, and
   renders `goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md` (check-by-default compares
   bytes). Provide `BunFileSystem.layer` and `BunCrypto.layer` as `generate-replay-evidence.ts` does.
5. **Tests (`live-replay.test.ts`):** surrogate rows decode with `custody: surrogate` and live rows with
   `custody: live`; a row with both or neither of `pid`/`ownerRef` fails typed; the released-only fixture
   replays with the skip counted and the window guard enforced (a wrong `preV3Chains` fails typed); the live
   pinned journal replays end to end through the script's logic with the agreement reported; the golden path
   is byte-unchanged; CQ-009 prints the out-of-scope line and never a verdict.

## Return

Structured: files changed, the decoder invariant's placement and proof, the live agreement numbers (the lab's
own: agreed/total, disagreements with attributions), the skipped/censored counts, the evidence file's sha256
and size, every gate command with its last lines, and follow-ups.
