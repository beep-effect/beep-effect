import {
  AttachmentFailure,
  AttachmentInvalidMimeType,
  AttachmentPortFailed,
  AttachmentRejection,
  AttachmentTooLarge,
  ImageAttachmentMimeType,
} from "@beep/editor/chat/attachment-model";
import {
  ComposerFeatures,
  MentionOption,
  MentionOptions,
  SendOn,
  SlashItem,
  SlashItems,
} from "@beep/editor/chat/config";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeMentionOptionResult = S.decodeResult(MentionOption);
const decodeMentionOptionsResult = S.decodeResult(MentionOptions);
const decodeSlashItemResult = S.decodeResult(SlashItem);
const decodeSlashItemsResult = S.decodeResult(SlashItems);
const decodeAttachmentRejection = S.decodeEffect(AttachmentRejection);
// Round-trip comparisons use each codec's declared equivalence: raw Equal.equals
// can see runtime metadata outside the encoded schema contract.
const sendOnEquivalence = S.toEquivalence(SendOn);
const imageAttachmentMimeTypeEquivalence = S.toEquivalence(ImageAttachmentMimeType);
const composerFeaturesEquivalence = S.toEquivalence(ComposerFeatures);
const attachmentRejectionEquivalence = S.toEquivalence(AttachmentRejection);
const decodeComposerFeatures = S.decodeEffect(ComposerFeatures);
const decodeImageAttachmentMimeType = S.decodeEffect(ImageAttachmentMimeType);
const decodeSendOn = S.decodeEffect(SendOn);
const encodeAttachmentFailure = S.encodeEffect(AttachmentFailure);
const encodeAttachmentRejection = S.encodeEffect(AttachmentRejection);
const encodeComposerFeatures = S.encodeEffect(ComposerFeatures);
const encodeImageAttachmentMimeType = S.encodeEffect(ImageAttachmentMimeType);
const encodeSendOn = S.encodeEffect(SendOn);

describe("@beep/editor schema crispening parity", () => {
  it.effect("keeps touched encoded wire shapes byte-identical", () =>
    Effect.gen(function* () {
      const tooLarge = AttachmentTooLarge.make({
        filename: "recording.mov",
        size: 15_000_000,
        maxBytes: 10_485_760,
      });
      const invalidMimeType = AttachmentInvalidMimeType.make({
        filename: "payload.bin",
        mimeType: "",
      });
      const portFailure = AttachmentPortFailed.make({
        message: "Files could not be attached.",
      });
      const features = ComposerFeatures.make({ toolbar: false });

      expect(yield* encodeAttachmentRejection(tooLarge)).toEqual({
        _tag: "AttachmentTooLarge",
        filename: "recording.mov",
        size: 15_000_000,
        maxBytes: 10_485_760,
      });
      expect(yield* encodeAttachmentRejection(invalidMimeType)).toEqual({
        _tag: "AttachmentInvalidMimeType",
        filename: "payload.bin",
        mimeType: "",
      });
      expect(yield* encodeAttachmentFailure(portFailure)).toEqual({
        _tag: "AttachmentPortFailed",
        message: "Files could not be attached.",
      });
      expect(yield* encodeComposerFeatures(features)).toEqual({
        toolbar: false,
        slash: true,
        mentions: true,
        attachments: true,
        characterCount: true,
        sendOn: "enter",
      });
    })
  );

  it.effect("round-trips pure chat schemas with schema-derived arbitraries", () =>
    Effect.gen(function* () {
      const sendOn = yield* Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(SendOn)]), ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeSendOn(value);
          const decoded = yield* decodeSendOn(encoded);
          expect(sendOnEquivalence(decoded, value)).toBe(true);

          return true;
        })
      );
      expect(sendOn._tag).toBe("Passed");
      const mimeTypes = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(ImageAttachmentMimeType)]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeImageAttachmentMimeType(value);
            const decoded = yield* decodeImageAttachmentMimeType(encoded);
            expect(imageAttachmentMimeTypeEquivalence(decoded, value)).toBe(true);

            return true;
          })
      );
      expect(mimeTypes._tag).toBe("Passed");
      const features = yield* Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(ComposerFeatures)]), ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* encodeComposerFeatures(value);
          const decoded = yield* decodeComposerFeatures(encoded);
          expect(composerFeaturesEquivalence(decoded, value)).toBe(true);

          return true;
        })
      );
      expect(features._tag).toBe("Passed");
      const rejections = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(AttachmentRejection)]),
        ([value]) =>
          Effect.gen(function* () {
            const encoded = yield* encodeAttachmentRejection(value);
            const decoded = yield* decodeAttachmentRejection(encoded);
            expect(attachmentRejectionEquivalence(decoded, value)).toBe(true);

            return true;
          })
      );
      expect(rejections._tag).toBe("Passed");
    })
  );

  it("rejects empty menu identity and display fields at the schema boundary", () => {
    expect(
      Result.isFailure(
        decodeSlashItemResult({
          key: "",
          label: "Heading",
          onSelect: () => undefined,
        })
      )
    ).toBe(true);
    expect(Result.isFailure(decodeMentionOptionResult({ id: "", label: "Ada" }))).toBe(true);
    expect(
      Result.isFailure(
        decodeSlashItemsResult([
          { key: "paragraph", label: "Paragraph", onSelect: () => undefined },
          { key: "", label: "Broken", onSelect: () => undefined },
        ])
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeMentionOptionsResult([
          { id: "ada", label: "Ada" },
          { id: "", label: "Broken" },
        ])
      )
    ).toBe(true);
  });

  it("rejects duplicate collection identities at their exact field paths", () => {
    const duplicateSlashItems = decodeSlashItemsResult([
      { key: "same", label: "First", onSelect: () => undefined },
      { key: "same", label: "Second", onSelect: () => undefined },
    ]);
    const duplicateMentions = decodeMentionOptionsResult([
      { id: "same", label: "First" },
      { id: "same", label: "Second" },
    ]);

    expect(Result.isFailure(duplicateSlashItems)).toBe(true);
    expect(Result.isFailure(duplicateMentions)).toBe(true);
    if (Result.isFailure(duplicateSlashItems)) {
      expect(String(duplicateSlashItems.failure)).toContain('at [1]["key"]');
      expect(String(duplicateSlashItems.failure)).toContain("Duplicate slash-command key");
    }
    if (Result.isFailure(duplicateMentions)) {
      expect(String(duplicateMentions.failure)).toContain('at [1]["id"]');
      expect(String(duplicateMentions.failure)).toContain("Duplicate mention-option id");
    }
  });
});
