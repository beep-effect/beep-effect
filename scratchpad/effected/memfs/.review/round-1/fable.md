### fable-1-1
- file: scratchpad/effected/memfs/internal/errno.ts:25
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; AGENTS.md Code Laws ("never a hand-rolled union of literals"); D5 (LiteralKit for literal domains, landed at S4)   evidence: `export type ErrnoCode = "EACCES" | "EBADF" | ... | "ERR_FS_EISDIR"` (15 literals) is a hand-rolled named union referenced by name in errno.ts:42 (`errnoMessages: { readonly [Code in ErrnoCode]: string }`), errno.ts:83-84 (ErrnoException.code), volume.ts:63 and every errnoError call site; none of the four runner laws inspect literal unions, so the gate cannot flag it (`rg -n 'ErrnoCode' scratchpad/effected/memfs`).
- failure: The errno domain has no runtime value: no `.is` guard, no `.Enum`, no annotation carrier, and the schema-first conversion of ErrnoException (fable-1-2) has nothing to validate `code` against; the port misses the D5 end-state bar on its one central literal domain.
- fix: `export const ErrnoCode = LiteralKit(["EACCES", ..., "ERR_FS_EISDIR"]); export type ErrnoCode = typeof ErrnoCode.Type;` keep `errnoMessages` keyed by the type; use `ErrnoCode` as the `code` field schema in the S.TaggedError from fable-1-2. No behaviour change.

### fable-1-2
- file: scratchpad/effected/memfs/internal/errno.ts:83
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 ("extend `S.TaggedError` from `effect/Schema` directly for typed errors"); .patterns/error-handling.md; operator ruling 2026-10-09 (memfs errno errors become an S.TaggedError)   evidence: `export class ErrnoException extends Data.TaggedError("ErrnoException")<{ code; path; message }>` with `this.name = "Error"` in the ctor. `rg -c 'Data\.TaggedError\(' packages --glob 'src/**/*.ts'` = 0: the production codebase has no Data.TaggedError. The native-runtime checker only matches NATIVE_ERROR_CTORS (`new Error`...), so a Data.TaggedError subclass passes the gate. The other five new memfs errors already use S.TaggedError, so this is the one inconsistent carrier.
- failure: The failure `cause` every FileSystem error carries is the only error in the module outside the schema-first carrier: no identity, no field schemas, no `S.is` guard, and it cannot join the planned S.TaggedError errno error (ruling) without a second rewrite.
- fix: `export class ErrnoException extends S.TaggedError<ErrnoException>($I`ErrnoException`)("ErrnoException", { code: ErrnoCode, path: S.optionalKey(S.String), message: S.String }, $I.annoteError<ErrnoException>(...)) { override readonly name = "Error"; }` plus a small `errnoException(code, pathOrDescriptor)` factory that builds the message exactly as today; keep `instanceof ErrnoException` at volume.ts:712,939 and MemoryFileSystem.ts:749,763 (unchanged), and construct at errno.ts:106 and volume.ts:713 through the factory.

### fable-1-3
- file: scratchpad/effected/memfs/internal/ports.ts:153
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native `Object` in domain logic) and law 4 / D15 (no type assertions); operator ruling 2026-10-09 ("not Object.defineProperties, which only evades the law")   evidence: `Object.defineProperty(out, name, { value: async ? ... : intercept })` inside `withFaults` replaces upstream's `(out as Record<string, unknown>)[name] = ...`. The gate missed it: `OBJECT_METHODS` in packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:56-66 lists keys/values/entries/fromEntries/assign/hasOwn/freeze/seal/create only, so `defineProperty` is unscanned while `Object.assign` in errno.ts:123 needed an allowlist entry. The write is a reflective, unchecked member assignment, i.e. the cast D15 removed in a different costume.
- failure: A member write TypeScript cannot check survives the D15 gate; the port's one reflective mutation is also the one the operator named as law evasion, so a later allowlist/checker hardening (`defineProperty` added to OBJECT_METHODS) turns this file red.
- fix: Build the wrapped members as a record and spread: `const wrapped = R.fromEntries(entries.flatMap(([name, handler]) => P.hasProperty(port, name) && P.isFunction(handler) && P.isFunction(port[name]) ? [[name, async ? (...args) => settle(() => intercept(...args)) : intercept]] : []))` then `return { ...port, ...wrapped };` — the generic spread types as `Port & Record<string, unknown>`, assignable to `Port` with no cast and no Object.* call.

### fable-1-4
- file: scratchpad/effected/memfs/README.md:365
- class: law   severity: required
- standard: D9 + section 14 deviation protocol (ledger `deviations` entry first, README Port notes → Deviations, cite the adjusted upstream test); operator ruling 2026-10-09 (one ledger + README entry per module per systemic class, e.g. tagged errors)   evidence: README Port notes say `### Deviations\n\nNone.` and PORT_LEDGER.json row w1-memfs has `"deviations": []`, yet the lab changed observable error types and adjusted upstream tests: `RangeError` → `InvalidFaultCountError` (MemoryFileSystem.ts:1086; FaultInjection.test.ts:307-309 changed from `RangeError`), `RangeError` → `UnknownFaultKeyError` (faults.ts:55; Ports.test.ts:197-206 and Handle.test.ts:299 changed), `new Error` defects → `VolumeInvariantError` (volume.ts:1660,1680), `RangeError`/`new Error`/`TypeError` → `UnsafeIntegerError`/`ReadOnlyFileSystemError`/`InvalidPathArgumentError` (NodeSyncFileSystem.ts:85,129,165; `instanceof TypeError` is now false), and `reason.cause` now carries `_tag: "ErrnoException"` (errno.ts:83). `git diff` of the test files against the oracle shows the retargeted assertions.
- failure: `ledger --verify` and the README both certify "no deviations" for a module whose public error contract changed; the next reviewer and the promotion grill have no record of which upstream tests were retargeted or why (law:beep-laws/no-native-runtime).
- fix: Add one `deviations` entry of class `tagged-errors` to the w1-memfs ledger row (`reason: "law:beep-laws/no-native-runtime"`, listing the five source sites and the three adjusted tests above, plus the `_tag` on ErrnoException) and mirror it under README → Port notes → Deviations.

### fable-1-5
- file: scratchpad/effected/memfs/index.ts:35
- class: law   severity: required
- standard: D2 superset export rule (additions listed under README Port notes → Added exports; ledger `exportsAdded`); .patterns/error-handling.md (typed errors are part of the public contract)   evidence: `InvalidFaultCountError` is `export class` in MemoryFileSystem.ts:49 and thrown by the public `MemoryFileSystem.failTimes`; `UnknownFaultKeyError` is `export class` in internal/faults.ts:36 and thrown by the public `makeFaulty`, `layerFaulty`, `syncFileSystem`, `promisesFileSystem` and `handle.withFaults`. Neither is re-exported from index.ts (`diff` vs upstream index.ts shows only the `.js`→`.ts` rewrite), README says `### Added exports\n\nNone.` and the ledger has `"exportsAdded": []`. Tests reach them by importing MemoryFileSystem.ts and internal/faults.ts directly (FaultInjection.test.ts:19, Ports.test.ts:6).
- failure: A consumer of the entry point can no longer name the error a public API throws (upstream's `RangeError` was a global): `catch (e) { if (e instanceof ...) }` has no importable type, and `S.is` / `Effect.catchTag` on the new tags are impossible from `index.ts`; D2's parity bookkeeping is also false.
- fix: Move `UnknownFaultKeyError` next to `InvalidFaultCountError` in MemoryFileSystem.ts (or re-export it), add both to the `index.ts` export list, list both under README → Added exports and in the ledger row's `exportsAdded`.

### fable-1-6
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:49
- class: schema   severity: required
- standard: Operator step 4 ruling (every schema takes identity from the IdentityComposer "with annotations on fields and schemas"; commit 8683700a9a message: "with an annotation and description, every field carries a description"); .patterns/error-handling.md (`$I.annote` / `$I.annoteError` third argument)   evidence: `rg -c '\.annote\(' scratchpad/effected/memfs` = 0 while every other lab module with tagged errors carries them (jsonl 30, jsonc 15, yaml 26 ...). All six memfs S.TaggedError classes pass only the identity tag and a bare `{ message: S.String }`: MemoryFileSystem.ts:49 (InvalidFaultCountError), internal/faults.ts:36 (UnknownFaultKeyError), internal/volume.ts:68 (VolumeInvariantError), NodeSyncFileSystem.ts:36,40,44 (UnsafeIntegerError, ReadOnlyFileSystemError, InvalidPathArgumentError). They were added in 91dfd36af4 after the memfs step-4 commit (8683700a9a touched only the Volume service key), so step 4 never saw them.
- failure: The module's schema classes have no `identifier`/`title`/`description` annotations and no field descriptions, so JSON Schema / docgen output names them by tag only and the step-4 bar the rest of the kit met is not met here.
- fix: Add `$I.annoteError<X>("X", { description: "..." })` as the third argument to each of the six classes and `$I.annoteKey("X.message", { description })` (and `X.code` for InvalidPathArgumentError) on the fields, following jsonc/JsoncEdit.ts:159-167 and jsonl/JsonlError.ts:72-80.

### fable-1-7
- file: scratchpad/effected/memfs/internal/volume.ts:2010
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 ("No native `Array.prototype.sort`; use `A.sort` with explicit `Order`")   evidence: `rg -n '\.sort\(' scratchpad/effected/memfs --glob '*.ts'` → 13 sites: volume.ts:392, 844, 1220, 1316, 2010, 2029, 2720, 2734, 2947, 2968, 3021, view.ts:35, faults.ts:56. None of the four runner laws (effect-imports, effect-fn, terse-effect, native-runtime) scan `.sort`, so the gate is green on a direct Short Law violation; `effect/Array` is already imported as `A` in volume.ts:23.
- failure: Thirteen in-place native sorts with implicit comparators in the engine's directory listing, glob, watch-event and copy paths, against an authoritative law the port adopts (section 3.3); the three `localeCompare` sorts (844, 1220, 1316) also hide their Order inline.
- fix: Replace `[...xs].sort()` / `xs.sort()` with `A.sort(xs, Order.string)` (identical UTF-16 code-unit ordering, stable, returns a new array which every site already treats as a fresh value) and the three entry sorts with a named `const byName = Order.make(([l]: readonly [string, unknown], [r]) => { const c = l.localeCompare(r); return c < 0 ? -1 : c > 0 ? 1 : 0; })`. Behaviour unchanged.

### fable-1-8
- file: scratchpad/effected/memfs/internal/errno.ts:94
- class: effect-idiom   severity: required
- standard: Operator ruling 2026-10-09 ("lab changes no law, diagnostic or ruling forced ... restore the upstream shape and the upstream tests they rewrote"); standards/effect-laws-v1.md Dual-Arity Inventory Contract (dual is for real public helper APIs); D9   evidence: Ten internal helpers were rewritten as `dual(...)` with hand-written data-last overloads: errnoError (errno.ts:94), nodeErrno (errno.ts:116), seedVolume/applyRoot/seedWith (seed.ts:17,94,118), resolvePath/withFaults/runNode/runMutation (ports.ts:83,129,265,287), assertKnownFaultKeys/wrapFaulty (faults.ts:46,61), plus four upstream test helpers (FileSystemContract.ts:107 `suite`, ErrnoParityContract.ts `errnoSuite`, CaseInsensitiveContract.ts `caseInsensitiveSuite`, helpers.ts `denied`). No gate forced it: terse-effect's `isExplicitDualOverloadCandidate` (TerseEffect.ts:546-571) only fires on exported *function declarations* that already carry data-first/data-last overloads, and upstream's helpers were single-signature arrow consts. `rg` shows zero data-last callers. Consequences: `errnoError`'s optional `description` became a mandatory explicit `undefined` at volume.ts:232,249,768,943 and MemoryFileSystem.ts:769; `nodeErrno`'s optional `path` likewise (ports.ts:172); arity is now decided by `arguments.length` / `P.isString(args[1])` predicates.
- failure: Unforced signature changes to internal helpers and to upstream test files, exactly the class the operator ruled must be restored rather than recorded; the explicit-`undefined` call sites and runtime arity predicates are a regression in readability with no consumer.
- fix: Restore the upstream single-signature arrow forms for the ten helpers (keep the `Effect.fnUntraced` bodies and the effect-imports changes), drop the explicit `undefined` arguments, and restore `suite`, `errnoSuite`, `caseInsensitiveSuite` and `denied` to their upstream signatures in the test files.

### fable-1-9
- file: scratchpad/effected/memfs/MemoryFileSystem.ts:1054
- class: docs   severity: backlog
- standard: Section 10.1 (a doc sentence made wrong by a law-driven change is rewritten and cited in Port notes); brief: docs findings are backlog until S2   evidence: `rg -n RangeError scratchpad/effected/memfs --glob '!KNOWLEDGE.md'` → MemoryFileSystem.ts:410 ("unknown-key `RangeError`"), :930 ("a `RangeError` names any other key"), :1054 ("Throws a `RangeError` at construction"), README.md:135 and :256; the code now throws `UnknownFaultKeyError` / `InvalidFaultCountError`.
- failure: Five public doc sentences name an error type the code no longer throws.
- fix: In the S2 pass rewrite the five sentences to name `UnknownFaultKeyError` / `InvalidFaultCountError` and cite the deviation entry from fable-1-4; KNOWLEDGE.md stays verbatim.

### fable-1-10
- file: scratchpad/effected/memfs/README.md:3
- class: docs   severity: backlog
- standard: Section 10.3 README adaptation (remove npm/version/Node/TypeScript badges, the Install section, the pre-1.0 stability block and pnpm-plugin-effect references)   evidence: README.md:3-6 still carry the four badges, :13-22 the "Pre-`1.0.0`" stability block with the pnpm-plugin-effect link, :24-36 the `## Install` section; only the title and Port notes were adapted.
- failure: The lab README advertises an npm install path and version policy for a package that is not published from this repo.
- fix: Delete lines 3-6, 13-22 and the `## Install` section (24-36) in the S2 docs commit.

### fable-1-11
- file: scratchpad/effected/memfs/internal/volume.ts:1208
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21/22 (tersest equivalent form; `Effect.fnUntraced` for internal generators); D11 perf rule (no measurement, so backlog)   evidence: `InodeEntry.$match(source, { File: Effect.fn("File")(...), SymbolicLink: Effect.fn("SymbolicLink")(...), Directory: Effect.fn("Directory")(...) })` inside `copyInode`, the per-inode recursion of `fs.copy`; every other internal generator in the file uses `Effect.fnUntraced`. Upstream used plain `Effect.gen` closures here.
- failure: One traced span named "File"/"Directory"/"SymbolicLink" per copied inode: meaningless span names in any tracer and a constant-factor allocation on the hot copy path, unmeasured.
- fix: Use `Effect.fnUntraced` for the three arms (the same change the rest of volume.ts received).

### fable-1-12
- file: scratchpad/effected/memfs/internal/seed.ts:45
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); D9   evidence: `const stamp = DateTime.toDateUtc(DateTime.makeUnsafe(0)); stamp.setTime(entry.mtime);` replaces `new Date(entry.mtime)`. It is behaviour-preserving (a NaN or out-of-range `mtime` still reaches `utimes` as an invalid Date and fails typed BadArgument there) but the reason the obvious `DateTime.toDateUtc(DateTime.makeUnsafe(entry.mtime))` was avoided (it would die on NaN) is not stated; the surrounding comment only explains Date-vs-number.
- failure: A reader will "simplify" it to `makeUnsafe(entry.mtime)` and turn a typed seeding failure into a defect.
- fix: Either add one comment line ("makeUnsafe(0)+setTime keeps an invalid mtime on the typed BadArgument path") or route through `DateTime.make(entry.mtime)` and fail typed with `badArgument` before `utimes` — the latter is a D9 deviation needing an entry.

### fable-1-13
- file: scratchpad/effected/memfs/internal/volume.ts:572
- class: test   severity: backlog
- standard: Section 11.3 (a branch unreachable by construction is a finding against the source: simplify it); S3 per-file 100% branch coverage   evidence: Guards added for `noUncheckedIndexedAccess` that are unreachable by construction: `stack[stack.length - 1] ?? RootInode` at volume.ts:572,577,581,589,620 (the stack starts as `[RootInode]` and only pops when `length > 1`); `if (frame === undefined) break;` / `if (name === undefined) continue;` at :2013,2019,2951,2957 (guarded by `frames.length > 0` and `index < names.length`); `if (current === undefined)` at :2485 (after `findIndex !== -1`); `if (segment === undefined) continue;` at :2667; `if (character === undefined) continue;` at :2526.
- failure: Eleven dead branches that the S3 100%-branch gate will report and that cannot be covered by a behaviour-asserting test.
- fix: Type the walk stack as `A.NonEmptyArray<Inode>` and read it with `A.lastNonEmpty`; iterate frames/names with `for...of` or `A.get` + `O.match` so no undefined arm exists; take `current` from `A.findFirst` instead of `findIndex` + index.

### fable-1-14
- file: scratchpad/test/memfs/Handle.test.ts:1
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14 (`it.layer` for scoped/effectful layers); section 11.2; brief: tsgo diagnostics gate   evidence: `rg -n '@effect-diagnostics' scratchpad/test/memfs` → `strictEffectProvide:skip-file` on nine files (Handle, Volume, Seeding, MemoryFileSystem, FaultInjection, Constructors, CaseInsensitiveContract, CaseInsensitive, node-sync.int) and `asyncFunction:skip-file` on Handle.test.ts; none are upstream. `nodeBuiltinImport:skip-file` on the three integration suites is justified (they compare against the host disk).
- failure: The "zero tsgo diagnostics" gate is vacuous for `strictEffectProvide` across the whole test surface; the per-test `Effect.provide` sites the pragma hides are exactly what the S3 `it.layer` migration must find.
- fix: When S3 runs, migrate suite-level layers to `it.layer`/`layer(...)` and delete the nine `strictEffectProvide:skip-file` pragmas; keep `asyncFunction:skip-file` only on Handle.test.ts (Promise-style suite by design) and the three `nodeBuiltinImport` pragmas.

### fable-1-15
- file: scratchpad/effected/memfs/internal/ports.ts:33
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md laws 19/20 (named internal literal domains as LiteralKit; finite variants as discriminated unions); AGENTS.md Discovery & Reuse   evidence: `type Resolved = { readonly path: string } | { readonly code: "ENOENT" | "ENOTDIR" | "ELOOP" }` is discriminated by key presence (`"code" in r` at ports.ts:93,107,166,181,185,191,212 and MemoryFileSystem.ts:768); `MemoryFileSystemVolumeStat.kind: "file" | "directory" | "symlink"` (MemoryFileSystem.ts:178) is re-derived by hand in view.ts:46 and ports.ts:96-99; `runMutation`'s `"writeFile" | "makeDirectory" | "remove" | "symlink"` (ports.ts:289-293) and the string-indexed `methodSyscall` record (ports.ts:270-277) duplicate one domain; `openDescriptor`'s `access?: "readable" | "writable"` (volume.ts:684).
- failure: Four internal literal domains and one key-presence union have no runtime kit (`.is`, `$match`), so the resolution outcome and the stat kind are matched by string comparison at a dozen sites.
- fix: `const ResolveErrno = LiteralKit(["ENOENT","ENOTDIR","ELOOP"])`, `const VolumeKind = LiteralKit(["file","directory","symlink"])`, `const MutatorMethod = LiteralKit([...])` with `methodSyscall` as `R.get` over a record keyed by it; make `Resolved` a `_tag`-discriminated union (`Resolved`/`Unresolved`) matched with `Match.tagsExhaustive`. Public interface shapes stay as upstream (D2 kinds unchanged).

REQUIRED: 8
BACKLOG: 7
