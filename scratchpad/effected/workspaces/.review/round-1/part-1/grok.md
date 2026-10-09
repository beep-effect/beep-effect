I'll review those eight workspaces files against the pinned upstream oracle and the port decisions, and report only findings. First I'm loading the binding decisions, the ledger, and the focus files.The review target is a named scratchpad slice, so I'll read those files and the pinned upstream copies directly and check the ledger for already-accepted deviations.The four gated laws are already green, so I’m comparing these files to the pinned upstream for behaviour and for law gaps those gates do not check.The review is still open. I am checking the two named literal domains and the stale `read()` docs against the laws before I write findings.Law 19 names `LiteralKit` for annotation-bearing domains. I am checking how those two schemas are used and whether anything else in these files still diverges from the oracle.### grok-1-1
- file: scratchpad/effected/workspaces/PackageManagerName.ts:36
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5 (kits land in S4); schema-first-development fast rule for named literal domains   evidence: `PackageManagerName` is an exported, annotation-bearing schema (`$I.annoteSchema`), referenced by name (`PackageManagerName.annotateKey` at line 113, the same-name type alias at line 43, and `PackedInstall`). Ledger kind is already `both`. `S.Literals` is the form law 19 reserves for an anonymous union that is never named.
- failure: The named manager domain has no `LiteralKit` surface (`.Enum`, `.is`, `$match`, `.toTaggedUnion`). Decoded members stay `"npm" | "pnpm" | "yarn" | "bun"`, so this is an idiom gap, not a behaviour change.
- fix: `import { LiteralKit } from "@beep/schema/LiteralKit"` and replace `S.Literals([...])` with `LiteralKit([...])` (no `as const` on the array). Keep `.pipe($I.annoteSchema(...))` and the `typeof PackageManagerName.Type` alias. Leave the inline `runtime` field at line 117 as `S.Literals`.

### grok-1-2
- file: scratchpad/effected/workspaces/PackageManagerName.ts:63
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5; schema-first-development   evidence: `PackageManagerEvidence` is the same kind of named domain: exported, `$I.annoteSchema`, referenced at line 119, and read as `PackageManagerEvidence.literals` at line 209. Ledger kind is `both`. `LiteralKit` inherits `.literals`, so that call stays valid.
- failure: The probe-marker vocabulary is a named annotation-bearing schema built with `S.Literals`, so callers do not get the kit helpers law 19 requires for a domain referenced by name.
- fix: Same substitution as grok-1-1: `LiteralKit([...])` with the existing `$I.annoteSchema` pipe and the `typeof PackageManagerEvidence.Type` alias. Do not add `as const`.

### grok-1-3
- file: scratchpad/effected/workspaces/LockfileReader.ts:97
- class: jsdoc   severity: backlog
- standard: operator order for this round (S2 has not run; JSDoc findings stay backlog); the shape at line 88   evidence: `LockfileReaderShape.read` is `Effect.Effect<Lockfile, LockfileReadFailure>`. The remark still says callers should read `lockfile.packagesNamed(name)` off `` `read()` ``. The `makeTest` remark at line 329 repeats `` `read()` ``.
- failure: A reader who follows the remark writes `reader.read()`, which does not typecheck. Running the effect is `yield* reader.read`.
- fix: In both remarks, describe `` `read` `` as the effect value. Leave the `unstubbed("read")` die text alone; the double tests assert that string.

REQUIRED: 2
BACKLOG: 1
