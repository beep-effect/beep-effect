# P3 report — Workstream A rewrite pass and the standing `refs --check` gate

Executed 2026-08-16 on branch `feat/knowledge-refs-rewrite-pass`, unlocked by the
recorded Workstream A verdict (`research/p1-fp-eyeball-verdicts.md`): the live
`actionable-host-path` set is the mechanical-rewrite worklist, mirror-shaped
`external-mirror-reference` rows take canonical GitHub URLs, and the census scan
becomes the standing gate.

## Worklist evolution

The verdict's 122-row set had grown to **447 live gated rows** by 2026-08-16
(tree growth since the census snapshot). They decomposed into three dispositions:

1. **Structural: `data/` archival segment (≈178 rows).** The dominant new shape
   was `goals/jsdoc-carrier-migration/data/extract.jsonl` — machine-captured
   JSDoc extraction records whose `blockText` fields quote verbatim,
   `sourceHash`-pinned source text containing illustrative paths. Rewriting them
   would corrupt the capture, exactly the "rewriting captured proof rewrites
   history" class. `data` joined `ARCHIVAL_SEGMENTS` (blast radius verified: the
   only in-scope tracked `data/` files are that packet's captures; zero `data/`
   paths exist at the frozen baseline commit, so the baseline-agreement test is
   unaffected).
2. **Structural: portable-home-convention batch (≈36 rows).** Nine prefixes were
   admitted per ratified A3 (widening is a deliberate CLI PR): `~/.cache`,
   `~/.cargo`, `~/.cursor`, `~/.local/state/beep`, `~/.mem0`, `~/.oracle`,
   `~/.portless`, `~/.portless-lan`, `~/.supermemory-claude`. Every member is a
   config/state/toolchain directory convention of a named product or the XDG
   basedir spec — the exact class semantic `~/.openclaw`'s admission
   established. Rows spelled home-absolutely were rewritten to tilde form so
   the (deliberately home-relative-only) convention check can see them.
   `~/Downloads` is admitted as an **exact-mention convention only** (review
   hardening on the PR): naming the XDG download directory is portable, but any
   concrete descendant stays gated — a prefix admission would have let live
   guidance park arbitrary machine-local files behind the folder name, the
   laundering surface the stop conditions name. The nine live descendant rows
   were rewritten instead (rules 227–236). A second review round narrowed the
   comparison once more: a trailing slash normalizes to the exact mention
   (`~/Downloads/` names the directory, not a descendant), while case variants
   (`~/downloads/report.csv`) stay gated because the convention is spelled
   exactly.
3. **Textual: 226-rule mechanical rewrite + 2 manual folds (233 remaining
   rows across 126 files).** Drafted per file-context by four fan-out agents
   under a written bucket policy, reviewed centrally (zero conflicting rules,
   zero reintroduced anchors), and applied by the repo-shipped runner.

## The mechanical pass is repo-shipped and re-runnable

`scripts/knowledge-refs-rewrite.rules.json` (226 reviewed literal rules, each
pinning file, exact match, replacement, and expected occurrence count) plus
`scripts/knowledge-refs-rewrite.ts` (apply / `--dry-run`; occurrences==count
applies, 0 skips as already-applied, anything else fails without writing).
Idempotence was proven by a second run reporting `0 applied, 226
already-applied`.

**Deviation from SPEC's tool naming, recorded:** SPEC says "ast-grep/comby
rules". Neither tool exists on the machine or in the repo toolchain; comby has
no maintained npm distribution and ast-grep is grammar-bound with no Markdown
prose semantics — while the approved worklist is literal-shaped, not
syntax-shaped. The ratified essence (reviewable, re-runnable, repo-shipped
mechanical rules; the scan is the standing gate) is preserved by a rules-file +
runner in the existing bun toolchain with strictly stronger guarantees
(occurrence-count pinning, idempotent re-runs). No new system dependency enters
CI or the hermetic lane.

Rewrite policy by bucket: beep-checkout absolutes became repo-relative paths;
worktree-layout illustrations use `<checkout-root>` placeholders; absolute
spellings of convention dirs became tilde forms; mirrors of public repos became
canonical GitHub URLs (firecrawl, trustgraph, facebook/lexical, PreTeXt);
machine-local projects and corpora are referenced by name with their
machine-local nature stated (per SPEC: concrete machine paths live only in
untracked or `docs/_internal` files); temp staging paths became `mktemp`/scratch
phrasing; compound `VAR=~/path` tokens were split so the convention check sees
the path token.

## The scan is now the standing gate

`beep knowledge refs --check`: after the census prints, any **live** observation
classified `actionable-host-path` or `external-mirror-reference` — the
observation space of the reserved `host-path-in-live-guidance` finding kind —
fails the run via the typed `KnowledgeHostPathDebtError`. Archival, convention,
and pattern classes never gate. The census without `--check` keeps its ratified
exit-zero measurement contract. Wired as `knowledge:refs-check` in
`rootRepoLintPolicySteps` directly after `knowledge:semantic-delta`; never
file-scoped because any tracked document can introduce a machine-local
reference. Zero-tolerance needs no baseline: the burn-down reached zero, which
honors the "no gate before its false-positive rate is known" rule — the gated
classes' FP rate at zero corpus debt is exactly zero.

End-to-end proof, both directions: at the branch head the gate exits 0 with
zero live gated observations; against the pre-rewrite `main` tree
(`refs --tree main --check`) it exits 1 reporting 249 live host-path
observations.

## False positives burned down with data in hand (as the verdict prescribed)

- **Upstream-subtree spans:** six rewritten rows initially left upstream repo
  sub-paths as bare governed-root inline spans (`apps/js-sdk/firecrawl`,
  `packages/lexical-playground`, another checkout's package tree), which the
  Stage-1 semantic-delta gate correctly flagged as introduced
  `broken-tracked-path` findings. Fixed by folding the sub-path into the
  canonical URL or de-governing the span; both knowledge gates now pass
  together.
- **Emphasis-wrapped convention token:** one bold-wrapped `~/.openclaw` span
  defeated the convention prefix test because the token trimmer does not strip
  `*`. The doc line was restructured; the trimmer widening is recorded as a
  candidate rule-table change (ledger receipt 14), not silently applied.
- **Lexical non-paths:** a slash-separated "repo, home, unit" category list and
  a tilde-prefixed TypeScript-alias example read as anchors; both lines were
  rephrased.

## Verification inventory

- `bun scripts/knowledge-refs-rewrite.ts --dry-run` / apply / re-run (idempotent).
- `bun run beep knowledge refs --check` → exit 0 at head; `--tree main --check`
  → exit 1 (249).
- `bun run beep knowledge semantic-delta` → exit 0 (no introduced findings).
- Package tests: 46 passing in `test/knowledge-refs.test.ts`, including the new
  convention-batch, segment-awareness, `data`-segment, and check-gate cases; the
  baseline-agreement test still reproduces the frozen inventory numbers.
- Per-file coverage of `Knowledge.command.ts` clears every monotonic floor after
  the check applicator gained direct tests: branches 50 (floor 40), statements
  56.66 (44.73), lines 58.13 (46.57), functions 40.54 (24.24). The ratchet is a
  hosted-only lane — the full local proof does not run it (ledger receipt 16).
- Every rewritten `.json` file re-parses (`jq`), and executable manifest
  commands keep their semantics (tilde expansion in shell; `--state-dir` is a
  documented portless install option).

## Residue

- P3's hermetic clean-clone lane (emptied `$HOME`) and the optional ASLR
  torture variant remain open — they are proofs over the now-clean corpus, not
  prerequisites of it.
- `broken-target` (523 live) stays ungated: its two known FP shapes (MCP method
  names, upstream paths in prose) persist in the corpus, and gating that class
  was never part of the A verdict.
- The `roadmap-refs` fold-in (T2 decision A7) is untouched by this pass.
- Archival segments match at any path depth, so a live guidance directory named
  after one (`docs/data/GUIDE.md`, `.claude/skills/data/SKILL.md`) is labelled
  archival and contributes no live debt. The property is inherited from the
  ratified nine-segment table, not introduced by the `data` admission; anchoring
  segments to their owning surface is proposed as ledger receipt 15 rather than
  applied here, because it changes ratified classification semantics.
