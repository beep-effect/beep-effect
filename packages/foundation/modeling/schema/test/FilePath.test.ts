import { fcRuns } from "@beep/fc-runs";
import * as FilePathSchema from "@beep/schema/FilePath";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownFilePathSchemaFilePath = S.decodeUnknownEffect(FilePathSchema.FilePath);
const decodeUnknownFilePathSchemaHasLeafSegment = S.decodeUnknownEffect(FilePathSchema.HasLeafSegment);
const decodeUnknownFilePathSchemaSupportedPathFamily = S.decodeUnknownEffect(FilePathSchema.SupportedPathFamily);
const decodeUnknownFilePathSchemaSupportedWindowsNamespace = S.decodeUnknownEffect(
  FilePathSchema.SupportedWindowsNamespace
);
const decodeUnknownFilePathSchemaValidWindowsPathSegment = S.decodeUnknownEffect(
  FilePathSchema.ValidWindowsPathSegment
);
const decodeUnknownFilePathSchemaValidWindowsPlainPathSegment = S.decodeUnknownEffect(
  FilePathSchema.ValidWindowsPlainPathSegment
);
const decodeUnknownFilePathSchemaValidWindowsRootSegment = S.decodeUnknownEffect(
  FilePathSchema.ValidWindowsRootSegment
);
const decodeUnknownFilePathSchemaValidWindowsUncRest = S.decodeUnknownEffect(FilePathSchema.ValidWindowsUncRest);
const decodeUnknownFilePathSchemaValidWindowsUncSegments = S.decodeUnknownEffect(
  FilePathSchema.ValidWindowsUncSegments
);
const decodeUnknownFilePathSchemaWindowsDotSegment = S.decodeUnknownEffect(FilePathSchema.WindowsDotSegment);
const decodeUnknownFilePathSchemaWindowsDrivePath = S.decodeUnknownEffect(FilePathSchema.WindowsDrivePath);
const decodeUnknownFilePathSchemaWindowsDriveRoot = S.decodeUnknownEffect(FilePathSchema.WindowsDriveRoot);
const decodeUnknownFilePathSchemaWindowsRelativePath = S.decodeUnknownEffect(FilePathSchema.WindowsRelativePath);
const decodeUnknownFilePathSchemaWindowsSegments = S.decodeUnknownEffect(FilePathSchema.WindowsSegments);
const decodeUnknownFilePathSchemaWindowsUncPath = S.decodeUnknownEffect(FilePathSchema.WindowsUncPath);
const decodeUnknownFilePathSchemaWindowsUncRoot = S.decodeUnknownEffect(FilePathSchema.WindowsUncRoot);
const isFilePathSchemaEndsWithSeparator = S.is(FilePathSchema.EndsWithSeparator);
const isFilePathSchemaFilePath = S.is(FilePathSchema.FilePath);
const isFilePathSchemaHasNullByte = S.is(FilePathSchema.HasNullByte);
const isFilePathSchemaUsesPosixSeparator = S.is(FilePathSchema.UsesPosixSeparator);
const isFilePathSchemaUsesWindowsSeparator = S.is(FilePathSchema.UsesWindowsSeparator);
const FilePathPayload = S.Struct({ filePath: FilePathSchema.FilePath });
const decodeFilePathPayload = S.decodeUnknownEffect(FilePathPayload);

describe("FilePath part schemas", () => {
  it.effect(
    "decodes the literal family unions",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaSupportedPathFamily =
        yield* decodeUnknownFilePathSchemaSupportedPathFamily("windowsDrive");
      expect(decodedUnknownFilePathSchemaSupportedPathFamily).toBe("windowsDrive");
      const decodedUnknownFilePathSchemaWindowsDotSegment = yield* decodeUnknownFilePathSchemaWindowsDotSegment(".");
      expect(decodedUnknownFilePathSchemaWindowsDotSegment).toBe(".");
      const decodedUnknownFilePathSchemaWindowsDotSegment1 = yield* decodeUnknownFilePathSchemaWindowsDotSegment("..");
      expect(decodedUnknownFilePathSchemaWindowsDotSegment1).toBe("..");
      const exit2 = yield* Effect.exit(decodeUnknownFilePathSchemaSupportedPathFamily("other"));
      const isFailure1 = Exit.hasFails(exit2);
      assertTrue(isFailure1);
      const exit3 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDotSegment("..."));
      const isFailure2 = Exit.hasFails(exit3);
      assertTrue(isFailure2);
    })
  );

  it.effect(
    "detects null bytes and supported namespaces",
    Effect.fnUntraced(function* () {
      expect(isFilePathSchemaHasNullByte(`bad\u0000path.txt`)).toBe(true);
      expect(isFilePathSchemaHasNullByte("plain.txt")).toBe(false);
      const decodedUnknownFilePathSchemaSupportedWindowsNamespace =
        yield* decodeUnknownFilePathSchemaSupportedWindowsNamespace("C:\\file.txt");
      expect(decodedUnknownFilePathSchemaSupportedWindowsNamespace).toBe("C:\\file.txt");
      const exit4 = yield* Effect.exit(decodeUnknownFilePathSchemaSupportedWindowsNamespace("\\\\?\\C:\\file.txt"));
      const isFailure3 = Exit.hasFails(exit4);
      assertTrue(isFailure3);
      const exit5 = yield* Effect.exit(decodeUnknownFilePathSchemaSupportedWindowsNamespace("\\\\.\\COM1"));
      const isFailure4 = Exit.hasFails(exit5);
      assertTrue(isFailure4);
    })
  );

  it("detects separator usage and trailing separators", () => {
    expect(isFilePathSchemaUsesPosixSeparator("foo/bar")).toBe(true);
    expect(isFilePathSchemaUsesPosixSeparator("foo\\bar")).toBe(false);

    expect(isFilePathSchemaUsesWindowsSeparator("foo\\bar")).toBe(true);
    expect(isFilePathSchemaUsesWindowsSeparator("foo/bar")).toBe(false);

    expect(isFilePathSchemaEndsWithSeparator("foo/")).toBe(true);
    expect(isFilePathSchemaEndsWithSeparator("foo\\")).toBe(true);
    expect(isFilePathSchemaEndsWithSeparator("foo")).toBe(false);
  });

  it.effect(
    "validates Windows roots",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaWindowsDriveRoot = yield* decodeUnknownFilePathSchemaWindowsDriveRoot("C:");
      expect(decodedUnknownFilePathSchemaWindowsDriveRoot).toBe("C:");
      const decodedUnknownFilePathSchemaWindowsDriveRoot6 = yield* decodeUnknownFilePathSchemaWindowsDriveRoot("C:\\");
      expect(decodedUnknownFilePathSchemaWindowsDriveRoot6).toBe("C:\\");
      const exit7 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDriveRoot("C:file.txt"));
      const isFailure5 = Exit.hasFails(exit7);
      assertTrue(isFailure5);

      const decodedUnknownFilePathSchemaWindowsUncRoot =
        yield* decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server\\share");
      expect(decodedUnknownFilePathSchemaWindowsUncRoot).toBe("\\\\server\\share");
      const exit8 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server\\share\\"));
      const isFailure6 = Exit.hasFails(exit8);
      assertTrue(isFailure6);
      const exit9 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server"));
      const isFailure7 = Exit.hasFails(exit9);
      assertTrue(isFailure7);
    })
  );

  it.effect.prop(
    "derives valid values from the WindowsDriveRoot source schema and round-trips",
    [Arbitrary.schema(FilePathSchema.WindowsDriveRoot)],
    Effect.fnUntraced(function* ([value]) {
      const decodedUnknownFilePathSchemaWindowsDriveRoot10 = yield* decodeUnknownFilePathSchemaWindowsDriveRoot(value);
      expect(decodedUnknownFilePathSchemaWindowsDriveRoot10).toBe(value);
      expect(value).toMatch(/^[A-Za-z]:[\\/]?$/);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "validates Windows path segments",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaValidWindowsPlainPathSegment =
        yield* decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("file.txt");
      expect(decodedUnknownFilePathSchemaValidWindowsPlainPathSegment).toBe("file.txt");
      const exit11 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("bad|name"));
      const isFailure8 = Exit.hasFails(exit11);
      assertTrue(isFailure8);
      const exit12 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("foo/bar"));
      const isFailure9 = Exit.hasFails(exit12);
      assertTrue(isFailure9);
      const exit13 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("bad."));
      const isFailure10 = Exit.hasFails(exit13);
      assertTrue(isFailure10);

      const decodedUnknownFilePathSchemaValidWindowsRootSegment =
        yield* decodeUnknownFilePathSchemaValidWindowsRootSegment("share");
      expect(decodedUnknownFilePathSchemaValidWindowsRootSegment).toBe("share");
      const exit14 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsRootSegment("."));
      const isFailure11 = Exit.hasFails(exit14);
      assertTrue(isFailure11);
      const exit15 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsRootSegment(".."));
      const isFailure12 = Exit.hasFails(exit15);
      assertTrue(isFailure12);

      const decodedUnknownFilePathSchemaValidWindowsPathSegment =
        yield* decodeUnknownFilePathSchemaValidWindowsPathSegment(".");
      expect(decodedUnknownFilePathSchemaValidWindowsPathSegment).toBe(".");
      const decodedUnknownFilePathSchemaValidWindowsPathSegment16 =
        yield* decodeUnknownFilePathSchemaValidWindowsPathSegment("..");
      expect(decodedUnknownFilePathSchemaValidWindowsPathSegment16).toBe("..");
      const decodedUnknownFilePathSchemaValidWindowsPathSegment17 =
        yield* decodeUnknownFilePathSchemaValidWindowsPathSegment("folder");
      expect(decodedUnknownFilePathSchemaValidWindowsPathSegment17).toBe("folder");
      const exit18 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPathSegment("foo/bar"));
      const isFailure13 = Exit.hasFails(exit18);
      assertTrue(isFailure13);
    })
  );

  it.effect(
    "validates Windows segment collections",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaWindowsSegments = yield* decodeUnknownFilePathSchemaWindowsSegments([
        "folder",
        "..",
        "file.txt",
      ]);
      expect(decodedUnknownFilePathSchemaWindowsSegments).toEqual(["folder", "..", "file.txt"]);
      const exit19 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsSegments([]));
      const isFailure14 = Exit.hasFails(exit19);
      assertTrue(isFailure14);

      const decodedUnknownFilePathSchemaValidWindowsUncRest = yield* decodeUnknownFilePathSchemaValidWindowsUncRest([
        "folder",
        "file.txt",
      ]);
      expect(decodedUnknownFilePathSchemaValidWindowsUncRest).toEqual(["folder", "file.txt"]);
      const exit20 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncRest([]));
      const isFailure15 = Exit.hasFails(exit20);
      assertTrue(isFailure15);

      const decodedUnknownFilePathSchemaValidWindowsUncSegments =
        yield* decodeUnknownFilePathSchemaValidWindowsUncSegments(["server", "share", "file.txt"]);
      expect(decodedUnknownFilePathSchemaValidWindowsUncSegments).toEqual(["server", "share", "file.txt"]);
      const exit21 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncSegments(["server", "share"]));
      const isFailure16 = Exit.hasFails(exit21);
      assertTrue(isFailure16);
      const exit22 = yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncSegments([".", "share", "file.txt"]));
      const isFailure17 = Exit.hasFails(exit22);
      assertTrue(isFailure17);
    })
  );

  it.effect(
    "detects whether a path includes a leaf segment",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaHasLeafSegment =
        yield* decodeUnknownFilePathSchemaHasLeafSegment("/usr/bin/env");
      expect(decodedUnknownFilePathSchemaHasLeafSegment).toBe("/usr/bin/env");
      const decodedUnknownFilePathSchemaHasLeafSegment23 =
        yield* decodeUnknownFilePathSchemaHasLeafSegment("folder\\file.txt");
      expect(decodedUnknownFilePathSchemaHasLeafSegment23).toBe("folder\\file.txt");
      const exit24 = yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("/"));
      const isFailure18 = Exit.hasFails(exit24);
      assertTrue(isFailure18);
      const exit25 = yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("foo/"));
      const isFailure19 = Exit.hasFails(exit25);
      assertTrue(isFailure19);
      const exit26 = yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("foo\\"));
      const isFailure20 = Exit.hasFails(exit26);
      assertTrue(isFailure20);
      const exit27 = yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("C:"));
      const isFailure21 = Exit.hasFails(exit27);
      assertTrue(isFailure21);
      const exit28 = yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("\\\\server\\share"));
      const isFailure22 = Exit.hasFails(exit28);
      assertTrue(isFailure22);
    })
  );

  it.effect(
    "validates Windows drive paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaWindowsDrivePath =
        yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:\\Users\\test\\file.txt");
      expect(decodedUnknownFilePathSchemaWindowsDrivePath).toBe("C:\\Users\\test\\file.txt");
      const decodedUnknownFilePathSchemaWindowsDrivePath29 =
        yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:/Users/test/file.txt");
      expect(decodedUnknownFilePathSchemaWindowsDrivePath29).toBe("C:/Users/test/file.txt");
      const decodedUnknownFilePathSchemaWindowsDrivePath30 =
        yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:relative.txt");
      expect(decodedUnknownFilePathSchemaWindowsDrivePath30).toBe("C:relative.txt");
      const exit31 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:"));
      const isFailure23 = Exit.hasFails(exit31);
      assertTrue(isFailure23);
      const exit32 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\"));
      const isFailure24 = Exit.hasFails(exit32);
      assertTrue(isFailure24);
      const exit33 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\folder\\"));
      const isFailure25 = Exit.hasFails(exit33);
      assertTrue(isFailure25);
      const exit34 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\bad<name.txt"));
      const isFailure26 = Exit.hasFails(exit34);
      assertTrue(isFailure26);
    })
  );

  it.effect(
    "validates Windows UNC paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaWindowsUncPath = yield* decodeUnknownFilePathSchemaWindowsUncPath(
        "\\\\server\\share\\folder\\file.txt"
      );
      expect(decodedUnknownFilePathSchemaWindowsUncPath).toBe("\\\\server\\share\\folder\\file.txt");
      const exit35 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server\\share"));
      const isFailure27 = Exit.hasFails(exit35);
      assertTrue(isFailure27);
      const exit36 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server"));
      const isFailure28 = Exit.hasFails(exit36);
      assertTrue(isFailure28);
      const exit37 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server\\share\\folder\\"));
      const isFailure29 = Exit.hasFails(exit37);
      assertTrue(isFailure29);
      const exit38 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\?\\C:\\file.txt"));
      const isFailure30 = Exit.hasFails(exit38);
      assertTrue(isFailure30);
    })
  );

  it.effect(
    "validates Windows relative paths without accepting UNC or drive-prefixed inputs",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaWindowsRelativePath =
        yield* decodeUnknownFilePathSchemaWindowsRelativePath("folder\\file.txt");
      expect(decodedUnknownFilePathSchemaWindowsRelativePath).toBe("folder\\file.txt");
      const decodedUnknownFilePathSchemaWindowsRelativePath39 =
        yield* decodeUnknownFilePathSchemaWindowsRelativePath(".\\file.txt");
      expect(decodedUnknownFilePathSchemaWindowsRelativePath39).toBe(".\\file.txt");
      const exit40 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("file.txt"));
      const isFailure31 = Exit.hasFails(exit40);
      assertTrue(isFailure31);
      const exit41 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("folder/child.txt"));
      const isFailure32 = Exit.hasFails(exit41);
      assertTrue(isFailure32);
      const exit42 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("folder\\"));
      const isFailure33 = Exit.hasFails(exit42);
      assertTrue(isFailure33);
      const exit43 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("\\\\server\\share\\file.txt"));
      const isFailure34 = Exit.hasFails(exit43);
      assertTrue(isFailure34);
      const exit44 = yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("C:\\file.txt"));
      const isFailure35 = Exit.hasFails(exit44);
      assertTrue(isFailure35);
    })
  );
});

describe("FilePath", () => {
  it.effect(
    "publishes codec statics and a canonical arbitrary for file paths",
    Effect.fnUntraced(function* () {
      const sampleEffect45 = yield* Arbitrary.sampleEffect(Arbitrary.schema(FilePathSchema.FilePath), {
        count: 20,
        seed: 0x5eed,
      });
      expect(A.every(sampleEffect45, S.is(FilePathSchema.FilePath))).toBe(true);
      const value46 = yield* S.decodeEffect(FilePathSchema.FilePath)("data/ontology.ttl");
      expect(value46).toBe("data/ontology.ttl");
    })
  );

  it.effect(
    "accepts valid POSIX file paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaFilePath = yield* decodeUnknownFilePathSchemaFilePath("/usr/bin/env");
      expect(decodedUnknownFilePathSchemaFilePath).toBe("/usr/bin/env");
      const decodedUnknownFilePathSchemaFilePath47 = yield* decodeUnknownFilePathSchemaFilePath("./foo/bar.txt");
      expect(decodedUnknownFilePathSchemaFilePath47).toBe("./foo/bar.txt");
      const decodedUnknownFilePathSchemaFilePath48 = yield* decodeUnknownFilePathSchemaFilePath("../a");
      expect(decodedUnknownFilePathSchemaFilePath48).toBe("../a");
    })
  );

  it.effect(
    "accepts valid Windows drive paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaFilePath49 =
        yield* decodeUnknownFilePathSchemaFilePath("C:\\Users\\test\\file.txt");
      expect(decodedUnknownFilePathSchemaFilePath49).toBe("C:\\Users\\test\\file.txt");
      const decodedUnknownFilePathSchemaFilePath50 =
        yield* decodeUnknownFilePathSchemaFilePath("C:/Users/test/file.txt");
      expect(decodedUnknownFilePathSchemaFilePath50).toBe("C:/Users/test/file.txt");
      const decodedUnknownFilePathSchemaFilePath51 = yield* decodeUnknownFilePathSchemaFilePath("C:relative.txt");
      expect(decodedUnknownFilePathSchemaFilePath51).toBe("C:relative.txt");
    })
  );

  it.effect(
    "accepts valid UNC file paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaFilePath52 = yield* decodeUnknownFilePathSchemaFilePath(
        "\\\\server\\share\\folder\\file.txt"
      );
      expect(decodedUnknownFilePathSchemaFilePath52).toBe("\\\\server\\share\\folder\\file.txt");
    })
  );

  it.effect(
    "locks the any-major-os policy for ambiguous leaf paths",
    Effect.fnUntraced(function* () {
      const decodedUnknownFilePathSchemaFilePath53 = yield* decodeUnknownFilePathSchemaFilePath("CON");
      expect(decodedUnknownFilePathSchemaFilePath53).toBe("CON");
      const decodedUnknownFilePathSchemaFilePath54 = yield* decodeUnknownFilePathSchemaFilePath("a<");
      expect(decodedUnknownFilePathSchemaFilePath54).toBe("a<");
    })
  );

  it.effect(
    "preserves the original path string exactly",
    Effect.fnUntraced(function* () {
      const input = "C:/Users/Test/Mixed-Case.txt";

      const decodedUnknownFilePathSchemaFilePath55 = yield* decodeUnknownFilePathSchemaFilePath(input);
      expect(decodedUnknownFilePathSchemaFilePath55).toBe(input);
    })
  );

  it("supports guard-style schema checks", () => {
    expect(isFilePathSchemaFilePath("./foo/bar.txt")).toBe(true);
    expect(isFilePathSchemaFilePath("foo/")).toBe(false);
  });

  it.effect(
    "rejects empty input",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath(""));
      const isFailure36 = Exit.isFailure(failure1) && Exit.hasFails(failure1);
      assertTrue(isFailure36);
      expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must not be empty"
      );
    })
  );

  it.effect(
    "rejects embedded NUL bytes",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath(`bad\u0000path.txt`));
      const isFailure37 = Exit.isFailure(failure2) && Exit.hasFails(failure2);
      assertTrue(isFailure37);
      expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must not contain embedded NUL bytes"
      );
    })
  );

  it.effect(
    "rejects root-only paths",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("/"));
      const isFailure38 = Exit.isFailure(failure3) && Exit.hasFails(failure3);
      assertTrue(isFailure38);
      expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure4 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("C:\\"));
      const isFailure39 = Exit.isFailure(failure4) && Exit.hasFails(failure4);
      assertTrue(isFailure39);
      expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure5 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\server\\share"));
      const isFailure40 = Exit.isFailure(failure5) && Exit.hasFails(failure5);
      assertTrue(isFailure40);
      expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
    })
  );

  it.effect(
    "rejects paths ending in separators",
    Effect.fnUntraced(function* () {
      const failure6 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("foo/"));
      const isFailure41 = Exit.isFailure(failure6) && Exit.hasFails(failure6);
      assertTrue(isFailure41);
      expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure7 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("foo\\"));
      const isFailure42 = Exit.isFailure(failure7) && Exit.hasFails(failure7);
      assertTrue(isFailure42);
      expect(pipe(failure7.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
    })
  );

  it.effect(
    "rejects malformed UNC paths",
    Effect.fnUntraced(function* () {
      const failure8 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\server"));
      const isFailure43 = Exit.isFailure(failure8) && Exit.hasFails(failure8);
      assertTrue(isFailure43);
      expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
    })
  );

  it.effect(
    "rejects invalid Windows characters in Windows path families",
    Effect.fnUntraced(function* () {
      const failure9 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("C:\\bad<name.txt"));
      const isFailure44 = Exit.isFailure(failure9) && Exit.hasFails(failure9);
      assertTrue(isFailure44);
      expect(pipe(failure9.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure10 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("folder\\bad|name.txt"));
      const isFailure45 = Exit.isFailure(failure10) && Exit.hasFails(failure10);
      assertTrue(isFailure45);
      expect(pipe(failure10.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
    })
  );

  it.effect(
    "rejects Windows segments with trailing dots or spaces",
    Effect.fnUntraced(function* () {
      const failure11 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("C:\\bad.\\file.txt"));
      const isFailure46 = Exit.isFailure(failure11) && Exit.hasFails(failure11);
      assertTrue(isFailure46);
      expect(pipe(failure11.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure12 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("folder\\bad \\file.txt"));
      const isFailure47 = Exit.isFailure(failure12) && Exit.hasFails(failure12);
      assertTrue(isFailure47);
      expect(pipe(failure12.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
    })
  );

  it.effect(
    "rejects unsupported Windows namespace paths",
    Effect.fnUntraced(function* () {
      const failure13 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\?\\C:\\file.txt"));
      const isFailure48 = Exit.isFailure(failure13) && Exit.hasFails(failure13);
      assertTrue(isFailure48);
      expect(pipe(failure13.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure14 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\.\\C:\\file.txt"));
      const isFailure49 = Exit.isFailure(failure14) && Exit.hasFails(failure14);
      assertTrue(isFailure49);
      expect(pipe(failure14.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
    })
  );

  it.effect(
    "reports nested field failures at the filePath key",
    Effect.fnUntraced(function* () {
      const failure15 = yield* Effect.exit(decodeFilePathPayload({ filePath: "foo/" }));
      const isFailure50 = Exit.isFailure(failure15) && Exit.hasFails(failure15);
      assertTrue(isFailure50);
      expect(pipe(failure15.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["filePath"]`);
    })
  );

  it.effect(
    "decodes object schemas with a filePath property",
    Effect.fnUntraced(function* () {
      const input = { filePath: "./folder/file.txt" };

      const decodedFilePathPayload = yield* decodeFilePathPayload(input);
      expect(decodedFilePathPayload).toEqual(input);
    })
  );
});
