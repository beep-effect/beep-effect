# @beep/github-reporting

Pure text models for reporting on GitHub surfaces: the check-state vocabulary and its check-run projection, marker-delimited managed documents a human also edits, a debounced check-to-document reconciler, and an escaping-safe GitHub-flavored Markdown writer. Nothing here talks to GitHub. The reconciler writes through a narrow sink you supply, so one registry can drive a pull request comment, a check-run summary or the job summary.

## Why this package

An action that reports progress rewrites a living document as checks resolve. Joining strings breaks that document in two familiar ways. A cell carrying `>=1 || <2` shifts every column after it. And a re-render appends instead of replacing, or wipes the prose a reviewer wrote around the bot's output. This package fixes both with structure rather than string assembly. The writer serializes through `@beep/markdown`, so pipes, fences and brackets are escaped by the serializer. `ManagedDocument` replaces named regions from current state and leaves every byte outside them unchanged.

The suite is a separate modeling package rather than a subpath of the GitHub Actions driver (SPEC D-10). These are pure text models with no driver edge, and repo-cli's reviewer and CI summaries are named reuse sites that must not link a runner runtime. The root entry point does not even reach the markdown engine: `GitHubMarkdown` is subpath-only.

Runtime dependencies: `effect` v4 and the workspace packages `@beep/identity`, `@beep/schema`, `@beep/utils`, `@beep/managed-section` and `@beep/markdown`. Only `GitHubMarkdown` reaches `@beep/markdown`. `@beep/managed-section` is imported through its `CommentStyle`, `Section`, `SectionDialect` and `SectionDocument` leaves only, so `effect/FileSystem` stays out of the closure.

## Usage

### Write GitHub markdown

```ts
import { GitHubMarkdown } from "@beep/github-reporting/GitHubMarkdown";
import * as S from "effect/Schema";

const Row = S.Struct({
  name: S.String.annotate({ title: "Check" }),
  detail: S.String,
});

console.log(GitHubMarkdown.tableFor(Row).render([{ name: "build", detail: "clean" }]));
// | Check | detail |
// | --- | --- |
// | build | clean |
```

`tableFor` takes the table's shape from a row schema. Column order is field declaration order, and each header is the field's `title` annotation. Each cell is the field's encoded form, so a typed field projects through its own codec. A row is an object rather than a positional array, so it cannot transpose columns. `table`, `heading`, `link`, `code`, `codeBlock`, `list`, `details` and `raw` cover the rest; every member takes pre-rendered markdown and returns a string.

### Report checks into a managed document

`ManagedDocument` owns named regions inside text a human also edits. A sentinel HTML comment identifies the document, marker comments delimit each region, and everything outside them survives byte for byte. `CheckDocument` puts a debounced reconciler on top: report a check as its state changes, and a background fiber projects the registry onto the document and writes it through the sink.

```ts
import { CheckDocument, CheckReport } from "@beep/github-reporting";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const doc = yield* CheckDocument;
  yield* doc.report("build", CheckReport.make({ state: "running" }));
  yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
  return yield* doc.flush;
});
// "written"   one write carrying the final state
// "unchanged" the render was byte-identical to the last one, so nothing was sent
// "stale"     a newer run owns the document; this pass was dropped
console.log(Effect.isEffect(program)); // true
```

The debounce is trailing with a max-wait. A burst of reports coalesces into one write carrying the final state, and a steady stream still surfaces progress.

### Share one document between runs

A re-run can overlap the delayed run it replaced. Give the layer this run's `stamp` and a sink that can `read` as well as `write`, and each pass reconciles against the live document instead of a private copy of what this process last wrote:

```ts
import { CheckDocument } from "@beep/github-reporting";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

const layer = CheckDocument.layer({
  namespace: "release-bot",
  key: "checks",
  render: ({ checks, order }) =>
    A.map(order, (name): readonly [string, string] => [
      name,
      O.match(HashMap.get(checks, name), { onNone: () => "unknown", onSome: (report) => report.state }),
    ]),
  sink: { write: (text: string) => Effect.log(text), read: Effect.succeed<string | undefined>(undefined) },
  stamp: { at: "2026-01-01T00:00:00Z", runId: "42" }, // a per-run constant: mint it once at startup
});
console.log(Layer.isLayer(layer)); // true
```

Every region the run writes then carries its `at` and `runId`. A pass whose stamp is strictly older than the newest stamp already on the document is dropped rather than written: `flush` answers `"stale"`, and the reconciler logs the drop once, at the transition. Equal stamps pass, so a run can always refine its own regions. Keeping the stamp constant is what preserves write suppression, because the same run rendering the same state produces byte-identical text.

### Project check states onto the check-run wire form

```ts
import { projectCheckState } from "@beep/github-reporting";

console.log(projectCheckState("running").status); // "in_progress"
console.log(projectCheckState("user_interaction_required").status); // "completed"
```

`CheckState` is deliberately wider than GitHub's conclusion set: `running` is a state rather than the absence of one, and `user_interaction_required` names a pipeline waiting on a human. `projectCheckState` maps each state to a status, plus a conclusion exactly when the status is `completed`.

## Features

- `CheckState` (root): the `CheckState` and `CheckRunConclusion` `LiteralKit` domains, `projectCheckState` onto the `CheckRunProjection` union of `CheckRunInProgress` and `CheckRunCompleted`, and `UnhandledCheckStateError`. The conclusion literals mirror `@beep/github`'s structurally rather than importing them; a test pins the mirror.
- `ManagedDocument` (root): `ManagedDocument` with `parse` and `parseResult`, `region`, `entry`, `regions`, `sentinel`, and `withRegions` and `withRegionsResult` (region content plus optional marker metadata), the `ManagedDocumentSource` input record, `ManagedDocumentError` (typed `kind`, with the marker's line in `markerLine`) and `RejectedRegionDialectError`.
- `CheckDocument` (root): the `CheckDocument` service and its `layer`, the `CheckReport` record, the `CheckDocumentSnapshot` each `checks` read returns, the `CheckDocumentStamp` staleness order (`isAtLeastAsRecent`), `CheckFlushOutcome` (`written`, `unchanged`, `stale`), `CheckDocumentError` (`render`, `read`, `sink`) and the `CheckDocumentOptions`, `CheckDocumentSink` and `CheckDocumentShape` types.
- `GitHubMarkdown` (subpath only, `@beep/github-reporting/GitHubMarkdown`): `table`, `tableFor(schema)`, `heading`, `link`, `code`, `codeBlock`, `list`, `details` and `raw`, with the `GitHubHeadingDepth` domain, the `GitHubListOptions` record and the schema-table types.
- Plain-data records (`CheckReport`, `CheckDocumentSnapshot`, `CheckDocumentStamp`, `GitHubListOptions`, `ManagedDocumentSource`, `CheckRunInProgress`, `CheckRunCompleted`) are branded `S.Opaque` schemas built with `X.make`. `ManagedDocument` stays an `S.Class` because it carries members.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/github-reporting

# from packages/foundation/modeling/github-reporting
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/github-reporting/<Module>` aliases; shared helpers are in `test/support/`. `test/reachability.test.ts` walks the runtime import graph and pins the subpath-only writer and the managed-section leaf imports. `test/GitHubMarkdown.gfm.test.ts` is a GFM HTML differential against micromark with `micromark-extension-gfm`, and `test/GitHubMarkdown.admission.test.ts` is a fixed-seed growth guard that counts node admissions instead of timing them: it spies on the writer's internal `admission.admit` seam (`src/internal/admission.ts`) and pins exactly 30 per row at 5k and 10k rows, with a quadratic-builder negative control. The long-run differential is `goals/effected-promotion/ops/github-reporting-gfm-differential.ts`. `KNOWLEDGE.md` carries the upstream interface notes verbatim.

## Provenance

Ported from the reporting suite of upstream `@effected/github-actions` (MIT, C. Spencer Beggs) through the effected port, which landed it in the scratchpad module `scratchpad/effected/github-actions` (the reporting modules last held at `6964eeb85b28da7cf38913b041242d0467e94abf`). Wave 3-1 of `goals/effected-promotion` then promoted the four reporting modules into this package. The promotion moved the sources to `src/` and their tests to `test/`, and renamed the schema identities from `@beep/scratchpad/effected/github-actions/<Name>` to `@beep/github-reporting/<Name>`. It also made the changes listed under Deviations. The rest of the runtime (inputs, outputs, cache, artifacts, OIDC, installers) moved to the `@beep/github-actions` driver in wave 5. The test-double helper the doubles use (`unstubbed`, `UnstubbedMemberError`) lives in the public `@beep/utils/TestDouble` leaf, which this package and `@beep/github-actions` share.

### Attribution

- Upstream package: `@effected/github-actions` 0.20.0 (modules `CheckState`, `ManagedDocument`, `GitHubMarkdown`, `CheckDocument`)
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`~/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (MIT; beep-effect and upstream notices)

### Added exports

- `UnhandledCheckStateError`, `RejectedRegionDialectError`: added by the port's review round 1, replacing native errors.
- Value exports for `CheckRunConclusion`, `CheckRunInProgress`, `CheckRunCompleted`, `CheckDocumentSnapshot`, `CheckFlushOutcome` and `ManagedDocumentSource`, which the lab barrel exported as types only.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence. Test paths are relative to `test/`.

Promotion (wave 3-1):

- **optional semantics** — `GitHubListOptions.ordered` and `ManagedDocumentSource.text` are exact optional keys (`S.optionalKey`, EF-40), a deliberate deviation from upstream, which accepts an explicit `undefined`: omit the key instead (`GitHubMarkdown.test.ts`, `ManagedDocument.test.ts` pin the rejection; `goals/exact-optional-keys`).
- **renamed field** — `ManagedDocumentError.line` is `markerLine`. Bun's JavaScriptCore defines its own `line` on every `Error`, so an absent `line` field rendered as "at line 0" under Bun only (`ManagedDocument.test.ts`, "the marker line is markerLine, not the engine-owned Error line property").
- **schema-first** — the plain-data records are branded `S.Opaque` built with `X.make`, which copies its input: compare them structurally, never with `===`. `CheckDocumentStamp` and the two `CheckRunProjection` members became `S.Opaque` too, though the wave plan kept the stamp as `S.Class`, because the schema-first detector flags a class whose only member is static. The registry `Ref` holds plain state, and a `CheckDocumentSnapshot` is admitted once per `checks` read and once per reconcile pass (`CheckDocument.test.ts`, "each checks read admits a fresh snapshot from plain registry state").
- **surface** — the root barrel exports `CheckState`, `ManagedDocument` and `CheckDocument`; `GitHubMarkdown` is subpath-only (`index.test.ts`, `reachability.test.ts`).
- **effect-string** — string, array and record operations go through `effect/String`, `effect/Array` and `effect/Record` (`preferEffectString` and friends at error). Indexed reads use `A.get` with an explicit default, not `?? ""`.
- **layer structure** — the `CheckDocument.layer` body is split into named `Effect.fn` helpers sharing one reconcile context. Span names are unchanged.

Carried from the port (the lab ledger rows hold the full upstream and port behaviour):

- **native-runtime** — Effect hash collections, ordered check snapshots and `Clock`/`DateTime` replace native structures and wall-clock reads; zone-less stamps read as UTC (`CheckDocument.test.ts`).
- **identity-keys** — identity-composer keys replace upstream service and reference identities and change the `ManagedDocument` JSON Schema definition paths (`ManagedDocument.test.ts`).
- **upstream-bug** — exact decimal `runId` ordering rejects genuinely older large integers instead of rounding them equal (`CheckDocument.test.ts`).
- **upstream-bug** — sentinel adoption preserves unmanaged whitespace and newline bytes instead of stripping them (`ManagedDocument.test.ts`).
- **upstream-bug** — `ManagedDocument` exposes `trailingCarriageReturn` in its error-kind schema and returns the refusal through the typed `Result` and `Effect` failure channels (`ManagedDocument.test.ts`).
- **upstream-bug** — polling sleeps for the lesser of the quiet interval and the remaining max-wait budget, writing the latest state at 750 ms without a duplicate at scope closure (`CheckDocument.test.ts`).
- **upstream-bug** — direct and schema-derived tables normalize CRLF, CR and LF to `<br>`, preserving row and column relationships (`GitHubMarkdown.test.ts`).
- **upstream-bug** — unmatched unescaped brackets are escaped before link construction, preserving the whole label and its supported emphasis, balanced brackets, escapes and complete code spans (`GitHubMarkdown.test.ts`).
- **upstream-bug** — the label writer adds one balancing backslash to an odd trailing run and preserves even runs and existing inline markup (`GitHubMarkdown.test.ts`).
- **upstream-bug** — list items normalize CRLF and bare CR to LF before serialization, so continuation text stays in one item (`GitHubMarkdown.test.ts`).
- **upstream-bug** — heading text normalizes all three line endings to inline `<br>`, keeping the text within one heading (`GitHubMarkdown.test.ts`).

### Dependency backlog

None.

## License

[MIT](LICENSE). The package `LICENSE` carries both copyright notices: beep-effect and the upstream author, C. Spencer Beggs.
