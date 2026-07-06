import {
  AttachmentInvalidMimeType,
  AttachmentRejection,
  AttachmentTooLarge,
  ComposerFeatures,
  ImageAttachmentMimeType,
  MentionOption,
  SendOn,
  SlashItem,
} from "@beep/editor/chat";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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
    const features = ComposerFeatures.make({ toolbar: false });

    expect(S.encodeSync(AttachmentRejection)(tooLarge)).toEqual({
      _tag: "AttachmentTooLarge",
      filename: "recording.mov",
      size: 15_000_000,
      maxBytes: 10_485_760,
    });
    expect(S.encodeSync(AttachmentRejection)(invalidMimeType)).toEqual({
      _tag: "AttachmentInvalidMimeType",
      filename: "payload.bin",
      mimeType: "",
    });
    expect(S.encodeSync(ComposerFeatures)(features)).toEqual({
      toolbar: false,
      slash: true,
      mentions: true,
      attachments: true,
      characterCount: true,
      sendOn: "enter",
    });
  });

  it("round-trips pure chat schemas with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(S.toArbitrary(SendOn), (value) => {
        expect(Equal.equals(S.decodeUnknownSync(SendOn)(S.encodeSync(SendOn)(value)), value)).toBe(true);
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(ImageAttachmentMimeType), (value) => {
        expect(
          Equal.equals(
            S.decodeUnknownSync(ImageAttachmentMimeType)(S.encodeSync(ImageAttachmentMimeType)(value)),
            value
          )
        ).toBe(true);
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(ComposerFeatures), (value) => {
        expect(Equal.equals(S.decodeUnknownSync(ComposerFeatures)(S.encodeSync(ComposerFeatures)(value)), value)).toBe(
          true
        );
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(AttachmentRejection), (value) => {
        expect(
          Equal.equals(S.decodeUnknownSync(AttachmentRejection)(S.encodeSync(AttachmentRejection)(value)), value)
        ).toBe(true);
      })
    );
  });

  it("rejects empty menu identity and display fields at the schema boundary", () => {
    expect(
      Result.isFailure(
        S.decodeUnknownResult(SlashItem)({
          key: "",
          label: "Heading",
          onSelect: () => undefined,
        })
      )
    ).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(MentionOption)({ id: "", label: "Ada" }))).toBe(true);
  });
});
