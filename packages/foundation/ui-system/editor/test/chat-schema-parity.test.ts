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
import { Effect, pipe, Result } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeMentionOptionResult = S.decodeResult(MentionOption);
const decodeMentionOptionsResult = S.decodeResult(MentionOptions);
const decodeSlashItemResult = S.decodeResult(SlashItem);
const decodeSlashItemsResult = S.decodeResult(SlashItems);
const decodeAttachmentRejectionSync = S.decodeSync(AttachmentRejection);
// Round-trip comparisons use each codec's declared equivalence: raw Equal.equals
// can see runtime metadata outside the encoded schema contract.
const sendOnEquivalence = S.toEquivalence(SendOn);
const imageAttachmentMimeTypeEquivalence = S.toEquivalence(ImageAttachmentMimeType);
const composerFeaturesEquivalence = S.toEquivalence(ComposerFeatures);
const attachmentRejectionEquivalence = S.toEquivalence(AttachmentRejection);
const decodeComposerFeaturesSync = S.decodeSync(ComposerFeatures);
const decodeImageAttachmentMimeTypeSync = S.decodeSync(ImageAttachmentMimeType);
const decodeSendOnSync = S.decodeSync(SendOn);
const encodeAttachmentFailureSync = S.encodeSync(AttachmentFailure);
const encodeAttachmentRejectionSync = S.encodeSync(AttachmentRejection);
const encodeComposerFeaturesSync = S.encodeSync(ComposerFeatures);
const encodeImageAttachmentMimeTypeSync = S.encodeSync(ImageAttachmentMimeType);
const encodeSendOnSync = S.encodeSync(SendOn);

describe("@beep/editor schema crispening parity", () => {
  it("keeps touched encoded wire shapes byte-identical", () => {
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

    expect(encodeAttachmentRejectionSync(tooLarge)).toEqual({
      _tag: "AttachmentTooLarge",
      filename: "recording.mov",
      size: 15_000_000,
      maxBytes: 10_485_760,
    });
    expect(encodeAttachmentRejectionSync(invalidMimeType)).toEqual({
      _tag: "AttachmentInvalidMimeType",
      filename: "payload.bin",
      mimeType: "",
    });
    expect(encodeAttachmentFailureSync(portFailure)).toEqual({
      _tag: "AttachmentPortFailed",
      message: "Files could not be attached.",
    });
    expect(encodeComposerFeaturesSync(features)).toEqual({
      toolbar: false,
      slash: true,
      mentions: true,
      attachments: true,
      characterCount: true,
      sendOn: "enter",
    });
  });

  it("round-trips pure chat schemas with schema-derived arbitraries", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(SendOn)]), ([value]) => {
          expect(sendOnEquivalence(decodeSendOnSync(encodeSendOnSync(value)), value)).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(ImageAttachmentMimeType)]), ([value]) => {
          expect(
            imageAttachmentMimeTypeEquivalence(
              decodeImageAttachmentMimeTypeSync(encodeImageAttachmentMimeTypeSync(value)),
              value
            )
          ).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(ComposerFeatures)]), ([value]) => {
          expect(
            composerFeaturesEquivalence(decodeComposerFeaturesSync(encodeComposerFeaturesSync(value)), value)
          ).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(AttachmentRejection)]), ([value]) => {
          expect(
            attachmentRejectionEquivalence(
              pipe(value, encodeAttachmentRejectionSync, decodeAttachmentRejectionSync),
              value
            )
          ).toBe(true);

          return true;
        })
      )._tag
    ).toBe("Passed");
  });

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
