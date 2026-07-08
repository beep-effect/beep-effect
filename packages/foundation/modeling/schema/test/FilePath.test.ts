import * as FilePathSchema from "@beep/schema/FilePath";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("FilePath part schemas", () => {
  it("decodes the literal family unions", () => {
    const decodeFamily = S.decodeUnknownSync(FilePathSchema.SupportedPathFamily);
    const decodeDot = S.decodeUnknownSync(FilePathSchema.WindowsDotSegment);

    expect(decodeFamily("windowsDrive")).toBe("windowsDrive");
    expect(decodeDot(".")).toBe(".");
    expect(decodeDot("..")).toBe("..");
    expect(() => decodeFamily("other")).toThrow();
    expect(() => decodeDot("...")).toThrow();
  });

  it("detects null bytes and supported namespaces", () => {
    expect(S.is(FilePathSchema.HasNullByte)(`bad\u0000path.txt`)).toBe(true);
    expect(S.is(FilePathSchema.HasNullByte)("plain.txt")).toBe(false);

    const decode = S.decodeUnknownSync(FilePathSchema.SupportedWindowsNamespace);

    expect(decode("C:\\file.txt")).toBe("C:\\file.txt");
    expect(() => decode("\\\\?\\C:\\file.txt")).toThrow();
    expect(() => decode("\\\\.\\COM1")).toThrow();
  });

  it("detects separator usage and trailing separators", () => {
    expect(S.is(FilePathSchema.UsesPosixSeparator)("foo/bar")).toBe(true);
    expect(S.is(FilePathSchema.UsesPosixSeparator)("foo\\bar")).toBe(false);

    expect(S.is(FilePathSchema.UsesWindowsSeparator)("foo\\bar")).toBe(true);
    expect(S.is(FilePathSchema.UsesWindowsSeparator)("foo/bar")).toBe(false);

    expect(S.is(FilePathSchema.EndsWithSeparator)("foo/")).toBe(true);
    expect(S.is(FilePathSchema.EndsWithSeparator)("foo\\")).toBe(true);
    expect(S.is(FilePathSchema.EndsWithSeparator)("foo")).toBe(false);
  });

  it("validates Windows roots", () => {
    const decodeDriveRoot = S.decodeUnknownSync(FilePathSchema.WindowsDriveRoot);
    const decodeUncRoot = S.decodeUnknownSync(FilePathSchema.WindowsUncRoot);

    expect(decodeDriveRoot("C:")).toBe("C:");
    expect(decodeDriveRoot("C:\\")).toBe("C:\\");
    expect(() => decodeDriveRoot("C:file.txt")).toThrow();

    expect(decodeUncRoot("\\\\server\\share")).toBe("\\\\server\\share");
    expect(() => decodeUncRoot("\\\\server\\share\\")).toThrow();
    expect(() => decodeUncRoot("\\\\server")).toThrow();
  });

  it("derives valid values from the WindowsDriveRoot source schema and round-trips", () => {
    const decode = S.decodeUnknownSync(FilePathSchema.WindowsDriveRoot);
    const arbitrary = S.toArbitrary(FilePathSchema.WindowsDriveRoot);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decode(value)).toBe(value);
        expect(value).toMatch(/^[A-Za-z]:[\\/]?$/);
      }),
      { numRuns: 50 }
    );
  });

  it("validates Windows path segments", () => {
    const decodePlainSegment = S.decodeUnknownSync(FilePathSchema.ValidWindowsPlainPathSegment);
    const decodeRootSegment = S.decodeUnknownSync(FilePathSchema.ValidWindowsRootSegment);
    const decodePathSegment = S.decodeUnknownSync(FilePathSchema.ValidWindowsPathSegment);

    expect(decodePlainSegment("file.txt")).toBe("file.txt");
    expect(() => decodePlainSegment("bad|name")).toThrow();
    expect(() => decodePlainSegment("foo/bar")).toThrow();
    expect(() => decodePlainSegment("bad.")).toThrow();

    expect(decodeRootSegment("share")).toBe("share");
    expect(() => decodeRootSegment(".")).toThrow();
    expect(() => decodeRootSegment("..")).toThrow();

    expect(decodePathSegment(".")).toBe(".");
    expect(decodePathSegment("..")).toBe("..");
    expect(decodePathSegment("folder")).toBe("folder");
    expect(() => decodePathSegment("foo/bar")).toThrow();
  });

  it("validates Windows segment collections", () => {
    const decodeSegments = S.decodeUnknownSync(FilePathSchema.WindowsSegments);
    const decodeUncRest = S.decodeUnknownSync(FilePathSchema.ValidWindowsUncRest);
    const decodeUncSegments = S.decodeUnknownSync(FilePathSchema.ValidWindowsUncSegments);

    expect(decodeSegments(["folder", "..", "file.txt"])).toEqual(["folder", "..", "file.txt"]);
    expect(() => decodeSegments([])).toThrow();

    expect(decodeUncRest(["folder", "file.txt"])).toEqual(["folder", "file.txt"]);
    expect(() => decodeUncRest([])).toThrow();

    expect(decodeUncSegments(["server", "share", "file.txt"])).toEqual(["server", "share", "file.txt"]);
    expect(() => decodeUncSegments(["server", "share"])).toThrow();
    expect(() => decodeUncSegments([".", "share", "file.txt"])).toThrow();
  });

  it("detects whether a path includes a leaf segment", () => {
    const decode = S.decodeUnknownSync(FilePathSchema.HasLeafSegment);

    expect(decode("/usr/bin/env")).toBe("/usr/bin/env");
    expect(decode("folder\\file.txt")).toBe("folder\\file.txt");
    expect(() => decode("/")).toThrow();
    expect(() => decode("foo/")).toThrow();
    expect(() => decode("foo\\")).toThrow();
    expect(() => decode("C:")).toThrow();
    expect(() => decode("\\\\server\\share")).toThrow();
  });

  it("validates Windows drive paths", () => {
    const decode = S.decodeUnknownSync(FilePathSchema.WindowsDrivePath);

    expect(decode("C:\\Users\\test\\file.txt")).toBe("C:\\Users\\test\\file.txt");
    expect(decode("C:/Users/test/file.txt")).toBe("C:/Users/test/file.txt");
    expect(decode("C:relative.txt")).toBe("C:relative.txt");
    expect(() => decode("C:")).toThrow();
    expect(() => decode("C:\\")).toThrow();
    expect(() => decode("C:\\folder\\")).toThrow();
    expect(() => decode("C:\\bad<name.txt")).toThrow();
  });

  it("validates Windows UNC paths", () => {
    const decode = S.decodeUnknownSync(FilePathSchema.WindowsUncPath);

    expect(decode("\\\\server\\share\\folder\\file.txt")).toBe("\\\\server\\share\\folder\\file.txt");
    expect(() => decode("\\\\server\\share")).toThrow();
    expect(() => decode("\\\\server")).toThrow();
    expect(() => decode("\\\\server\\share\\folder\\")).toThrow();
    expect(() => decode("\\\\?\\C:\\file.txt")).toThrow();
  });

  it("validates Windows relative paths without accepting UNC or drive-prefixed inputs", () => {
    const decode = S.decodeUnknownSync(FilePathSchema.WindowsRelativePath);

    expect(decode("folder\\file.txt")).toBe("folder\\file.txt");
    expect(decode(".\\file.txt")).toBe(".\\file.txt");
    expect(() => decode("file.txt")).toThrow();
    expect(() => decode("folder/child.txt")).toThrow();
    expect(() => decode("folder\\")).toThrow();
    expect(() => decode("\\\\server\\share\\file.txt")).toThrow();
    expect(() => decode("C:\\file.txt")).toThrow();
  });
});

describe("FilePath", () => {
  const decode = S.decodeUnknownSync(FilePathSchema.FilePath);

  it("accepts valid POSIX file paths", () => {
    expect(decode("/usr/bin/env")).toBe("/usr/bin/env");
    expect(decode("./foo/bar.txt")).toBe("./foo/bar.txt");
    expect(decode("../a")).toBe("../a");
  });

  it("accepts valid Windows drive paths", () => {
    expect(decode("C:\\Users\\test\\file.txt")).toBe("C:\\Users\\test\\file.txt");
    expect(decode("C:/Users/test/file.txt")).toBe("C:/Users/test/file.txt");
    expect(decode("C:relative.txt")).toBe("C:relative.txt");
  });

  it("accepts valid UNC file paths", () => {
    expect(decode("\\\\server\\share\\folder\\file.txt")).toBe("\\\\server\\share\\folder\\file.txt");
  });

  it("locks the any-major-os policy for ambiguous leaf paths", () => {
    expect(decode("CON")).toBe("CON");
    expect(decode("a<")).toBe("a<");
  });

  it("preserves the original path string exactly", () => {
    const input = "C:/Users/Test/Mixed-Case.txt";

    expect(decode(input)).toBe(input);
  });

  it("supports guard-style schema checks", () => {
    const isFilePath = S.is(FilePathSchema.FilePath);

    expect(isFilePath("./foo/bar.txt")).toBe(true);
    expect(isFilePath("foo/")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(() => decode("")).toThrow("File path must not be empty");
  });

  it("rejects embedded NUL bytes", () => {
    expect(() => decode(`bad\u0000path.txt`)).toThrow("File path must not contain embedded NUL bytes");
  });

  it("rejects root-only paths", () => {
    expect(() => decode("/")).toThrow("File path must include a leaf segment");
    expect(() => decode("C:\\")).toThrow("File path must include a leaf segment");
    expect(() => decode("\\\\server\\share")).toThrow("File path must include a leaf segment");
  });

  it("rejects paths ending in separators", () => {
    expect(() => decode("foo/")).toThrow("File path must include a leaf segment");
    expect(() => decode("foo\\")).toThrow("File path must include a leaf segment");
  });

  it("rejects malformed UNC paths", () => {
    expect(() => decode("\\\\server")).toThrow("File path must use supported POSIX or Windows file path syntax");
  });

  it("rejects invalid Windows characters in Windows path families", () => {
    expect(() => decode("C:\\bad<name.txt")).toThrow("File path must use supported POSIX or Windows file path syntax");
    expect(() => decode("folder\\bad|name.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("rejects Windows segments with trailing dots or spaces", () => {
    expect(() => decode("C:\\bad.\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
    expect(() => decode("folder\\bad \\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("rejects unsupported Windows namespace paths", () => {
    expect(() => decode("\\\\?\\C:\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
    expect(() => decode("\\\\.\\C:\\file.txt")).toThrow(
      "File path must use supported POSIX or Windows file path syntax"
    );
  });

  it("reports nested field failures at the filePath key", () => {
    const Payload = S.Struct({
      filePath: FilePathSchema.FilePath,
    });

    expect(() => S.decodeUnknownSync(Payload)({ filePath: "foo/" })).toThrow(`at ["filePath"]`);
  });

  it("decodes object schemas with a filePath property", () => {
    const Payload = S.Struct({
      filePath: FilePathSchema.FilePath,
    });
    const input = { filePath: "./folder/file.txt" };

    expect(S.decodeUnknownSync(Payload)(input)).toEqual(input);
  });
});
