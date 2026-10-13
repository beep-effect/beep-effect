<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review those eight workspaces files against the pinned upstream oracle and the round-1 inventory, then report only new findings.Round 1 already closed several schema and sort issues on these files. I'll read the rest of that inventory and the decision rules, then compare the current sources with the oracle.I'll finish the read-only review of those eight files against the pinned oracle and the round-1 inventory, then report only new findings.### fable-2-1
- file: scratchpad/effected/workspaces/LockfileReader.ts:323
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native `Map` in domain logic); EFFECTED_PORT_GOAL.md D5 and D11; allowlist contract (no scanner-miss entries). Round-1 r24 closed the same escape in `internal/roots.ts`, `PeerCheck.ts`, and `DuplicateCheck.ts`.
- evidence: After building `MutableHashMap<string, string>`, the pnpm importer stage returns `lockfile.withImporterNames(names.backing)`. `backing` is the native `Map` field on `MutableHashMap` (`packages/effect/src/MutableHashMap.ts:67` in the Effect reference). `NoNativeRuntime.ts:390-397` reports only `new Map` / `new Set` constructor calls, so this property read stays invisible to the green law gate. This is the only `.backing` access under `scratchpad/effected/workspaces`. `Lockfile.withImporterNames` (`scratchpad/effected/lockfiles/Lockfile.ts:395-421`) only calls `names.get`, and string keys are simple keys, so today’s renames match an upstream `Map`. The README native-runtime deviation records that native maps were replaced. It does not record this remaining escape.
- failure: Domain code still hands a native `Map` across the lockfile boundary. The module stays green only because the checker never sees `.backing`.
- fix: Stop reading `.backing`. Widen `Lockfile.withImporterNames` to take `MutableHashMap<string, string>` (or a structural `get`) and look names up with `MutableHashMap.get`. Pass `names`. Do not add an allowlist entry and do not construct `new Map`.

### fable-2-2
- file: scratchpad/effected/workspaces/PackageManagerName.ts:650
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named domain constraints are schemas; derive guards with `S.is`); D11. Same class as closed round-1 r09. `LiteralKit.is` is a per-member guard object (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:179-183`), so the union guard is `S.is(PackageManagerName)`.
- evidence: `PackageManagerName` is the named `LiteralKit(["npm", "pnpm", "yarn", "bun"])` at line 47. `declaredName` returns `O.Option<string>` because `ManagerHint.name` is `S.String` (lines 172-175, 509-516). The declaration tier then re-spells the domain: `name === "pnpm" || name === "npm" || name === "yarn" || name === "bun"`. Upstream has the same chain (`PackageManagerName.ts:464` in the pinned oracle). For the current four literals, `S.is(PackageManagerName)(name)` accepts and rejects the same strings, so D9 behavior stays put.
- failure: Membership in the named manager domain is a hand-written literal chain. A later literal added only to `PackageManagerName` is ignored here, and a manifest that declares it falls through to `PackageManagerDetectionError`.
- fix: Replace the chain with `if (S.is(PackageManagerName)(name))`. Keep the runtime ternary and the devEngines-first evidence selection.

REQUIRED: 2
BACKLOG: 0
