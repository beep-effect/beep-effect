import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { ConversationPhoto, photosAsString, readContentType, readStorageId } from "../../beep/ConversationPhoto.ts";

describe("ConversationPhoto", () => {
  it("decodes null and missing optional fields", () => {
    const present = Effect.runSync(
      S.decodeUnknownEffect(ConversationPhoto)({
        base64: "pixels",
        storageId: " frame-1 ",
        contentType: " Image/PNG ",
        description: "desk",
      }),
    );
    expect(O.getOrElse(present.storageId, () => "")).toBe("frame-1");
    expect(O.getOrElse(present.contentType, () => "")).toBe("image/png");
    const missing = Effect.runSync(S.decodeUnknownEffect(ConversationPhoto)({ base64: "pixels" }));
    expect(O.isNone(missing.storageId)).toBe(true);
    expect(O.isNone(missing.description)).toBe(true);
    const nulled = Effect.runSync(S.decodeUnknownEffect(ConversationPhoto)({ base64: "pixels", storageId: null, description: null }));
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
      S.decodeUnknownEffect(ConversationPhoto)({
        base64: "pixels",
        description: "desk",
        createdAt: "2020-01-02T03:04:05.000Z",
      }),
    );
    expect(photosAsString([dated], false)).toBe('- "desk"');
    expect(photosAsString([dated], true)).toBe('- [03:04:05] "desk"');
  });
});
