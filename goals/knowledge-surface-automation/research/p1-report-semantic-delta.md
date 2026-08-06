# P1 report — knowledge semantic-delta live run (Workstream C Stage 1)

Phase-0 evidence for the FP-eyeball gate (execution decision E4). Live paired run of
`bun run beep knowledge semantic-delta --json` on 2026-08-04 with HEAD at the
implementation branch tip (content-identical to `origin/main` for the scanned corpus)
and base `origin/main`. All paths below are repo-relative; no host paths occur in
scanner output by construction.

## Headline numbers

| Measure | Value |
| --- | --- |
| `introduced` | 0 (HEAD == base for the scanned corpus — correct null result) |
| `resolved` | 0 |
| `unchanged` (inherited corpus findings) | **495** |
| — `broken-tracked-path` | 482 |
| — `unknown-beep-command` | 13 |
| — `index-drift` | 0 (INDEX in sync; agrees with `goals index --check`) |
| — `failed-assertion` | 0 (no `beep:assert` comments exist yet) |
| Golden fixtures | 15/15 pass (10 matrix cases + 5 negative controls) |
| Invalid `--base` smoke | fails closed, exit 1, remediation names `fetch-depth: 0` / `git fetch --unshallow` |

Because Stage 1 is a paired diff with no baseline, **none of the 495 inherited
findings can ever block a PR** — the gate (P3, not yet wired) fires only on
`introduced` findings. The fixtures prove inherited identities survive reflow,
rename, and alternate path spellings.

## Highest-density documents

15 `explorations/mcp-auth-gated-registration/RESEARCH.md` · 10
`explorations/_gold-intake/GOLD_SYNTHESIS.md` · 9 `goals/canvas/PLAN.md` · 8
`goals/canvas/SPEC.md` · 8 `.claude/skills/schema-model-specialist/SKILL.md` · 8
`explorations/uspto-patent-driver-depth/RESEARCH.md` · 7
`goals/agentic-professional-runtime/SPEC.md`.

## Sampled false-positive annotations

- **True positives — stale commands (gate working as intended).**
  `beep-command:quality repo-exports-catalog` (`goals/fallow-advisory-ratchets/SPEC.md`)
  names the retired catalog command AGENTS.md itself bans; `beep-command:ai-sync`
  (`goals/unified-ai-toolchain/PLAN.md`) and `beep-command:reuse`
  (`goals/dedup-clone-engine/SPEC.md`) name commands that do not exist in the tree.
- **True positives — broken tracked paths.** e.g.
  `goals/openclaw-workstation-agent/README.md` → `goals/openclaw-p2-generation`
  (packet absent).
- **Judgment — gitignored-by-design paths.** `AGENTS.md` → `docs/generated`: the
  path is intentionally untracked and the prose says so. Under the ratified
  tracked-oracle contract this is a finding; it only ever matters if newly
  introduced. Eyeball call: acceptable as-is, or grant a future normalized class for
  documented-gitignored targets (a versioned normalizer change, not a v1 edit).
- **Judgment — speculative future paths in design prose.** The largest bucket (e.g.
  `goals/canvas/SPEC.md` → `packages/canvas/ui`, not yet built). Inherited ones are
  inert, but **once the P3 gate wires, a NEW design doc citing a to-be-built path in
  an inline-code span will block its PR**. The ratified mitigations already exist:
  fenced blocks are decoys (put speculative trees in fences) and non-code prose is
  never scanned. This authoring-pattern ruling is the main pre-P3 decision.
- **Grammar edge — ellipsis spans.** `goals/knowledge-surface-automation/SPEC.md`'s
  literal `` `bun run beep ...` `` yields `beep-command:...` (2 occurrences repo-wide).
  FP-leaning; fixing it means either editing the two docs or versioning the
  normalizer to treat a bare `...` tail as ineligible.
- **Corpus boundary — exploration RESEARCH/CAPTURE files.** Archival exclusions are
  directory segments (`research/`, `history/`, …); files named `RESEARCH.md` /
  `CAPTURE.md` inside exploration packets are live corpus (33+ findings). CAPTURE
  is a ratified A2 portfolio surface, so inclusion is consistent — confirm
  RESEARCH.md files should stay in scope too.

## Eyeball ask

Confirm (a) introduced-only gating semantics and identity stability match intent,
(b) the speculative-path authoring rule before P3 wiring (recommend: keep the
scanner strict; speculative trees go in fences per the ratified decoy rule),
(c) whether `...`-tail command spans warrant a normalizer exception or a two-line
doc fix (recommend: doc fix; keep the normalizer v1), (d) the RESEARCH.md corpus
boundary, and (e) that nothing else blocks P3 gate wiring
(`knowledge:semantic-delta` into `rootRepoLintPolicySteps`).

## Review-surfaced constraint for P3 gate wiring

The #563 review pass flagged that `--help` probes and index-script probes execute
code from the scanned revision's archive (Bun, unsandboxed beyond the hermetic
env and out-of-archive scratch root). For a locally invoked read-only command
this is the same trust boundary as running the revision's tests; it becomes a
real exposure only when P3 wires the gate into hosted CI, where a fork PR on
this public repository could reach it. Binding constraint recorded for the P3
grill: the hosted gate must either skip probes for untrusted fork PRs, run them
in an OS-level sandbox, or restrict the lane to same-repo branches. Do not wire
the gate without deciding this.
