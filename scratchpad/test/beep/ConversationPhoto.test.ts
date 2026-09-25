import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { ConversationPhoto, photosAsString, readContentType, readStorageId } from "../../beep/ConversationPhoto.ts";

const decodeConversationPhoto = S.decodeEffect(ConversationPhoto);

describe("ConversationPhoto", () => {
  it("decodes null and missing optional fields", () => {
    const present = Effect.runSync(
      decodeConversationPhoto({
        base64: "pixels",
        storageId: " frame-1 ",
        contentType: " Image/PNG ",
        description: "desk",
        createdAt: "2020-01-02T03:04:05.000Z",
        discarded: false,
      }),
    );
    expect(O.getOrElse(present.storageId, () => "")).toBe("frame-1");
    expect(O.getOrElse(present.contentType, () => "")).toBe("image/png");
    // Constructor defaults are construction-only: decode still needs the defaulted keys.
    const wireDefaults = { createdAt: "2020-01-02T03:04:05.000Z", discarded: false };
    const missing = Effect.runSync(decodeConversationPhoto({ base64: "pixels", ...wireDefaults }));
    expect(O.isNone(missing.storageId)).toBe(true);
    expect(O.isNone(missing.description)).toBe(true);
    const nulled = Effect.runSync(
      decodeConversationPhoto({ base64: "pixels", storageId: null, description: null, ...wireDefaults }),
    );
    expect(O.isNone(nulled.storageId)).toBe(true);
    expect(O.isNone(nulled.description)).toBe(true);
    expect(Arbitrary.schema(ConversationPhoto)).toBeTruthy();
  });

  it("rejects opaque storage ids and non-image types", () => {
    expect(O.getOrElse(readStorageId(" frame-1 "), () => "")).toBe("frame-1");
    expect(O.isNone(readStorageId(" "))).toBe(true);
    expect(O.isNone(readStorageId("a/b"))).toBe(true);
    expect(O.isNone(readStorageId("a\\b"))).toBe(true);
    expect(O.isNone(readStorageId("http:file"))).toBe(true);
    expect(O.isNone(readStorageId("https://cdn"))).toBe(true);
    expect(O.getOrElse(readContentType(" Image/PNG "), () => "")).toBe("image/png");
    expect(O.isNone(readContentType("text/plain"))).toBe(true);
  });

  it("formats photo descriptions", () => {
    expect(photosAsString([], false)).toBe("None");
    const blank = ConversationPhoto.make({ base64: "pixels", description: O.some("   ") });
    expect(photosAsString([blank], false)).toBe("None");
    const dated = Effect.runSync(
      decodeConversationPhoto({
        base64: "pixels",
        description: "desk",
        createdAt: "2020-01-02T03:04:05.000Z",
        discarded: false,
      }),
    );
    expect(photosAsString([dated], false)).toBe('- "desk"');
    expect(photosAsString([dated], true)).toBe('- [03:04:05] "desk"');
    expect(photosAsString([dated])).toBe('- "desk"');
  });

  it("formats photo descriptions data-last in a pipe", () => {
    const dated = Effect.runSync(
      decodeConversationPhoto({
        base64: "pixels",
        description: "desk",
        createdAt: "2020-01-02T03:04:05.000Z",
        discarded: false,
      }),
    );
    expect(pipe([dated], photosAsString(true))).toBe('- [03:04:05] "desk"');
    expect(pipe([dated], photosAsString(false))).toBe('- "desk"');
    expect(pipe([dated], photosAsString())).toBe('- "desk"');
    expect(pipe([], photosAsString(true))).toBe("None");
  });
});
