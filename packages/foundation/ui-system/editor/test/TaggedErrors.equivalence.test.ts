import {
  AttachmentInvalidMimeType,
  AttachmentPortFailed,
  AttachmentTooLarge,
} from "@beep/editor/chat/attachment-model";
import { MentionLookupError } from "@beep/editor/chat/typeahead";
import { MermaidRenderError } from "@beep/editor/mermaid-view";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const sameAttachmentTooLarge = S.toEquivalence(AttachmentTooLarge);
const sameAttachmentInvalidMimeType = S.toEquivalence(AttachmentInvalidMimeType);
const sameAttachmentPortFailed = S.toEquivalence(AttachmentPortFailed);
const sameMentionLookupError = S.toEquivalence(MentionLookupError);
const sameMermaidRenderError = S.toEquivalence(MermaidRenderError);

describe("Editor tagged-error declared equivalence", () => {
  it("compares AttachmentTooLarge by declared fields", () => {
    const a = AttachmentTooLarge.make({ filename: "brief.pdf", size: 20, maxBytes: 10 });
    const b = AttachmentTooLarge.make({ filename: "brief.pdf", size: 20, maxBytes: 10 });
    const c = AttachmentTooLarge.make({ filename: "brief.pdf", size: 21, maxBytes: 10 });

    pipe(sameAttachmentTooLarge(a, b), assertTrue);
    pipe(sameAttachmentTooLarge(a, c), assertFalse);
  });

  it("compares AttachmentInvalidMimeType by declared fields", () => {
    const a = AttachmentInvalidMimeType.make({ filename: "payload.bin", mimeType: "" });
    const b = AttachmentInvalidMimeType.make({ filename: "payload.bin", mimeType: "" });
    const c = AttachmentInvalidMimeType.make({ filename: "payload.bin", mimeType: "application/x-invalid" });

    pipe(sameAttachmentInvalidMimeType(a, b), assertTrue);
    pipe(sameAttachmentInvalidMimeType(a, c), assertFalse);
  });

  it("excludes AttachmentPortFailed cause from diagnostic identity", () => {
    const a = AttachmentPortFailed.make({ message: "Files could not be attached.", cause: new Error("first") });
    const b = AttachmentPortFailed.make({ message: "Files could not be attached.", cause: new Error("second") });
    const c = AttachmentPortFailed.make({ message: "Attachment failed.", cause: new Error("first") });

    pipe(sameAttachmentPortFailed(a, b), assertTrue);
    pipe(sameAttachmentPortFailed(a, c), assertFalse);
  });

  it("excludes MentionLookupError cause from diagnostic identity", () => {
    const a = MentionLookupError.make({
      reason: "source-failed",
      message: "Mentions are unavailable right now.",
      cause: new Error("first"),
    });
    const b = MentionLookupError.make({
      reason: "source-failed",
      message: "Mentions are unavailable right now.",
      cause: new Error("second"),
    });
    const c = MentionLookupError.make({
      reason: "invalid-results",
      message: "Mentions are unavailable right now.",
      cause: new Error("first"),
    });

    pipe(sameMentionLookupError(a, b), assertTrue);
    pipe(sameMentionLookupError(a, c), assertFalse);
  });

  it("excludes MermaidRenderError cause from diagnostic identity", () => {
    const a = MermaidRenderError.make({ message: "Unable to render diagram.", cause: new Error("first") });
    const b = MermaidRenderError.make({ message: "Unable to render diagram.", cause: new Error("second") });
    const c = MermaidRenderError.make({ message: "Diagram could not be parsed.", cause: new Error("first") });

    pipe(sameMermaidRenderError(a, b), assertTrue);
    pipe(sameMermaidRenderError(a, c), assertFalse);
  });
});
