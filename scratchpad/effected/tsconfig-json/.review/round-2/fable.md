<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the tsconfig-json port read-only against the pinned upstream oracle and the round-1 inventory, and I won't repeat closed items.### fable-2-1
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:358
- class: bug   severity: required
- standard: D9 / section 14; upstream `TsEnumCodec.ts` `encodeCompilerOptions` (`Option.isSome` passthrough). The ledger coverage row for `TsEnumCodec.ts:359` claims the deleted fallback had no behaviour change.   evidence: `O.getOrThrow` is `getOrThrowWith(() => new Error("getOrThrow called on a None"))` (`effect/src/Option.ts:1092`). `encode("target", "es9999")` is `None` (lab test at `TsEnumCodec.test.ts:143`). Upstream left that string in place. The retained comment at `TsEnumCodec.test.ts:197-201` says hand-built options bypass schema and are valid input. `decodeCompilerOptions` in the same file still keeps unmappable numbers (`TsEnumCodec.ts:377-378`). The class doc at `TsEnumCodec.ts:393` still says lookups never throw.
- failure: `encodeCompilerOptions({ target: "es9999" })` throws `Error: getOrThrow called on a None`. Upstream returns `{ target: "es9999" }`. Schema-decoded literals still encode; this is the public bypass the tests already document.
- fix: Restore `const encoded = encode(family, value); if (O.isSome(encoded)) result[key] = encoded.value`. Do not throw.

### fable-2-2
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:364
- class: bug   severity: required
- standard: D9 / section 14. Ledger coverage row for `TsEnumCodec.ts:365` says the non-string `lib` fallback was unreachable and behaviour-preserving.   evidence: Upstream mapped `typeof entry === "string" ? file-name : entry`. The lab always calls `normalizeLibReference`, which calls `slice` / `startsWith` / `endsWith` (`TsEnumCodec.ts:230-232`). `decodeCompilerOptions` still keeps non-string `lib` entries (`TsEnumCodec.ts:384`). The same test comment documents schema bypass via `deliberatelyInvalid`.
- failure: A non-string `lib` entry throws `TypeError` inside `normalizeLibReference`. Upstream copied the entry through. File-name encoding of real strings is unchanged.
- fix: Restore the `P.isString` guard around `normalizeLibReference` on encode, matching decode.

### fable-2-3
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:163
- class: bug   severity: required
- standard: D9 / section 14. The function comment at `ResolvedTsconfig.ts:149` still says non-string values pass through (forward tolerance). Ledger coverage rows for lines 163 and 169 call those guards unreachable.   evidence: `typeRoots` / `rootDirs` do `value.map(transform)` with no element check (`ResolvedTsconfig.ts:163`). `paths` values do `arr.map(transform)` with no `A.isArray` check (`ResolvedTsconfig.ts:168-170`). `transform` is `startsWithConfigDir`, which calls `value.slice` (`ResolvedTsconfig.ts:72-73`). Upstream kept non-strings and non-array `paths` values. `absolutize` / `substituteConfigDir` do not re-decode.
- failure: `absolutize({ compilerOptions: { typeRoots: [1] } }, dir, join)` throws `TypeError` on `slice`. A `paths` value that is not an array throws on `.map`. Upstream left both untouched. String paths still absolutize.
- fix: Restore the upstream per-entry `P.isString` map and the `A.isArray` guard inside `rebuildRecord`.

### fable-2-4
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:332
- class: bug   severity: required
- standard: D9 / section 14. Ledger coverage row for `ResolvedTsconfig.ts:332` records the same “unreachable, no behaviour change” claim.   evidence: `substituteWatchExcludes` maps every `excludeDirectories` / `excludeFiles` element through `substitute` (`ResolvedTsconfig.ts:331-332`). `substitute` calls `startsWithConfigDir` → `slice`. Upstream used `typeof entry === "string" ? substitute(entry) : entry`. `files` / `include` / `exclude` never had that guard upstream; this one did.
- failure: A non-string watch-exclude entry throws `TypeError` during `substituteConfigDir`. Upstream copied it through. String entries still substitute.
- fix: Restore the per-entry `P.isString` check before `substitute`.

REQUIRED: 4
BACKLOG: 0
