# P1 design — `KnowledgeFinding` and the Stage-1 semantic-delta scanner

Status: design only; no implementation is authorized by this document.

## Scope and binding doctrine

This is Workstream C, Stage 1: scan paired merge-base/HEAD Git archives with no
baseline writer and fail only on normalized findings introduced in HEAD. Stage 2
owns full-corpus baselines, suppressions, causal grouping, and counterfactual
hardening (`goals/knowledge-surface-automation/SPEC.md:133-178`).

The schema follows the live family-local `LiteralKit`/`S.Class`/derived-guard
pattern in `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:16-75,291-328`
and the doctor finding model at `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:91-195`.
The identity explicitly follows the stable-key and regenerable-not-line-key lessons
in `goals/knowledge-surface-automation/research/prior-ritual-lessons.md:173-176`.

## Decided contract

1. The command is `bun run beep knowledge semantic-delta`, in a new top-level
   `Knowledge` family. It is not another implementation inside `Lint/`.
2. `KnowledgeFinding` is the common versioned finding envelope. The Stage-1
   scanner emits only `broken-tracked-path`, `unknown-beep-command`,
   `index-drift`, and `failed-assertion`; the wider taxonomy is reserved in the
   same literal domain for later evaluators.
3. Stage-1 severities are all `blocking`; `advisory` is reserved for later
   evaluators. Severity is evaluator-owned, never document markup.
4. Identity excludes path, offset, excerpt, message, remediation, and severity.
5. Identity is a semantic *instance* identity: normalized class + rename-aware
   document identity + normalized subject + duplicate ordinal. This prevents a
   pre-existing broken claim in one document from laundering a new copy in a
   different document.
6. Stage-1 identity is comparison-scoped: stable across paired reflow/renames,
   but not a Stage-2 baseline key until `documentId` has durable lineage.
7. Findings are a multiset; repeated identical claims receive source-order
   ordinals `0..n-1`.
8. Operational failures (no merge-base, archive failure, malformed UTF-8,
   archive-local CLI load failure) are typed command errors and fail closed with
   the operational exit path. They are not `KnowledgeFinding` values.

## Schema sketch (illustrative, not implementation)

Every API form below is already used by the repo: `LiteralKit`, `S.Class`,
`S.TemplateLiteral`, `S.Literal`, `S.optionalKey`, `S.is`, and Effect codecs.
`Sha256Hex` is the existing `@beep/schema` digest schema. Names and annotations
are illustrative; the field contract is the design.

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema"
import * as S from "effect/Schema"
const $I = $RepoCliId.create("commands/Knowledge/Knowledge.schemas")
export const KnowledgeFindingKind = LiteralKit([
  "host-path-in-live-guidance", "host-path-in-historical-artifact",
  "skill-lock-coverage-drift", "unresolvable-skill-source",
  "floating-github-skill-source", "manifest-v1-legacy",
  "manifest-schema-version-gap", "index-drift",
  "exploration-goal-provenance-asymmetry", "unresolved-exploration-goal-link",
  "broken-tracked-path", "unknown-beep-command", "failed-assertion",
]).pipe($I.annoteSchema("KnowledgeFindingKind", {
  description: "Stable classes emitted by knowledge-surface evaluators.",
}))
export type KnowledgeFindingKind = typeof KnowledgeFindingKind.Type
export const isKnowledgeFindingKind = S.is(KnowledgeFindingKind)
export const KnowledgeFindingSeverity = LiteralKit(["blocking", "advisory"]).pipe(
  $I.annoteSchema("KnowledgeFindingSeverity", { description: "Finding enforcement severity." })
)
export type KnowledgeFindingSeverity = typeof KnowledgeFindingSeverity.Type
export const isKnowledgeFindingSeverity = S.is(KnowledgeFindingSeverity)
export const KnowledgeFindingId = S.TemplateLiteral(["knowledge-finding/v1:", Sha256Hex]).pipe(
  $I.annoteSchema("KnowledgeFindingId", {
  description: "SHA-256 identity of one normalized semantic finding instance.",
}))
export type KnowledgeFindingId = typeof KnowledgeFindingId.Type
export class KnowledgeFindingLocation extends S.Class<KnowledgeFindingLocation>($I`KnowledgeFindingLocation`)({
  path: S.String,
  line: S.optionalKey(NonNegativeInt),
  column: S.optionalKey(NonNegativeInt),
}, $I.annote("KnowledgeFindingLocation", { description: "Display location, excluded from identity." })) {}

export class KnowledgeFinding extends S.Class<KnowledgeFinding>($I`KnowledgeFinding`)({
  schemaVersion: S.Literal("knowledge-finding/v1"),
  normalizationVersion: S.Literal("knowledge-normalization/v1"),
  findingId: KnowledgeFindingId,
  kind: KnowledgeFindingKind,
  severity: KnowledgeFindingSeverity,
  documentId: S.String,
  subject: S.String,
  occurrence: NonNegativeInt,
  location: KnowledgeFindingLocation,
  message: S.String,
  remediation: S.String,
}, $I.annote("KnowledgeFinding", { description: "Versioned normalized knowledge finding." })) {}

export const isKnowledgeFinding = S.is(KnowledgeFinding)
export const decodeKnowledgeFinding = S.decodeUnknownEffect(KnowledgeFinding)
export const encodeKnowledgeFinding = S.encodeUnknownEffect(KnowledgeFinding)
```

The inventory's negative controls (`skill-tree-drift`,
`goal-packet-missing-manifest`, `exploration-orphan`) are test controls, not
finding classes, so they are intentionally absent. The positive taxonomy comes
from `goals/knowledge-surface-automation/research/surface-inventory.md:355-378`.

## Identity normalization — load-bearing algorithm

All strings below are Unicode NFC. Paths are POSIX `/` paths. `LP(s)` is the
ASCII decimal length of `UTF8(s)`, then `:`, then `UTF8(s)`. Length-prefixing,
not delimiter escaping, makes the preimage unambiguous.

For a paired comparison `(B, H)`:

1. Build the rename table from the exact Git diff described below.
2. Assign every base document `documentId = "base:" + basePath`.
3. A same-path HEAD document receives `"base:" + headPath`.
4. A rename target receives `"base:" + renameSourcePath`.
5. A new HEAD document receives `"head-new:" + headPath`; if it reuses a path
   renamed away, append `":" + headBlobOid` to prevent a lineage collision.
6. Normalize each evaluator subject using the class-specific rules below.
7. Group by `(kind, documentId, subject)` and assign `occurrence` from zero in
   source order. Reflow changes offsets, not the multiset or ordinals.
8. Compute:

   `digest = SHA256(LP("knowledge-normalization/v1") || LP(kind) ||
   LP(documentId) || LP(subject) || LP(decimalOccurrence))`.

9. Set `findingId = "knowledge-finding/v1:" + lowercaseHex(digest)`.

Class-specific `subject` normalization:

- `broken-tracked-path`: `repo-path:` plus the resolved repo-root-relative path.
  Strip query and fragment for existence, collapse repeated `/`, remove `.`
  segments, resolve `..`, reject root escape, remove a leading `./`, and preserve
  case. Relative spellings resolve from the document; governed bare roots resolve
  from repo root. Backslashes/absolute paths are separate Workstream A classes.
- `unknown-beep-command`: `beep-command:` plus canonical command names joined by
  one ASCII space. Options, arguments, redirects, and comments are the replaced
  tail and do not enter the subject. Aliases normalize to the command's `.name`.
- `failed-assertion`: `path-exists:` plus the same canonical repo path. An
  assertion emits only this class, not a duplicate `broken-tracked-path`.
- `index-drift`: `producer://goals/index:` plus
  `SHA256(expectedBytes) + ":" + SHA256(archivedBytes)`. Newline and whitespace
  changes remain meaningful because `goals/INDEX.md` is an exact generated file.

Offsets are not hashed and rename pairs use one base lineage, so reflow and
rename do not relabel findings. Claims in different documents do not merge. A
normalizer change requires a new version and paired golden migration proof.

## Exact paired-archive semantics

1. Default `baseRef` is the literal local tracking ref `origin/main`; no fetch
   occurs. Resolve `H` with
   `git rev-parse --verify HEAD^{commit}` and `B` with
   `git merge-base <baseRef> H`. An absent/non-commit ref, unborn HEAD, or absent
   merge-base is an operational failure.
2. Materialize separate empty roots with
   `git archive --format=tar --output=<file> <B|H>` and safe extraction. Dirty,
   staged-but-uncommitted, ignored, and untracked files are excluded.
3. Build each tracked-path oracle from `git ls-tree -r -z --full-tree <commit>`,
   including blob/symlink/gitlink mode and object ID. Path findings consult this
   oracle, not ambient `fs.exists`; a local symlink or untracked file cannot fake
   validity. A directory exists when at least one tracked entry has its path plus
   `/` as a prefix. Submodule contents are not recursively scanned.
4. Compute renames with
   `git diff --name-status -z --find-renames=50% B H -- <scanner-scope>`.
   Parse `R<n>` as old-path/new-path pairs. Copies are not renames. Rename scores
   below 50% are delete+add and intentionally create new document identity.
5. Run the same v1 extraction/normalization code over both roots. Archive-local
   path state, command tree, and index generator are side-specific.
6. Let `baseIds` and `headIds` be finding-ID sets. The report is:
   `introduced = HEAD \\ BASE`, `resolved = BASE \\ HEAD`, and
   `unchanged = HEAD intersection BASE`, each sorted by `findingId`.
7. Fail only for introduced blockers. There is no baseline, suppression, or mutation.

## Narrow scanner contract

The Stage-1 Markdown corpus is tracked UTF-8 Markdown in the ratified knowledge
surfaces. `docs/generated/**`, `docs/_internal/**`, and explicit archival segments
(`history`, `research`, `reviews`, `synthesis`, `findings`, `outputs`,
`reflections`, `logs`, `.proofs`) are excluded from Stage-1 enforcement. Their
classification returns in Stage 2; this matches the inventory's conservative
live/historical split rather than turning captured proof into executable advice.

Extraction is deliberately narrow:

- Paths come only from single inline-code spans outside fenced blocks and must
  match the governed repo-path grammar. Markdown link destinations remain owned
  by `lint roadmap-refs` until the shared parser is extracted.
- Commands come only from single-line inline-code spans beginning exactly
  `bun run beep`. Shell operators make the span ineligible rather than partially
  executing it.
- The only assertion is an HTML comment outside fences with grammar
  `<!-- beep:assert path-exists PATH -->`, one unquoted path token and no suffix.
- All fenced blocks are decoys in Stage 1. No fence language or marker grants an
  exemption because Stage 1 does not inspect fence contents at all.

### Safe `--help` command probe

Each archive loads its own `packages/tooling/tool/cli/src/commands/Root.ts` so a
command addition/removal is evaluated against the matching tree. The probe walks
the public `Command.subcommands`, `.name`, and `.alias` fields to isolate the
longest command path and replace the remaining documented tail with `--help`.
If a group has children and the next word matches none, emit
`unknown-beep-command`. For a resolved path, call archive-local
`Command.runWith(rootCommand, { version: "0.0.0" })([...path, "--help"])`.

The structural precheck is mandatory: Effect v4 processes the global Help action
before ordinary parse errors (`.repos/effect/packages/effect/src/unstable/cli/Command.ts:1601-1647`),
so a subprocess exit code from `bad-subcommand --help` alone is not an oracle.
The precheck still uses the actual command object, not a second registry, and the
Help action never reaches a command handler.

For archive-local module resolution, a temporary `node_modules` link may point to
the already-installed checkout dependencies; it is never admitted to the tracked
path oracle. Incompatibility between an archive's source and installed dependency
graph is an operational failure, never a pass or synthetic finding.

### Hermetic environment and index probe

Create fresh empty directories and override `HOME`, `XDG_CONFIG_HOME`,
`XDG_CACHE_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_RUNTIME_DIR`, and
`TMPDIR` for each archive-local process. Preserve only the executable search
environment needed to run Bun; set `GIT_CONFIG_GLOBAL=/dev/null` and
`GIT_CONFIG_NOSYSTEM=1`. The process CWD is the archive root. No network or
credential-bearing environment is required.

The index evaluator must reuse the archive-local `GoalManifest` decoder,
inventory semantics, and `renderPortfolioIndex`; it may not duplicate INDEX
rendering. Parameterize inventory/index building by an explicit archive root,
render expected bytes in memory, and compare with that archive's tracked
`goals/INDEX.md`. Do not invoke `--write`, even in the disposable archive.

## Golden paired-fixture matrix

The fixture harness injects base/head tracked-path, command-tree, and index
oracles. Expected sets below are `introduced`; inherited/resolved findings may
also be asserted separately. `K(doc, subject)` denotes the v1 ID preimage before
hashing.

| Case | Base | HEAD | Expected introduced set |
| --- | --- | --- | --- |
| Content edit | `docs/guide.md` cites valid `docs/existing.md` | Span changes to `docs/missing.md` | `{ broken-tracked-path K(base:docs/guide.md, repo-path:docs/missing.md) }` |
| Pure reflow | Two-line paragraph contains inherited missing `docs/missing.md` | Same inline span rewrapped and moved to another line | `{}`; identical ID remains inherited |
| Rename-only | `docs/old.md` contains inherited missing path | Git reports `R100 docs/old.md docs/new.md`; bytes unchanged | `{}`; HEAD uses `base:docs/old.md` |
| Rename + edit | Same inherited finding in `docs/old.md` | `R80` to `docs/new.md` and add `packages/missing/src/index.ts` | Only the added `broken-tracked-path`; inherited one keeps its ID |
| Command added | No command span | Add valid `bun run beep goals doctor --write-baseline` | `{}`; flags are replaced tail |
| Command tail changed | Valid `bun run beep goals doctor` | Change child word to `bun run beep goals doctro --write` | `{ unknown-beep-command K(doc, beep-command:goals doctro) }` |
| Assertion added/failing | No assertion | Add `<!-- beep:assert path-exists docs/missing.md -->` | `{ failed-assertion K(doc, path-exists:docs/missing.md) }` |
| Fenced-example decoy | No fence | Add fenced broken path, unknown command, and assertion-looking comment | `{}`; Stage 1 ignores the entire fence |
| Alternate path spelling | Inherited `./missing.md` from `docs/guide.md` | Rewrite as `docs/./missing.md` | `{}`; both normalize to `docs/missing.md` |
| Index drift | Both generated and tracked bytes agree | Change a manifest without regenerating INDEX | One `index-drift` with HEAD expected/actual digest pair |

Add negative controls for duplicate occurrences (adding a second identical span
adds ordinal 1), delete+recreate at the same path (new lineage), rename below the
50% threshold (new lineage), a tracked symlink escape (does not resolve through
the host), and a malformed assertion (ignored as prose, not partially parsed).

## CLI/service placement and policy wiring

Follow the Image family shape documented at
`goals/knowledge-surface-automation/research/cli-ground-truth.md:242-269`:
`Knowledge.schemas.ts`, `Knowledge.errors.ts`, `Knowledge.service.ts`,
`Knowledge.command.ts`, and `index.ts`; add Root/package exports. The command
handler only decodes flags, obtains `KnowledgeService`, executes, and renders.
Archive/Git helpers extend `src/internal/repo-run/GitExec.ts`.

Insert this exact step after `lint:roadmap-refs` and before `goals:doctor` in
`rootRepoLintPolicySteps`:

```ts
repoCliStep(repoRoot, "knowledge:semantic-delta", ["knowledge", "semantic-delta"])
```

Keep `goals:index-check` as a direct defense and local repair hint even though
semantic-delta also compares archive-local INDEX bytes. Update the exact ordered
label test noted at
`goals/knowledge-surface-automation/research/cli-ground-truth.md:320-335`.
Because this is a top-level Knowledge command, the lint-subcommand fast-path
allowlist in `bin-main.ts` does not need another entry.

## Open questions for the P2 grill

These do not reopen paired archives, no-baseline Stage 1, or the identity
normalization above.

1. Should Stage 1 remain live-guidance-only, or should selected archival command
   blocks opt back in before Stage 2 has historical-with-commit classification?
2. Which fenced shell blocks are executable documentation in Stage 2, and what
   exact fence-scoped generated-example marker is allowed?
3. Should command probes validate only command paths as ratified, or should a
   later class separately validate documented option names without executing?
4. Is `--base` user-configurable, and what explicit CI behavior is required for
   shallow clones whose local `origin/HEAD` or merge-base is absent?
5. Should `index-drift` remain one whole-file digest finding or graduate to
   producer-semantic row findings once Mermaid is part of INDEX?
6. When Stage 2 mints persistent keys, is durable document identity supplied by
   inline `beep:ref`, a sidecar map, Git lineage/tombstones, or a measured hybrid?
7. What false-positive ceiling permits promotion of additional extraction forms
   from report-only to blocking?
