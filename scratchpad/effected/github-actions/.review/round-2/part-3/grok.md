I'll review this github-actions slice against the pinned upstream oracle and the round-1 inventory, and report only new findings. First I'm loading the binding decisions, prior inventory, and the files in scope.Round 1 is already dispositioned. I'll review the current slice for new defects and compare it only with the pinned oracle.### grok-2-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:451
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the manifest is attacker-supplied (readPackageManifest, lines 688–692)   evidence: `posixShim` and `cmdShim` interpolate the bin target inside double quotes (`exec node "${target}"` / `node "${target}"`). `readPackageManifest` only rejects a resolved path whose `path.relative` is `..`, starts with `..${sep}`, or is absolute. A relative target such as `bin/x"$(id).js` stays inside the package directory, passes `assertFile` when the tarball contains that name, and is written by `writeShims` at line 797. The resulting shim is `exec node "/cache/.../bin/x"$(id).js" "$@"`, which runs `id` when the shim runs. The same hole exists upstream (`posixShim` / `cmdShim` at the pinned oracle). `"` , `$`, backticks, backslash, and newlines are special inside POSIX double quotes; `"` and `%` are special in the cmd shim.
- failure: A package whose `bin` target is still inside the extracted tree can break out of the shim quotes and run shell commands when the installed command is invoked.
- fix: Reject a bin target that contains POSIX or cmd metacharacters (`"`, `$`, `` ` ``, `\`, newlines, `%`) with the existing `layoutUnexpected` error before any shim is written. Leave the shim templates unchanged so benign shim bytes stay the same. Add a regression in `PackageManagerInstaller.test.ts` whose target stays inside the package and whose install fails before `writeFileString`. Record the verified upstream bug centrally.

### grok-2-2
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:35
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); containment added for r21 still claims every shim lands inside `.bin`   evidence: `BinName` is `/^(?!\.{1,2}$)[^/\\:\x00]+$/`, so `NUL`, `CON`, `PRN`, `AUX`, and `COM1`–`COM9` / `LPT1`–`LPT9` pass. On Windows `shimFileName` appends `.cmd` (line 542). Win32 treats `NUL.cmd` and `CON.cmd` as device names, and `fs.writeFile` of those paths succeeds without creating a file under `.bin`. `validateShimDestinations` (lines 639–648) only checks `path.relative` after `path.resolve`, which still reports `.../.bin/NUL.cmd` as inside `.bin`.
- failure: On Windows an accepted bin name makes the installer report success while the shim is not a file in `.bin`.
- fix: When `windows` is true, reject a shim filename whose stem before the first dot is a reserved device name (`con`, `prn`, `aux`, `nul`, `com[1-9]`, `lpt[1-9]`, case-insensitive) with the existing `layoutUnexpected` error. Keep the check off the POSIX path so ordinary filenames are unchanged. Add a Windows-name regression next to the r21 escaping-bin case. Record the verified upstream bug centrally.

### grok-2-3
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:508
- class: bug   severity: required
- standard: D11; section 14 (`upstream-bug`); same assignment rule round-1 r2 demonstrated for accepted keys   evidence: `normalizeBins` copies manifest entries with `entries[name] = value`. `R.toEntries` is `Object.keys`, and `JSON.parse` defines an own enumerable `__proto__` via `CreateDataProperty`. The ordinary assignment hits `Object.prototype.__proto__`'s setter, which ignores a string (ECMA-262 B.2.2.1.2) and creates no own property. `BinName` allows `__proto__`. A manifest whose only bin is that key returns `O.none()` and the install fails with "package.json names no bin". A manifest that also has a normal bin succeeds and omits `__proto__`. `R.fromEntries` is `Object.fromEntries`, which does define the own property. Upstream uses the same assignment.
- failure: A string bin name the new filename grammar accepts is dropped, so the installed bin map is not the manifest's accepted map.
- fix: Build the bin record with `R.assignProperty` or `R.fromEntries` instead of property assignment. Keep the string-value and empty-map failures. Add an own-property regression for a `__proto__` bin plus a normal bin in `PackageManagerInstaller.test.ts`. Record the verified upstream bug centrally.

### grok-2-4
- file: scratchpad/effected/github-actions/Secret.ts:106
- class: bug   severity: required
- standard: D11; section 14 (`upstream-bug`); `Secret.forChildEnv` returns one plaintext entry per input key (lines 99–107). Round-1 r2 showed `record[key] = string` does not create an own `__proto__` property   evidence: The loop is `for (const [name, secret] of R.toEntries(entries)) { ... declassified[name] = plaintext }`. `R.toEntries` yields an own `__proto__` key. The assignment does not create that own property, and the effect still succeeds. Masking of that secret has already run. Upstream `Object.entries` plus the same assignment does the same thing.
- failure: `forChildEnv` succeeds with a record that is missing an accepted key, so the child environment does not contain that variable.
- fix: Use `R.assignProperty(declassified, name, plaintext)`. Add an own-key regression for `__proto__` beside a normal name in `Secret.test.ts`. Record the verified upstream bug centrally.

### grok-2-5
- file: scratchpad/effected/github-actions/internal/jwt.ts:60
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 and the Schema section (decodeResult only for non-throwing paths); standards/effect-laws-v1.md law 21. Round-1 r5–r8 required this shape elsewhere; c4 only records the SchemaError cause. The green `terse-effect` gate still misses `getOrThrowWith((error) => error)` (round-1 r19).   evidence: `payloadOf` does `try { return Result.succeed(Result.getOrThrowWith(S.decodeResult(Json)(json.success), (error) => error)) } catch (cause) { ... }`. The `Result` is already a failure; the `catch` exists only to receive that same `SchemaError`. `unsignedJwt` at line 88 repeats the identity lambda around `S.encodeResult`.
- failure: Payload decoding throws on the failure path of a non-throwing codec, and both sites use the identity wrapper law 21 rejects.
- fix: In `payloadOf`, branch on `Result.isFailure` and put `decoded.failure` in the existing `cause` field so the `SchemaError` cause stays. In `unsignedJwt`, call `Result.getOrThrow` so a non-encodable fixture still throws that same `SchemaError`. Keep the segment and base64url failures. Add no `JSON.parse`.

### grok-2-6
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:676
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 and the Schema section (Result codecs are for non-throwing paths). c7 keeps the `P.hasProperty` guards and the typed `layoutUnexpected` / `integrityMismatch` results; it does not keep a throw-to-catch around `decodeResult`. The same gate miss as grok-2-5.   evidence: `readPackageManifest` (lines 676–679) and `registryIntegrity` (lines 899–902) both use `Effect.try({ try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error), catch })`. `S.decodeResult` does not throw; `getOrThrowWith` throws the `SchemaError` so `Effect.try` can catch it.
- failure: Manifest and packument parsing use the exception channel to branch on a `Result` the function already has.
- fix: Branch on `Result.isFailure` (or `S.decodeEffect` plus `Effect.mapError`) and pass `decoded.failure` as the existing `cause`. Keep both error subjects, the `P.hasProperty` reads, and the null/primitive outcomes c7 already recorded.

### grok-2-7
- file: scratchpad/effected/github-actions/internal/unstubbed.ts:57
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (do not `throw` in production domain logic). The tagged-error deviation already requires `UnstubbedMemberError` in the die channel; it does not require `throw`.   evidence: `unstubbed` returns `Effect.sync(() => { throw UnstubbedMemberError.make({ message: ... }) })`. `Effect.die` is the die constructor and carries that same value. No beep law gate flags `throw` inside `Effect.sync`.
- failure: Every unstubbed test double enters the die channel by throwing.
- fix: Return `Effect.die(UnstubbedMemberError.make({ message }))` with the same message string. Keep the defect value tests assert.

REQUIRED: 7
BACKLOG: 0
