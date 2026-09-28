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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
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

  it.effect.prop(
    "round-trips pure chat schemas with schema-derived arbitraries",
    [
      Arbitrary.schema(SendOn),
      Arbitrary.schema(ImageAttachmentMimeType),
      Arbitrary.schema(ComposerFeatures),
      Arbitrary.schema(AttachmentRejection),
    ],
    ([sendOn, mimeTypes, features, rejections]) =>
      Effect.gen(function* () {
        {
          const encoded = yield* encodeSendOn(sendOn);
          const decoded = yield* decodeSendOn(encoded);
          pipe(sendOnEquivalence(decoded, sendOn), assertTrue);
        }
        {
          const encoded = yield* encodeImageAttachmentMimeType(mimeTypes);
          const decoded = yield* decodeImageAttachmentMimeType(encoded);
          pipe(imageAttachmentMimeTypeEquivalence(decoded, mimeTypes), assertTrue);
        }
        {
          const encoded = yield* encodeComposerFeatures(features);
          const decoded = yield* decodeComposerFeatures(encoded);
          pipe(composerFeaturesEquivalence(decoded, features), assertTrue);
        }
        {
          const encoded = yield* encodeAttachmentRejection(rejections);
          const decoded = yield* decodeAttachmentRejection(encoded);
          pipe(attachmentRejectionEquivalence(decoded, rejections), assertTrue);
        }
      }),
    { arbitrary: fcRuns(100) }
  );

  it("rejects empty menu identity and display fields at the schema boundary", () => {
    pipe(
      decodeSlashItemResult({
        key: "",
        label: "Heading",
        onSelect: () => undefined,
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(decodeMentionOptionResult({ id: "", label: "Ada" }), Result.isFailure, assertTrue);
    pipe(
      decodeSlashItemsResult([
        { key: "paragraph", label: "Paragraph", onSelect: () => undefined },
        { key: "", label: "Broken", onSelect: () => undefined },
      ]),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeMentionOptionsResult([
        { id: "ada", label: "Ada" },
        { id: "", label: "Broken" },
      ]),
      Result.isFailure,
      assertTrue
    );
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

    pipe(duplicateSlashItems, Result.isFailure, assertTrue);
    pipe(duplicateMentions, Result.isFailure, assertTrue);
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
