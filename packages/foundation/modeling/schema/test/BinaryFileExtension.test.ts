import {
  BinaryFileExtension,
  hasBinaryExtension,
  isBinaryContent,
  isBinaryFileExtension,
} from "@beep/schema/BinaryFileExtension";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";

const decodeUnknownBinaryFileExtensionEffect = S.decodeUnknownEffect(BinaryFileExtension);

describe("BinaryFileExtension", () => {
  it.effect(
    "accepts dotted binary file extensions",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownBinaryFileExtensionEffect(".png")).toBe(".png");
    })
  );

  it.effect(
    "rejects undotted values",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownBinaryFileExtensionEffect("png"));
      pipe(failure1, Exit.hasFails, assertTrue);
    })
  );

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
