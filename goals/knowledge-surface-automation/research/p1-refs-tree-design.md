# P1 design — `KnowledgeRef` and the `knowledge refs --tree` census

Status: design only; no implementation is authorized by this document.

## Scope and binding doctrine

This is Workstream A, phase 0: a read-only inventory of every reference form in
the agent-facing corpus, resolved against a Git tree rather than the working
filesystem, with false positives classified and measured
(`goals/knowledge-surface-automation/SPEC.md:92-97`). The mechanical rewrite
pass, `relink`, `rename --plan`, and the hermetic clean-clone lane are P3 work
unlocked only after this report's false-positive rate is eyeballed
(`goals/knowledge-surface-automation/PLAN.md:37-41`, execution decision E5).

The schema follows the family-local `LiteralKit`/`S.Class`/`S.toTaggedUnion`
pattern shipped in `Knowledge.schemas.ts` by Workstream C and reuses that
family's length-prefixed digest discipline. Ratified decisions A1 (same-line
trailing plus heading-scope `beep:ref`, one per line, ambiguity is a hard
failure) and A2 (dual-write on portfolio surfaces only) are inputs, not open
questions (`goals/knowledge-surface-automation/research/p2-grill-decisions.md:164-189`).

The measurement baseline is the tracked clone-agnosticism scan: 1,741
non-overlapping anchor occurrences across 406 files, split 298 live / 1,443
archival (`goals/knowledge-surface-automation/research/surface-inventory.md:28-77`).
The census must reconcile against those numbers or it cannot be compared with
its own baseline.

## Decided contract

1. The command is `bun run beep knowledge refs`, a second subcommand in the
   existing `Knowledge` family. It is not a `lint` subcommand and it does not
   join `rootRepoLintPolicySteps`; a read-only census that gates nothing has no
   business in the policy lane until C7's zero-FP window closes.
2. `KnowledgeRef` is a three-member tagged union — repo-relative path,
   machine-local host path, and `repo://goal/*` URI — carried inside a versioned
   `KnowledgeRefsReport` envelope. `upstream://owner/repo@sha` is reserved in the
   kind domain and not emitted in v1; Workstream B owns upstream provenance.
3. The census emits **observations**, never `KnowledgeFinding` values. The
   mapping from observation to the reserved finding classes
   (`host-path-in-live-guidance`, `host-path-in-historical-artifact`) is defined
   here and emitted by a later evaluator, so the two identity spaces never mix.
4. The command's exit status is zero for every observation. Only operational
   failures (unresolvable tree-ish, Git failure, malformed UTF-8 in a blob the
   scanner elected to read) fail closed, reusing `KnowledgeOperationalError` and
   `KNOWLEDGE_HISTORY_REMEDIATION`.
5. Resolution consults the tracked-entry oracle for the requested tree only.
   Untracked files, local symlink targets outside the tree, and ambient
   `fs.exists` can never make a reference look valid.
6. Goal slugs resolve against tracked `goals/<slug>/ops/manifest.json` in the
   same tree, **not** against `goals/INDEX.md`. INDEX is a generated projection
   owned by `producer://goals/index`; resolving identities against a projection
   would let a stale generated file validate a reference.
7. A `repo://goal/<slug>` reference whose manifest exists but whose decoded
   `initiative.id` differs from the slug is an `identity-mismatch`, reported
   distinctly from `missing`. This is the split-brain drift SPEC names as
   Workstream A's load-bearing risk.
8. Fenced blocks are decoys for repo-path resolution (matching Stage-1) but are
   **not** decoys for host-path anchors. A fenced `cd <HOME>/...` is precisely
   the guidance that breaks a fresh clone, and the inventory baseline counted
   anchors line-wise, so excluding fences would make the census incomparable
   with its own baseline.
9. Classification is computed by a pure rule table, never hand-labelled. The
   eyeball validates the rule table; that is what phase 0 is for.

## Schema sketch (illustrative, not implementation)

Every API form below already ships in this repo. `Sha256Hex`, `NonNegativeInt`,
and `LiteralKit` come from `@beep/schema`; `KnowledgeFindingLocation` is reused
from `Knowledge.schemas.ts` rather than redeclared. Names and annotations are
illustrative; the field contract is the design.

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema"
import * as S from "effect/Schema"
const $I = $RepoCliId.create("commands/Knowledge/Knowledge.refs")
export const KnowledgeHostAnchor = LiteralKit([
  "home-absolute", "home-relative", "temp", "encoded-home", "bare-tree-name",
]).pipe($I.annoteSchema("KnowledgeHostAnchor", { description: "Lexical anchor that made a span machine-local." }))
export const KnowledgeRefSurface = LiteralKit(["live", "archival"]).pipe(
  $I.annoteSchema("KnowledgeRefSurface", { description: "Corpus disposition of the containing document." })
)
export const KnowledgeRefClassification = LiteralKit([
  "verified", "broken-target", "identity-mismatch", "producer-owned-target",
  "actionable-host-path", "portable-home-convention", "documented-temp-convention",
  "external-mirror-reference", "archival-provenance", "audit-pattern-literal",
  "ambiguous-ref-pairing", "ungoverned-syntax",
]).pipe($I.annoteSchema("KnowledgeRefClassification", {
  description: "Deterministic triage class assigned to one reference observation.",
}))
export const KnowledgeRefId = S.TemplateLiteral(["knowledge-ref/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("KnowledgeRefId", { description: "SHA-256 identity of one normalized reference instance." })
)
export class KnowledgeRepoPathRef extends S.Class<KnowledgeRepoPathRef>($I`KnowledgeRepoPathRef`)({
  kind: S.tag("repo-path"), raw: S.String, normalized: S.String,
}, $I.annote("KnowledgeRepoPathRef", { description: "Repo-root-relative target after governed normalization." })) {}
export class KnowledgeHostPathRef extends S.Class<KnowledgeHostPathRef>($I`KnowledgeHostPathRef`)({
  kind: S.tag("host-path"), raw: S.String, anchor: KnowledgeHostAnchor,
}, $I.annote("KnowledgeHostPathRef", { description: "Machine-local span; never resolvable inside a tree." })) {}
export class KnowledgeGoalUriRef extends S.Class<KnowledgeGoalUriRef>($I`KnowledgeGoalUriRef`)({
  kind: S.tag("goal-uri"), raw: S.String, slug: S.String, displayPath: S.optionalKey(S.String),
}, $I.annote("KnowledgeGoalUriRef", { description: "repo://goal/<slug> identity plus its paired display path." })) {}
export const KnowledgeRef = S.Union([KnowledgeRepoPathRef, KnowledgeHostPathRef, KnowledgeGoalUriRef]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("KnowledgeRef", { description: "One recognised reference across the typed buses." })
)
export class KnowledgeRefObservation extends S.Class<KnowledgeRefObservation>($I`KnowledgeRefObservation`)({
  refId: KnowledgeRefId, ref: KnowledgeRef, documentId: S.String, occurrence: NonNegativeInt,
  surface: KnowledgeRefSurface, classification: KnowledgeRefClassification,
  resolution: KnowledgeRefResolution, location: KnowledgeFindingLocation, remediation: S.String,
}, $I.annote("KnowledgeRefObservation", { description: "One resolved, classified reference occurrence." })) {}
export class KnowledgeRefsReport extends S.Class<KnowledgeRefsReport>($I`KnowledgeRefsReport`)({
  schemaVersion: S.tag("knowledge-refs/v1"),
  normalizationVersion: S.tag("knowledge-ref-normalization/v1"),
  treeish: S.String, commit: Sha256Hex,
  observations: S.Array(KnowledgeRefObservation), skipped: S.Array(KnowledgeSkippedBlob),
}, $I.annote("KnowledgeRefsReport", { description: "Versioned reference census for one Git tree." })) {}
```

`KnowledgeRefResolution` is a second tagged union on `status`:
`resolved` (carrying `targetPath`, Git `mode`, `objectId`), `missing`,
`identity-mismatch` (carrying `declaredId`), `producer-owned` (carrying
`producerId` and the exact regeneration command), and `not-applicable` (every
host-path reference, which is unresolvable by construction rather than broken).
`upstream://owner/repo@sha` is reserved in the union's tag domain and carries no
member class in v1.

Identity mirrors the ratified Stage-1 algorithm with a distinct version tag:
`digest = SHA256(LP("knowledge-ref-normalization/v1") || LP(kind) ||
LP(documentId) || LP(normalizedSubject) || LP(decimalOccurrence))`, lower-hex,
prefixed `knowledge-ref/v1:`. Location is excluded, so reflow does not relabel
an observation; duplicate identical references in one document take source-order
ordinals `0..n-1`.

## Scanned corpus

The census reuses the Stage-1 `SCANNER_SCOPE` roots — `AGENTS.md`, `CLAUDE.md`,
`goals`, `explorations`, `docs`, `.claude`, `.agents`, `.codex`, `standards`,
`.github` — with two deliberate widenings:

- **Archival segments are censused, not excluded.** Stage 1 excludes `history`,
  `research`, `reviews`, `synthesis`, `findings`, `outputs`, `reflections`,
  `logs`, and `.proofs` from *enforcement*; the census includes them and labels
  each observation `surface: archival`. The 1,443 archival occurrences are 83% of
  the baseline and are the reason the split exists at all.
- **Text beyond Markdown.** Tracked `.md`, `.json`, `.jsonc`, `.jsonl`, `.toml`,
  and `.yml`/`.yaml` blobs are read as UTF-8 lines. The inventory's live examples
  include `goals/ai-metrics-stack/ops/manifest.json` and `.claude/settings.json`,
  so a Markdown-only census would miss control-plane guidance. JSON is scanned
  line-wise as text in v1, not structurally by key path.

`docs/generated/**` and `docs/_internal/**` stay out of scope. Non-regular blobs
(symlink mode `120000`, gitlink `160000`) and blobs that fail strict UTF-8
decoding are recorded in `skipped` with a reason and never fail the run.

Extraction is deliberately narrow, per bus:

- **Repo paths** come from single inline-code spans outside fences that match the
  governed repo-path grammar, plus Markdown link destinations. The link-
  destination parser is extracted here and becomes the shared parser
  `lint roadmap-refs` folds into during P3; until then `RoadmapRefs` keeps
  ownership of `docs/ROADMAP.md` and the census simply reports the same targets
  (`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts`).
- **Host paths** are matched line-wise on the five baseline anchors: absolute
  home prefixes, home-relative `~/` prefixes, `/tmp/`, encoded session-directory
  literals, and the bare machine tree name. Fences do not exempt them (contract
  item 8).
- **Goal URIs** come from `repo://goal/<slug>` spans and from
  `<!-- beep:ref goal/<slug> -->` comments. Pairing follows A1: at most one ref
  per line, paired to the display path on the same line or to the heading it
  immediately follows. Two refs on one line, or a ref with no resolvable
  neighbour, is `ambiguous-ref-pairing` — a hard classification, because the
  split-brain rule demands the tool never guess which object an identity names.

## Resolution semantics

1. Resolve the requested tree with `git rev-parse --verify <treeish>^{commit}`;
   the default `--tree HEAD` matches SPEC's phrasing. An absent or non-commit
   ref is an operational failure carrying `KNOWLEDGE_HISTORY_REMEDIATION`,
   consistent with C4's fail-closed rule.
2. Build the oracle from `git ls-tree -r -z --full-tree <commit>` into an
   `effect/HashMap` keyed by path, plus an `effect/HashSet` of directory
   prefixes for directory-target existence. This promotes the tree-reading
   helper Stage 1 introduced into `src/internal/repo-run/GitExec.ts` so both
   evaluators share one parser.
3. Normalize repo paths with the ratified Stage-1 rules: strip query and
   fragment, collapse repeated `/`, remove `.` segments, resolve `..`, reject
   root escape, remove a leading `./`, preserve case. Relative spellings resolve
   from the containing document's directory; governed bare roots resolve from the
   repo root. A spelling that escapes the root is `ungoverned-syntax`, never a
   host lookup.
4. Producer-owned targets resolve through a single registry mapping producer id
   to tracked path and regeneration command. v1 registers exactly
   `producer://goals/index` → `goals/INDEX.md` →
   `bun run beep goals index --write`. A missing target that matches a registered
   producer output reports `producer-owned` with the command, so the report says
   "run this", not "broken".
5. Goal slugs resolve by looking up `goals/<slug>/ops/manifest.json` in the
   oracle, reading the blob, and decoding it with the production
   `decodeGoalManifest`. Present and matching id → `resolved`; present with a
   different `initiative.id` → `identity-mismatch`; absent → `missing`. The
   census never decodes through a weaker local schema.
6. Anchors and fragments (`#heading`) are stripped before resolution and are not
   validated in v1.

## False-positive classification taxonomy

The rule table is total over `(kind, anchor, surface, resolution)`:

| Class | Trigger | Disposition |
| --- | --- | --- |
| `verified` | repo-path or goal-uri resolves in the tree | not a defect |
| `broken-target` | repo-path missing, no producer owns it | candidate true positive |
| `identity-mismatch` | goal-uri manifest id disagrees with slug | hard defect (split-brain) |
| `producer-owned-target` | missing target is a registered producer output | remediation is a command |
| `actionable-host-path` | host anchor in a `live` document, not a convention | P3 rewrite target |
| `portable-home-convention` | home-relative prefix in the documented-convention set (`~/.claude`, `~/.codex`, `~/.config`, `~/.bun`) | portable; not a clone-agnosticism defect |
| `documented-temp-convention` | `/tmp/` prefix in the documented-convention set | product documentation, not local leakage |
| `external-mirror-reference` | host path pointing outside any beep checkout | remediation is a canonical GitHub URL |
| `archival-provenance` | any host anchor in an `archival` document | captured proof; rewriting it rewrites history |
| `audit-pattern-literal` | the anchor is the subject of a rule, regex, or inventory row | self-reference; the audit corpus is its own top offender |
| `ambiguous-ref-pairing` | A1 pairing ambiguity | hard defect |
| `ungoverned-syntax` | backslash, absolute repo path, or root escape | out of the governed grammar |

`audit-pattern-literal` is load-bearing: `standards/git-worktrees.md`,
`surface-inventory.md`, and this packet's own manifest verification grep all
contain anchors *as data*. Without the class the census reports its own
instrumentation as debt. The rule is lexical (the line also contains a rule,
regex, glob, or table delimiter marking it as pattern text), so it is auditable
and falsifiable in the fixture matrix rather than a judgement call.

The census deliberately does **not** try to distinguish a broken repo path from
a speculative not-yet-built one. There is no oracle for intent, and Stage 1's
live report already flagged speculative design-prose paths as the dominant
bucket. Both land in `broken-target`; the report annotates the split by hand and
the question goes to the mini-grill.

## Command surface

```text
bun run beep knowledge refs [--tree <rev>] [--surface live|archival|all] [--json]
```

- `--tree` defaults to `HEAD` and accepts any commit-ish; no fetch ever occurs.
- `--surface` defaults to `all` and filters observations only — counts in the
  summary are always whole-corpus so a filtered run cannot understate the census.
- `--json` emits the encoded `KnowledgeRefsReport` on one line via
  `S.fromJsonString`, matching the Stage-1 command's JSON path. Human output is a
  per-class summary table plus the highest-density documents.
- There is no `--fix`, `--write`, or `--rewrite`. Phase 0 has no writer.

## Placement in the Knowledge family

Concrete files, all landing on top of the merged Workstream C scaffold:

1. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts` (new) —
   ref schemas, the pure classifier, the tree-oracle evaluator, and
   `knowledgeRefsCommand`. This mirrors the Goals family, where each evaluator
   (`Doctor.ts`, `PortfolioIndex.ts`, `SetStatus.ts`) owns its own finding
   schemas beside the shared `Goals.schemas.ts`.
2. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts` —
   extend `KnowledgeServiceShape` with `refsTree`, and export a
   `KnowledgeTreeOracle` interface so golden fixtures and the live tree are
   indistinguishable to the evaluator, exactly as `KnowledgeArchiveOracle` does
   for Stage 1.
3. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.errors.ts` — no
   new error class; widen `KnowledgeOperationalError`'s documented scope to
   include tree resolution. One operational error per family beats a parallel
   hierarchy.
4. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts` —
   register the subcommand and update both the family-root listing line and the
   docgen-checked JSDoc example that currently asserts `[ "semantic-delta" ]`.
5. `packages/tooling/tool/cli/src/commands/Knowledge/index.ts` — export the new
   module.
6. `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts` — promote the
   `ls-tree` parser to a shared bounded helper.
7. `packages/tooling/tool/cli/test/knowledge-refs.test.ts` plus fixtures.

Unchanged by design: `Root.ts` (the family is already registered),
`bin-main.ts` (its allowlist covers `lint` subcommands only), the package
subpath map (same `./commands/Knowledge` entry), and `Quality/Tasks.ts`.

## Golden fixture matrix

Fixtures inject a `KnowledgeTreeOracle`, so no fixture needs a real repository.
Expected values are `(classification, resolution.status)`.

| Case | Fixture | Expected |
| --- | --- | --- |
| Verified inline span | live doc cites tracked `docs/README.md` | `verified` / `resolved` |
| Missing target | live doc cites absent `packages/missing/src/index.ts` | `broken-target` / `missing` |
| Document-relative | packet doc cites `./PLAN.md`, sibling tracked | `verified` / `resolved` |
| Root escape | doc cites `../../etc/passwd` | `ungoverned-syntax` / `not-applicable` |
| Link destination | `[PLAN](./PLAN.md)` in a portfolio README | `verified` / `resolved` |
| Producer target | doc cites `goals/INDEX.md`, absent from tree | `producer-owned-target` / `producer-owned` |
| Live host path | skill doc contains `<HOME>/<checkouts>/beep-effect` | `actionable-host-path` / `not-applicable` |
| Portable convention | settings doc contains `~/.claude/memory` | `portable-home-convention` / `not-applicable` |
| Temp convention | skill doc contains `/tmp/portless` | `documented-temp-convention` / `not-applicable` |
| Archival anchor | same absolute path under `goals/x/research/y.md` | `archival-provenance` / `not-applicable` |
| Audit literal | a regex line whose pattern contains a home anchor | `audit-pattern-literal` / `not-applicable` |
| Fenced host path | absolute path inside a `bash` fence | `actionable-host-path` (fences do not exempt) |
| Fenced repo path | broken repo path inside a fence | no observation (fence decoy) |
| Goal URI resolved | `repo://goal/knowledge-surface-automation`, manifest id matches | `verified` / `resolved` |
| Goal URI drifted | manifest present, `initiative.id` is another slug | `identity-mismatch` / `identity-mismatch` |
| Goal URI absent | no tracked manifest for the slug | `broken-target` / `missing` |
| Paired `beep:ref` | `[PLAN](../PLAN.md) <!-- beep:ref goal/<slug> -->` | `verified`, paired display path recorded |
| Heading-scope ref | ref on its own line after a heading | `verified`, scope is the heading |
| Two refs one line | A1 violation | `ambiguous-ref-pairing` |
| Orphan ref | ref with no resolvable neighbour | `ambiguous-ref-pairing` |
| Duplicate spans | same broken path twice in one document | ordinals 0 and 1, distinct `refId` |
| Binary blob | tracked PNG under scope | recorded in `skipped`, run succeeds |

Negative controls: permuting tracked-entry order and document scan order yields
byte-identical JSON; a tracked symlink whose target escapes the tree resolves to
`skipped`, never through the host; renaming a document changes `documentId` but
not the classification of its references (the census has no rename lineage by
design — it is a single-tree snapshot, not a paired delta).

One further control is a **baseline-agreement test**: the live census totals per
anchor and per surface must reconcile with `surface-inventory.md`'s 1,741 / 406 /
298 / 1,443, with any delta attributable to files added since 2026-07-31 or to
the working-copy-versus-tree difference. An unexplained delta means the extractor
disagrees with its own baseline and the report is not yet trustworthy.

## Evidence report

`research/p1-report-refs-tree.md` is the committed FP-eyeball artifact required
by E4. It carries headline counts by bus, anchor, and surface reconciled against
the inventory baseline; a per-classification table; the highest-density
documents; annotated samples of each judgement-bearing class (especially
`audit-pattern-literal`, `portable-home-convention`, and the broken-versus-
speculative split); the `repo://goal/*` fixture results proving identity-mismatch
detection works before dual-write exists; and an explicit eyeball ask.

Every host-absolute path quoted in the report is redacted to `<HOME>`
placeholders. Redaction is an authoring step over quoted JSON excerpts — the
command itself emits real paths — and the packet's own manifest verification
command (`! rg -n` over home anchors, excluding `ops/manifest.json` and
`research/surface-inventory.md`) is the standing proof it happened. Because the
report lands under `research/`, it is archival: excluded from Stage-1
enforcement, and in later census runs its own rows classify as
`archival-provenance` and `audit-pattern-literal` with zero host anchors.

## Scope guard

This slice is read-only and produces exactly one command and one report. It does
**not** ship the ast-grep/comby rewrite rules, the mechanical path rewrite pass,
`beep knowledge relink`, `beep knowledge rename --plan`, dual-write `beep:ref`
insertion on the A2 portfolio surfaces, the hermetic clean-clone lane, the ASLR
torture variant, the `RoadmapRefs` migration, or any policy-lane wiring. There is
no rewrite pass in this PR. P3 unlocks that work for Workstream A alone, after
Benjamin eyeballs this report — per-workstream, not behind a phase barrier (E5).

## Open questions for the mini-grill

These do not reopen the tree-backed oracle, the manifests-not-INDEX slug rule,
the A1 pairing rule, or the identity algorithm above.

1. Broken versus speculative repo paths: does Workstream A need its own marker or
   classifier, or does Stage 1's ratified fence-decoy rule (put speculative trees
   in fences) fully cover the authoring pattern? This is the same question C's
   live report raised; deciding it once should settle both.
2. Should JSON/JSONC control-plane files be censused line-wise as text, or
   structurally by key path so a manifest's `verificationCommands` array can be
   distinguished from its `mission` prose?
3. Should the documented-convention sets (`portable-home-convention`,
   `documented-temp-convention`) live as a tracked JSONC allowlist that review
   can extend, or as a code-level `HashSet` that requires a PR to the CLI?
4. Do anchors and fragments (`#heading`) get validated in a later version, or is
   heading drift permanently out of scope?
5. Should the census emit `upstream://` rows for GitHub URLs now, or stay silent
   until Workstream B's `skills-lock/v2` provenance lands and owns that bus?
6. Tracked symlinks: `.agents/skills` is a symlink to `.claude/skills`. Should
   the census follow tracked symlink targets inside the tree, or keep reporting
   them as skipped so the two trees stay independently auditable?
7. Does `lint roadmap-refs` keep its command name after folding into the shared
   link parser in P3, or does `docs/ROADMAP.md` become one more censused surface?
