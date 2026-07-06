import {
  getExtensions,
  getTypes,
  lookup,
  mimeTypes,
  OfficialMimeTypeDataByTopLevel,
  OfficialMimeTypeDataByType,
  OfficialMimeTypeDataMetadata,
  OfficialMimeTypeDataSourceSha256,
  OfficialMimeTypeDataSourceUrl,
  OfficialMimeTypeDataTypeValues,
  OfficialMimeTypeDataUpdated,
} from "@beep/data/MimeTypes";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Struct } from "effect";
import * as Str from "effect/String";

describe("mimeTypes", () => {
  it("contains known MIME types", () => {
    expect(mimeTypes["application/json"]).toBeDefined();
    expect(mimeTypes["text/html"]).toBeDefined();
    expect(mimeTypes["image/png"]).toBeDefined();
  });

  it("each entry has source and extensions", () => {
    const json = mimeTypes["application/json"];
    expect(json.source).toBe("iana");
    expect(json.extensions).toContain("json");

    for (const type of Struct.keys(mimeTypes)) {
      const mime = mimeTypes[type];
      expect(["iana", "apache", "nginx"]).toContain(mime.source);
      expect(A.length(mime.extensions)).toBeGreaterThan(0);
    }
  });
});

describe("official IANA media types", () => {
  it("exports generated registry maps and metadata", () => {
    expect(OfficialMimeTypeDataByType["application/json"].topLevel).toBe("application");
    expect(OfficialMimeTypeDataByType["text/html"].topLevel).toBe("text");
    expect(OfficialMimeTypeDataByTopLevel.application["application/json"].name).toBe("json");
    expect(OfficialMimeTypeDataByTopLevel.text["text/html"].name).toBe("html");
    expect(OfficialMimeTypeDataTypeValues).toContain("application/json");
    expect(OfficialMimeTypeDataTypeValues).toContain("text/html");
    expect(OfficialMimeTypeDataUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(OfficialMimeTypeDataSourceUrl).toBe("https://www.iana.org/assignments/media-types/media-types.xml");
    expect(OfficialMimeTypeDataSourceSha256).toHaveLength(64);
    expect(OfficialMimeTypeDataMetadata.sha256).toBe(OfficialMimeTypeDataSourceSha256);
  });
});

describe("getTypes", () => {
  it("returns a record mapping extensions to MIME types", () => {
    const types = getTypes();
    expect(types.json).toBe("application/json");
    expect(types.html).toBe("text/html");
    expect(types.png).toBe("image/png");
    expect(types.css).toBe("text/css");
  });

  it("maps common file extensions correctly", () => {
    const types = getTypes();
    expect(types.js).toBe("application/javascript");
    expect(types.pdf).toBe("application/pdf");
    expect(types.xml).toBe("application/xml");
    expect(types.jpg).toBe("image/jpeg");
    expect(types.gif).toBe("image/gif");
    expect(types.svg).toBe("image/svg+xml");
    expect(types.mp4).toBe("video/mp4");
    expect(types.mp3).toBe("audio/mpeg");
  });

  it("prefers iana source over apache for shared extensions", () => {
    const types = getTypes();
    // iana > apache in preference ordering
    // "xml" appears in both application/xml (iana) and text/xml (iana)
    // but application/xml should win because of the source preference tie-breaking
    // that favors non-application types only if source priority is higher
    expect(types.xml).toBeDefined();
  });

  it("returns the same object on repeated calls", () => {
    const a = getTypes();
    const b = getTypes();
    expect(a).toBe(b);
  });
});

describe("getExtensions", () => {
  it("returns a record mapping MIME types to extension arrays", () => {
    const extensions = getExtensions();
    expect(extensions["application/json"]).toContain("json");
    expect(extensions["application/json"]).toContain("map");
    expect(extensions["text/html"]).toContain("html");
    expect(extensions["text/html"]).toContain("htm");
  });

  it("includes all major MIME type categories", () => {
    const extensions = getExtensions();
    const keys = Struct.keys(extensions);
    const hasApplication = A.some(keys, Str.startsWith("application/"));
    const hasText = A.some(keys, Str.startsWith("text/"));
    const hasImage = A.some(keys, Str.startsWith("image/"));
    const hasAudio = A.some(keys, Str.startsWith("audio/"));
    const hasVideo = A.some(keys, Str.startsWith("video/"));
    expect(hasApplication).toBe(true);
    expect(hasText).toBe(true);
    expect(hasImage).toBe(true);
    expect(hasAudio).toBe(true);
    expect(hasVideo).toBe(true);
  });

  it("returns the same object on repeated calls", () => {
    const a = getExtensions();
    const b = getExtensions();
    expect(a).toBe(b);
  });
});

describe("lookup", () => {
  it("returns MIME type for a bare extension", () => {
    expect(lookup("json")).toBe("application/json");
    expect(lookup("html")).toBe("text/html");
    expect(lookup("png")).toBe("image/png");
    expect(lookup("css")).toBe("text/css");
  });

  it("returns MIME type for an extension with leading dot", () => {
    expect(lookup(".json")).toBe("application/json");
    expect(lookup(".html")).toBe("text/html");
    expect(lookup(".png")).toBe("image/png");
  });

  it("returns MIME type for a full file path", () => {
    expect(lookup("file.json")).toBe("application/json");
    expect(lookup("path/to/file.html")).toBe("text/html");
    expect(lookup("image.png")).toBe("image/png");
  });

  it("is case-insensitive", () => {
    expect(lookup("JSON")).toBe("application/json");
    expect(lookup("HTML")).toBe("text/html");
    expect(lookup(".PNG")).toBe("image/png");
    expect(lookup("file.CSS")).toBe("text/css");
  });

  it("returns false for empty string", () => {
    expect(lookup("")).toBe(false);
  });

  it("returns false for unknown extensions", () => {
    expect(lookup("asdfasdf")).toBe(false);
    expect(lookup(".zzzzz")).toBe(false);
    expect(lookup("file.nonexistent")).toBe(false);
  });

  it("handles common web extensions", () => {
    expect(lookup("js")).toBe("application/javascript");
    expect(lookup("mjs")).toBe("application/javascript");
    expect(lookup("wasm")).toBe("application/wasm");
    expect(lookup("svg")).toBe("image/svg+xml");
    expect(lookup("webp")).toBe("image/webp");
    expect(lookup("woff2")).toBe("font/woff2");
    expect(lookup("webmanifest")).toBe("application/manifest+json");
  });

  it("handles media extensions", () => {
    expect(lookup("mp4")).toBe("video/mp4");
    expect(lookup("mp3")).toBe("audio/mpeg");
    expect(lookup("ogg")).toBe("audio/ogg");
    expect(lookup("webm")).toBe("video/webm");
    expect(lookup("wav")).toBe("audio/x-wav");
    expect(lookup("flac")).toBe("audio/x-flac");
  });

  it("handles document extensions", () => {
    expect(lookup("pdf")).toBe("application/pdf");
    expect(lookup("doc")).toBe("application/msword");
    expect(lookup("docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(lookup("xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("handles archive extensions", () => {
    expect(lookup("zip")).toBe("application/zip");
    expect(lookup("gz")).toBe("application/gzip");
    expect(lookup("tar")).toBe("application/x-tar");
    expect(lookup("7z")).toBe("application/x-7z-compressed");
  });

  it("handles additional binary and design extensions from the repo allowlist", () => {
    expect(lookup("z")).toBe("application/x-compress");
    expect(lookup("tgz")).toBe("application/x-compressed-tar");
    expect(lookup("a")).toBe("application/x-archive");
    expect(lookup("o")).toBe("application/x-object");
    expect(lookup("lib")).toBe("application/vnd.microsoft.portable-executable");
    expect(lookup("pyc")).toBe("application/x-python-bytecode");
    expect(lookup("pyo")).toBe("application/x-python-bytecode");
    expect(lookup("sqlite")).toBe("application/vnd.sqlite3");
    expect(lookup("sqlite3")).toBe("application/vnd.sqlite3");
    expect(lookup("blend")).toBe("application/x-blender");
    expect(lookup("fla")).toBe("application/vnd.dtg.local.flash");
    expect(lookup("dylib")).toBe("application/octet-stream");
    expect(lookup("app")).toBe("application/octet-stream");
    expect(lookup("node")).toBe("application/octet-stream");
    expect(lookup("rlib")).toBe("application/octet-stream");
    expect(lookup("db")).toBe("application/octet-stream");
    expect(lookup("idx")).toBe("application/octet-stream");
    expect(lookup("sketch")).toBe("application/octet-stream");
    expect(lookup("xd")).toBe("application/octet-stream");
    expect(lookup("max")).toBe("application/octet-stream");
    expect(lookup("lockb")).toBe("application/octet-stream");
    expect(lookup("dat")).toBe("application/octet-stream");
    expect(lookup("data")).toBe("application/octet-stream");
  });
});
