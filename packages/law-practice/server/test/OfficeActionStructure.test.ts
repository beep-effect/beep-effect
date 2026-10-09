import { GroundedExtraction } from "@beep/langextract/Extraction";
import { DocStructureDocument, DocStructureRuleFamily } from "@beep/law-practice-domain";
import {
  OfficeActionDocketIntakeLive,
  officeActionStructureFileStore,
} from "@beep/law-practice-server/OfficeActionStructure";
import {
  OfficeActionAttemptRequest,
  OfficeActionDocketIntake,
  OfficeActionEvidenceConsumer,
  OfficeActionStructureAttempt,
  OfficeActionStructureStore,
} from "@beep/law-practice-use-cases/OfficeActionStructure";
import { VerifySourceTextIdentityInput } from "@beep/provenance/VerifiedTextAnchor";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixtureOcrPage, fixtureSource, readFixture, TestCrypto } from "../../use-cases/test/officeActionFixtures.ts";

const document = DocStructureDocument.make({
  documentId: "fixture",
  sourceVersion: "1",
  modality: "public-form-language",
});
const filename = "/history/attempts.jsonl";
class TestState extends Context.Service<
  TestState,
  {
    readonly delivered: Ref.Ref<number>;
    readonly verification: VerifySourceTextIdentityInput;
    readonly text: string;
    readonly originalBytes: Ref.Ref<string>;
  }
>()("OfficeActionStructureTest/State") {}
const StateLive = Layer.effect(
  TestState,
  Effect.gen(function* () {
    const text = yield* readFixture("oa-001.txt");
    const { verification } = yield* fixtureSource(text);
    return { text, verification, delivered: yield* Ref.make(0), originalBytes: yield* Ref.make("") };
  })
).pipe(Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layer, Path.layer, TestCrypto)));
const ConsumerLive = Layer.effect(
  OfficeActionEvidenceConsumer,
  Effect.gen(function* () {
    const state = yield* TestState;
    return OfficeActionEvidenceConsumer.of({
      receive: Effect.fnUntraced(function* (pair) {
        expect(pair.candidates).toHaveLength(2);
        expect("approval" in pair).toBe(false);
        expect("admitted" in pair).toBe(false);
        yield* Ref.update(state.delivered, (n) => n + 1);
      }),
    });
  })
).pipe(Layer.provideMerge(StateLive));
const composition = () =>
  OfficeActionDocketIntakeLive.pipe(Layer.provideMerge(officeActionStructureFileStore(filename)));
it.layer(ConsumerLive, { timeout: "10 seconds", concurrent: false })("office-action durable evidence intake", (it) => {
  it.layer(composition(), { timeout: "10 seconds", concurrent: false })("initial writer", (it) => {
    it.effect("persists an atomic evidence pair with no admission state", () =>
      Effect.gen(function* () {
        const state = yield* TestState;
        const intake = yield* OfficeActionDocketIntake;
        const fs = yield* FileSystem.FileSystem;
        const outcome = yield* intake.record(
          OfficeActionAttemptRequest.make({ attemptId: "a-1", document, verification: state.verification })
        );
        yield* intake.deliver(outcome);
        yield* Ref.set(state.originalBytes, yield* fs.readFileString(filename));
        expect(yield* Ref.get(state.delivered)).toBe(1);
      })
    );
  });
  it.layer(composition(), { timeout: "10 seconds", concurrent: false })("restarted reader and writer", (it) => {
    it.effect("reverifies serialized receipts, retains v1 and appends failure and re-anchor history", () =>
      Effect.gen(function* () {
        const state = yield* TestState;
        const intake = yield* OfficeActionDocketIntake;
        const store = yield* OfficeActionStructureStore;
        const fs = yield* FileSystem.FileSystem;
        const initial = yield* store.read;
        const first = yield* Effect.fromOption(A.head(initial), () => "missing first attempt");
        const encoded = yield* S.encodeEffect(S.fromJsonString(OfficeActionStructureAttempt))(first);
        const decoded = yield* S.decodeEffect(S.fromJsonString(OfficeActionStructureAttempt))(encoded);
        expect(decoded).toEqual(first);
        const replayed = yield* intake.replay(decoded, state.verification);
        yield* intake.deliver(replayed);

        const changed = yield* fixtureSource(`prefix ${state.text}`);
        const unauthorized = OfficeActionStructureAttempt.make({ ...first, expectedSource: changed.source });
        const unauthorizedReplay = yield* intake.replay(unauthorized, state.verification).pipe(Effect.flip);
        expect(unauthorizedReplay._tag).toBe("VerifiedTextAnchorError");
        const firstExtraction = yield* Effect.fromOption(
          A.head(first.extractions),
          () => "missing retained extraction"
        );
        if (!GroundedExtraction.guards.match_exact(firstExtraction))
          return yield* Effect.die("Expected retained exact extraction.");
        const badQuote = Str.repeat(Str.length(firstExtraction.matchedText))("x");
        const tamperedExtractions = OfficeActionStructureAttempt.make({
          ...first,
          extractions: [
            GroundedExtraction.cases.match_exact.make({
              label: firstExtraction.label,
              text: badQuote,
              matchedText: badQuote,
              span: firstExtraction.span,
            }),
            ...A.drop(first.extractions, 1),
          ],
        });
        const invalidReplay = yield* intake.replay(tamperedExtractions, state.verification).pipe(Effect.flip);
        expect(invalidReplay._tag).toBe("VerifiedTextAnchorError");
        if (invalidReplay._tag === "VerifiedTextAnchorError") expect(invalidReplay.reason).toBe("quote-mismatch");
        const staleReplay = yield* intake.replay(first, changed.verification).pipe(Effect.flip);
        expect(staleReplay._tag).toBe("VerifiedTextAnchorError");
        const second = yield* intake.record(
          OfficeActionAttemptRequest.make({
            attemptId: "a-2",
            previousAttemptId: O.some("a-1"),
            document,
            verification: state.verification,
            rule: DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 2 }),
          })
        );
        expect(second).toMatchObject({ status: "abstained", code: "rule-not-covered" });
        yield* intake.deliver(second);
        const duplicate = yield* store.append(first).pipe(Effect.flip);
        expect(duplicate.message).toContain("unique");
        const failure = yield* intake
          .record(
            OfficeActionAttemptRequest.make({
              attemptId: "a-3",
              previousAttemptId: O.some("a-2"),
              document,
              verification: VerifySourceTextIdentityInput.make({
                expectedSource: state.verification.expectedSource,
                source: changed.source,
                sourceText: `prefix ${state.text}`,
              }),
            })
          )
          .pipe(Effect.flip);
        expect(failure._tag).toBe("VerifiedTextAnchorError");
        const reanchored = yield* intake.record(
          OfficeActionAttemptRequest.make({
            attemptId: "a-4",
            previousAttemptId: O.some("a-3"),
            document: DocStructureDocument.make({ ...document, sourceVersion: "2" }),
            verification: changed.verification,
          })
        );
        expect(reanchored.status).toBe("recognized");
        const finalHistory = yield* store.read;
        expect(finalHistory).toHaveLength(4);
        expect(finalHistory[0]).toEqual(first);
        expect(finalHistory[2]?.outcome).toMatchObject({ status: "failed", reason: "stale-source" });
        const fourth = yield* Effect.fromOption(A.get(finalHistory, 3), () => "missing fourth attempt");
        assertSome(fourth.previousAttemptId, "a-3");
        expect((yield* intake.replay(first, state.verification)).status).toBe("recognized");
        expect(yield* store.find(first.source, first.rule)).toHaveLength(1);
        const bytes = yield* fs.readFileString(filename);
        expect(Str.startsWith(yield* Ref.get(state.originalBytes))(bytes)).toBe(true);
        expect(yield* Ref.get(state.delivered)).toBe(2);
        const page = yield* fixtureOcrPage(state.text);
        const lowQuality = yield* intake.record(
          OfficeActionAttemptRequest.make({
            attemptId: "a-5",
            previousAttemptId: O.some("a-4"),
            document,
            verification: state.verification,
            ocrPages: [page],
          })
        );
        expect(lowQuality).toMatchObject({ status: "abstained", code: "low-quality-source" });
        const final = yield* store.read;
        const ocrAttempt = yield* Effect.fromOption(A.last(final), () => "missing OCR attempt");
        expect(ocrAttempt.ocrPages).toHaveLength(1);
        expect(yield* intake.replay(ocrAttempt, state.verification)).toMatchObject({
          status: "abstained",
          code: "low-quality-source",
        });
        yield* intake.deliver(lowQuality);
        expect(yield* Ref.get(state.delivered)).toBe(2);
      })
    );
    it.effect("rejects partial lines and a tampered predecessor chain", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* OfficeActionStructureStore;
        const rows = yield* store.read;
        const original = yield* fs.readFileString(filename);
        yield* fs.writeFileString(filename, Str.slice(0, -1)(original));
        expect((yield* store.read.pipe(Effect.flip))._tag).toBe("OfficeActionStructureStorageError");
        const first = yield* Effect.fromOption(A.head(rows), () => "missing first");
        const corrupt = OfficeActionStructureAttempt.make({ ...first, previousAttemptId: O.some("missing") });
        yield* fs.writeFileString(
          filename,
          `${yield* S.encodeEffect(S.fromJsonString(OfficeActionStructureAttempt))(corrupt)}\n`
        );
        expect((yield* store.read.pipe(Effect.flip))._tag).toBe("OfficeActionStructureStorageError");
        yield* fs.writeFileString(filename, original);
      })
    );
  });
});
