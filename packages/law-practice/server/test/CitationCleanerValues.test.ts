import * as NodeURL from "node:url";
import { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { citationCleanerHtmlTextOutput } from "@beep/law-practice-server/internal/Citation/CleanerTextIdentity";
import { makeCitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationHtmlInput } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import { makeCitationHtmlKernel } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import { makeCitationLiteralCleaners } from "@beep/law-practice-server/internal/Citation/LiteralCleaners";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";

const Relations = S.Struct({
  sameInput: S.Boolean,
  sameAcrossCalls: S.Boolean,
  sameAcrossInputs: S.Boolean,
  sameInputObjects: S.Boolean,
  cachedEmpty: S.Boolean,
  cachedSpace: S.Boolean,
});
const Row = S.Struct({
  name: S.String,
  cleaner: S.Literals(["html", "inline_whitespace", "all_whitespace", "underscores", "xml"]),
  input: S.String,
  subtype: S.Literals(["plain", "marked"]),
  hooks: S.Array(S.String),
  outcome: S.Union([
    S.Struct({ kind: S.tag("success"), text: S.String, subtype: S.tag("plain"), ...Relations.fields }),
    S.Struct({ kind: S.tag("error"), type: S.tag("lxml.etree.ParserError"), message: S.String }),
  ]).pipe(S.toTaggedUnion("kind")),
});
const CorpusJson = S.fromJsonString(
  S.Struct({ artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })), cases: S.Array(Row) })
);

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("scoped cleaner values", (it) => {
  it.effect(
    "matches all pinned text identity/subclass relations through the actual builtin implementations",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const raw = yield* fs.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/cleaner-identities.json", import.meta.url)
          )
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "cbfc90b78127f947c0f227392cd4af9a51f993271742f950c9802c31522b1eb6"
        );
        const data = yield* S.decodeEffect(CorpusJson)(raw);
        expect(data.cases).toHaveLength(340);
        expect(data.artifacts).toHaveLength(40);
        const strings = HashMap.fromIterable(A.map(data.artifacts, (row) => [row.sha256, row.value] as const));
        const values = yield* makeCitationCleanerValues((yield* defaultCitationEnginePolicy).limits);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const literal = yield* makeCitationLiteralCleaners(limits);
        const preparation = yield* makeCitationHtmlInput(limits);
        const kernel = yield* makeCitationHtmlKernel(
          yield* fs.readFile(NodeURL.fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url)))
        );
        const empty = yield* values.text("");
        const space = yield* values.materialize(empty, { text: " ", allocation: "space" });
        let coercions = 0;
        const poison = new Proxy(
          {},
          {
            get: () => {
              coercions++;
              throw new Error("host hook");
            },
            ownKeys: () => {
              coercions++;
              throw new Error("host keys");
            },
          }
        );
        const apply = Effect.fn("CleanerValuesTest.apply")(function* (
          row: typeof Row.Type,
          ref: CitationCleanerObject
        ) {
          const descriptor = yield* values.getText(ref).pipe(Effect.flatMap(Effect.fromOption));
          const output =
            row.cleaner === "html"
              ? yield* preparation
                  .prepareStage(descriptor.text, () => Effect.void)
                  .pipe(
                    Effect.flatMap((input) => kernel.run({ input, outputUtf16: limits.producedTextUtf16 })),
                    Effect.map(citationCleanerHtmlTextOutput)
                  )
              : yield* literal.applyOutput({ cleaner: row.cleaner, text: descriptor.text });
          return yield* values.materialize(ref, output);
        });
        let successes = 0;
        let failures = 0;
        for (const row of data.cases) {
          const text = yield* Effect.fromOption(HashMap.get(strings, row.input));
          const firstInput = yield* row.subtype === "marked" ? values.subclass(text, poison) : values.text(text);
          const otherInput = yield* row.subtype === "marked" ? values.subclass(text, poison) : values.text(text);
          expect(row.hooks).toEqual([]);
          if (row.outcome.kind === "error") {
            expect(yield* Effect.flip(apply(row, firstInput)), row.name).toMatchObject({
              _tag: "CitationHtmlKernelFailure",
              reason: "parse-error",
            });
            failures++;
            continue;
          }
          const first = yield* apply(row, firstInput);
          const repeated = yield* apply(row, firstInput);
          const independent = yield* apply(row, otherInput);
          const descriptor = yield* values.getText(first).pipe(Effect.flatMap(Effect.fromOption));
          expect(descriptor.text, row.name).toBe(yield* Effect.fromOption(HashMap.get(strings, row.outcome.text)));
          expect(descriptor.subtype, row.name).toBe(row.outcome.subtype);
          expect(
            {
              sameInput: yield* values.same(first, firstInput),
              sameAcrossCalls: yield* values.same(first, repeated),
              sameAcrossInputs: yield* values.same(first, independent),
              sameInputObjects: yield* values.same(firstInput, otherInput),
              cachedEmpty: yield* values.same(first, empty),
              cachedSpace: yield* values.same(first, space),
            },
            row.name
          ).toEqual({
            sameInput: row.outcome.sameInput,
            sameAcrossCalls: row.outcome.sameAcrossCalls,
            sameAcrossInputs: row.outcome.sameAcrossInputs,
            sameInputObjects: row.outcome.sameInputObjects,
            cachedEmpty: row.outcome.cachedEmpty,
            cachedSpace: row.outcome.cachedSpace,
          });
          successes++;
        }
        expect(successes).toBe(324);
        expect(failures).toBe(16);
        expect(coercions).toBe(0);
        expect((yield* values.snapshot).cached).toBe(2);
      }),
    { timeout: 60_000 }
  );
});
it.effect(
  "owns original references, rejects restored/foreign values and inconsistent allocation without coercion",
  () =>
    Effect.gen(function* () {
      const values = yield* makeCitationCleanerValues((yield* defaultCitationEnginePolicy).limits);
      const other = yield* makeCitationCleanerValues((yield* defaultCitationEnginePolicy).limits);
      const ref = yield* values.text("A");
      expect(Object.isFrozen(ref)).toBe(true);
      const clone = CitationCleanerObject.make({ slot: ref.slot });
      const codec = S.fromJsonString(CitationCleanerObject);
      const restored = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(ref));
      for (const foreign of [clone, restored, yield* other.text("A")]) {
        expect(yield* Effect.flip(values.assertOwned(foreign))).toMatchObject({ reason: "unissued-value" });
      }
      let hooks = 0;
      const forged = Object.create(null);
      Object.defineProperty(forged, "slot", {
        get: () => {
          hooks++;
          throw new Error("getter");
        },
      });
      expect(yield* Effect.flip(values.assertOwned(forged))).toMatchObject({ reason: "unissued-value" });
      expect(hooks).toBe(0);
      const host = { state: 0 };
      const hostRef = yield* values.retainHost(host);
      assertNone(yield* values.getText(hostRef));
      assertSome(yield* values.getHost(hostRef), host);
      host.state++;
      const retained = yield* values.getHost(hostRef).pipe(Effect.flatMap(Effect.fromOption));
      expect(retained).toBe(host);
      const before = (yield* values.snapshot).issued;
      for (const output of [
        { text: "B", allocation: "unchanged" },
        { text: "X", allocation: "space" },
        { text: "X", allocation: "empty" },
        { text: "", allocation: "fresh" },
        { text: "A", allocation: "unknown" },
      ]) {
        expect(yield* Effect.flip(values.materialize(ref, output))).toMatchObject({
          reason: "invalid-text-allocation",
        });
      }
      expect(yield* Effect.flip(values.materialize(hostRef, { text: "A", allocation: "unchanged" }))).toMatchObject({
        reason: "invalid-text-allocation",
      });
      expect((yield* values.snapshot).issued).toBe(before);
      const snapshot = yield* values.getText(ref).pipe(Effect.flatMap(Effect.fromOption));
      Reflect.set(snapshot, "text", "changed snapshot");
      expect((yield* values.getText(ref).pipe(Effect.flatMap(Effect.fromOption))).text).toBe("A");
      const cached = yield* Effect.all(
        A.makeBy(32, () => values.materialize(ref, { text: " ", allocation: "space" })),
        { concurrency: "unbounded" }
      );
      expect(A.every(cached, (value) => value === cached[0])).toBe(true);
      expect(yield* values.same(ref, yield* values.text("A"))).toBe(false);
    })
);
it.effect("captures owner lifetime and clears all arena-held values and caches on scope closure", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const values = yield* makeCitationCleanerValues((yield* defaultCitationEnginePolicy).limits).pipe(
      Effect.provideService(Scope.Scope, scope)
    );
    const ref = yield* values.text("");
    const host = yield* values.retainHost({ private: "value" });
    yield* values.materialize(ref, { text: " ", allocation: "space" });
    const before = yield* values.snapshot;
    yield* Scope.close(scope, Exit.void);
    expect(yield* values.snapshot).toEqual({ issued: before.issued, cached: 0, closed: true });
    for (const read of [
      values.assertOwned(ref),
      values.assertOwned(host),
      values.text("A").pipe(Effect.asVoid),
      values.subclass("A", {}).pipe(Effect.asVoid),
      values.retainHost({}).pipe(Effect.asVoid),
    ]) {
      expect(yield* Effect.flip(read)).toMatchObject({ reason: "closed-owner" });
    }
  })
);
