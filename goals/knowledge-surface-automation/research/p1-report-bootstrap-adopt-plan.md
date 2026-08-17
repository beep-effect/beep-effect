# P1 report — `goals bootstrap|adopt --plan` pure-plan evidence (Workstream E phase 0)

Commands run 2026-08-17 against the live checkout (no fixture copies):

```text
bun run beep goals bootstrap --slug example-goal --title "Example Goal" \
  --mission "Prove the plan compiler." --today 2026-08-17 --plan --json
bun run beep goals adopt knowledge-surface-automation --plan --json
```

Both commands are plan-only: no `--write`, no `--apply`, no `--force` exists, and no function
in the slice calls a mutating `FileSystem` member. The suite proves this empirically two
ways: a porcelain-equality test asserts `git status --porcelain` is byte-identical around
compilation and snapshotting, and the evergreen pilot test re-snapshots the packet and
compares per-file digest sets before and after compilation (the same evidence a doctor
before/after parity run would consume — doctor reads exactly those files).

## Bootstrap plan headline

`planId: goal-plan/v1:76621ab1a39245c998729b55c1dcae53d0be0fc3e753917f806d09250cd6376d`

| Action / ownership | Count | Paths |
| --- | --- | --- |
| create / generated | 4 | `ops/manifest.json`, three `.gitkeep` markers |
| create / generated-seed | 5 | `README.md`, `GOAL.md`, `SPEC.md`, `PLAN.md`, `research/SOURCES.md` |
| report / generated | 1 | `goals/INDEX.md` (producer://goals/index, `bun run beep goals index --write`) |

Validations: `manifest-decodes`, `doctor-clean`, `index-regenerates`,
`readme-lifecycle-line`, `goal-md-within-budget`. Conflicts: none. Every `create` entry
carries its complete payload bytes plus a SHA-256 digest; the generated manifest mints the
E4 PacketId beacon (`initiative.packetId = goal-packet/v1:<sha256(slug\ntoday)>`), which the
lenient decoder accepts and ignores today and the schema models in the executor era.

Excerpt (`entries[0]`, payload elided):

```json
{
  "action": "create",
  "ownership": "generated",
  "path": "goals/example-goal/ops/manifest.json",
  "payloadDigest": "…64 hex…",
  "reason": "Every byte derives from the input and the archetype."
}
```

## Pilot adoption headline (self-hosting test case #1)

`towardArchetype: report-first` (inferred from the packet's phase names)
`templateSnapshotHash: 4f608b5d317256669749fcca4684749d3988d749e9ba26535129c2d28440736e`

The pilot planId is deliberately **not** quoted as a reproducible constant: this report file
lives inside the packet it snapshots, so any edit to the report shifts the packet tree and
with it the content-addressed planId (self-inclusion). The tree-stable evidence below —
per-action counts, the manifest pre-image digest, and the template snapshot hash — is
captured against the exact tree this report ships in, and re-running the printed command on
that tree reproduces it.

| Action / ownership | Count | Meaning |
| --- | --- | --- |
| retain / authored | 29 | every tracked prose/research file (this report included), untouched |
| retain / generated | 2 | `history/.gitkeep`, `history/reflections/.gitkeep` |
| preserve / preserved | 1 | `ops/manifest.json`, byte-preserving obligation |
| report / authored | 1 | `history/reflections/_TEMPLATE.md` absent — a human resolves it |
| create / generated | 1 | `research/.gitkeep` directory marker (machine-derivable) |

**Authored-file creations: zero**, as the design requires — if this table ever shows one,
the ownership rules are wrong and the eyeball has done its job before a writer existed.

The preservation row enumerates exactly the five unmodeled top-level manifest keys the
design predicted, with the pre-image digest binding a future adoption patch to the exact
bytes reviewed:

```json
{
  "path": "goals/knowledge-surface-automation/ops/manifest.json",
  "preImageDigest": "346db1b7c05b18662231786df82f294257c3f49fa9eff4b6d1cf248b26d742b9",
  "reason": "The canonical decoder strips these top-level keys from decoded output.",
  "unmodeledKeys": [
    "agentLaunchers",
    "currentSourceOfTruth",
    "researchReports",
    "stopConditions",
    "verificationCommands"
  ]
}
```

The preservation counterfactual test proves the naive path destroys data: round-tripping
the pilot manifest through `decodeGoalManifest` then `S.encodeUnknownEffect(GoalManifest)`
loses all five keys.

## Deviations from the illustrative sketch (recorded, not doctrine changes)

- `PlanConflictReason` ships as `slug-exists | packet-not-found | manifest-unparseable`.
  The sketch's `template-slug` is unreachable by construction — the `GoalSlug` grammar
  rejects `_template` at decode, as the design's D1 reuse intends — and
  `standard-artifact-absent` contradicts the adopt semantics section itself, which routes
  absent standard artifacts to `report` entries rather than conflicts. Dead domain values
  were dropped instead of shipped.
- Snapshot digests are computed over exact file **bytes** (`sha256HexBytes`), not decoded
  text: several hand-rolled packets carry binary evidence (PNG/JPG under `history/`), and a
  lossy UTF-8 decode would emit digests external `sha256sum` tooling cannot verify —
  breaking the bind-to-exact-bytes contract for any non-pilot packet. Caught by the
  adversarial review pass before publish; the pilot is all-text either way.
- `MODELED_GOAL_MANIFEST_KEYS` is derived from `GoalManifest.fields` rather than
  hand-listed, so the unmodeled-key enumeration cannot drift from the schema.
- The bootstrap handler refuses a `--provides`/`--requires` self-cycle before compiling:
  the `GoalManifest` schema rejects self-cycles, so a plan carrying one could never satisfy
  its own `manifest-decodes` validation.

## Test evidence

`packages/tooling/tool/cli/test/goals-bootstrap-plan.test.ts`, 20 tests green, covering the
design's eleven classes: three committed golden plans (regenerate with `REGEN_GOLDENS=1`),
determinism under repetition and permuted input field order, slug-grammar rejection
(uppercase, separators, traversal, whitespace, `_template`), slug-exists fail-closed,
evergreen live pilot adoption, digest-set zero-write/doctor-input parity, idempotence and
the simulated-overlay fixed point (zero creates), the preservation counterfactual, the
manifest-less synthetic packet (one generated manifest, README never written), the
missing-packet and corrupt-manifest conflicts, index parity, the exhaustive
doctor-finding → validation-requirement mapping (a compile-time-exhaustive record; new
doctor kinds fail the build until mapped), the command-surface gate (missing `--plan`,
self-cycle refusal, happy-path JSON), and the porcelain-equality zero-write proof.

## Annotated false-positive review

A false positive here means one of exactly three things: (1) a `create` entry that would
overwrite authored prose, (2) a `preserve` entry missing an unmodeled key, or (3) a
`report` entry for an artifact the standard does not actually require. Against the pilot:

- **(1) none observed** — the only `create` is `research/.gitkeep`, a byte-exact copy of
  the template's marker in a directory that already carries authored files. Borderline
  cosmetic rather than wrong: the standard ships the marker, the pilot dropped it once
  real research files existed. If the eyeball prefers, "marker beside real files" could
  downgrade to `report`; recorded as the one candidate judgement call.
- **(2) none observed** — the five enumerated keys match a hand diff of the manifest
  against the `GoalManifest` struct fields; `provenance` does not appear because the pilot
  manifest does not carry it (the `_template` does, which the manifest-less synthetic test
  covers).
- **(3) one candidate** — `history/reflections/_TEMPLATE.md` is reported absent. The
  `_template` tree ships it as authoring convenience; whether a conforming packet must
  carry a copy is a standards question, not a compiler question. If Benjamin rules it
  optional, the fix is a documented-convention exclusion in the adoption classifier, not a
  marker syntax.

## Eyeball ask

Confirm the ownership rule table (generated / generated-seed / authored / preserved as
compiled above), confirm the pilot's preservation set is complete, rule on the two
annotated judgement calls, and confirm nothing else blocks the P4 unlock for Workstream E.
Per PLAN P4 and execution decision E5, this gate is E's alone and blocks nothing else.
