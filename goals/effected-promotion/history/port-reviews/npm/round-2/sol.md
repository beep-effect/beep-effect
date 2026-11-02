### sol-2-1
- file: scratchpad/effected/npm/Manifest.ts:431
- class: bug   severity: required
- standard: D9; section 14, verified upstream bug; Manifest’s dependency-map preservation contract.   evidence: Read-only probes against both the reviewed commit and the pinned oracle decoded `{"dependencies":{"__proto__":"1.0.0","p":"1.2.3"}}`. Before resolution, `toRecord()` preserved both dependency keys; after resolution with the two no-op resolver layers, it returned `{"dependencies":{"p":"1.2.3"}}`. The assignments at lines 410, 428 and 431 write into the ordinary object created at line 403. This is new evidence from the resolution path; round-1 `npm-1` fixed the separate unknown-field wire-decoder path.
- failure: `Manifest.resolve()` silently deletes an own `__proto__` dependency entry, including a concrete specifier that needs no resolution. Assignment invokes the inherited prototype setter instead of creating an own property.
- fix: Accumulate resolved dependency entries and construct each section with `effect/Record.fromEntries`. Add a regression asserting that resolution preserves the complete dependency map, including its own `__proto__` key, and record this additional upstream-bug correction under section 14.

### sol-2-2
- file: scratchpad/effected/npm/IntegrityHash.ts:512
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11.   evidence: The reviewed commit still uses direct native string helpers in the integrity-conversion path: `value.startsWith`, `value.endsWith` and `value.slice` at line 512, followed by `startsWith`/`slice` at lines 520–521 and `slice` at line 530. Additional instances remain in algorithm extraction and base64 parsing. The installed `effect/String` module exposes equivalent helpers. These concrete sites remain despite the reported green gates and were not the sites closed by round-1 `npm-28` through `npm-31`.
- failure: Production integrity parsing and conversion retain the direct native string-helper form that EF-5 requires replacing.
- fix: Replace the remaining native string calls with equivalent `effect/String` helpers, preserving separator handling, quote unwrapping and strict base64 validation. For `Str.indexOf`, preserve the existing missing-index behavior through its `Option` result.

### sol-2-3
- file: scratchpad/effected/npm/ReleaseAgeGate.ts:102
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11.   evidence: The reviewed commit’s `matchesPattern` calls `pattern.includes("*")` directly. `effect/String` is already imported as `Str`, and the installed module provides `Str.includes`. The call remains despite the reported green gates; the recorded date-parsing and finite-number deviations do not authorize this helper exception.
- failure: The release-age exclusion matcher retains a direct native string helper in domain logic.
- fix: Replace `!pattern.includes("*")` with `!Str.includes("*")(pattern)`, preserving the existing matching behavior.

REQUIRED: 3
BACKLOG: 0