import { fcRuns } from "@beep/fc-runs";
import * as FilePathSchema from "@beep/schema/FilePath";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownFilePathSchemaFilePathSync = S.decodeUnknownSync(FilePathSchema.FilePath);
const decodeUnknownFilePathSchemaHasLeafSegmentSync = S.decodeUnknownSync(FilePathSchema.HasLeafSegment);
const decodeUnknownFilePathSchemaSupportedPathFamilySync = S.decodeUnknownSync(FilePathSchema.SupportedPathFamily);
const decodeUnknownFilePathSchemaSupportedWindowsNamespaceSync = S.decodeUnknownSync(
  FilePathSchema.SupportedWindowsNamespace
);
const decodeUnknownFilePathSchemaValidWindowsPathSegmentSync = S.decodeUnknownSync(
  FilePathSchema.ValidWindowsPathSegment
);
const decodeUnknownFilePathSchemaValidWindowsPlainPathSegmentSync = S.decodeUnknownSync(
  FilePathSchema.ValidWindowsPlainPathSegment
);
const decodeUnknownFilePathSchemaValidWindowsRootSegmentSync = S.decodeUnknownSync(
  FilePathSchema.ValidWindowsRootSegment
);
const decodeUnknownFilePathSchemaValidWindowsUncRestSync = S.decodeUnknownSync(FilePathSchema.ValidWindowsUncRest);
const decodeUnknownFilePathSchemaValidWindowsUncSegmentsSync = S.decodeUnknownSync(
  FilePathSchema.ValidWindowsUncSegments
);
const decodeUnknownFilePathSchemaWindowsDotSegmentSync = S.decodeUnknownSync(FilePathSchema.WindowsDotSegment);
const decodeUnknownFilePathSchemaWindowsDrivePathSync = S.decodeUnknownSync(FilePathSchema.WindowsDrivePath);
const decodeUnknownFilePathSchemaWindowsDriveRootSync = S.decodeUnknownSync(FilePathSchema.WindowsDriveRoot);
const decodeUnknownFilePathSchemaWindowsRelativePathSync = S.decodeUnknownSync(FilePathSchema.WindowsRelativePath);
const decodeUnknownFilePathSchemaWindowsSegmentsSync = S.decodeUnknownSync(FilePathSchema.WindowsSegments);
const decodeUnknownFilePathSchemaWindowsUncPathSync = S.decodeUnknownSync(FilePathSchema.WindowsUncPath);
const decodeUnknownFilePathSchemaWindowsUncRootSync = S.decodeUnknownSync(FilePathSchema.WindowsUncRoot);
const isFilePathSchemaEndsWithSeparator = S.is(FilePathSchema.EndsWithSeparator);
const isFilePathSchemaFilePath = S.is(FilePathSchema.FilePath);
const isFilePathSchemaHasNullByte = S.is(FilePathSchema.HasNullByte);
const isFilePathSchemaUsesPosixSeparator = S.is(FilePathSchema.UsesPosixSeparator);
const isFilePathSchemaUsesWindowsSeparator = S.is(FilePathSchema.UsesWindowsSeparator);
const FilePathPayload = S.Struct({ filePath: FilePathSchema.FilePath });
const decodeFilePathPayloadSync = S.decodeSync(FilePathPayload);

describe("FilePath part schemas", () => {
  it("decodes the literal family unions", () => {
    expect(decodeUnknownFilePathSchemaSupportedPathFamilySync("windowsDrive")).toBe("windowsDrive");
    expect(decodeUnknownFilePathSchemaWindowsDotSegmentSync(".")).toBe(".");
    expect(decodeUnknownFilePathSchemaWindowsDotSegmentSync("..")).toBe("..");
    expect(() => decodeUnknownFilePathSchemaSupportedPathFamilySync("other")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsDotSegmentSync("...")).toThrow();
  });

  it("detects null bytes and supported namespaces", () => {
    expect(isFilePathSchemaHasNullByte(`bad\u0000path.txt`)).toBe(true);
    expect(isFilePathSchemaHasNullByte("plain.txt")).toBe(false);
    expect(decodeUnknownFilePathSchemaSupportedWindowsNamespaceSync("C:\\file.txt")).toBe("C:\\file.txt");
    expect(() => decodeUnknownFilePathSchemaSupportedWindowsNamespaceSync("\\\\?\\C:\\file.txt")).toThrow();
    expect(() => decodeUnknownFilePathSchemaSupportedWindowsNamespaceSync("\\\\.\\COM1")).toThrow();
  });

  it("detects separator usage and trailing separators", () => {
    expect(isFilePathSchemaUsesPosixSeparator("foo/bar")).toBe(true);
    expect(isFilePathSchemaUsesPosixSeparator("foo\\bar")).toBe(false);

    expect(isFilePathSchemaUsesWindowsSeparator("foo\\bar")).toBe(true);
    expect(isFilePathSchemaUsesWindowsSeparator("foo/bar")).toBe(false);

    expect(isFilePathSchemaEndsWithSeparator("foo/")).toBe(true);
    expect(isFilePathSchemaEndsWithSeparator("foo\\")).toBe(true);
    expect(isFilePathSchemaEndsWithSeparator("foo")).toBe(false);
  });

  it("validates Windows roots", () => {
    expect(decodeUnknownFilePathSchemaWindowsDriveRootSync("C:")).toBe("C:");
    expect(decodeUnknownFilePathSchemaWindowsDriveRootSync("C:\\")).toBe("C:\\");
    expect(() => decodeUnknownFilePathSchemaWindowsDriveRootSync("C:file.txt")).toThrow();

    expect(decodeUnknownFilePathSchemaWindowsUncRootSync("\\\\server\\share")).toBe("\\\\server\\share");
    expect(() => decodeUnknownFilePathSchemaWindowsUncRootSync("\\\\server\\share\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsUncRootSync("\\\\server")).toThrow();
  });

  it("derives valid values from the WindowsDriveRoot source schema and round-trips", () => {
    const arbitrary = S.toArbitrary(FilePathSchema.WindowsDriveRoot)(fc);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decodeUnknownFilePathSchemaWindowsDriveRootSync(value)).toBe(value);
        expect(value).toMatch(/^[A-Za-z]:[\\/]?$/);
      }),
      fcRuns(50)
    );
  });

  it("validates Windows path segments", () => {
    expect(decodeUnknownFilePathSchemaValidWindowsPlainPathSegmentSync("file.txt")).toBe("file.txt");
    expect(() => decodeUnknownFilePathSchemaValidWindowsPlainPathSegmentSync("bad|name")).toThrow();
    expect(() => decodeUnknownFilePathSchemaValidWindowsPlainPathSegmentSync("foo/bar")).toThrow();
    expect(() => decodeUnknownFilePathSchemaValidWindowsPlainPathSegmentSync("bad.")).toThrow();

    expect(decodeUnknownFilePathSchemaValidWindowsRootSegmentSync("share")).toBe("share");
    expect(() => decodeUnknownFilePathSchemaValidWindowsRootSegmentSync(".")).toThrow();
    expect(() => decodeUnknownFilePathSchemaValidWindowsRootSegmentSync("..")).toThrow();

    expect(decodeUnknownFilePathSchemaValidWindowsPathSegmentSync(".")).toBe(".");
    expect(decodeUnknownFilePathSchemaValidWindowsPathSegmentSync("..")).toBe("..");
    expect(decodeUnknownFilePathSchemaValidWindowsPathSegmentSync("folder")).toBe("folder");
    expect(() => decodeUnknownFilePathSchemaValidWindowsPathSegmentSync("foo/bar")).toThrow();
  });

  it("validates Windows segment collections", () => {
    expect(decodeUnknownFilePathSchemaWindowsSegmentsSync(["folder", "..", "file.txt"])).toEqual([
      "folder",
      "..",
      "file.txt",
    ]);
    expect(() => decodeUnknownFilePathSchemaWindowsSegmentsSync([])).toThrow();

    expect(decodeUnknownFilePathSchemaValidWindowsUncRestSync(["folder", "file.txt"])).toEqual(["folder", "file.txt"]);
    expect(() => decodeUnknownFilePathSchemaValidWindowsUncRestSync([])).toThrow();

    expect(decodeUnknownFilePathSchemaValidWindowsUncSegmentsSync(["server", "share", "file.txt"])).toEqual([
      "server",
      "share",
      "file.txt",
    ]);
    expect(() => decodeUnknownFilePathSchemaValidWindowsUncSegmentsSync(["server", "share"])).toThrow();
    expect(() => decodeUnknownFilePathSchemaValidWindowsUncSegmentsSync([".", "share", "file.txt"])).toThrow();
  });

  it("detects whether a path includes a leaf segment", () => {
    expect(decodeUnknownFilePathSchemaHasLeafSegmentSync("/usr/bin/env")).toBe("/usr/bin/env");
    expect(decodeUnknownFilePathSchemaHasLeafSegmentSync("folder\\file.txt")).toBe("folder\\file.txt");
    expect(() => decodeUnknownFilePathSchemaHasLeafSegmentSync("/")).toThrow();
    expect(() => decodeUnknownFilePathSchemaHasLeafSegmentSync("foo/")).toThrow();
    expect(() => decodeUnknownFilePathSchemaHasLeafSegmentSync("foo\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaHasLeafSegmentSync("C:")).toThrow();
    expect(() => decodeUnknownFilePathSchemaHasLeafSegmentSync("\\\\server\\share")).toThrow();
  });

  it("validates Windows drive paths", () => {
    expect(decodeUnknownFilePathSchemaWindowsDrivePathSync("C:\\Users\\test\\file.txt")).toBe(
      "C:\\Users\\test\\file.txt"
    );
    expect(decodeUnknownFilePathSchemaWindowsDrivePathSync("C:/Users/test/file.txt")).toBe("C:/Users/test/file.txt");
    expect(decodeUnknownFilePathSchemaWindowsDrivePathSync("C:relative.txt")).toBe("C:relative.txt");
    expect(() => decodeUnknownFilePathSchemaWindowsDrivePathSync("C:")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsDrivePathSync("C:\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsDrivePathSync("C:\\folder\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsDrivePathSync("C:\\bad<name.txt")).toThrow();
  });

  it("validates Windows UNC paths", () => {
    expect(decodeUnknownFilePathSchemaWindowsUncPathSync("\\\\server\\share\\folder\\file.txt")).toBe(
      "\\\\server\\share\\folder\\file.txt"
    );
    expect(() => decodeUnknownFilePathSchemaWindowsUncPathSync("\\\\server\\share")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsUncPathSync("\\\\server")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsUncPathSync("\\\\server\\share\\folder\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsUncPathSync("\\\\?\\C:\\file.txt")).toThrow();
  });

  it("validates Windows relative paths without accepting UNC or drive-prefixed inputs", () => {
    expect(decodeUnknownFilePathSchemaWindowsRelativePathSync("folder\\file.txt")).toBe("folder\\file.txt");
    expect(decodeUnknownFilePathSchemaWindowsRelativePathSync(".\\file.txt")).toBe(".\\file.txt");
    expect(() => decodeUnknownFilePathSchemaWindowsRelativePathSync("file.txt")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsRelativePathSync("folder/child.txt")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsRelativePathSync("folder\\")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsRelativePathSync("\\\\server\\share\\file.txt")).toThrow();
    expect(() => decodeUnknownFilePathSchemaWindowsRelativePathSync("C:\\file.txt")).toThrow();
  });
});

describe("FilePath", () => {
  it("publishes codec statics and a canonical arbitrary for file paths", () => {
    expect(SchemaAST.resolve(FilePathSchema.FilePath.ast)?.toArbitrary).toBeDefined();
    expect(
      fc
        .sample(S.toArbitrary(FilePathSchema.FilePath)(fc), { numRuns: 20, seed: 0x5eed })
        .every(FilePathSchema.FilePath.is)
    ).toBe(true);
    expect(FilePathSchema.FilePath.decodeUnknownSync("data/ontology.ttl")).toBe("data/ontology.ttl");
  });

  it("accepts valid POSIX file paths", () => {
    expect(decodeUnknownFilePathSchemaFilePathSync("/usr/bin/env")).toBe("/usr/bin/env");
    expect(decodeUnknownFilePathSchemaFilePathSync("./foo/bar.txt")).toBe("./foo/bar.txt");
    expect(decodeUnknownFilePathSchemaFilePathSync("../a")).toBe("../a");
  });

  it("accepts valid Windows drive paths", () => {
    expect(decodeUnknownFilePathSchemaFilePathSync("C:\\Users\\test\\file.txt")).toBe("C:\\Users\\test\\file.txt");
    expect(decodeUnknownFilePathSchemaFilePathSync("C:/Users/test/file.txt")).toBe("C:/Users/test/file.txt");
    expect(decodeUnknownFilePathSchemaFilePathSync("C:relative.txt")).toBe("C:relative.txt");
  });

  it("accepts valid UNC file paths", () => {
    expect(decodeUnknownFilePathSchemaFilePathSync("\\\\server\\share\\folder\\file.txt")).toBe(
      "\\\\server\\share\\folder\\file.txt"
    );
  });

  it("locks the any-major-os policy for ambiguous leaf paths", () => {
    expect(decodeUnknownFilePathSchemaFilePathSync("CON")).toBe("CON");
    expect(decodeUnknownFilePathSchemaFilePathSync("a<")).toBe("a<");
  });

  it("preserves the original path string exactly", () => {
    const input = "C:/Users/Test/Mixed-Case.txt";

    expect(decodeUnknownFilePathSchemaFilePathSync(input)).toBe(input);
  });

  it("supports guard-style schema checks", () => {
    expect(isFilePathSchemaFilePath("./foo/bar.txt")).toBe(true);
    expect(isFilePathSchemaFilePath("foo/")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("")).toThrow("File path must not be empty");
  });

  it("rejects embedded NUL bytes", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync(`bad\u0000path.txt`)).toThrow(
      "File path must not contain embedded NUL bytes"
    );
  });

  it("rejects root-only paths", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("/")).toThrow("File path must include a leaf segment");
    expect(() => decodeUnknownFilePathSchemaFilePathSync("C:\\")).toThrow("File path must include a leaf segment");
    expect(() => decodeUnknownFilePathSchemaFilePathSync("\\\\server\\share")).toThrow(
      "File path must include a leaf segment"
    );
  });

  it("rejects paths ending in separators", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("foo/")).toThrow("File path must include a leaf segment");
    expect(() => decodeUnknownFilePathSchemaFilePathSync("foo\\")).toThrow("File path must include a leaf segment");
  });

  it("rejects malformed UNC paths", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("\\\\server")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("rejects invalid Windows characters in Windows path families", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("C:\\bad<name.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
    expect(() => decodeUnknownFilePathSchemaFilePathSync("folder\\bad|name.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("rejects Windows segments with trailing dots or spaces", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("C:\\bad.\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
    expect(() => decodeUnknownFilePathSchemaFilePathSync("folder\\bad \\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("rejects unsupported Windows namespace paths", () => {
    expect(() => decodeUnknownFilePathSchemaFilePathSync("\\\\?\\C:\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
    expect(() => decodeUnknownFilePathSchemaFilePathSync("\\\\.\\C:\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("reports nested field failures at the filePath key", () => {
    expect(() => decodeFilePathPayloadSync({ filePath: "foo/" })).toThrow(`at ["filePath"]`);
  });

  it("decodes object schemas with a filePath property", () => {
    const input = { filePath: "./folder/file.txt" };

    expect(decodeFilePathPayloadSync(input)).toEqual(input);
  });
});
