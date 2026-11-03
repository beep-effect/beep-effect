import * as NodeURL from "node:url";
import { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { makeCitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationPythonHash } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";

const Snapshot = S.Struct({
  width: S.Literals([1, 2, 4]),
  nativeHex: S.String,
  hash: S.BigIntFromString,
  pythonLength: S.Natural,
  utf16Units: S.Natural,
});
const CorpusJson = S.fromJsonString(
  S.Struct({ cases: S.Array(S.Struct({ events: S.Array(S.Struct({ value: Snapshot })) })) })
);
const ShortText = S.String.check(S.isMaxLength(96));

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("owned native Unicode values", (it) => {
  it.effect("retains every source snapshot through issuance, native reads and unchanged materialization", () =>
    Effect.gen(function* () {
      const citationResult1 = yield* FileSystem.FileSystem;
      const raw = yield* citationResult1.readFileString(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/cleaner-unicode.json", import.meta.url))
      );
      const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult2).toBe("0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0");
      const corpus = yield* S.decodeEffect(CorpusJson)(raw);
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const values = yield* makeCitationCleanerValues(limits);
      const hash = yield* makeCitationPythonHash(limits);
      let snapshots = 0;
      for (const row of corpus.cases)
        for (const event of row.events) {
          const source = event.value;
          const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(source.nativeHex);
          const input = yield* values.unicode({ width: source.width, bytes });
          const citationResult3 = yield* values.getUnicode(input);
          const value = yield* Effect.fromOption(citationResult3);
          expect(value.storage.bytes).toEqual(bytes);
          expect(value.storage.width).toBe(source.width);
          expect(value.pythonLength).toBe(source.pythonLength);
          expect(value.utf16Units).toBe(source.utf16Units);
          const citationResult4 = yield* hash.unicode(value.storage);
          expect(citationResult4).toBe(source.hash);
          const output = yield* values.materializeUnicode(
            input,
            { text: value.text, allocation: "unchanged" },
            value.storage
          );
          const citationResult5 = yield* values.same(input, output);
          expect(citationResult5).toBe(true);
          snapshots++;
        }
      expect(corpus.cases).toHaveLength(2016);
      expect(snapshots).toBe(6412);
    })
  );

  it.effect.prop(
    "retains schema-derived text through the native ownership path",
    [ShortText],
    Effect.fnUntraced(function* ([text]) {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const unicode = yield* makeCitationPythonUnicode(limits);
      const values = yield* makeCitationCleanerValues(limits);
      const original = yield* unicode.fromText(text);
      const input = yield* values.unicode(original.storage);
      const citationResult6 = yield* values.getUnicode(input);
      const citationResult7 = yield* Effect.fromOption(citationResult6);
      expect(citationResult7).toEqual(original);
    }),
    { arbitrary: fcRuns(50) }
  );
});

it.effect("protects native bytes, preserves subclass flattening and rejects equal-projection substitutions", () =>
  Effect.gen(function* () {
    const citationResult8 = yield* defaultCitationEnginePolicy;
    const values = yield* makeCitationCleanerValues(citationResult8.limits);
    const bytes = new Uint8Array([0x3d, 0xd8, 0, 0xde]);
    const native = { width: 2, bytes };
    const pair = yield* values.unicode(native);
    const scalar = yield* values.text("😀");
    bytes[0] = 0;
    const citationResult9 = yield* values.getUnicode(pair);
    const first = yield* Effect.fromOption(citationResult9);
    expect(first.pythonLength).toBe(2);
    first.storage.bytes[0] = 0;
    const citationResult10 = yield* values.getUnicode(pair);
    const retained = yield* Effect.fromOption(citationResult10);
    expect(retained.storage.bytes[0]).toBe(0x3d);
    const citationResult11 = yield* values.getUnicode(scalar);
    const scalarValue = yield* Effect.fromOption(citationResult11);
    const before = yield* values.snapshot;
    const citationResult12 = yield* Effect.flip(
      values.materializeUnicode(pair, { text: "😀", allocation: "unchanged" }, scalarValue.storage)
    );
    expect(citationResult12).toMatchObject({ reason: "invalid-text-allocation" });
    const citationResult13 = yield* values.snapshot;
    expect(citationResult13.issued).toBe(before.issued);
    const host = { retained: true };
    const subclass = yield* values.unicodeSubclass(retained.storage, host);
    const citationResult14 = yield* values.getHost(subclass);
    const citationResult15 = yield* Effect.fromOption(citationResult14);
    expect(citationResult15).toBe(host);
    const flattened = yield* values.materialize(subclass, { text: "😀", allocation: "unchanged" });
    const citationResult16 = yield* values.same(subclass, flattened);
    expect(citationResult16).toBe(false);
    const citationResult17 = yield* values.getUnicode(flattened);
    const citationResult18 = yield* Effect.fromOption(citationResult17);
    expect(citationResult18).toEqual(retained);
    const fresh = yield* values.materializeUnicode(scalar, { text: "😀", allocation: "fresh" }, retained.storage);
    const citationResult19 = yield* values.getUnicode(fresh);
    const citationResult20 = yield* Effect.fromOption(citationResult19);
    expect(citationResult20.pythonLength).toBe(2);
    const citationResult21 = yield* values.same(fresh, pair);
    expect(citationResult21).toBe(false);
    const citationResult22 = yield* Effect.flip(values.getUnicode(CitationCleanerObject.make({ slot: pair.slot })));
    expect(citationResult22).toMatchObject({
      reason: "unissued-value",
    });
  })
);

it.effect("enforces captured limits and rejects every native operation after owner closure", () =>
  Effect.gen(function* () {
    const policy = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 1 };
    const scope = yield* Scope.make();
    const values = yield* makeCitationCleanerValues(policy).pipe(Effect.provideService(Scope.Scope, scope));
    policy.producedTextUtf16 = 16;
    const empty = yield* values.text("");
    const native = { width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) };
    const citationResult23 = yield* Effect.flip(values.unicode(native));
    expect(citationResult23).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "clean",
      limit: "producedTextUtf16",
    });
    const citationResult24 = yield* values.snapshot;
    expect(citationResult24.issued).toBe(1);
    yield* Scope.close(scope, Exit.void);
    for (const operation of [
      values.unicode(native).pipe(Effect.asVoid),
      values.unicodeSubclass(native, {}).pipe(Effect.asVoid),
      values.getUnicode(empty).pipe(Effect.asVoid),
      values
        .materializeUnicode(empty, { text: "", allocation: "unchanged" }, { width: 1, bytes: new Uint8Array() })
        .pipe(Effect.asVoid),
    ]) {
      const citationResult25 = yield* Effect.flip(operation);
      expect(citationResult25).toMatchObject({ reason: "closed-owner" });
    }
  })
);

it.effect("reports the captured operation deadline without issuing a partial handle", () =>
  Effect.gen(function* () {
    const original = yield* Clock.Clock;
    const entered = yield* Deferred.make<number>();
    const wake = yield* Deferred.make<void>();
    let armed = false;
    const operationDeadline = Duration.millis(500);
    const citationResult26 = yield* defaultCitationEnginePolicy;
    const values = yield* makeCitationCleanerValues({
      ...citationResult26.limits,
      operationDeadline,
      cleanDeadline: Duration.seconds(1),
    }).pipe(
      Effect.provideService(Clock.Clock, {
        ...original,
        sleep: (duration) =>
          armed
            ? Deferred.succeed(entered, Duration.toMillis(duration)).pipe(Effect.andThen(Deferred.await(wake)))
            : Effect.never,
      })
    );
    armed = true;
    expect(Reflect.set(operationDeadline.value, "millis", 20_000)).toBe(true);
    const pending = yield* values
      .unicode({ width: 1, bytes: new Uint8Array(16_384) })
      .pipe(Effect.provideService(Clock.Clock, { ...original, sleep: () => Effect.never }), Effect.forkChild);
    const citationResult27 = yield* Deferred.await(entered);
    expect(citationResult27).toBe(500);
    yield* Deferred.succeed(wake, undefined);
    const failure = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "clean",
      limit: "operationDeadline",
    });
    const citationResult28 = yield* values.snapshot;
    expect(citationResult28.issued).toBe(0);
  })
);

it.effect("admits original source independently from a smaller produced-value ceiling", () =>
  Effect.gen(function* () {
    const policy = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 8, producedTextUtf16: 1 };
    const values = yield* makeCitationCleanerValues(policy);
    const source = yield* values.sourceText("__");
    const citationResult29 = yield* values.getUnicode(source);
    const citationResult30 = yield* Effect.fromOption(citationResult29);
    expect(citationResult30.utf16Units).toBe(2);
    const native = yield* values.sourceUnicode({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) });
    const citationResult31 = yield* values.getUnicode(native);
    const citationResult32 = yield* Effect.fromOption(citationResult31);
    expect(citationResult32.pythonLength).toBe(2);
    const citationResult33 = yield* Effect.flip(values.text("__"));
    expect(citationResult33).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "producedTextUtf16",
    });
    const citationResult34 = yield* Effect.flip(values.sourceText("123456789"));
    expect(citationResult34).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "sourceUtf16",
    });
    const citationResult35 = yield* values.snapshot;
    expect(citationResult35.issued).toBe(2);
  })
);

it.effect("admits only fixed server names independently of request/output ceilings", () =>
  Effect.gen(function* () {
    const citationResult36 = yield* defaultCitationEnginePolicy;
    const values = yield* makeCitationCleanerValues({
      ...citationResult36.limits,
      sourceUtf16: 1,
      producedTextUtf16: 1,
    });
    const name = yield* values.builtinName("inline_whitespace");
    const citationResult37 = yield* values.getUnicode(name);
    const citationResult38 = yield* Effect.fromOption(citationResult37);
    expect(citationResult38.utf16Units).toBe(17);
    const citationResult39 = yield* Effect.flip(values.builtinName("arbitrary callback output"));
    expect(citationResult39).toMatchObject({
      reason: "invalid-input",
    });
    const citationResult40 = yield* Effect.flip(values.text("inline_whitespace"));
    expect(citationResult40).toMatchObject({ limit: "producedTextUtf16" });
    const citationResult41 = yield* values.snapshot;
    expect(citationResult41.issued).toBe(1);
  })
);
