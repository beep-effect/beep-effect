# P0.5 core promotion readiness

Status: source/law review complete; no promotion authorized.

Owner: this report only. Source of truth is the sibling `effect-vitest-filesystem`
checkout (Root-supplied base `663904610c`, Bun 1.4.2). Root owns verification and
implementation. This review proves no compiler/runtime result; copy metadata is pending.

Settled: fixture is 27 bytes including LF; subject-local scoped creation, no public
asset/locator. Conformance and publication are not being redesigned.

## Scope and binding rules

All source anchors below are relative to `effect-vitest-filesystem`, unless noted.
`V` means `scratchpad/memfs/internal/volume.ts`; `T` means
`scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts`; `TU` means
`packages/tooling/test-kit/test-utils`.
Cache is `~/.cache/beep/effect-vitest-canon/effect-rc112`, not upstream HEAD.

- **Fact:** `TU/package.json:27` declares `tooling/test-kit`; the binding anchor is
  `*.test-kit.ts` plus `index.ts`, with `fixtures/` and `layers/` optional
  (`standards/ARCHITECTURE.md:681–696`). Neither a product slice nor a new service
  tag is required to implement the existing `FileSystem.FileSystem` contract.
- **Required:** replace the scratchpad identity at `V:52,74`; curate only `make`
  (`V:2824`) and `layer` (`V:3031`). Do not copy the facade class or publish the
  inspection extension (`V:2826–3005`) and its `currentState` hook (`V:182–186,2709`).
- **Required modeling distinction:** schema-first applies to private pure data;
  behavioral contracts and type-level utilities can remain TypeScript
  (`standards/ARCHITECTURE.md:114–135`; `standards/effect-first-development.md:277–285,798–807`).
- **Fact:** the algorithm attribution at `V:16–50` is a provenance/notice
  obligation, not an exception to the destination's laws. The test-kit is not an
  `ecosystem` package, whose separate standards are explicitly scoped in
  `standards/ARCHITECTURE.md:174–179,640–651`.
- Skills applied: effect-first-development and schema-first-development for law
  classification; Unslop for prose. No skill's implementation/gate commands were run.

## Exact core inventory and classification

The retained closure is `V:1–2824` plus `V:3007–3031`, minus the five-line
inspection hook declaration and its one-line implementation: **2,843 original
lines before standards changes**. It contains **25 interfaces, 7 type aliases,
2 classes, 2 `Data.taggedEnum` factories, 17 tuple `as const` assertions, and
8 native array sorts**. Counts exclude the inspection extension.

| Source declarations | Classification / required disposition |
|---|---|
| `PlatformError`, `SystemErrorTag` (`V:81–82`) | Existing upstream contract aliases; retain/qualify, do not invent error schemas. |
| `Inode`, `FileDescriptor` + nominal constructors (`V:105–113`) | Two private numeric identities. Derive their types/constructors from annotated branded schemas, preserving existing brand strings and numeric representation; do not introduce a public ID API or new allocation bounds. |
| `InodeMetadata`, `FileInode`, `DirectoryInode`, `SymbolicLinkInode`, `InodeEntry` (`V:115–145`) | Pure stored inode data; schema-first required. Ten common fields: ino/mode/uid/gid/nlink/openCount and four UTC times; variants carry bytes, name→inode map, or target. Replace the tagged-enum source of truth with schema-derived cases/guards. |
| `OpenFileDescriptor` (`V:189–196`); `State` (`V:167–173`) | Data, not open handles: descriptor has fd/inode/three flags/position; state has two immutable maps and three counters. Schema-model these records. The separate captured mutable **reference** to State remains implementation machinery. |
| `OpenMode` (`V:620–627`), `CloneContext` (`V:216–220`) | Pure six-boolean flag interpretation and three-field clone policy. Derive from schemas or eliminate redundant records through schema-backed literal dispatch; neither is a new service/config subsystem. |
| `ResolvedInode`, `ResolvedEntry` (`V:203–214`) | Pure resolver result records; schema-derived shapes or schema-derived composition types. Preserve resolved path vs original error-path distinction; do not decode/re-resolve paths again on return. |
| `ResolveOptions`, `OpenOptions` (`V:198–201,629–632`) | Call-policy / upstream API options, not automatically domain entities. Open options can derive from the existing FileSystem `open` signature; private resolution policy can use an annotated local options schema. Keep upstream optional keys and current defaults at the boundary; no new public options. |
| `GlobLiteral`, `GlobStar`, `GlobOne`, `GlobCharacterClass`, `GlobToken` (`V:2276–2298`); `GlobSegment`, `GlobGlobstar`, `CompiledGlobSegment`, `CompiledGlobPattern` (`V:2300–2315`) | Pure parser AST: four token cases, two segment cases, compiled pattern. Schema-first required even though private. Canonical `_tag` schema unions fit; no requirement to wrap `_tag` twice with another LiteralKit discriminator. |
| `BraceExpansion`, `GlobCharacterClassAtom` (`V:2317–2326`) | Named pure parser records: start/end/alternatives and value/escaped. Derive from local schemas; retain code-unit indexing and existing escape/range rules. |
| `Volume` (`V:175–187`) | Behavioral contract with polymorphic `withState`, `mutate`, `mutateInterruptibly`, watcher registry. Interface allowed; keep private; remove only inspection hook. |
| `WatchSubscription` (`V:147–153`), local traversal `Frame` (`V:1896–1901`) | Mutable operational state: queue attachment/pending events and worklist cursor. Technical interfaces allowed; no fake serializable schema for a queue or iterator frame. Optional queue→Option cleanup must preserve registration-before-attachment handoff. |
| `TransitionResult<A>` (`V:155–165`) | Generic transaction carrier whose arbitrary `A` may be a runtime handle. Type-level utility allowed; do not invent `S.Unknown` payload decoding to force a schema. Its State component uses the schema-derived type. |
| `MemoryFile` (`V:1770–1868`) | Behavioral implementation of upstream File: fd + private Volume; stat/sync getters, seek/read/readAlloc/truncate/write/writeAll. Keep resource class, not `S.Class` or public service. |
| `MemoryFileSystemInvariantError` (`V:76–78`) | Already `S.TaggedError`; required package identity + meaningful annotation, not a new expected-error channel. Preserve defect use at `V:1539,1561`. |

**Public inventory:** exactly two values: `make: Effect<FileSystem.FileSystem>` and
`layer: Layer<FileSystem.FileSystem>`, with no added error/environment channel.
Retain the 25 primitives at `V:2765–2792` and upstream `FileSystem.make`'s derived helpers.
No new public class, models, errors, options, fixture locator, or volume handle.

## Definite changes versus implementation judgment

- **Required before promotion:** schema-source-of-truth changes above, local
  `$TestUtilsId` identities/annotations, and schema-derived guards for named
  constraints: entry names (`V:282–287`), flags (`V:638–648`), mode/owner
  (`V:763–766,2079–2082`), safe sizes (`V:1677–1724,1815–1819,2019–2024`),
  temporary fragments (`V:2135–2138`). Preserve each caller's existing typed
  error tag, method, path/descriptor and precedence; schema errors must not leak.
  Rules: `standards/effect-laws-v1.md:28–31`, EF-12/12b/33/35 in
  `standards/effect-first-development.md:255–285,798–807,859–878`.
- **Required helper compliance:** use canonical `O`, not root `Option`
  (`V:54–69`); move stable helper imports to their dedicated modules. Replace
  all eight `.sort()` sites (`V:383,795,1128,1211,1905,1926,2637,2650`) with
  `A.sort` and explicit Orders. Five use default code-unit order; **three use
  localeCompare**, so do not substitute `Order.String` for all eight.
  Rules: `standards/effect-laws-v1.md:7–13,21`.
- **Required internal absence cleanup:** `findInode`/`findEntry`
  (`V:263–267`) discard HashMap's Option into undefined and propagate it through
  inode domain logic. Keep Option and existing NotFound/BadResource mappings.
  This does not outlaw undefined in upstream optional parameters, void
  transition results, or operational callback attachment state (EF-2:69–75).
- **Required literal-law cleanup, not evidence of unsafe casting:** all 17
  assertions are tuple `as const`, not `as any`/`as unknown` coercions. Use
  `Tuple.make` or explicit tuple return types to meet the no-assertion rule
  (`standards/effect-laws-v1.md:15`); `typeof FileTypeId` at `V:1771` is a
  legitimate type query, not a forbidden runtime typeof check. No switch found.
- **Required review with behavior preserved:** migrate ordinary native string/
  array transformations and schema-domain tag branching to Effect helpers;
  retain early error returns and iterative worklists rather than rewriting
  every `if`/loop. Existing hot `Effect.fnUntraced` implementations are lawful;
  zero-argument effect values remain effects. Reusable plain effect-returning
  helpers (`V:337,662,668,1752,2019,2026,2103,2690–2705`) should use the
  appropriate Effect function constructor, without moving work across the lock.
- **Allowed technical implementation:** a closure-local `let state`, Semaphore,
  MutableHashSet, mutable queue/worklist bookkeeping, bit masks, Uint8Array
  allocation/copy/set/subarray, TextEncoder, and Date→UTC boundary adaptation.
  These implement platform contracts, not product-domain shortcuts. Do not
  replace bytes with schema arrays, deep-clone all State on commits, add a new
  Ref/STM layer, or change public `Date | number`, `SizeInput`, or optional API
  signatures merely for style (`V:1642–1664,1790–1808,2103–2109,2659–2715`).
- **Not an automatic waiver:** an actual native-runtime/complexity finding must
  be attributed and resolved through Root's normal gate. Any necessary
  exception needs the specific rule/site/reason, not "vendored"; no allowlist,
  threshold, or inventory change is approved here
  (`standards/effect-laws-v1.md:36–55`; architecture migration posture:1940–1958).

The twelve inline option literals (`V:836,965,1430,1939,1983,2178,2198,2202,2210,2245,2254,2613`) mirror upstream FileSystem contracts; derive their types, not twelve public schemas.
`fileSystemError`'s input (`V:226–233`) is an upstream PlatformError adapter, not a new domain error model.

## Live reuse findings

Targeted package-source/barrel searches found **no existing promoted engine, inode model, or matching compiled-glob AST**.
Paths prefixed `Schema/` below mean `packages/foundation/modeling/schema/src/`.

| Existing public symbol and source/barrel | Use / limitation |
|---|---|
| `$TestUtilsId`: `packages/foundation/modeling/identity/src/packages.ts:550`, root barrel `index.ts:121` | Replace `$ScratchpadId`; file-local composer for the actual new role path. Already a TU dependency (`TU/package.json:56`). |
| `LiteralKit`: `Schema/LiteralKit/LiteralKit.schema.ts:730–770`, barrel `LiteralKit/index.ts:12`, root `index.ts:287` | Exact ten-member open-flag kit + `.is`; derive dispatch rather than parallel string checks. Upstream `FileSystem.ts:610` has the type union, not a runtime flag schema. |
| `HasNullByte`: `Schema/FilePath/FilePath.guards.ts:31–44`, barrel `FilePath/index.ts:14` | Reuse its `.is`/`S.is` guard for NUL rejection without adopting the full FilePath validator. |
| `Int`, `PosInt`, `NonNegativeInt`: `Schema/Int.ts:31,78`, `Schema/Number.ts:192`, root `index.ts:238,327` | Reuse only where their safe-integer bounds match existing checks. Do **not** constrain cursor position with NonNegativeInt: seek stores signed bigint and postpones invalid read/write rejection (`V:1790–1808`). Do not tighten nominal ID allocation limits. |
| `Uint32`: `Schema/Uint32.ts:68`, root `index.ts:502` | Same numeric range as mode/owner checks, but protobuf branding is not filesystem identity. Prefer built-in `S.isUint32` for a locally annotated filesystem constraint; do not clone the range filter or expose the protobuf brand. |
| `FilePath`, `PosixPath`, `Glob`: `Schema/FilePath/FilePath.schema.ts:99–140`, `Schema/PosixPath.ts:33,74`, `Schema/Glob/Glob.schema.ts:45–88`; root `index.ts:156,367,201` | **Not drop-in replacements:** FilePath rejects bare roots; PosixPath rejects/normalizes backslashes that this engine treats literally; Glob validation needs Bun and rejects escapes accepted by this parser. Keep the virtual-root resolver and portable AST/matcher, using appropriate smaller helpers. |
| `provideScopedLayer`: `TU/src/Layer.ts:34–37`, root `index.ts:30` | Existing helper, not a reason to add another wrapper or bypass D14. The conformance subject-local provision is already settled. `@beep/utils/FileSystem` (`packages/foundation/modeling/utils/src/FileSystem.ts:313,467`) performs host IO and must not back the engine. |

Pinned reuse (all under cache `packages/effect/src/`): `S.HashMap` (`Schema.ts:11553`),
`S.DateTimeUtc` (13768), `S.Uint8Array` (13605), `S.brand` (5242), `S.TaggedUnion`
(6470), `S.toTaggedUnion` (6318), `S.Int`/`S.isInt` (8353/8298; **safe** integers),
`S.isUint32` (8430), `Tuple.make` (`Tuple.ts:46`), `A.sort` (`Array.ts:2071`),
`Order.String`/`Order.make` (`Order.ts:144/111`), `Str.slice`/`Str.split`
(`String.ts:376/444`). Preserve locale ordering with an explicit sign-normalized
locale comparator at the three locale sites; no new sorting library is needed.

## Minimum ordered implementation plan (proposal only)

1. **Maintain the gate.** Root's reported 20/21 Memory result on each runtime
   remains blocked by copy metadata, not by this review. Keep D1–D14, rc.112 and
   Codex CLI/Grok routing. Do not change `V:1352–1356`, `T:132–150`, or
   `TU/src/FileSystemConformance.ts:346–365` until the copy choice is authorized.
2. **Smallest lawful source layout:** `TU/src/MemoryFileSystem/index.ts` with
   explicit `export { make, layer }`, and `MemoryFileSystem.test-kit.ts` containing
   the retained core and private schemas/types/helpers. This matches the live
   `ConformanceLedger/index.ts:8–11` pattern and test-kit role law. A service,
   layer-variant, errors, config, or product-domain role file is not required.
   Root later maps exact `./MemoryFileSystem` and blocks `./MemoryFileSystem/*`
   in source/publish exports and generated aliases; current wildcard alone does
   not implement the curated boundary (`TU/package.json:14–21,79–85`). No root
   `export *` of these generic names; a root namespace is optional, not required.
3. **Model before moving behavior.** Default to annotated `S.Class` records and
   schema `_tag` unions; derive runtime types. Preserve brands, map keys, buffer
   ownership and copy-on-write updates. Constructor defaults must reproduce
   `V:84–99,399–483,2666–2688`: no module-level shared mutable maps/bytes, no
   clock acquisition in sync constructors, no fresh timestamps during unrelated
   state updates. Preserve open default `r`, write default `w`, false option
   defaults, `/tmp`, empty temp fragments, mode masks, and all numeric error rules.
4. **Adapt helpers without changing transactions.** Retain interruptible permit
   acquisition, uninterruptible commit+event publication and the special temp
   file interruption path (`V:2220–2239,2661–2705`). Keep `make` lazy and `layer`
   as `Layer.effect(FileSystem.FileSystem, make)`; do not add `Layer.fresh`
   everywhere or allocate a singleton. Optional earned splits: private
   `MemoryFileSystem.schema.ts` for models/constraints, and a private glob role
   for `V:2274–2608`; neither is mandated just by file length. Any such split
   keeps role exports off the public facade and must preserve error dependencies.
5. **Document and prove through public APIs.** Rewrite both constructor/layer
   examples (`V:2800–2824,3007–3031`) to `@beep/test-utils/MemoryFileSystem` and
   observable writes/reads; remove stale scratchpad links and public `@internal`.
   Include lead, titled Example, canonical category, `@since 0.0.0`; private
   schemas need annotations, not invented public APIs (`.patterns/jsdoc-documentation.md:13–25,68–91`).
   Preserve attribution and full MIT notice/disclaimer from cached `LICENSE:1–21`,
   not merely the old URL. Keep public `@effect/vitest` and existing helpers;
   no dependency on P0e's instrumented Vitest module. Root owns all actual gates.

## Regression protection and unresolved proof

Keep all **21 conformance cases and 17 memory-specific cases**; do not weaken the
pending copy assertion or add skips. Package tests import only public `@beep/*`
source surfaces. Existing protections and focused additions for this refactor:

| Change risk | Existing assertions / targeted additional proof |
|---|---|
| Volume sharing, transaction ordering, watchers | `T:30–44` writes/reads `shared` then separate block has no file; `T:153–175` append is AB or BA and exactly one exclusive create succeeds; `T:248–321` exact normalized events, hard-link aliases, recursive/nonrecursive lists. Add same-block cross-test sharing and independent `make` acquisitions; do not merely assert different objects. |
| Schema constructors, bytes, timestamps, identity | `T:67–92,108–130` final symlinks and same-inode rename; `T:200–216` mode 0, uid 42/gid 84, times 1000/2000, access still succeeds. Add write/read buffer mutation isolation, equal hard-link inode IDs versus distinct copied inode IDs, and default root/tmp/file modes and owners through FileSystem stat. |
| Size/option/error guards and handle lifecycle | `T:178–197` invalid sizes fail with BadArgument/truncate and bytes remain `content`; `TU/src/FileSystemConformance.ts:274–342` flag behavior and `:369–606` cursor/append/truncate/EOF assertions. Preserve scoped cleanup NotFound checks at `:195–208,223–252`. Add invalid flag/mode/owner payload checks and signed seek→read/write error behavior if touching their validation. |
| Ordering/parser changes and bounds | `T:219–245` no symlink traversal, depth failure BadResource/copy and no destination. Add exact recursive listing order for mixed-case/non-ASCII names, escaped glob literals, character classes/negation, braces, dotfiles and expansion limits; characterize locale-sensitive traversal/error precedence against unchanged scratchpad core on each runtime. |

**Unknowns requiring real proof:** class construction/spread compatibility and
brand inference; schema validation timing/defect channels; encoded HashMap/byte
types; exact optional-parameter and FileSystem method assignability; generated
alias/export blocking; docgen inclusion/examples; complexity and lint outcomes;
watch handoff/interruption behavior and allocation costs after the rewrite.
Root-reported platform successes do not prove the promoted artifact. This review
ran no compiler, runtime, scanner, package or audit command and changed only this
report. Scratchpad deletion, facade promotion and other-package adoption remain unauthorized.
