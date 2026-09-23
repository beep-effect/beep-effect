import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";
import { ConversationMetadata, ConversationMetadataKeys, metadataList, toVectorMetadata } from "../../beep/ConversationMetadata.ts";

describe("ConversationMetadata", () => {
  it("constructs empty lists and copies them into vector metadata", () => {
    const metadata = ConversationMetadata.make({ topics: ["shipping"] });
    expect(metadata.people).toEqual([]);
    expect(toVectorMetadata(metadata).topics).toEqual(["shipping"]);
    expect(ConversationMetadataKeys.dates).toBe("dates");
    expect(Arbitrary.schema(ConversationMetadata)).toBeTruthy();
  });

  it("reads lists and ignores other shapes", () => {
    expect(metadataList({ topics: ["shipping", 2] }, "topics")).toEqual(["shipping", "2"]);
    expect(metadataList({ topics: "shipping" }, "topics")).toEqual([]);
    expect(metadataList(null, "topics")).toEqual([]);
    expect(ConversationMetadata.make({}).people).toEqual([]);
  });
});
