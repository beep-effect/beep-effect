/** Source constructor replay through real owned cleaning and geometry.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCleanerProduced,
  CitationCleanerRuntime,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import {
  CitationDocumentInputFailure,
  CitationDocumentInputProtocols,
  makeCitationInputDocument,
} from "@beep/law-practice-server/internal/Citation/InputDocument";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { readCitationOracleFixture, setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import type { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationInputDocument");
const Value = S.Union([
  S.Struct({ kind: S.tag("unicode"), native: CitationNativeUnicodeHex }),
  S.Struct({ kind: S.tag("none") }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Value", { description: "Sealed native text or None source observations." })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-document-input-modes/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        plainInput: Value,
        markupInput: Value,
        stepsKind: S.String,
        error: S.NullOr(S.Literals(["ValueError", "TypeError", "AttributeError", "RuntimeError"])),
        plain: Value,
        source: Value,
        sourceIsPlainInput: S.Boolean,
        sourceIsMarkupInput: S.Boolean,
        plainIsPlainInput: S.Boolean,
        stepsIsInput: S.Boolean,
        hasForward: S.Boolean,
        hasBackward: S.Boolean,
        events: S.Array(S.String),
        emphasis: S.Array(S.Struct({ text: CitationNativeUnicodeHex, start: S.Natural, end: S.Natural })),
        stepsAfter: S.Union([
          S.Struct({ kind: S.Literals(["list", "tuple"]), items: S.Array(S.String) }),
          S.Struct({ kind: S.tag("none") }),
          S.Struct({ kind: S.tag("generator"), state: S.String }),
        ]),
      })
    ).check(S.isBetweenLength(112, 112)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Authenticated original Document mode, protocol and identity observations.",
  })
);
const load = readCitationOracleFixture(
  "document-input-modes",
  "3f12e818620d16fa7ab9b3ded25c2ab8d95136bb33e70ae6eb7df746784abe37"
).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
const sourceFailure = (sourceError: CitationDocumentInputFailure["sourceError"]) =>
  CitationDocumentInputFailure.make({ reason: "source-protocol", sourceError });

type Row = (typeof Corpus.Type.cases)[number];
const tokensFor = (kind: string) => {
  if (Str.endsWith("html")(kind) || kind === "list-truth-error") return ["html"];
  if (kind === "list-underscores" || kind === "list-false") return ["underscores"];
  if (Str.startsWith("callback-")(kind)) return ["callback"];
  return A.empty<string>();
};
const makeCase = Effect.fn("InputDocumentTest.case")(function* (
  row: Row,
  setup: Effect.Success<ReturnType<typeof setupCitationMetadataRuntime>>,
  diffRuntime: CitationNativeProcessRuntime,
  discovery: Effect.Success<ReturnType<typeof readCitationHtmlDiscoveryCorpus>>["configuration"]
) {
  const h = yield* makeCitationCleanerRegistryHarness(undefined, undefined, setup.observed.spawner).pipe(
    Effect.provideContext(setup.provided)
  );
  const makeValue = (value: typeof Value.Type) =>
    value.kind === "unicode" ? h.values.sourceUnicode(value.native) : h.values.retainHost(null);
  const plain = yield* makeValue(row.plainInput);
  const markup = yield* makeValue(row.markupInput);
  const steps = yield* h.values.retainHost({ kind: row.stepsKind });
  const callback = yield* h.values.retainHost("constructor-callback");
  const events: Array<string> = [];
  const tokens = tokensFor(row.stepsKind);
  let position = 0;
  let generatorState = "GEN_CREATED";
  const traced = Str.startsWith("list-")(row.stepsKind) || Str.startsWith("callback-")(row.stepsKind);
  const generator = Str.startsWith("generator-")(row.stepsKind);
  const handles = new Map<string, CitationCleanerObject>();
  handles.set("callback", callback);
  const html = yield* h.values.text("html");
  handles.set("html", html);
  const underscores = yield* h.values.text("underscores");
  handles.set("underscores", underscores);
  h.hooks({
    hash: () => Effect.succeed(123456789n),
    equal: () => Effect.succeed(false),
    callable: () => Effect.succeed(true),
    invoke: Effect.fnUntraced(function* (_fn, current, work) {
      events.push(row.stepsKind);
      if (row.stepsKind === "callback-none") {
        const none = yield* h.values.retainHost(null);
        return CitationCleanerProduced.make({ value: none, charges: [] });
      }
      const native = yield* h.values.getUnicode(current);
      const amount = O.isSome(native) ? native.value.utf16Units : 0;
      const charges = amount > 0 ? [yield* work.reserveText(amount)] : [];
      return CitationCleanerProduced.make({ value: current, charges });
    }),
    open: Effect.fnUntraced(function* () {
      events.push("clean:start");
      if (traced) events.push("steps:iter");
      if (!generator) position = 0;
      return {
        next: Effect.sync(() => {
          const token = A.get(tokens, position++);
          if (O.isNone(token)) {
            if (generator) generatorState = "GEN_CLOSED";
            events.push("clean:end");
            return O.none<CitationCleanerObject>();
          }
          if (generator) generatorState = "GEN_SUSPENDED";
          const handle = handles.get(token.value);
          if (handle === undefined) throw new Error("missing fixture token");
          return O.some(handle);
        }),
      };
    }),
  });
  const protocols = CitationDocumentInputProtocols.of({
    truth: Effect.fnUntraced(function* (value) {
      if (value !== steps) {
        const native = yield* h.values.getUnicode(value);
        return O.isSome(native) && native.value.pythonLength !== 0;
      }
      if (traced) events.push("steps:truth");
      if (row.stepsKind === "list-truth-error") return yield* sourceFailure("RuntimeError");
      if (row.stepsKind === "list-false" || row.stepsKind === "none") return false;
      return generator || tokens.length !== 0;
    }),
    containsHtml: Effect.fnUntraced(function* () {
      if (traced) events.push("steps:contains:html");
      if (row.stepsKind === "none") return yield* sourceFailure("TypeError");
      if (!generator) return A.contains(tokens, "html");
      while (position < tokens.length) {
        const token = A.getUnsafe(tokens, position++);
        generatorState = "GEN_SUSPENDED";
        if (token === "html") return true;
      }
      generatorState = "GEN_CLOSED";
      return false;
    }),
    insertSourceHtml: Effect.fnUntraced(function* () {
      if (traced) events.push("steps:insert:html:0");
      if (row.stepsKind === "list-permissive") return;
      return yield* sourceFailure(
        Str.startsWith("tuple-")(row.stepsKind) || generator ? "AttributeError" : "TypeError"
      );
    }),
    plan: Effect.fn("InputDocumentTest.plan")(() => Effect.succeed("constructor-steps")),
    warnHtmlAdded: Effect.sync(() => {
      events.push("warning:html-added");
    }),
  });
  const stage = yield* makeCitationInputDocument(setup.limits, setup.runtime, {
    discovery,
    diffRuntime,
  }).pipe(
    Effect.provideContext(setup.provided),
    Effect.provideService(CitationCleanerValues, h.values),
    Effect.provideService(CitationCleanerRuntime, h.registry.runtime),
    Effect.provideService(CitationDocumentInputProtocols, protocols)
  );
  return { h, plain, markup, steps, stage, events: () => events, state: () => ({ generatorState, tokens }) };
});
const checkCase = Effect.fn("InputDocumentTest.check")(function* (
  row: Row,
  fixture: Effect.Success<ReturnType<typeof makeCase>>
) {
  const { h, plain, markup, steps, stage } = fixture;
  const invocation = stage.initialize({ plain, markup, steps });
  const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
  if (row.error !== null) {
    const error = yield* closed.pipe(Effect.flip);
    expect(error, `${row.id}:error`).toMatchObject({ sourceError: row.error });
  } else {
    const result = yield* closed;
    const checkValue = Effect.fnUntraced(function* (handle: CitationCleanerObject, expected: typeof Value.Type) {
      const unicode = yield* h.values.getUnicode(handle);
      if (expected.kind === "none") {
        expect(O.isNone(unicode)).toBe(true);
        const host = yield* h.values.getHost(handle);
        expect(O.getOrThrow(host)).toBe(null);
      } else expect(O.getOrThrow(unicode).storage).toEqual(expected.native);
    });
    yield* checkValue(result.plain, row.plain);
    yield* checkValue(result.source, row.source);
    expect(result.source === plain).toBe(row.sourceIsPlainInput);
    expect(result.source === markup).toBe(row.sourceIsMarkupInput);
    expect(result.plain === plain).toBe(row.plainIsPlainInput);
    expect(result.steps).toBe(steps);
    expect(O.isSome(result.geometry)).toBe(row.hasForward && row.hasBackward);
    if (O.isNone(result.geometry)) expect(result.reservedUnits).toBe(result.cleanerTextUtf16);
    else expect(result.reservedUnits).toBeGreaterThanOrEqual(result.cleanerTextUtf16);
    if (O.isSome(result.geometry)) expect(result.geometry.value.tags).toEqual(row.emphasis);
  }
  expect(fixture.events(), `${row.id}:events`).toEqual(
    A.filter(row.events, (event) => !A.contains(["placeholder", "diff:0", "diff:1", "emphasis"], event))
  );
  if (row.stepsAfter.kind === "generator") expect(fixture.state().generatorState).toBe(row.stepsAfter.state);
  if (row.stepsAfter.kind === "list" || row.stepsAfter.kind === "tuple")
    expect(fixture.state().tokens).toEqual(row.stepsAfter.items);
});
/** Full source replay is hosted; smoke retains ordinary failures, None output and actual geometry. */
export const replayCitationInputDocument = Effect.fn("InputDocumentTest.replay")(function* (full: boolean) {
  const corpus = yield* load;
  const discovery = yield* readCitationHtmlDiscoveryCorpus();
  const setup = yield* setupCitationMetadataRuntime("bun");
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-document-diff-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime("bun", directory);
  const rows = A.filter(
    corpus.cases,
    (row) =>
      full ||
      A.contains(
        [
          0, 14, 15, 16, 23, 24, 27, 28, 29, 30, 32, 34, 35, 36, 39, 40, 41, 42, 43, 49, 53, 54, 56, 57, 70, 79, 84, 86,
          93, 107,
        ],
        row.id
      )
  );
  for (const row of rows) {
    const fixture = yield* makeCase(row, setup, diffRuntime, discovery.configuration);
    yield* checkCase(row, fixture);
  }
  expect(rows).toHaveLength(full ? 112 : 30);
  const exits = yield* setup.observed.snapshot;
  expect(exits).toEqual({ spawned: full ? 55 : 20, confirmed: full ? 55 : 20 });
  const native = yield* setup.admission.snapshot;
  expect(native).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
  const operations = yield* setup.operation.snapshot;
  expect(operations).toMatchObject({ active: 0, queued: 0 });
});
