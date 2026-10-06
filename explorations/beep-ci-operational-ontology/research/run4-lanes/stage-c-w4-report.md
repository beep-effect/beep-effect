# Stage C lane report — W4 `run4-ledger` proof-ledger capture (2026-10-05/06)

Lane brief: `stage-c-w4-brief.md` (with `stage-c-common-brief.md`). Rulings: graduation Rulings 1,
3, 8; run-3 Rulings 11, 18, 22; time-to-certainty rulings 61–64 and 71; P1 Rulings 1–8 and
recorded calls a–t in `goals/ciops-ontology-pipeline/research/decisions.md`. Deliverables: the
generator `ontology/extraction/s4/beep-ci-ops/corpus/etl_run4_proof_ledger.py` (Lineage section in
its docstring), its tests `test_run4_proof_ledger.py`, and the pinned root `corpus/run4-ledger/`.

## Build protocol

Same protocol as the W3 lane: implementer, three refuting lenses, fixer with a regression test per
finding, skeptic; two rounds before the 2026-10-06 build sitting, a third for Rulings 3 (as
amended) and 8, a fourth as the final pre-pin round.

| Round | Tests | Findings in | Fixed | Deferred to the sitting | Remaining after the skeptic |
| --- | --- | --- | --- | --- | --- |
| implementer | 48 | — | — | — | — |
| review 1 | — | 38 (7 blocker, 13 major, 18 minor) | — | — | — |
| fix 1 / skeptic 1 | 71 | — | 37 | 1 | 5 |
| fix 2 / skeptic 2 | 76 | — | 1 | 1 | 2 |
| fix 3 / skeptic 3 (sitting rulings) | 77 | — | all task items | — | 2 major (tests), 2 minor |
| fix 4 / skeptic 4 (final) | 80 | — | 3 task items | — | 0 major, 4 minor (follow-ups) |

Findings that became rulings: the gitleaks entropy cut on 12-hex reuse-key prefixes (Ruling 3
amendment); the exit-3 refusal on a post-cut merged-preview fact (Ruling 8). Findings that became
recorded calls: the raw-file digest oracle (call p), the directional tear reading (call o), the
`-home-` marker rule (call s), facts-only dormancy (call t).

## What the generator pins

Every owning clone's `.beep/yeet/proof-ledger.ndjson`, read exactly once through the ruling-71
resolver (the `.git` file's `gitdir:` line and the `commondir` file, no git spawned), admitted only
under the public-origin filter; the whole ledger (facts and shadow rows, pre- and post-cut) with
`provenance.originKey` mapped to `<fleet>/<label>`, the two reuse-key members pinned as injective
11-hex prefixes, every other member verbatim, strict exact-member decoding that fails closed on
writer drift, torn rows and the unterminated tail tallied, pairing over decoded rows with the
directional tear rule; the gate block (C4.1 cite, the #1321 cut, post-cut pre-push facts); the
stage census with all four `ProofStage` members and the merged-preview reading; hits resolved
within the same ledger as hypothetical would-reuse edges; join coverage as counts (W4 reads no
attempt journal); tree-pinned citations; lane ledgers counted by an existence probe only.

## Pin census (capture 2026-10-06T03:21:25Z to 03:21:35Z, corpus_commit `26269bb0ec`, tree `edc79dd7b6`, capture head `28d962ec6b`)

- 19 files (18 payloads: 9 ledgers and their `.properties` projections), 8,082 rows, 12,453,734
  payload bytes, manifest 64,470 bytes.
- Discovery: 260 checkouts (same rules and counts as `run4-fleet`); 25 owning clones resolved, 9
  with a ledger, 16 absent, 0 bare or separated; 13 lane ledgers counted by existence probe only;
  4 checkouts excluded as non-public origin.
- Ledgers (rows): beep-effect 1,242; beep-effect2 3,034; beep-effect3 894; beep-effect5 608;
  beep-effect6 66; beep-effect7 342; beep-effect9 1,656; beep-effect19 110; beep-effect22 130.
  4,041 shadow/fact pairs, 0 torn rows, 0 unterminated tails, 0 unpaired rows, 0 pairing violations.
- Gate: C4.1 checked (tree-pinned cite of `goals/time-to-certainty/PLAN.md:171`); cut
  2026-09-28T15:09:38Z (committer instant of `9d52d8f587`, verified at capture); 3,628 post-cut
  pre-push facts; `holds: true`.
- Stage census (facts; shadows mirror them): pre-push 408 before the cut, 3,628 after; repair-loop
  5 before, 0 after; merged-preview 0/0, reading "dormant in capture window (P1 Ruling 1)"; hosted
  0/0. Outcomes: passed 3,956, failed 85. Decisions: miss 3,916 (undeclared-inputs 2,635, no-fact
  835, changed-package-tripwire 446), hit 125.
- Distinct: attempts 114 (15 before the cut, 99 after), run ids 46, branches 46, lanes 58 (25 bare,
  33 wave-qualified), head SHAs 102, epochs 31, origin labels 40. Time range 2026-09-23T03:34:07Z to
  2026-10-06T01:29:38Z; first post-cut fact 2026-09-28T16:29:42Z.
- Hits: 125, all resolved to a prior passed fact in the same ledger, 15 cross-origin, 0 from the
  same attempt, 0 disagreements; read as hypothetical would-reuse edges (graduation Ruling 1).
- Origins (facts): clone-root 619 (385 before the cut, 234 after), lane 2,954 (28 before, 2,926
  after), Claude-app worktree 468 (all after), merged-preview 0; at capture 1,991 origin directories
  present (378 without `.git`), 2,050 gone. Join coverage is counts only; W4 read no attempt journal.
- Projection: 8,082 reuse keys written as injective 11-hex prefixes; 4,041 `originKey` values
  replaced by `<fleet>/<label>`; custody surrogates minted 0 (no process member in any row); deny-list
  hits 0 by construction.

## Gates run on the pinned tree

Same battery as the W3 report, run over this root: ordinary verify PASS (twice); serial corruption
proof (payload byte flip and same-length `payload_files` mutation each fail, restored tree verifies,
tree hash equal); count-only residue scan 0 in every class and the Stage B grep/rg lines empty;
gitleaks 0 findings under the PR and `origin/main` configs; committed bytes equal the verified
working tree; `git ls-files` inventory equals the manifest (19 files); packet validators, CQ suite,
run-3 citation replay and snapshot check green; `goals doctor` no findings for this packet; knowledge
refs observations all inherited in other packets' files.

## Follow-ups (tracked, not blocking the pin)

- The merged-preview reading paraphrases Ruling 8's quoted string ("observed after the cut: n
  merged-preview fact(s)"); a later entry may adopt the exact wording.
- One 188-character docstring line runs Lineage items (d) and (e) together (cosmetic).
- The `-home-` scan's percent-encoding gap is the same as W3's and is covered by the raw
  `originKey` label and the source descriptor, which fail closed.
- The payload-wide marker scan would refuse a branch or run id with a component-leading `-home-`;
  none exists in the pin; if one appears before a later sibling capture, that is a recorded-call (s)
  question, not a code change.
