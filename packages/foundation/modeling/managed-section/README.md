# @beep/managed-section

Managed sections: delimited `BEGIN`/`END` blocks inside files whose surrounding content belongs to the user. A tool owns the block, the user owns everything else, and neither destroys the other. That is the mechanism behind a generated hook, a managed config fragment, or any file a tool and its user both need to edit. `SectionDocument` is a pure string-to-string core with no `Effect`, no IO and no runtime: parse a document, compare a declared section against what is already there, reconcile a whole set of them, render the result. `ManagedSection` is a thin service that reads a file, calls the pure core, and writes back only when the text actually changed.

## Usage

Declare two sections and sync them into a file in one call. Declared order becomes file order, so `base` always precedes `tool`, however a user may have reordered the file by hand:

Declare two sections and sync them into a file in one call. Declared order becomes file order, so `base` always precedes `tool`, however a user may have reordered the file by hand:

```ts
import { ManagedSection } from "@beep/managed-section/ManagedSection";
import { SectionId } from "@beep/managed-section/Section";
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as Effect from "effect/Effect";

const Base = SectionId.make({ key: "base", commentStyle: CommentStyle.hash });
const Tool = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });

const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.syncAll(".husky/pre-commit", [Base.section("#!/usr/bin/env sh"), Tool.section("npx tool run")]);
});

Effect.runPromise(program.pipe(Effect.provide(ManagedSection.layer), Effect.provide(NodeFileSystem.layer))).then((outcomes) =>
  console.log(outcomes.map((o) => o._tag)),
);
// example output on a fresh file: [ "Created", "Created" ]
// example output on a second, identical run: [ "Unchanged", "Unchanged" ]
```

### Marker attributes

A `BEGIN` marker can carry `name="value"` pairs, so a tool reads a block's provenance — which run wrote it, and when — off the marker line without opening the block:

```ts
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { SectionDocument } from "@beep/managed-section/SectionDocument";
import { SectionId } from "@beep/managed-section/Section";
import * as Result from "effect/Result";

const Tool = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
const doc = SectionDocument.parseResult("#!/usr/bin/env sh\n");

if (Result.isSuccess(doc)) {
  const next = doc.success.reconcile([Tool.section("npx tool run", { origin: "ci", runId: "1873" })]);
  console.log(Result.isSuccess(next) ? next.success.text : next.failure.message);
  // #!/usr/bin/env sh
  //
  // # --- BEGIN tool MANAGED SECTION origin="ci" runId="1873" ---
  // npx tool run
  // # --- END tool MANAGED SECTION ---
}
```

Attributes are metadata, never identity: a section is found by key and comment style alone, so bumping `runId` updates that block in place instead of orphaning it and appending a second one. They do count as difference — `check` answers `Drifted` when a declared attribute disagrees with the marker on disk, which is what lets a tool rewrite a block whose only change is its metadata. Omitting the argument and passing `{}` are the same section, so a caller that never uses attributes sees no drift against a bare marker.

The grammar has no escaping, deliberately: names match `[A-Za-z][A-Za-z0-9_-]*`, values are double-quoted and carry neither `"` nor a line break, and anything outside that fails typed as a `SectionRenderError` with `reason: "invalidAttribute"` naming the attribute — before a byte is written. An `END` marker never carries attributes, and an attribute run that does not parse cleanly (a mangled pair, one name declared twice) makes the whole line ordinary content rather than a marker.

Attributed markers are a one-way compatibility break: a scanner predating this feature does not recognize one at all, so the block it opens stops being a managed section for that tool. Writing attributes into a file another tool also manages is a decision, not a detail.

### Literal markers

A file whose markers were written before this package existed can be managed without migrating them. `LiteralMarkerDialect` lists a fixed `BEGIN`/`END` spelling per key; a listed key is rendered and scanned with exactly that spelling, and every other key keeps the ruled form:

```ts
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { SectionId } from "@beep/managed-section/Section";
import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
import { SectionDocument } from "@beep/managed-section/SectionDocument";
import * as Result from "effect/Result";

const dialect = LiteralMarkerDialect.make({
  phrase: "MANAGED SECTION",
  styles: [CommentStyle.html],
  markers: [SectionMarkers.make({ key: "catalog", begin: "BEGIN GENERATED: CATALOG", end: "END GENERATED: CATALOG" })],
});
const Catalog = SectionId.make({ key: "catalog", commentStyle: CommentStyle.html });
const doc = SectionDocument.parseResult("# Title\n\n<!-- BEGIN GENERATED: CATALOG -->\nold\n<!-- END GENERATED: CATALOG -->\n", dialect);
const next = Result.flatMap(doc, (document) => document.reconcile([Catalog.section("new")]));
console.log(Result.isSuccess(next) ? next.success.text : next.failure.message);
// # Title
//
// <!-- BEGIN GENERATED: CATALOG -->
// new
// <!-- END GENERATED: CATALOG -->
```

The scanner's guarantees carry over unchanged: a literal marker must own its line, a duplicate, orphaned, overlapping or unterminated literal section is a typed `SectionParseError`, the document's line ending is kept, and content containing a literal marker is refused. A literal marker has no attribute slot, so rendering a listed key with attributes fails as `invalidAttribute`. A ruled marker that names a listed key is ordinary text to that dialect.

## Design

Ambiguity fails typed rather than being resolved by guessing: an unterminated marker, an orphaned `END`, two overlapping sections, or the same identity declared twice are all a typed `SectionParseError` naming the line, never a silent skip that leaves a duplicate block on the next run. Line endings are a first-class invariant too: the document's dominant EOL is detected at parse and every comparison is EOL-normalized, so a CRLF file does not report drift forever.

`FileSystem` comes from `effect` core, not from a platform package, so a consumer provides it once at the edge (`NodeFileSystem.layer` from `@effect/platform-node` on Node). `Path` is deliberately not required: this package treats every path as an opaque string handed straight to `FileSystem`.

The package is ESM-only. Import it from an ES module through the `@beep/managed-section` entrypoint or one of its module leaves (`@beep/managed-section/SectionDocument`, `@beep/managed-section/ManagedSection`, ...).

## Features

- `SectionDocument` — the pure core: `parse` / `read` / `has` / `check` / `reconcile` / `remove` over a plain string, with no `Effect`, no IO and no runtime needed to test it.
- `ManagedSection` — the service: `read`, `readAll`, `isManaged`, `sync`, `syncAll`, `check`, `checkAll` and `remove`, each writing back only when the text changed.
- `CommentStyle` — an open set of `{prefix, suffix?}` presets (`hash`, `slash`, `semicolon`, `dash`, `html`, `block`) covering both line comments and wrapped ones like `<!-- … -->`, so a managed section can live in Markdown or HTML, not just source files.
- Marker attributes — `name="value"` pairs on a `BEGIN` marker, via `SectionId.section(content, attributes)` and `Section.attributes`: metadata for the tool, never part of a section's identity.
- `SyncOutcome` / `CheckOutcome` — tagged results (`Created` / `Updated` / `Unchanged`, `Absent` / `UpToDate` / `Drifted`) that carry the sections involved rather than a diff, so a caller renders exactly the comparison it needs.
- Byte-preserving outside managed blocks: every character outside a declared section's span survives a sync, in order, including a leading BOM.
- Idempotent by construction: syncing an already-up-to-date document writes nothing and touches no mtime.

## Reference material

[KNOWLEDGE.md](./KNOWLEDGE.md) carries the upstream design notes (the package `CLAUDE.md` and the `okf/modules/templates.md` design doc) verbatim. Their paths name the upstream checkout: upstream `packages/templates/src/` is this package's `src/`, and upstream `__test__/` is `test/`.

## Validation

From the repository root:

```sh
bun run beep quality package-verify @beep/managed-section
```

Inside the package, `bun run check`, `bun run lint`, `bun run lint:laws`, `bun run lint:jsdoc`, `bun run test`, `bun run test:integration` and `bun run docgen` run the individual gates.

## Provenance

Ported from upstream `@effected/templates` (MIT, C. Spencer Beggs) through the effected port, then promoted into this workspace package by `goals/effected-promotion`. The package [LICENSE](./LICENSE) carries both the beep-effect and the upstream copyright notices.

## Port notes

### Upstream pin

- Upstream package: `@effected/templates` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)
- Vendored-engine notices: none found in source headers.

### Added exports

- `SectionMarkers` and `LiteralMarkerDialect` (`SectionDialect` leaf): fixed per-key marker spellings, so repo-cli's pre-existing generated regions (`BEGIN GENERATED: ...`, `beep-models:begin ...`) are managed byte for byte without a marker migration (effected-promotion R8).
- `CommentStyle.comment`: the one spelling of a commented-out marker line, used by both marker forms.
- `SectionDialect.spellings` and `SectionDialect.literalMatchers` (internal): the hooks `LiteralMarkerDialect` overrides; both are empty on a ruled dialect.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, port behaviour and reason are on the module's ledger row in the effected port.

- **native-runtime** — Lab uses Effect hash collections, Record and Array helpers, owner-local matchers and a tagged defect where upstream uses native collections, Object helpers, sort and Error. (packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:43,129; packages/foundation/modeling/managed-section/test/SectionDocument.reconcile.test.ts:186,201,217; packages/foundation/modeling/managed-section/test/SectionAttributes.test.ts:49,249; packages/foundation/modeling/managed-section/test/ManagedSection.test.ts:323; packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:181,203)
- **identity-keys** — Lab eagerly stores compiled matchers in each dialect owner while upstream lazily stores them in an identity-keyed WeakMap. (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:181,203)
- **tagged-errors** — Lab uses ManagedSectionTestError for unstubbed defects and preserves encoded cause stacks where upstream throws native Error and omits those stacks. (packages/foundation/modeling/managed-section/test/ManagedSection.test.ts:221,323)
- **schema-first** — Lab adds schema authorities, LiteralKit domains, derived guards and named validation messages while upstream has constructor-only outcomes, type-only models and manual validation. (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:175,211; packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:309,333,354; packages/foundation/modeling/managed-section/test/SectionDocument.reconcile.test.ts:229; packages/foundation/modeling/managed-section/test/SectionAttributes.test.ts:358,366,374; packages/foundation/modeling/managed-section/test/Section.test.ts:28; packages/foundation/modeling/managed-section/test/CommentStyle.test.ts)
- **numeric-domains** — Lab validates offsets and error lines with S.Finite where upstream uses unrestricted Schema.Number or a type-only number. (packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:30,38,333 (valid offsets, lines and scan schema))
- **type-safety** — Lab uses narrowing, a nonempty-array helper and inferred record/tuple types where upstream relies on unsafe casts and widened indexing. (packages/foundation/modeling/managed-section/test/ManagedSection.test.ts:67,323; packages/foundation/modeling/managed-section/test/SectionAttributes.test.ts:336; module suite packages/foundation/modeling/managed-section/test/**)
- **tsgo-diagnostics** — Lab adds dual pipeable signatures, named Effect.fn and schema .make construction where upstream has direct-only helpers, Effect.gen and new schema errors. (module suite packages/foundation/modeling/managed-section/test/**)
- **effect-first** — Lab uses named Effect.fn, exhaustive Match and Option helpers where upstream uses a generator wrapper, switch and conditional omission spreads. (packages/foundation/modeling/managed-section/test/ManagedSection.test.ts:25,67,264,282; packages/foundation/modeling/managed-section/test/SectionAttributes.test.ts:374; module suite packages/foundation/modeling/managed-section/test/**)
- **effect-imports** — Lab uses dedicated effect/Module imports in source, tests and examples where upstream imports from the effect barrel. (module suite packages/foundation/modeling/managed-section/test/**)
- **identity-annotations** — Lab supplies @beep/identity annotations and composer-named JSON Schema definitions and service keys where upstream uses bare names and inline patterns. (packages/foundation/modeling/managed-section/test/Section.test.ts:87; packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:152; module suite packages/foundation/modeling/managed-section/test/**)
- **upstream-bug** — Lab reads and reconciles a block immediately after a leading BOM while upstream rejects it as orphanedEnd. (packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:264,283,289)
- **upstream-bug** — Lab normalizes CRLF content before EOL conversion and checks its render UpToDate while upstream doubles carriage returns and reports Drifted. (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:163; packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:294)
- **upstream-bug** — Lab precomputes missing-section anchors in linear passes while upstream repeatedly searches them quadratically, preserving the insertion and byte contracts. (packages/foundation/modeling/managed-section/test/SectionDocument.reconcile.test.ts:201,217)
- **upstream-bug** — The lab preserves nonempty prefixes and excess separators on first insertion, while upstream discards blank prefixes and rebuilds trailing separators. (packages/foundation/modeling/managed-section/test/SectionDocument.reconcile.test.ts:245; packages/foundation/modeling/managed-section/test/SectionDocument.property.test.ts:57)
- **upstream-bug** — The lab refuses LF rendering of trailing bare CR with a typed error and preserves CRLF fidelity, while upstream succeeds and loses the CR on parsing. (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:268; packages/foundation/modeling/managed-section/test/SectionDialect.property.test.ts:54; packages/foundation/modeling/managed-section/test/SectionDocument.test.ts:451)
- **upstream-bug** — The lab exposes prefix matchers plus shared full-marker recognition with a linear boundary sweep, while upstream exposes complete regex matchers whose malformed whitespace tails backtrack quadratically. (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:298,322,357; packages/foundation/modeling/managed-section/test/internal/scan.coverage.test.ts:32,67)
- **schema-first** — The lab exposes identified attribute schema checks with explicit decode messages and unchanged grammar, while upstream uses grammar predicates and the pre-round lab checks report generic regex failures. (packages/foundation/modeling/managed-section/test/SectionAttributes.test.ts:369,378,387,397)
- **upstream-bug** — The lab refuses hash/HTML markers containing closing-rule tails before U+2028/U+2029 with typed invalidAttribute errors and preserves existing files during sync, whereas upstream renders unreadable blocks successfully (packages/foundation/modeling/managed-section/test/SectionDialect.test.ts:409; packages/foundation/modeling/managed-section/test/ManagedSection.test.ts:70).

### Dependency backlog

None.

## License

[MIT](LICENSE)
