import { MimeTypesData } from "@beep/data";
import {
  AudioMimeType,
  extractMimeExtensions,
  extractMimeTypes,
  ImageMimeType,
  MimeType,
  TextMimeType,
} from "@beep/schema";
import { Struct } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";

describe("MimeType helpers", () => {
  it("dedupes extracted file extensions while preserving first-seen order", () => {
    const sample = {
      "application/example-a": {
        source: "repo",
        extensions: ["one", "two"] as const,
      },
      "application/example-b": {
        source: "repo",
        extensions: ["two", "three"] as const,
      },
    } as const;

    expect(extractMimeExtensions(sample)).toEqual(["one", "two", "three"]);
  });

  it("extracts MIME type keys without changing their order", () => {
    const sample = {
      "text/example-a": {
        source: "repo",
        extensions: ["a"] as const,
      },
      "text/example-b": {
        source: "repo",
        extensions: ["b"] as const,
      },
    } as const;

    expect(extractMimeTypes(sample)).toEqual(["text/example-a", "text/example-b"]);
  });

  it("allows empty mime dictionaries at the public extraction boundary", () => {
    expect(extractMimeTypes({})).toEqual([]);
  });
});

describe("MimeType kinds", () => {
  it("preserves schema instance methods on the exported kit", () => {
    expect(MimeType).toHaveProperty("annotate");
  });

  it("keeps representative category members on the exported schema kits", () => {
    expect(MimeType.kinds.Application.Options).toContain("application/json");
    expect(TextMimeType.Options).toContain("text/html");
    expect(ImageMimeType.Options).toContain("image/png");
    expect(AudioMimeType.Options).toContain("audio/mpeg");
  });

  it("keeps the category kits aligned with the generated IANA media type data", () => {
    expect(MimeType.Options).toEqual(MimeTypesData.OfficialMimeTypeDataTypeValues);
    expect(MimeType.kinds.Application.Options).toEqual(
      Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.application)
    );
    expect(MimeType.kinds.Video.Options).toEqual(Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.video));
    expect(MimeType.kinds.Text.Options).toEqual(Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.text));
    expect(MimeType.kinds.Image.Options).toEqual(Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.image));
    expect(MimeType.kinds.Audio.Options).toEqual(Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.audio));
    expect(MimeType.kinds.Misc.Options).toEqual(Struct.keys(MimeTypesData.OfficialMimeTypeDataByTopLevel.misc));
  });
});
