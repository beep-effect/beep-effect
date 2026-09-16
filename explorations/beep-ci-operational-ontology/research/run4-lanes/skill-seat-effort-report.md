# Auditor skill seat-effort and denotation-grain report

Parts A through D are implemented in the repo-local skill. The five skill
files are unstaged. This lane started at `662823dd960367046ba7d73dd8fd25d15782865a`
on `chore/auditor-skill-seat-effort`; the supplied brief was the only initial
untracked file. No staging, commit, stash, checkout restoration, or branch
switch command was run.

Authority: [the lane brief](./skill-seat-effort-brief.md), the run-3
`impl-report.md` section "Upstream skill follow-ups queued", and the
2026-09-11 steward ruling recorded in the brief.

### Changes

- `.claude/skills/_shared/schemas/run-manifest.schema.yaml`: added
  `effort: ""` to all five seats. The header names seat effort, and the
  first seat's margin comment explains launched-setting provenance, the
  `default` convention, and the same cryptographic limitation as `model`.
  All existing keys, seat flags, and role-to-prompt bindings are preserved.
- `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py`:
  v15 requires a non-blank effort string for every role. The error names the
  role, launched reasoning-effort setting, `default` convention, and the
  offending value through `!r`. One new self-test family tests each of five
  roles with a missing field, empty string, whitespace string, integer, and
  boolean. Matching controls accept `max`, `xhigh`, `medium`, and `default`
  with no manifest errors. The fixture fills the schema exemplar and computes
  current prompt and engine locks. Existing fixtures have empty agent blocks;
  none previously supplied a complete valid agent block requiring repair.
  The diff contains only the header version, new rule, new family, and PASS line.
- `.claude/skills/ontology-foundational-auditor/prompts/denotation.md`:
  inserted the brief's exact sentence as step 2 and renumbered subsequent
  steps. Existing wording is unchanged.
- `.claude/skills/ontology-foundational-auditor/SKILL.md`: changed the one
  version mention to v15, added the Step 0 `EFFORT` variable and its comment,
  and passed `-c "model_reasoning_effort=\"$EFFORT\""` on all five Codex
  seat launch lines.
- `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md`: appended
  the v15 field-amendment entry with both amendments, their authority,
  158-family result, Python versions, and the live-tree comparison.
  Every older entry is unchanged.

### Self-test proofs

All commands ran from the repo root with the existing `UV_CACHE_DIR`.
Bun reported `1.4.2`. No interpreter or dependency download was needed.

Python 3.12, exit 0:

```sh
uv run --offline --python 3.12 --with pyyaml python .claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py --self-test
```

```text
SELF-TEST PASS (158 rule families fire: canonical ids, nested closure, object grammar, mixed-unrep, discriminator, searched-true, warrant-XOR, parents grammar, id grammars incl. rat digits, crash-hardening, rat content binding + staleness + freshness, review edge-target/chain/history/continuity/revision_log incl. landed-rule join + duplicate rounds, chain cross-wire + verdict join, carried authentication + live-carried bypass, row-evidence join, since-exact, digest-fresh IRI, identifier pad + negation context + provider agreement incl. boolean-vs-unresolved, boolean pin_waived, ufo_category required, addressed-list shape, #-boundary, config pairing, vacuity-boolean, text exact-type sweep, container shapes, prior-FAIL coverage population, tri-state crash hardening, duplicate-key loader, syntax-aware pairing stripper, glued openers, mid-line bare keys, blank-line continuation, identity precedence, lexical component symlinks, run-id parser, closed shared run-id grammar + rotation parity, exact-hex digest locks, cross-line separator refusal, ini/properties quoted-payload, toml/BOM/form-feed comment boundaries, join quarantine, orphan review/rejection authority, predecessor-local row validation, symlink-loop fail-closed, bounded run-id fractions, CR line-break normalization, half-quote arm refusal, table-filter quarantine, predecessor date/grammar/reason/carried meters, control-escaped authority rendering, unexaminable-path fail-closed, referent-mapping guard, review revision-requests channel, ledger-rationale binding, revision-log digest union, closure-read fail-closed, runs-shelter poison guard, seat-effort provenance)
```

Python 3.13, exit 0:

```sh
uv run --offline --python 3.13 --with pyyaml python .claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py --self-test
```

```text
SELF-TEST PASS (158 rule families fire: canonical ids, nested closure, object grammar, mixed-unrep, discriminator, searched-true, warrant-XOR, parents grammar, id grammars incl. rat digits, crash-hardening, rat content binding + staleness + freshness, review edge-target/chain/history/continuity/revision_log incl. landed-rule join + duplicate rounds, chain cross-wire + verdict join, carried authentication + live-carried bypass, row-evidence join, since-exact, digest-fresh IRI, identifier pad + negation context + provider agreement incl. boolean-vs-unresolved, boolean pin_waived, ufo_category required, addressed-list shape, #-boundary, config pairing, vacuity-boolean, text exact-type sweep, container shapes, prior-FAIL coverage population, tri-state crash hardening, duplicate-key loader, syntax-aware pairing stripper, glued openers, mid-line bare keys, blank-line continuation, identity precedence, lexical component symlinks, run-id parser, closed shared run-id grammar + rotation parity, exact-hex digest locks, cross-line separator refusal, ini/properties quoted-payload, toml/BOM/form-feed comment boundaries, join quarantine, orphan review/rejection authority, predecessor-local row validation, symlink-loop fail-closed, bounded run-id fractions, CR line-break normalization, half-quote arm refusal, table-filter quarantine, predecessor date/grammar/reason/carried meters, control-escaped authority rendering, unexaminable-path fail-closed, referent-mapping guard, review revision-requests channel, ledger-rationale binding, revision-log digest union, closure-read fail-closed, runs-shelter poison guard, seat-effort provenance)
```

The two `refusing:` diagnostics before each PASS line are expected negative
self-test cases for duplicate YAML keys and an invalid run-id string.

### Live-tree comparison

The pre-change validator was obtained with
`git show HEAD:.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py`
and written to a scratch file outside the checkout. That file and the edited
validator each ran through the Python 3.12 offline command against
`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
without `--gate` and without `--repo`.

Both runs exited 1. The exact validator verdict was:

```text
VIOLATIONS (904):
```

The comparison script reported:

```text
LIVE COMPARISON PASS: byte-identical; 230084 bytes; sha256 f2faf8896ee5ce716a6d388506da4f867c7128ceafddc741e40ea20cee9a3977
LIVE DIFF: empty
```

The comparison covers the captured standard output followed by standard error.
The live `work/run-manifest.yaml` singleton is absent. Existing records still
produce missing-manifest and dangling-observation errors under both versions.
This is a successful regression comparison, not a green live ontology gate.

### Contract parse and digest

```text
CONTRACT PARSE PASS: yaml.safe_load; all 5 seats retain empty-string effort fields
CONTRACTS DIGEST: db5aefe804fe -> dcc8da4cc7f9 (21 framed files)
```

The old digest uses HEAD bytes for every member; the new digest uses the
working-tree bytes. Both use `check_manifest`'s exact closure and ordering:
shared schema YAML, shared YAML/Markdown/JSON, and skill template YAML,
sorted by path relative to `.claude/skills`. Each member contributes its
relative path, newline, byte length, newline, then its bytes to SHA-256;
the reported value is the first 12 hexadecimal characters. These values are
informational in this report. No run manifest or recorded engine pin was updated.

### Knowledge proofs

`bun run beep knowledge semantic-delta`: exit 0. Advisory verdict lines:

```text
probe-policy: enabled
introduced (0)
resolved (0)
unchanged (491)
```

`bun run beep knowledge refs --check`: exit 0. Its verdict was:

```text
check: 0 live gated observation(s)
```

These are the requested checks before commit. The refs command identifies its
snapshot as HEAD; these results do not replace proof after publication. The
491 unchanged semantic findings were not repaired in this scoped lane.

### Historical bytes and scope

A before/after SHA-256 comparison covers every tracked file under
`explorations/**/runs/`, `explorations/**/archives/`, `work-run2/`,
`work-run3/`, and `research/run3-lanes/`.

```text
HISTORICAL BYTES PASS: 3856 files byte-identical to the initial checkout
```

Final `git status --short`:

```text
 M .claude/skills/_shared/schemas/run-manifest.schema.yaml
 M .claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md
 M .claude/skills/ontology-foundational-auditor/SKILL.md
 M .claude/skills/ontology-foundational-auditor/prompts/denotation.md
 M .claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py
?? explorations/beep-ci-operational-ontology/research/run4-lanes/skill-seat-effort-brief.md
?? explorations/beep-ci-operational-ontology/research/run4-lanes/skill-seat-effort-report.md
```

The status assertion also checked that every tracked edit is unstaged and that
`git diff --cached --name-only` is empty.

```text
SCOPE PASS: exactly 5 modified skill files plus the untracked brief and report; index unchanged
```

### Residue and typos

The residue scan read the full contents of all seven paths, including the brief
and this report. It checked home-relative paths, user home roots, numeric user
runtime roots, Windows home roots, concrete identity assignments, and the
current username, hostname, home directory, and numeric user identifier.
Identity values were resolved only in memory and never written to files.

```text
RESIDUE SCAN PASS: all 7 files; 0 home-path, host-path, username, hostname, or numeric-user-id matches
```

`typos` ran with every path in the Files list as an explicit argument and the
repo configuration. Its raw result is not green:

```text
TYPOS: exit 2 over all 7 files
```

All 12 findings are in unchanged validator lines: seven occurrences of the
ancestor-walk variable and five of the subject matter expert abbreviation. A second comparison
ran `typos --config _typos.toml --format json` against both the saved HEAD
validator and the edited validator. It compared the typo, suggested corrections,
byte offset, and complete source line, allowing for shifted line numbers:

```text
TYPOS ATTRIBUTION PASS: all 12 findings match HEAD text; 0 introduced findings
TYPOS SCOPE: the other 6 scoped files have no findings
```

`git diff --check` also passed with no output.

### Blockers and friction

No implementation blocker. All requested proofs ran. Raw typos remains at
exit 2 because of 12 inherited findings; the brief's byte-preservation rule
precludes changing those validator lines. The 904 live-tree violations are
inherited and byte-identical under both validators; changing the live or
archived ontology records is outside this lane. Neither result is presented
as a green aggregate check.

Graft reported that this skill directory is not indexed. Targeted reads
provided the needed source context. No additional graph or skill wiring was
changed.

The first typos attribution attempt used an unsupported stdin filename option
(exit 64); the next expected a source-line field absent from this installed
version's JSON. Those attempts are not proof. CLI help and an actual JSON row
established the supported file arguments and line-number fields used by the
successful comparison above. Inspecting those interfaces first would have
avoided the retries.

### Files

- `.claude/skills/_shared/schemas/run-manifest.schema.yaml` (modified)
- `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` (modified)
- `.claude/skills/ontology-foundational-auditor/prompts/denotation.md` (modified)
- `.claude/skills/ontology-foundational-auditor/SKILL.md` (modified)
- `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md` (modified)
- `explorations/beep-ci-operational-ontology/research/run4-lanes/skill-seat-effort-brief.md`
  (pre-existing untracked input; left unchanged)
- `explorations/beep-ci-operational-ontology/research/run4-lanes/skill-seat-effort-report.md`
  (created by this lane)
