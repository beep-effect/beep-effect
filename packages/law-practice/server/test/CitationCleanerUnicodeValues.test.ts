import * as NodeURL from "node:url";
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
import { CitationCleanerObject } from "../src/internal/Citation/CleanerPipeline.ts";
import { makeCitationCleanerValues } from "../src/internal/Citation/CleanerValues.ts";
import { makeCitationPythonHash } from "../src/internal/Citation/PythonHash.ts";
import { makeCitationPythonUnicode } from "../src/internal/Citation/PythonUnicode.ts";

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
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/cleaner-unicode.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0"
      );
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
          const value = yield* Effect.fromOption(yield* values.getUnicode(input));
          expect(value.storage.bytes).toEqual(bytes);
          expect(value.storage.width).toBe(source.width);
          expect(value.pythonLength).toBe(source.pythonLength);
          expect(value.utf16Units).toBe(source.utf16Units);
          expect(yield* hash.unicode(value.storage)).toBe(source.hash);
          const output = yield* values.materializeUnicode(
            input,
            { text: value.text, allocation: "unchanged" },
            value.storage
          );
          expect(yield* values.same(input, output)).toBe(true);
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
      expect(yield* Effect.fromOption(yield* values.getUnicode(input))).toEqual(original);
    }),
    { arbitrary: fcRuns(50) }
  );
});

it.effect("protects native bytes, preserves subclass flattening and rejects equal-projection substitutions", () =>
  Effect.gen(function* () {
    const values = yield* makeCitationCleanerValues((yield* defaultCitationEnginePolicy).limits);
    const bytes = new Uint8Array([0x3d, 0xd8, 0, 0xde]);
    const native = { width: 2, bytes };
    const pair = yield* values.unicode(native);
    const scalar = yield* values.text("😀");
    bytes[0] = 0;
    const first = yield* Effect.fromOption(yield* values.getUnicode(pair));
    expect(first.pythonLength).toBe(2);
    first.storage.bytes[0] = 0;
    const retained = yield* Effect.fromOption(yield* values.getUnicode(pair));
    expect(retained.storage.bytes[0]).toBe(0x3d);
    const scalarValue = yield* Effect.fromOption(yield* values.getUnicode(scalar));
    const before = yield* values.snapshot;
    expect(
      yield* Effect.flip(values.materializeUnicode(pair, { text: "😀", allocation: "unchanged" }, scalarValue.storage))
    ).toMatchObject({ reason: "invalid-text-allocation" });
    expect((yield* values.snapshot).issued).toBe(before.issued);
    const host = { retained: true };
    const subclass = yield* values.unicodeSubclass(retained.storage, host);
    expect(yield* Effect.fromOption(yield* values.getHost(subclass))).toBe(host);
    const flattened = yield* values.materialize(subclass, { text: "😀", allocation: "unchanged" });
    expect(yield* values.same(subclass, flattened)).toBe(false);
    expect(yield* Effect.fromOption(yield* values.getUnicode(flattened))).toEqual(retained);
    const fresh = yield* values.materializeUnicode(scalar, { text: "😀", allocation: "fresh" }, retained.storage);
    expect((yield* Effect.fromOption(yield* values.getUnicode(fresh))).pythonLength).toBe(2);
    expect(yield* values.same(fresh, pair)).toBe(false);
    expect(yield* Effect.flip(values.getUnicode(CitationCleanerObject.make({ slot: pair.slot })))).toMatchObject({
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
    expect(yield* Effect.flip(values.unicode(native))).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "clean",
      limit: "producedTextUtf16",
    });
    expect((yield* values.snapshot).issued).toBe(1);
    yield* Scope.close(scope, Exit.void);
    for (const operation of [
      values.unicode(native).pipe(Effect.asVoid),
      values.unicodeSubclass(native, {}).pipe(Effect.asVoid),
      values.getUnicode(empty).pipe(Effect.asVoid),
      values
        .materializeUnicode(empty, { text: "", allocation: "unchanged" }, { width: 1, bytes: new Uint8Array() })
        .pipe(Effect.asVoid),
    ]) {
      expect(yield* Effect.flip(operation)).toMatchObject({ reason: "closed-owner" });
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
    const values = yield* makeCitationCleanerValues({
      ...(yield* defaultCitationEnginePolicy).limits,
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
    expect(yield* Deferred.await(entered)).toBe(500);
    yield* Deferred.succeed(wake, undefined);
    const failure = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      operation: "clean",
      limit: "operationDeadline",
    });
    expect((yield* values.snapshot).issued).toBe(0);
  })
);

it.effect("admits original source independently from a smaller produced-value ceiling", () =>
  Effect.gen(function* () {
    const policy = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 8, producedTextUtf16: 1 };
    const values = yield* makeCitationCleanerValues(policy);
    const source = yield* values.sourceText("__");
    expect((yield* Effect.fromOption(yield* values.getUnicode(source))).utf16Units).toBe(2);
    const native = yield* values.sourceUnicode({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) });
    expect((yield* Effect.fromOption(yield* values.getUnicode(native))).pythonLength).toBe(2);
    expect(yield* Effect.flip(values.text("__"))).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "producedTextUtf16",
    });
    expect(yield* Effect.flip(values.sourceText("123456789"))).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "sourceUtf16",
    });
    expect((yield* values.snapshot).issued).toBe(2);
  })
);
