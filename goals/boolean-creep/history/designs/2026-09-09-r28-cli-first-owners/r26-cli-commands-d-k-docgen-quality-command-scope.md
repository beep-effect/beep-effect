# Instance

- id: `r26-cli-commands-d-k-docgen-quality-command-scope`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:778`
- symbol: `docgenQualityCommand`
- members: `package`, `all`, `changedFiles`
- evidence:
  - E2 at `internal/quality/Quality.scope.ts:107-154` — after rejecting more
    than one selected scope, the resolver returns exactly package, all,
    changed-files, or default affected scope.

`Docgen.command.ts:778-796` establishes ownership: the named Command carrier
parses the package Option and both Boolean flags together and passes them to the
scope resolver. That ownership fact is not a separate E3 claim; qualification
rests on the resolver's exclusive read and rejection behavior.

The earlier `docgen-quality-scope-flags` ID named the now-withdrawn anonymous
function-parameter record. This ID names the surviving `Command.make`
declaration and must not reuse the withdrawn ID. Formal P3 remains pending.

# Current shape

`docgenQualityCommand` parses eight fields. The scope cluster is the optional
`--package` selector plus default-false `--all` and `--changed-files`. The
independent `--check` and `--json` flags remain the existing D1 output/failure
cluster; output path, score mode, and packet limit are separate payload/policy
inputs.

The handler passes raw scope fields to `resolveDocgenQualityTargets`. That
exported resolver first runs `assertNoOrphanDocgenConfigPaths`, then counts
selected scope inputs and fails with the exact DomainError when more than one
is selected. It next prioritizes the now-validated alternatives:

- Some package resolves exactly that workspace package;
- `all` selects every configured package;
- `changed-files` selects packages touched only by worktree TypeScript changes;
- no explicit scope defaults to affected files from `origin/main...HEAD` plus
  the worktree.

The resolved report already uses the canonical four-value
`DocgenQualityScopeMode` LiteralKit at `Quality.schemas.ts:49-70`. Package
selection additionally needs its selector payload while the other three cases
are payload-free.

# Cardinality gap

The r26 raw 4/3 count covers only `all,changedFiles` and is incomplete. The
named command carries package presence too. Coarsening the selector Option to
None/Some gives `2³ = 8` representable combinations and exactly four valid
scope inputs:

| Package | All | Changed files | Resolved scope |
| --- | --- | --- | --- |
| None | false | false | `affected` |
| Some(selector) | false | false | `package(selector)` |
| None | true | false | `all` |
| None | false | true | `changed-files` |

The other four combinations select two or three scopes and receive the same
DomainError. The package string remains payload rather than multiplying finite
cardinality. It may still fail later in `resolveDocgenWorkspacePackage`; do not
conflate selector validity with scope coherence.

Do not multiply this carrier by `check`, `json`, output presence, score mode, or
packet-limit values. Those members have independent readers and legal cross
products with every valid scope. The inventory contract permits independently
adjudicated clusters within one declaration.

# Target schema

Reuse the existing `DocgenQualityScopeMode` LiteralKit to derive one tagged
scope selection with a package payload:

```ts
export const DocgenQualityScopeSelection = DocgenQualityScopeMode.toTaggedUnion("scope")({
  affected: {},
  package: { selector: S.String },
  "changed-files": {},
  all: {},
}).pipe(
  $I.annoteSchema("DocgenQualityScopeSelection", {
    description: "Validated target selection for one docgen quality command.",
  })
);
export type DocgenQualityScopeSelection = typeof DocgenQualityScopeSelection.Type;
```

Resolve the three raw CLI fields once, after the existing orphan-config check,
into this union. Match the union exhaustively for target discovery. The report
continues to receive the existing string `scope` member, not the selection
object, so its JSON contract does not change.

Retain the raw flags at the Effect CLI parsing boundary because the public CLI
syntax and mutual-exclusion error must remain exact. Do not add another literal
family, duplicate package presence as a Boolean, or return raw scope flags from
the resolver.

# Migration inventory

- `Docgen.command.ts:81-85,131-145` — preserve `--package`/`-p`, `--all`, and
  `--changed-files`, including Option/default-false decoding and descriptions.
- `Docgen.command.ts:748-776` — preserve quality output-path inference: only an
  explicit single package gets the default package-local output path; other
  scopes print unless `--output` is present.
- `Docgen.command.ts:778-796` — retain the named command fields and public CLI
  grammar; pass the raw boundary values to the one validated scope resolver.
- `Docgen.command.ts:798-819` — preserve empty-target early return, negative
  packet-limit validation order, analysis inputs, JSON/Markdown selection,
  output emission, and check failure behavior.
- `internal/quality/Quality.schemas.ts:35-70` — reuse
  `DocgenQualityScopeMode`; derive the payload-bearing selection from it rather
  than introducing another four-string LiteralKit.
- `Quality.schemas.ts:543-570` — retain the emitted report's literal `scope`
  field and all schema-version/encoded report fields.
- `internal/quality/Quality.scope.ts:23-75` — preserve changed-file commands,
  tolerant worktree-probe behavior, affected-scope origin/main failure text,
  package selection, sorting, and `countSelectedScopes` semantics during the
  boundary conversion.
- `Quality.scope.ts:107-122` — keep `assertNoOrphanDocgenConfigPaths` before the
  scope-conflict error and preserve the exact error message. Produce the tagged
  selection only after this validation.
- `Quality.scope.ts:124-154` — replace Option/Boolean branching with an
  exhaustive selection match. Preserve package resolution before configured
  package discovery; preserve affected/changed-files collection differences.
- Direct `resolveDocgenQualityTargets` examples/tests — preserve the current
  raw input signature as the internal compatibility boundary. It must run the
  same orphan check and raw validation before delegating to a private resolver
  that accepts `DocgenQualityScopeSelection`. Update its JSDoc implementation
  detail only; the documented invocation remains valid.

# Guard-deletion accounting

Delete downstream reads of `packageSelector`, `all`, and `changedFiles` after
scope resolution. Delete the package branch, all branch, and changed/affected
ternary from target discovery; the tagged selection exhaustively owns them.

The raw `countSelectedScopes > 1` check remains once at the CLI compatibility
boundary because invalid flag combinations must still be accepted by parsing
and rejected with the current DomainError. Do not recreate the three inputs in
a helper result. The package case owns its selector, and the three payload-free
cases carry no dummy Option.

# Encoded-side impact

None. CLI flags remain `--package`, `--all`, and `--changed-files`; aliases,
defaults, conflict acceptance by the parser, and DomainError text remain exact.
The target selection is transient and is not written to disk.

Quality report JSON keeps the existing four `scope` strings and every other
field. Markdown/JSON rendering, output-file inference, check exit behavior,
packet generation, and public schema version remain unchanged. Package strings
are passed byte-for-byte into existing package resolution.

# Test impact

Extend `packages/tooling/tool/cli/test/docgen.test.ts` with an eight-row raw
scope table through `Command.runWith`:

- no flags resolves affected;
- each single explicit scope resolves affected/package/all/changed-files as
  appropriate and produces the same report scope;
- all three pairwise conflicts and the triple conflict fail with
  “Choose only one docgen quality scope: --package, --all, or
  --changed-files.”;
- conflict validation still occurs after orphan-config validation and before
  package discovery, git probing, analysis, output writes, or packet-limit
  validation.

Retain changed-file selection coverage at `docgen.test.ts:2955-3012`, negative
packet-limit behavior at lines 3714-3764, JSON/Markdown output, check mode, and
default package output tests. Add direct exhaustive matching/constructor tests
for all four selection cases without snapshots that merely mirror the schema.

# Risk and sequencing

Tier 1 internal command-state migration. The main risks are moving the scope
error ahead of the orphan-config check, changing package-local output-path
inference, or flattening independent `check/json` behavior into the scope.

Run focused docgen CLI tests, package verification, and the repository-required
checks during implementation. Formal P3 must
confirm full 8/4 cardinality and the compatibility-wrapper/error order.

# Qualification recommendation

Promote `r26-cli-commands-d-k-docgen-quality-command-scope` with members
`package,all,changedFiles`, cardinality 8/4, `storage=stored`,
`exposure=internal`, `targetShape=tagged-union`, and Tier 1. Correct the raw
4/3 count and LiteralKit target: the existing LiteralKit supplies tags, but the
package alternative requires a tagged payload. Do not revive the withdrawn
anonymous-function ID.
