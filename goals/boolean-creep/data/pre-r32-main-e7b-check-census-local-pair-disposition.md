# Supplemental local-pair disposition

**Add a D1 record for the existing `hasCheckOverlay` local pair.** The prior audit correctly established four legal observations but gave an unsupported reason for omitting the record. Its statement that no canonical D1 row was proposed because the pair is transient and absent from a scanner report is superseded by this supplement. The original bundle remains sealed, and its separate compilerOptions D2 replacement remains valid.

The frozen SPEC.md:33-38 defines the recall net as at least two Boolean-typed members in one scope and requires D1/D2 suspects to be recorded. DECISIONS.md:18-23 uses the same at-least-two-Booleans/scope rule, with function flag parameters excluded. Neither file excludes an actual sibling local result pair because it is transient or has not appeared in a scanner report. SPEC.md:39-40's exclusions do not supply that missing rule. Treating the example scope forms as a blanket ban on local facts would introduce a narrower rule than the stated net. This actual pair should enter the net and receive the source-supported D1 disposition.

The exact owner is `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts:752`: `const [overlay, build] = yield* Effect.all([...])`. Both members are Booleans returned by independent `FileSystem.exists` operations for two distinct paths (source:753-754; frozen installed FileSystem.ts:140-145). The enclosing function's parameter `dir` is a string (source:747-749), so the function-flag-parameter exclusion does not apply. `kind: sibling-state` represents this sibling result scope in the existing inventory kind vocabulary; it does not claim that the pair is persisted or stateful across calls.

| overlay | build | Concrete observation | Selection result |
| --- | --- | --- | --- |
| false | false | Neither tsconfig path exists | false |
| false | true | Only canonical tsconfig.json exists | false |
| true | false | Only tsconfig.check.json exists | false |
| true | true | Both paths exist | true |

All four are legitimate filesystem observations, including incomplete package configuration. The selector intentionally rejects the first three. Rejection from package selection does not make an observation an illegal domain state. Failed existence effects fall back to false independently, preserving the same finite observation domain. There is no exclusivity or implication between the observations, and the reader handles the combined-true case directly. This proves D1 under DECISIONS.md:124-125: independently observed facts, 4 representable / 4 legal.

The only reader of this local pair is the conjunction at source:757. `selectCheckCensusPackages` consumes the resulting Boolean through Effect.filter at source:801; the complete caller is source:783-802. No pair payload is exported, encoded or persisted. No guard can be deleted on Boolean-creep grounds: the conjunction performs the required package selection. This supplements census coverage without qualifying a design, adding an operation union or changing the report/wire boundary.

`proposed-row.jsonl` adds id `check-census-package-config-presence`, with members overlay/build, line 752 and D1. The id has no R32 prefix because this is a bounded source-forward correction, not a new census result. It does not duplicate the existing compilerOptions D2 row, which owns six different flags in a different scope. The captured 751-row inventory has neither this id nor this file/symbol/member cluster. If appended to that frozen inventory alone, the result would be 752 rows / 145 qualified; the parent's live integration already includes other changes, so no current total or complete replacement inventory is asserted here. Parent should reconcile and append the one row against its integration.

All substantive source and rule evidence was copied from the verified prior manifest. This supplement neither reacquires a source hold nor reopens the prior audit. It grants no census-round, dry-round, P3 or implementation credit. Only the omission rationale changes; no source, canonical inventory, design, dependency, config, index or ref is edited.
