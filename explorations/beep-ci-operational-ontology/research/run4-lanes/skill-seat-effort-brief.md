# Auditor skill follow-ups brief: seat-effort provenance + denotation grain (one lane, one PR)

You are a Codex implementation lane in the checkout `beep-effect8-worktrees/skill-run4-followups`
(branch `chore/auditor-skill-seat-effort` off main `662823dd96`). Do not run `git add`,
`git commit`, `git stash`, `git checkout --`, or `git switch`; leave the tree dirty and list every
touched path in your report. The orchestrator stages by name and commits. Paths below are
repo-relative. Use Bun 1.4.2 from the session PATH. Set `UV_CACHE_DIR` to the operator-provided
cache in the shell environment, then use `uv run --offline --python 3.12 --with pyyaml python`
(and `--python 3.13` for the second self-test pass).

## Authority (read first; do not re-litigate)

- `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work-run3/impl-report.md`
  section "Upstream skill follow-ups queued": rows "Structured seat effort" and "Denotation grain".
  The other two rows there (NDJSON configuration support, historical archive-path handling) are
  OUT OF SCOPE for this lane; the run-4 intake docket carries them.
- Steward rulings (2026-09-11, orchestrator grill): (1) the seat-effort field is REQUIRED on every
  seat, a non-blank string; a seat whose model exposes no effort control records the literal
  `default`; (2) the follow-ups ship as one small PR; (3) nothing frozen changes: every archived
  run manifest, report, and receipt in the packet keeps its bytes.
- `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md` "Field amendments (post-loop)"
  is the format for the version entry. The repo copy of the skill is the ONLY skill; no
  user-scope copy exists or is edited.

## Part A: manifest contract (`.claude/skills/_shared/schemas/run-manifest.schema.yaml`)

1. Add an `effort: ""` field to each of the five `agents` entries (denotation, foundational,
   synthesis, adversary, alternative), keeping every existing key and the fixed role-to-prompt
   binding. Add a right-margin comment in the file's existing style on the first entry: the
   field records the reasoning-effort setting the seat was LAUNCHED with (for example `max`,
   `xhigh`, `medium`); `default` when the model exposes no effort control; it is recorded
   provenance that the harness cannot cryptographically bind (same status as `model`).
2. Extend the header comment's parenthetical "(required fields, cq_count >= 1, seat flags)" to
   name seat effort. Change nothing else in the file; its bytes feed the framed
   `contracts_sha256_12`, so every edit must be deliberate.

## Part B: validator (`.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py`)

1. Bump the docstring header from `(v14)` to `(v15)`. Do not restate v4..v14 history there.
2. In `check_manifest`, inside the per-role loop over `PROMPT_ROLES`, require
   `agents.<role>.effort` to be a non-blank STRING; the violation message names the role, says
   the field names the launched reasoning-effort setting, says `default` is the value for a
   model without an effort control, and shows the offending value with `!r`, matching the
   neighbouring `model` message's shape. Use the module's existing helpers and error channel;
   no new dependencies; no other rule changes.
3. Self-test: add a `# --- v15 field-amendment families ---` section after the v14 one with ONE
   new rule family, "seat-effort provenance": a manifest fixture that is otherwise complete for
   the rule under test must fail when `effort` is missing, blank/whitespace, or a non-string
   (integer and boolean), and the matching control with a non-blank string must NOT raise that
   message. Follow the file's `expect_err`/control conventions exactly. Update the
   `SELF-TEST PASS (... rule families fire: ...)` line to 158 and append `seat-effort
   provenance` to its list. If any existing fixture built a full `agents` block that previously
   satisfied `check_manifest`, add `effort` to it so the fixture keeps testing what it tested.
4. Byte-identical elsewhere: `git diff` on this file must show only the docstring version, the
   new rule, the new self-test family, and the PASS line.

## Part C: denotation prompt (`.claude/skills/ontology-foundational-auditor/prompts/denotation.md`)

Insert, verbatim, as a new numbered step directly after step 1 (renumber the later steps; no
other wording changes):

> Emit one hypothesis per candidate referent kind, grouping the individual chains that
> instantiate it and stating what individuates an instance.

## Part D: skill prose (`SKILL.md` and `REVIEW-HISTORY.md` under `.claude/skills/ontology-foundational-auditor/`)

1. `SKILL.md`: (a) the `(v14)` mention becomes `(v15)`; (b) in Step 0, directly after the
   `MODEL="<model-id-recorded-in-manifest>"` line, add
   `EFFORT="<reasoning-effort-recorded-in-manifest>"` with a one-line comment that it is the
   exact effort every Codex seat launches with and what `agents.<role>.effort` records
   (`default` for a model without an effort control); (c) every `codex exec` seat launch line
   that passes `-m "$MODEL"` also passes `-c "model_reasoning_effort=\"$EFFORT\""` so the
   recorded field matches the launched setting. Touch nothing else; the file is also
   digest-pinned by runs and its history is not rewritten.
2. `REVIEW-HISTORY.md`: append a `- **v15** (2026-09-11, auditor run 3 field defects ...)`
   bullet under "Field amendments (post-loop)", in the v14 entry's voice, naming both
   amendments, their provenance (the run-3 impl report and the 2026-09-11 steward ruling), the
   new family count (158), the interpreters the self-test was green on, and the before/after
   live-tree comparison from the proofs below. Do not edit older entries.

## Proofs (all from the repo root; paste verdict lines in the report)

- `--self-test` on Python 3.12 AND 3.13: `SELF-TEST PASS (158 rule families ...)`.
- Live-tree comparison: run the validator WITHOUT `--gate` and WITHOUT `--repo` over
  `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops` once with the
  pre-change validator bytes (`git show HEAD:<path>` into a scratch file) and once with the
  changed file; report whether the outputs are byte-identical and, if not, the exact diff.
  Expected: identical (no live `work/run-manifest.yaml` singleton exists on main).
- Contract parse: the edited schema exemplar still loads with `yaml.safe_load`, and the
  validator's framed contracts digest changes (report old and new 12-hex, computed the way
  `check_manifest` computes it; they are informational, not recorded anywhere in this PR).
- Historical bytes untouched: `git status --short` lists ONLY the five skill files plus this
  brief and your report; in particular nothing under `explorations/**/runs/`,
  `explorations/**/archives/`, `work-run2/`, `work-run3/`, or `research/run3-lanes/` changes.
- `bun run beep knowledge semantic-delta` (advisory before commit; run it) and
  `bun run beep knowledge refs --check` (no live gated observations; never write home-relative
  or absolute host paths, user names, hostnames, or numeric user identifiers into any file).
- Residue scan over every touched file for those same classes; `typos` on touched files.

## Report

Write `explorations/beep-ci-operational-ontology/research/run4-lanes/skill-seat-effort-report.md`:
what changed per file, the proof verdict lines verbatim, the old/new contracts digest, blockers,
and a final `### Files` list.
