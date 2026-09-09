import {
  BinaryFileExtension,
  hasBinaryExtension,
  isBinaryContent,
  isBinaryFileExtension,
} from "@beep/schema/BinaryFileExtension";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownBinaryFileExtensionSync = S.decodeUnknownSync(BinaryFileExtension);

describe("BinaryFileExtension", () => {
  it("accepts dotted binary file extensions", () => {
    expect(decodeUnknownBinaryFileExtensionSync(".png")).toBe(".png");
  });

  it("rejects undotted values", () => {
    expect(() => decodeUnknownBinaryFileExtensionSync("png")).toThrow();
  });

  it("derives a schema-backed guard", () => {
    expect(isBinaryFileExtension(".pdf")).toBe(true);
    expect(isBinaryFileExtension("pdf")).toBe(false);
  });
});

describe("hasBinaryExtension", () => {
  it("detects lowercase and uppercase dotted extensions from file paths", () => {
    expect(hasBinaryExtension("photo.png")).toBe(true);
    expect(hasBinaryExtension("photo.PNG")).toBe(true);
  });

  it("returns false for non-binary extensions", () => {
    expect(hasBinaryExtension("notes.md")).toBe(false);
  });
});

describe("isBinaryContent", () => {
  it("returns true when the sample contains a null byte", () => {
    expect(isBinaryContent(new Uint8Array([72, 0, 73]))).toBe(true);
  });

  it("returns true when the sample has a high ratio of non-printable bytes", () => {
    expect(isBinaryContent(new Uint8Array([1, 2, 3, 4, 65]))).toBe(true);
  });

  it("returns false for ordinary text bytes", () => {
    expect(isBinaryContent(new TextEncoder().encode("hello\nworld"))).toBe(false);
  });
});
