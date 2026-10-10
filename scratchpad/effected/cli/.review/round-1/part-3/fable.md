### fable-1-1
- file: scratchpad/effected/cli/ui/CliUi.ts:284
- class: bug   severity: required
- standard: D9 / section 14 (behaviour-preserving; a different formatted byte needs a law:<id> or upstream-bug cause); effect-fn law is satisfied by Effect.fnUntraced; tsgo effect-fn-iife for `fallback`   evidence: `Effect.fn("run")` (CliUi.ts:284), `Effect.fn("mount")` (:142), `Effect.fn("fallback")` (:493, invoked at :511) and `Effect.fn("live")` (CliUiLive.ts:268) replace upstream's plain `Effect.gen`, which opened no span. Read-only bun probe: a defect raised under `Effect.fn("mount")` inside `Effect.fn("run")` carries `Cause.StackTrace` frames `run > run (definition) > mount > mount (definition)`, and the port's own `CliFailure.toDoc(cause, { spans: "app" })` rendered through `Render.plain` prints `✗ Error: boom` then `in: mount › run`. `spanBlocks` (CliFailure.ts:364-382) keeps every span whose file is not under `node_modules/@effected|effect` (`isKitFile` :314); the lab's files never are, and under `spans: "all"` the trail shows regardless. README *Deviations* and the ledger `deviations` row are both empty; no upstream test renders a report from a screen crash, so the gate did not see it.
- failure: Every failure report of a program whose screen crashes (or whose live view / fallback prompt dies) gains an `in: mount › run` (`in: live`, `in: mount › run › fallback`) line that upstream never prints: an observable formatted-output deviation with no recorded cause.
- fix: Use `Effect.fnUntraced` for `mount` (CliUi.ts:142), `run` (:284) and `live` (CliUiLive.ts:268). For `fallback` (:493-511) return `Effect.gen(function* () { ... })` directly: `const fallback = Effect.fn(...)(gen); return fallback();` is the effect-fn-iife anti-pattern in a two-statement form the rule's syntactic check misses, and the rule's own guidance is Effect.gen. Alternatively record a `law:` deviation naming the rule that forces traced spans; none of the four gated laws does.

### fable-1-2
- file: scratchpad/effected/cli/ui/Select.ts:18
- class: bug   severity: required
- standard: D9 / section 14 (unrecorded deviation); sibling precedent MultiSelect.ts:27 and CliUi.ts:44 (`override readonly name = "Error"`)   evidence: `Schema.Error(identifier)` builds the class with `makeClass(core.Error, identifier, struct, annotations, identifier => ({ name: identifier }))` (node_modules/effect/dist/Schema.js:9398-9403), so `S.TaggedError<X>($I`X`)` names every instance by its identity path. Read-only bun probe: `Select.init([])` throws with `name = "@beep/scratchpad/effected/cli/ui/Select/NoEnabledChoiceError"` and `String(e)` = `@beep/scratchpad/effected/cli/ui/Select/NoEnabledChoiceError: @effected/cli/ui: Select needs at least one enabled choice`; `Confirm.init` with duplicate keys → `@beep/scratchpad/effected/cli/ui/Confirm/DuplicateToggleKeyError: ...`; `MultiSelect.init` (which overrides `name`) → `Error: @effected/cli/ui: MultiSelect item keys ...`, exactly upstream's `new Error(...)`. `CliFailure.describe` (CliFailure.ts:99-109) prints `String(value)`, so the defect line of every report changes. Same construction without the override at Confirm.ts:22 (thrown :117), DocView.ts:14 (thrown :71/:74 inside render → boundary → defect) and CliUiLive.ts:251 (`Effect.die` :273). The upstream tests only match the message (`/at least one enabled choice/`, `/unique.*x/`, `String(exit)` includes "tickMillis"), so the gate passes.
- failure: The kit's own failure report, `String(error)`, `error.name` and any stack printer show a ~60-character identity path where upstream printed `Error`: different formatted bytes, unrecorded in README/ledger.
- fix: Add `override readonly name = "Error";` to `NoEnabledChoiceError` (Select.ts:18), `DuplicateToggleKeyError` (Confirm.ts:22), `MissingDocViewThemeError` (DocView.ts:14) and `LiveTickError` (CliUiLive.ts:251), as MultiSelect.ts:27 and CliUi.ts:44 already do; or, if tag-named errors are wanted, write one `law:native-runtime` deviation entry (ledger + README) covering all six classes and the report lines they change.

### fable-1-3
- file: scratchpad/effected/cli/internal/scanAudience.ts:43
- class: schema   severity: required
- standard: AGENTS.md Code Laws: "Prefer named schema building blocks, derived `S.is(...)` guards, and named `LiteralKit` internal domains over ad-hoc predicate helpers"; D5 (LiteralKit for literal domains, kits applied at S4); D11 (schema idiom violation with a cited standard)   evidence: `const KINDS: ReadonlyArray<string> = ["human", "agent", "ci"]` (:38) and `isKind = (value: string): value is AudienceKind => KINDS.includes(value)` (:43), plus `isBoolean = (name): name is "human" | "agent" | "ci" => name === "human" || name === "agent" || name === "ci"` (:61-62) and `Record<"human" | "agent" | "ci", boolean[]>` (:60), spell the same three-literal domain by hand four times. The sibling env module already owns it as a kit: `export const AudienceKind = LiteralKit(["human", "agent", "ci"])` (scratchpad/effected/env/Audience.ts:21) with `const isAudienceKind = S.is(AudienceKind)` in use (:34). The hand guard asserts `value is AudienceKind` from a `ReadonlyArray<string>` nothing ties to the kit. Not covered by the four gated laws (effect-imports, effect-fn, terse-effect, native-runtime).
- failure: A fourth audience kind added to `AudienceKind` leaves `scanAudience` silently blind to it while the guard still claims `AudienceKind`; the literal domain lives in two unlinked places.
- fix: Import the `AudienceKind` kit value (from `../../env/Audience.ts`, or export the value from `env/index.ts`, which today exports only the type at :11), replace both `isKind` and `isBoolean` with `AudienceKind.is` / `S.is(AudienceKind)` (the two domains coincide), type `booleans` as `Record<AudienceKind, boolean[]>`, and delete `KINDS`.

### fable-1-4
- file: scratchpad/effected/cli/internal/renderDoc.ts:376
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; this is constant-factor, so backlog)   evidence: `Match.valueTags(input, fields)` is `tagsExhaustive(fields)(makeTypeMatcher(identity, []))` followed by `match(input)` (node_modules/effect/dist/internal/matcher.js:136-139, :179-182): each call builds a matcher from the cases object and scans its cases linearly. `blockLines` (renderDoc.ts:376) and `blockMd` (renderMarkdown.ts:375) now allocate a 17-entry cases object with 17 closures plus a matcher per block, recursively; `control` (CliUiLive.ts:706) does the same per inbox message at tick rate, including a fresh `Effect.fnUntraced` wrapper for `Ended` (:709). Upstream was a `switch` jump with no allocation. No measurement taken.
- failure: Constant-factor slowdown and garbage per rendered block and per live-view tick.
- fix: Hoist the handlers out of the per-call path (a module-level `Match.typeTags<Block>()({...})` or a tag-keyed record of functions built once, taking `walk`/`width`/`compact` as arguments), or keep upstream's `switch`.

### fable-1-5
- file: scratchpad/effected/cli/ui/CliUiLive.ts:295
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (use the module's own guards; validate against the installed Effect, not literals)   evidence: `"~effect/Stream" in source` (:295-296) hard-codes `Stream.TypeId` (node_modules/effect/dist/Stream.js:63). In 4.0.2 `Stream.isStream` is a type guard, `(u: unknown) => u is Stream<unknown, unknown, unknown>` (Stream.d.ts:250), and narrows `Stream<E> | PubSub.Subscription<E>` on both branches, so the `as` casts upstream needed are gone without a magic string. The two derived `undefined` sentinels then leave a third, unreachable pump branch `subscription === undefined ? Effect.void : ...` (:779) that would never offer `Ended` and leave `control` waiting on `Queue.takeAll` if it were ever reached.
- failure: A TypeId rename in effect silently breaks the stream/subscription split; the dead branch encodes an impossible "no events" source.
- fix: Narrow once with `Stream.isStream(source)` and build `streamPull`, `pump` and `queuedTail` inside the two branches of that one check, so no `undefined` sentinel and no third branch remain.

### fable-1-6
- file: scratchpad/effected/cli/ui/CliUiLive.ts:329
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws "Prefer the tersest equivalent helper form" (terse-effect); tsgo effect-succeed-with-void   evidence: `current === undefined ? Effect.as(Effect.void, undefined) : Effect.as(unmount(current), current)` — `Effect.as(Effect.void, undefined)` exists only to dodge `effect-succeed-with-void` on upstream's `Effect.succeed(undefined)`; 4.0.2 has no `Effect.undefined`.
- failure: No runtime effect; the detour reads as a lint evasion and hides that both branches end in `current`.
- fix: `Effect.as(current === undefined ? Effect.void : unmount(current), current)` — one expression with the same `Effect<Run<S> | undefined>` type.

### fable-1-7
- file: scratchpad/effected/cli/ui/KeyTable.ts:238
- class: effect-idiom   severity: backlog
- standard: React rules of hooks; D2 (additions listed under README *Port notes → Added exports*)   evidence: `useKeys`, a React hook, is now `dual((args) => !P.isFunction(args[0]), ...)` (:238-241) to satisfy `missing-pipeable-signature`. The new data-last form `useKeys(dispatch, options)` returns a thunk that calls `useScreenGuard()` and `ink.useInput` whenever it is invoked — a hook behind a function value, which the rules of hooks forbid inside callbacks or conditionals. Every caller uses the data-first form (Select.ts:288, MultiSelect.ts:291, Confirm.ts:281, Tabs.ts:178, CliUi.ts:126, all tests). README *Added exports* says "None".
- failure: The curried overload invites a hook call outside render order; the public surface grew without a Port-notes entry.
- fix: Keep the data-first signature only and record the `missingPipeableSignature` exception for this hook in scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md (the existing per-file exception mechanism), or list the overload under *Added exports* with a rules-of-hooks caveat in its JSDoc.

### fable-1-8
- file: scratchpad/effected/cli/internal/renderGithubLog.ts:17
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws "Prefer the tersest equivalent helper form"   evidence: Six consecutive `...O.getSomesStruct({ one: ... })` spreads (:17-22). Read-only probe: `getSomesStruct({ a: O.none() })` → `{}` (key absent), `getSomesStruct({ a: O.some(1) })` → `{ a: 1 }`, so one call over all six fields is byte-for-byte equivalent to upstream's conditional spreads. Same two-spread shape at CliUi.ts:203-204 and CliUiLive.ts:501-502.
- failure: None at runtime; six struct allocations and six spreads where one does.
- fix: One `...O.getSomesStruct({ title: O.map(O.fromUndefinedOr(block.title), sanitize), file: ..., startLine: ..., endLine: ..., startColumn: ..., endColumn: ... })`; likewise one call in CliUi.ts and CliUiLive.ts.

### fable-1-9
- file: scratchpad/effected/cli/ui/CliUi.ts:231
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled `**Example** (Title)` and `**Details**`/`**Gotchas**` sections; never `@example`/`@remarks`); D4 (carriers converted, never dropped). Backlog by operator order: S2 has not run.   evidence: 84 `@example|@remarks|@public|@internal` carriers remain across the 15 focus files (CliUi.ts 16, MultiSelect.ts 12, Select.ts 10, Confirm.ts 10, KeyTable.ts 8, CliUiLive.ts 5, scanAudience.ts 4, renderDoc/renderMarkdown/DocView/KeyHelp 3 each, renderPlain/splitFrame/wizardGate 2 each, renderGithubLog 1). The S0 import rewrite also turned public examples' `from "@effected/cli/ui"` into `from "../ui.ts"` (CliUi.ts:233, Confirm.ts:207, Select.ts:196, MultiSelect.ts:209), a path no consumer can use and that docgen will compile against the lab layout.
- failure: JSDoc law red at S2; examples teach a lab-relative import.
- fix: S2 carrier conversion per the pattern for these files; examples import through the module's promoted name (or keep `../ui.ts` until promotion and say so under Port notes).

REQUIRED: 3
BACKLOG: 6
