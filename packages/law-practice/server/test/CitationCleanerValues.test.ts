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
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";

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
        const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
        expect(citationResult1).toBe("cbfc90b78127f947c0f227392cd4af9a51f993271742f950c9802c31522b1eb6");
        const data = yield* S.decodeEffect(CorpusJson)(raw);
        expect(data.cases).toHaveLength(340);
        expect(data.artifacts).toHaveLength(40);
        const strings = HashMap.fromIterable(A.map(data.artifacts, (row) => [row.sha256, row.value] as const));
        const citationResult2 = yield* defaultCitationEnginePolicy;
        const values = yield* makeCitationCleanerValues(citationResult2.limits);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const literal = yield* makeCitationLiteralCleaners(limits);
        const preparation = yield* makeCitationHtmlInput(limits);
        const citationResult3 = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url))
        );
        const kernel = yield* makeCitationHtmlKernel(citationResult3);
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
            const citationResult4 = yield* Effect.flip(apply(row, firstInput));
            expect(citationResult4, row.name).toMatchObject({
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
          const citationResult5 = yield* Effect.fromOption(HashMap.get(strings, row.outcome.text));
          expect(descriptor.text, row.name).toBe(citationResult5);
          expect(descriptor.subtype, row.name).toBe(row.outcome.subtype);
          const citationResult6 = yield* values.same(first, firstInput);
          const citationResult7 = yield* values.same(first, repeated);
          const citationResult8 = yield* values.same(first, independent);
          const citationResult9 = yield* values.same(firstInput, otherInput);
          const citationResult10 = yield* values.same(first, empty);
          const citationResult11 = yield* values.same(first, space);
          expect(
            {
              sameInput: citationResult6,
              sameAcrossCalls: citationResult7,
              sameAcrossInputs: citationResult8,
              sameInputObjects: citationResult9,
              cachedEmpty: citationResult10,
              cachedSpace: citationResult11,
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
        const citationResult12 = yield* values.snapshot;
        expect(citationResult12.cached).toBe(2);
      }),
    { timeout: 60_000 }
  );
});
it.effect(
  "owns original references, rejects restored/foreign values and inconsistent allocation without coercion",
  () =>
    Effect.gen(function* () {
      const citationResult13 = yield* defaultCitationEnginePolicy;
      const values = yield* makeCitationCleanerValues(citationResult13.limits);
      const citationResult14 = yield* defaultCitationEnginePolicy;
      const other = yield* makeCitationCleanerValues(citationResult14.limits);
      const ref = yield* values.text("A");
      expect(Object.isFrozen(ref)).toBe(true);
      const clone = CitationCleanerObject.make({ slot: ref.slot });
      const codec = S.fromJsonString(CitationCleanerObject);
      const citationResult15 = yield* S.encodeEffect(codec)(ref);
      const restored = yield* S.decodeEffect(codec)(citationResult15);
      for (const foreign of [clone, restored, yield* other.text("A")]) {
        const citationResult16 = yield* Effect.flip(values.assertOwned(foreign));
        expect(citationResult16).toMatchObject({ reason: "unissued-value" });
      }
      let hooks = 0;
      const forged = Object.create(null);
      Object.defineProperty(forged, "slot", {
        get: () => {
          hooks++;
          throw new Error("getter");
        },
      });
      const citationResult17 = yield* Effect.flip(values.assertOwned(forged));
      expect(citationResult17).toMatchObject({ reason: "unissued-value" });
      expect(hooks).toBe(0);
      const host = { state: 0 };
      const hostRef = yield* values.retainHost(host);
      const citationResult18 = yield* values.getText(hostRef);
      assertNone(citationResult18);
      const citationResult19 = yield* values.getHost(hostRef);
      assertSome(citationResult19, host);
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
        const citationResult20 = yield* Effect.flip(values.materialize(ref, output));
        expect(citationResult20).toMatchObject({
          reason: "invalid-text-allocation",
        });
      }
      const citationResult21 = yield* Effect.flip(values.materialize(hostRef, { text: "A", allocation: "unchanged" }));
      expect(citationResult21).toMatchObject({
        reason: "invalid-text-allocation",
      });
      const citationResult22 = yield* values.snapshot;
      expect(citationResult22.issued).toBe(before);
      const snapshot = yield* values.getText(ref).pipe(Effect.flatMap(Effect.fromOption));
      Reflect.set(snapshot, "text", "changed snapshot");
      const citationResult23 = yield* values.getText(ref).pipe(Effect.flatMap(Effect.fromOption));
      expect(citationResult23.text).toBe("A");
      const cached = yield* Effect.all(
        A.makeBy(32, () => values.materialize(ref, { text: " ", allocation: "space" })),
        { concurrency: "unbounded" }
      );
      expect(A.every(cached, (value) => value === cached[0])).toBe(true);
      const citationResult24 = yield* values.text("A");
      const citationResult25 = yield* values.same(ref, citationResult24);
      expect(citationResult25).toBe(false);
    })
);
it.effect("captures owner lifetime and clears all arena-held values and caches on scope closure", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const citationResult26 = yield* defaultCitationEnginePolicy;
    const values = yield* makeCitationCleanerValues(citationResult26.limits).pipe(
      Effect.provideService(Scope.Scope, scope)
    );
    const ref = yield* values.text("");
    const host = yield* values.retainHost({ private: "value" });
    yield* values.materialize(ref, { text: " ", allocation: "space" });
    const before = yield* values.snapshot;
    yield* Scope.close(scope, Exit.void);
    const citationResult27 = yield* values.snapshot;
    expect(citationResult27).toEqual({ issued: before.issued, cached: 0, closed: true });
    for (const read of [
      values.assertOwned(ref),
      values.assertOwned(host),
      values.text("A").pipe(Effect.asVoid),
      values.subclass("A", {}).pipe(Effect.asVoid),
      values.retainHost({}).pipe(Effect.asVoid),
    ]) {
      const citationResult28 = yield* Effect.flip(read);
      expect(citationResult28).toMatchObject({ reason: "closed-owner" });
    }
  })
);

it.effect("rejects malformed policy with a closed failure before installing operations", () =>
  Effect.gen(function* () {
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationCleanerValues(policy).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);

it.effect("rejects malformed bytes and native text without issuing references", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const values = yield* makeCitationCleanerValues(limits);
    const before = yield* values.snapshot;
    for (const input of [null, [], [65], "private bytes", { bytes: new Uint8Array([65]) }]) {
      const failure = yield* Effect.flip(values.bytes(input));
      expect(failure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
    for (const operation of [
      values.text(17),
      values.sourceText(null),
      values.subclass({}, {}),
      values.unicode({ width: 2, bytes: new Uint8Array([65]) }),
      values.sourceUnicode({ width: 4, bytes: new Uint8Array([0, 0, 17, 0]) }),
      values.unicodeSubclass({ width: 3, bytes: new Uint8Array([65]) }, {}),
    ]) {
      const failure = yield* Effect.flip(operation);
      expect(failure).toMatchObject({ _tag: "CitationCleanerFailure", reason: "invalid-input" });
    }
    const after = yield* values.snapshot;
    expect(after).toEqual(before);
    const bytes = new Uint8Array([0, 65, 255]);
    const ref = yield* values.bytes(bytes);
    const readBytes = yield* values.getBytes(ref);
    assertSome(readBytes, bytes);
    const byteText = yield* values.getText(ref);
    assertNone(byteText);
    const textRef = yield* values.text("A");
    const textBytes = yield* values.getBytes(textRef);
    assertNone(textBytes);
  })
);

it.effect("applies the captured operation deadline to native materialization without publishing partial text", () =>
  Effect.gen(function* () {
    const clock = yield* Clock.Clock;
    let expired = false;
    let deadlines = 0;
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const values = yield* makeCitationCleanerValues(limits).pipe(
      Effect.provideService(Clock.Clock, {
        ...clock,
        sleep: () => (expired && ++deadlines === 1 ? Effect.void : Effect.never),
      })
    );
    const ref = yield* values.text("A");
    const before = yield* values.snapshot;
    expired = true;
    const failure = yield* Effect.flip(
      values.materialize(ref, {
        text: Str.repeat(100_000)("a"),
        allocation: "fresh",
      })
    );
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "clean", limit: "cleanDeadline" });
    const after = yield* values.snapshot;
    expect(after).toEqual(before);
  })
);
