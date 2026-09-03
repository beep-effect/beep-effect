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
import { pipe, Result } from "effect";
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
    const portFailure = AttachmentPortFailed.make({
      message: "Files could not be attached.",
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
    expect(S.encodeSync(AttachmentFailure)(portFailure)).toEqual({
      _tag: "AttachmentPortFailed",
      message: "Files could not be attached.",
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
      fc.property(S.toArbitrary(SendOn)(fc), (value) => {
        expect(Equal.equals(S.decodeSync(SendOn)(S.encodeSync(SendOn)(value)), value)).toBe(true);
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(ImageAttachmentMimeType)(fc), (value) => {
        expect(
          Equal.equals(S.decodeSync(ImageAttachmentMimeType)(S.encodeSync(ImageAttachmentMimeType)(value)), value)
        ).toBe(true);
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(ComposerFeatures)(fc), (value) => {
        expect(pipe(value, S.encodeSync(ComposerFeatures), S.decodeSync(ComposerFeatures), Equal.equals(value))).toBe(
          true
        );
      })
    );
    fc.assert(
      fc.property(S.toArbitrary(AttachmentRejection)(fc), (value) => {
        expect(
          pipe(value, S.encodeSync(AttachmentRejection), S.decodeSync(AttachmentRejection), Equal.equals(value))
        ).toBe(true);
      })
    );
  });

  it("rejects empty menu identity and display fields at the schema boundary", () => {
    expect(
      Result.isFailure(
        S.decodeResult(SlashItem)({
          key: "",
          label: "Heading",
          onSelect: () => undefined,
        })
      )
    ).toBe(true);
    expect(Result.isFailure(S.decodeResult(MentionOption)({ id: "", label: "Ada" }))).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(SlashItems)([
          { key: "paragraph", label: "Paragraph", onSelect: () => undefined },
          { key: "", label: "Broken", onSelect: () => undefined },
        ])
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(MentionOptions)([
          { id: "ada", label: "Ada" },
          { id: "", label: "Broken" },
        ])
      )
    ).toBe(true);
  });

  it("rejects duplicate collection identities at their exact field paths", () => {
    const duplicateSlashItems = S.decodeResult(SlashItems)([
      { key: "same", label: "First", onSelect: () => undefined },
      { key: "same", label: "Second", onSelect: () => undefined },
    ]);
    const duplicateMentions = S.decodeResult(MentionOptions)([
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
