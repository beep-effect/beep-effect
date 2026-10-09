# templates (lab port of @effected/templates)


Managed sections: delimited `BEGIN`/`END` blocks inside files whose surrounding content belongs to the user. A tool owns the block, the user owns everything else, and neither destroys the other — the mechanism behind a generated hook, a managed config fragment, or any file your tool and your user both need to edit.

## Why @effected/templates

Most "managed section" implementations put the whole algorithm inside a service that also does file IO, so the hardest logic — deciding what changed, and where a new block belongs — can only be tested by writing files to disk. This package splits the two apart. `SectionDocument` is a pure string-to-string core with no `Effect`, no IO and no runtime: parse a document, compare a declared section against what is already there, reconcile a whole set of them, render the result. `ManagedSection` is a thin service that reads a file, calls the pure core, and writes back only when the text actually changed.

Ambiguity fails typed rather than being resolved by guessing: an unterminated marker, an orphaned `END`, two overlapping sections, or the same identity declared twice are all a typed `SectionParseError` naming the line, never a silent skip that leaves a duplicate block on the next run. Line endings are a first-class invariant too — the document's dominant EOL is detected at parse and every comparison is EOL-normalized, so a CRLF file does not report drift forever.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`FileSystem` comes from `effect` core, not from a platform package, so a consumer provides it once at the edge (`NodeFileSystem.layer` from `@effect/platform-node` on Node). `Path` is deliberately not required — this package treats every path as an opaque string handed straight to `FileSystem`.

## Quick start

Declare two sections and sync them into a file in one call. Declared order becomes file order, so `base` always precedes `tool`, however a user may have reordered the file by hand:

```ts
import { ManagedSection } from "@beep/scratchpad/effected/templates/ManagedSection";
import { SectionId } from "@beep/scratchpad/effected/templates/Section";
import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
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

## Marker attributes

A `BEGIN` marker can carry `name="value"` pairs, so a tool reads a block's provenance — which run wrote it, and when — off the marker line without opening the block:

```ts
import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
import { SectionDocument } from "@beep/scratchpad/effected/templates/SectionDocument";
import { SectionId } from "@beep/scratchpad/effected/templates/Section";
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

## Features

- `SectionDocument` — the pure core: `parse` / `read` / `has` / `check` / `reconcile` / `remove` over a plain string, with no `Effect`, no IO and no runtime needed to test it.
- `ManagedSection` — the service: `read`, `readAll`, `isManaged`, `sync`, `syncAll`, `check`, `checkAll` and `remove`, each writing back only when the text changed.
- `CommentStyle` — an open set of `{prefix, suffix?}` presets (`hash`, `slash`, `semicolon`, `dash`, `html`, `block`) covering both line comments and wrapped ones like `<!-- … -->`, so a managed section can live in Markdown or HTML, not just source files.
- Marker attributes — `name="value"` pairs on a `BEGIN` marker, via `SectionId.section(content, attributes)` and `Section.attributes`: metadata for the tool, never part of a section's identity.
- `SyncOutcome` / `CheckOutcome` — tagged results (`Created` / `Updated` / `Unchanged`, `Absent` / `UpToDate` / `Drifted`) that carry the sections involved rather than a diff, so a caller renders exactly the comparison it needs.
- Byte-preserving outside managed blocks: every character outside a declared section's span survives a sync, in order, including a leading BOM.
- Idempotent by construction: syncing an already-up-to-date document writes nothing and touches no mtime.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/templates` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Lab uses Effect hash collections, Record and Array helpers, owner-local matchers and a tagged defect where upstream uses native collections, Object helpers, sort and Error. (scratchpad/test/templates/SectionDocument.test.ts:43,129; scratchpad/test/templates/SectionDocument.reconcile.test.ts:186,201,217; scratchpad/test/templates/SectionAttributes.test.ts:49,249; scratchpad/test/templates/ManagedSection.test.ts:323; scratchpad/test/templates/SectionDialect.test.ts:181,203)
- **identity-keys** — Lab eagerly stores compiled matchers in each dialect owner while upstream lazily stores them in an identity-keyed WeakMap. (scratchpad/test/templates/SectionDialect.test.ts:181,203)
- **tagged-errors** — Lab uses ManagedSectionTestError for unstubbed defects and preserves encoded cause stacks where upstream throws native Error and omits those stacks. (scratchpad/test/templates/ManagedSection.test.ts:221,323)
- **schema-first** — Lab adds schema authorities, LiteralKit domains, derived guards and named validation messages while upstream has constructor-only outcomes, type-only models and manual validation. (scratchpad/test/templates/SectionDialect.test.ts:175,211; scratchpad/test/templates/SectionDocument.test.ts:309,333,354; scratchpad/test/templates/SectionDocument.reconcile.test.ts:229; scratchpad/test/templates/SectionAttributes.test.ts:358,366,374; scratchpad/test/templates/Section.test.ts:28; scratchpad/test/templates/CommentStyle.test.ts)
- **numeric-domains** — Lab validates offsets and error lines with S.Finite where upstream uses unrestricted Schema.Number or a type-only number. (scratchpad/test/templates/SectionDocument.test.ts:30,38,333 (valid offsets, lines and scan schema))
- **type-safety** — Lab uses narrowing, a nonempty-array helper and inferred record/tuple types where upstream relies on unsafe casts and widened indexing. (scratchpad/test/templates/ManagedSection.test.ts:67,323; scratchpad/test/templates/SectionAttributes.test.ts:336; module suite scratchpad/test/templates/**)
- **tsgo-diagnostics** — Lab adds dual pipeable signatures, named Effect.fn and schema .make construction where upstream has direct-only helpers, Effect.gen and new schema errors. (module suite scratchpad/test/templates/**)
- **effect-first** — Lab uses named Effect.fn, exhaustive Match and Option helpers where upstream uses a generator wrapper, switch and conditional omission spreads. (scratchpad/test/templates/ManagedSection.test.ts:25,67,264,282; scratchpad/test/templates/SectionAttributes.test.ts:374; module suite scratchpad/test/templates/**)
- **effect-imports** — Lab uses dedicated effect/Module imports in source, tests and examples where upstream imports from the effect barrel. (module suite scratchpad/test/templates/**)
- **identity-annotations** — Lab supplies @beep/identity annotations and composer-named JSON Schema definitions and service keys where upstream uses bare names and inline patterns. (scratchpad/test/templates/Section.test.ts:87; scratchpad/test/templates/SectionDialect.test.ts:152; module suite scratchpad/test/templates/**)
- **upstream-bug** — Lab reads and reconciles a block immediately after a leading BOM while upstream rejects it as orphanedEnd. (scratchpad/test/templates/SectionDocument.test.ts:264,283,289)
- **upstream-bug** — Lab normalizes CRLF content before EOL conversion and checks its render UpToDate while upstream doubles carriage returns and reports Drifted. (scratchpad/test/templates/SectionDialect.test.ts:163; scratchpad/test/templates/SectionDocument.test.ts:294)
- **upstream-bug** — Lab precomputes missing-section anchors in linear passes while upstream repeatedly searches them quadratically, preserving the insertion and byte contracts. (scratchpad/test/templates/SectionDocument.reconcile.test.ts:201,217)

### Dependency backlog

None.
