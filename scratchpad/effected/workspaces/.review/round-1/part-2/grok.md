I'll review those six workspaces files against the pinned upstream oracle and the port decisions, and report only findings. First I'm loading the binding decisions, port notes, and the files themselves.The seat is Grok, round 1. Next I’ll compare the six files with the pinned upstream and the recorded port notes.The remaining behavioural diffs are `carrierCommand` and the SourceBoundary fixtures. I will finish those against the pinned oracle, then apply D11 to anything that still looks like a finding.### grok-1-1
- file: scratchpad/effected/workspaces/ReleaseTag.ts:28
- class: schema   severity: required
- standard: D5; schema-first fast rule (named literal domains are `LiteralKit`; `S.Literals` only for an anonymous inline union never referenced by name). `schemaUnionOfLiterals` only flags `Schema.Union` of `Schema.Literal` members, and schema-first lint scans `packages/**`, so neither gate sees this.
- failure: `TagStyle` is an exported literal domain built with `S.Literals`. It decodes the same two strings as upstream and has no `.Enum`, `.is`, or `.$match`. `jsonc` (`NavigateContainer`) is the D5 bar and uses `LiteralKit`.
- fix: `import { LiteralKit } from "@beep/schema/LiteralKit"` and `LiteralKit(["single", "scoped"]).pipe($I.annoteSchema("TagStyle", { description: "..." }))`. Keep `export type TagStyle = typeof TagStyle.Type`. Decode stays the same.

### grok-1-2
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:36
- class: schema   severity: required
- standard: D5; schema-first fast rule, same gate gap as grok-1-1.
- failure: `VersioningStrategyType` is an exported literal domain (`"single" | "fixed-group" | "independent"`) built with `S.Literals`, then used as the `type` field. Callers get no kit helpers. Classification results are unchanged.
- fix: Same swap as grok-1-1: `LiteralKit(["single", "fixed-group", "independent"]).pipe($I.annoteSchema(...))`. Leave the `type` field pointing at that const.

### grok-1-3
- file: scratchpad/effected/workspaces/PeerCheck.ts:93
- class: schema   severity: required
- standard: schema-first development, "Derive behavior instead of duplicating truth" and the named-domain `LiteralKit` rule; D5. D2 parity stays green: `exportKindCovers("both", "type")` is true.
- failure: `UnverifiedReason` is a hand-written four-string union, and `PeerCheck.unverified` repeats those strings as `S.Literals` at line 709. The copies match today. Adding a reason to one side does not update the other, so `PeerCheck.make` and the push sites can disagree.
- fix: One `LiteralKit` of the four strings, exported under the same name, `export type UnverifiedReason = typeof UnverifiedReason.Type`, and use that kit as the `unverified` element schema. No new reason, no new decode.

### grok-1-4
- file: scratchpad/effected/workspaces/SourceBoundary.ts:110
- class: schema   severity: required
- standard: D5; schema-first fast rule (`S.Literals` is for an inline union never referenced by name). `OffenceRule` at line 136 is that name. Parity accepts widening the type-only export to `both`.
- failure: The seven offence rules live in an anonymous `S.Literals`, and `export type OffenceRule = Offence["rule"]` only re-exports the decoded union. The public domain has no `.is` or `.Enum`. `scan` and `check` still emit the same rule strings.
- fix: `export const OffenceRule = LiteralKit(["process", "node:process", "stdout-write", "console", "console-stdout", "forbidImports", "forbidTokens"]).pipe($I.annoteSchema(...))`, `export type OffenceRule = typeof OffenceRule.Type`, and set `Offence.rule` to that kit.

### grok-1-5
- file: scratchpad/effected/workspaces/SourceBoundary.ts:106
- class: docs   severity: backlog
- standard: D9 and section 14; `effect(schemaNumber)` (`Schema.Number` accepts `NaN`, `Infinity`, and `-Infinity`). `jsonc` records the same swap. The round brief ranks docs backlog.
- failure: Upstream `Offence.line` and `column` are `Schema.Number`. The lab uses `S.Finite`, so `Offence.make` and decode reject non-finite numbers. Scanner output is still finite integers, so `scan` results match. README Port notes say `Deviations: None`, and the `w4-workspaces` ledger `deviations` array is empty.
- fix: Do not revert to `S.Number`. Record `law:tsgo-schemaNumber` on `Offence.line` and `Offence.column` in the ledger and in Port notes → Deviations, with the narrowed input (`NaN` and infinities rejected; every finite number still accepted).

### grok-1-6
- file: scratchpad/effected/workspaces/PackedInstall.ts:46
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy (`@remarks` and `@example` forbidden; exports need `@category` and `@since`). Round brief: S2 has not run, so this stays backlog.
- failure: Exported docs, starting at `PackSource`, still use upstream `@remarks` / `@example` / `@public` and have no `@category` or `@since`. The JSDoc ratchet does not scan `scratchpad/`.
- fix: S2 conversion for this file: `@remarks` becomes `**Details**`, each `@example` becomes `**Example** (Title)`, and each export gains `@category` and `@since 0.0.0`.

### grok-1-7
- file: scratchpad/effected/workspaces/PeerCheck.ts:39
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- failure: `UnverifiedReason` and the other exports in this file still use `@remarks` / `@example` and omit `@category` and `@since`.
- fix: Same S2 carrier conversion as grok-1-6, for this file.

### grok-1-8
- file: scratchpad/effected/workspaces/Publishability.ts:43
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- failure: `PublishabilityDetectorShape` and `PublishabilityDetector` still carry `@remarks` and `@example` blocks (lines 43, 80, 101, 148) without `@category` or `@since`.
- fix: Same S2 carrier conversion as grok-1-6, for this file.

### grok-1-9
- file: scratchpad/effected/workspaces/ReleaseTag.ts:21
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- failure: `TagStyle`, `TrackingTag`, `classifyTag`, and `ReleaseTag` still use `@remarks` / `@example` and omit `@category` and `@since`.
- fix: Same S2 carrier conversion as grok-1-6, for this file.

### grok-1-10
- file: scratchpad/effected/workspaces/SourceBoundary.ts:19
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- failure: `BoundaryRule` and `SourceBoundary` still use `@remarks` / `@example` and omit `@category` and `@since`.
- fix: Same S2 carrier conversion as grok-1-6, for this file.

### grok-1-11
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:27
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` carrier policy; S2 deferred by the round brief.
- failure: `VersioningStrategyType` and `VersioningStrategy` still use `@remarks` / `@example` and omit `@category` and `@since`.
- fix: Same S2 carrier conversion as grok-1-6, for this file.

REQUIRED: 4
BACKLOG: 7
