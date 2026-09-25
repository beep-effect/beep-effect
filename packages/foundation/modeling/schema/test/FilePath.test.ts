import { fcRuns } from "@beep/fc-runs";
import * as FilePathSchema from "@beep/schema/FilePath";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
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
      expect(yield* decodeUnknownFilePathSchemaSupportedPathFamily("windowsDrive")).toBe("windowsDrive");
      expect(yield* decodeUnknownFilePathSchemaWindowsDotSegment(".")).toBe(".");
      expect(yield* decodeUnknownFilePathSchemaWindowsDotSegment("..")).toBe("..");
      const isFailure1 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaSupportedPathFamily("other")));
      assertTrue(isFailure1);
      const isFailure2 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDotSegment("...")));
      assertTrue(isFailure2);
    })
  );

  it.effect(
    "detects null bytes and supported namespaces",
    Effect.fnUntraced(function* () {
      expect(isFilePathSchemaHasNullByte(`bad\u0000path.txt`)).toBe(true);
      expect(isFilePathSchemaHasNullByte("plain.txt")).toBe(false);
      expect(yield* decodeUnknownFilePathSchemaSupportedWindowsNamespace("C:\\file.txt")).toBe("C:\\file.txt");
      const isFailure3 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaSupportedWindowsNamespace("\\\\?\\C:\\file.txt"))
      );
      assertTrue(isFailure3);
      const isFailure4 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaSupportedWindowsNamespace("\\\\.\\COM1"))
      );
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
      expect(yield* decodeUnknownFilePathSchemaWindowsDriveRoot("C:")).toBe("C:");
      expect(yield* decodeUnknownFilePathSchemaWindowsDriveRoot("C:\\")).toBe("C:\\");
      const isFailure5 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDriveRoot("C:file.txt")));
      assertTrue(isFailure5);

      expect(yield* decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server\\share")).toBe("\\\\server\\share");
      const isFailure6 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server\\share\\"))
      );
      assertTrue(isFailure6);
      const isFailure7 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncRoot("\\\\server")));
      assertTrue(isFailure7);
    })
  );

  it.effect.prop(
    "derives valid values from the WindowsDriveRoot source schema and round-trips",
    [Arbitrary.schema(FilePathSchema.WindowsDriveRoot)],
    Effect.fnUntraced(function* ([value]) {
      expect(yield* decodeUnknownFilePathSchemaWindowsDriveRoot(value)).toBe(value);
      expect(value).toMatch(/^[A-Za-z]:[\\/]?$/);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "validates Windows path segments",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("file.txt")).toBe("file.txt");
      const isFailure8 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("bad|name"))
      );
      assertTrue(isFailure8);
      const isFailure9 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("foo/bar"))
      );
      assertTrue(isFailure9);
      const isFailure10 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPlainPathSegment("bad."))
      );
      assertTrue(isFailure10);

      expect(yield* decodeUnknownFilePathSchemaValidWindowsRootSegment("share")).toBe("share");
      const isFailure11 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsRootSegment(".")));
      assertTrue(isFailure11);
      const isFailure12 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsRootSegment("..")));
      assertTrue(isFailure12);

      expect(yield* decodeUnknownFilePathSchemaValidWindowsPathSegment(".")).toBe(".");
      expect(yield* decodeUnknownFilePathSchemaValidWindowsPathSegment("..")).toBe("..");
      expect(yield* decodeUnknownFilePathSchemaValidWindowsPathSegment("folder")).toBe("folder");
      const isFailure13 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsPathSegment("foo/bar"))
      );
      assertTrue(isFailure13);
    })
  );

  it.effect(
    "validates Windows segment collections",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaWindowsSegments(["folder", "..", "file.txt"])).toEqual([
        "folder",
        "..",
        "file.txt",
      ]);
      const isFailure14 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsSegments([])));
      assertTrue(isFailure14);

      expect(yield* decodeUnknownFilePathSchemaValidWindowsUncRest(["folder", "file.txt"])).toEqual([
        "folder",
        "file.txt",
      ]);
      const isFailure15 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncRest([])));
      assertTrue(isFailure15);

      expect(yield* decodeUnknownFilePathSchemaValidWindowsUncSegments(["server", "share", "file.txt"])).toEqual([
        "server",
        "share",
        "file.txt",
      ]);
      const isFailure16 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncSegments(["server", "share"]))
      );
      assertTrue(isFailure16);
      const isFailure17 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaValidWindowsUncSegments([".", "share", "file.txt"]))
      );
      assertTrue(isFailure17);
    })
  );

  it.effect(
    "detects whether a path includes a leaf segment",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaHasLeafSegment("/usr/bin/env")).toBe("/usr/bin/env");
      expect(yield* decodeUnknownFilePathSchemaHasLeafSegment("folder\\file.txt")).toBe("folder\\file.txt");
      const isFailure18 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("/")));
      assertTrue(isFailure18);
      const isFailure19 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("foo/")));
      assertTrue(isFailure19);
      const isFailure20 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("foo\\")));
      assertTrue(isFailure20);
      const isFailure21 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("C:")));
      assertTrue(isFailure21);
      const isFailure22 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaHasLeafSegment("\\\\server\\share"))
      );
      assertTrue(isFailure22);
    })
  );

  it.effect(
    "validates Windows drive paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:\\Users\\test\\file.txt")).toBe(
        "C:\\Users\\test\\file.txt"
      );
      expect(yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:/Users/test/file.txt")).toBe(
        "C:/Users/test/file.txt"
      );
      expect(yield* decodeUnknownFilePathSchemaWindowsDrivePath("C:relative.txt")).toBe("C:relative.txt");
      const isFailure23 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:")));
      assertTrue(isFailure23);
      const isFailure24 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\")));
      assertTrue(isFailure24);
      const isFailure25 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\folder\\"))
      );
      assertTrue(isFailure25);
      const isFailure26 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsDrivePath("C:\\bad<name.txt"))
      );
      assertTrue(isFailure26);
    })
  );

  it.effect(
    "validates Windows UNC paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaWindowsUncPath("\\\\server\\share\\folder\\file.txt")).toBe(
        "\\\\server\\share\\folder\\file.txt"
      );
      const isFailure27 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server\\share"))
      );
      assertTrue(isFailure27);
      const isFailure28 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server")));
      assertTrue(isFailure28);
      const isFailure29 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\server\\share\\folder\\"))
      );
      assertTrue(isFailure29);
      const isFailure30 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsUncPath("\\\\?\\C:\\file.txt"))
      );
      assertTrue(isFailure30);
    })
  );

  it.effect(
    "validates Windows relative paths without accepting UNC or drive-prefixed inputs",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaWindowsRelativePath("folder\\file.txt")).toBe("folder\\file.txt");
      expect(yield* decodeUnknownFilePathSchemaWindowsRelativePath(".\\file.txt")).toBe(".\\file.txt");
      const isFailure31 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("file.txt")));
      assertTrue(isFailure31);
      const isFailure32 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("folder/child.txt"))
      );
      assertTrue(isFailure32);
      const isFailure33 = Exit.hasFails(yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("folder\\")));
      assertTrue(isFailure33);
      const isFailure34 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("\\\\server\\share\\file.txt"))
      );
      assertTrue(isFailure34);
      const isFailure35 = Exit.hasFails(
        yield* Effect.exit(decodeUnknownFilePathSchemaWindowsRelativePath("C:\\file.txt"))
      );
      assertTrue(isFailure35);
    })
  );
});

describe("FilePath", () => {
  it.effect(
    "publishes codec statics and a canonical arbitrary for file paths",
    Effect.fnUntraced(function* () {
      expect(
        (yield* Arbitrary.sampleEffect(Arbitrary.schema(FilePathSchema.FilePath), { count: 20, seed: 0x5eed })).every(
          FilePathSchema.FilePath.is
        )
      ).toBe(true);
      expect(yield* FilePathSchema.FilePath.decodeUnknownEffect("data/ontology.ttl")).toBe("data/ontology.ttl");
    })
  );

  it.effect(
    "accepts valid POSIX file paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaFilePath("/usr/bin/env")).toBe("/usr/bin/env");
      expect(yield* decodeUnknownFilePathSchemaFilePath("./foo/bar.txt")).toBe("./foo/bar.txt");
      expect(yield* decodeUnknownFilePathSchemaFilePath("../a")).toBe("../a");
    })
  );

  it.effect(
    "accepts valid Windows drive paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaFilePath("C:\\Users\\test\\file.txt")).toBe("C:\\Users\\test\\file.txt");
      expect(yield* decodeUnknownFilePathSchemaFilePath("C:/Users/test/file.txt")).toBe("C:/Users/test/file.txt");
      expect(yield* decodeUnknownFilePathSchemaFilePath("C:relative.txt")).toBe("C:relative.txt");
    })
  );

  it.effect(
    "accepts valid UNC file paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaFilePath("\\\\server\\share\\folder\\file.txt")).toBe(
        "\\\\server\\share\\folder\\file.txt"
      );
    })
  );

  it.effect(
    "locks the any-major-os policy for ambiguous leaf paths",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownFilePathSchemaFilePath("CON")).toBe("CON");
      expect(yield* decodeUnknownFilePathSchemaFilePath("a<")).toBe("a<");
    })
  );

  it.effect(
    "preserves the original path string exactly",
    Effect.fnUntraced(function* () {
      const input = "C:/Users/Test/Mixed-Case.txt";

      expect(yield* decodeUnknownFilePathSchemaFilePath(input)).toBe(input);
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
      const isFailure36 = Exit.hasFails(failure1);
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
      const isFailure37 = Exit.hasFails(failure2);
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
      const isFailure38 = Exit.hasFails(failure3);
      assertTrue(isFailure38);
      expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure4 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("C:\\"));
      const isFailure39 = Exit.hasFails(failure4);
      assertTrue(isFailure39);
      expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure5 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\server\\share"));
      const isFailure40 = Exit.hasFails(failure5);
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
      const isFailure41 = Exit.hasFails(failure6);
      assertTrue(isFailure41);
      expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must include a leaf segment"
      );
      const failure7 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("foo\\"));
      const isFailure42 = Exit.hasFails(failure7);
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
      const isFailure43 = Exit.hasFails(failure8);
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
      const isFailure44 = Exit.hasFails(failure9);
      assertTrue(isFailure44);
      expect(pipe(failure9.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure10 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("folder\\bad|name.txt"));
      const isFailure45 = Exit.hasFails(failure10);
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
      const isFailure46 = Exit.hasFails(failure11);
      assertTrue(isFailure46);
      expect(pipe(failure11.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure12 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("folder\\bad \\file.txt"));
      const isFailure47 = Exit.hasFails(failure12);
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
      const isFailure48 = Exit.hasFails(failure13);
      assertTrue(isFailure48);
      expect(pipe(failure13.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
        "File path must use supported POSIX or Windows file path syntax"
      );
      const failure14 = yield* Effect.exit(decodeUnknownFilePathSchemaFilePath("\\\\.\\C:\\file.txt"));
      const isFailure49 = Exit.hasFails(failure14);
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
      const isFailure50 = Exit.hasFails(failure15);
      assertTrue(isFailure50);
      expect(pipe(failure15.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["filePath"]`);
    })
  );

  it.effect(
    "decodes object schemas with a filePath property",
    Effect.fnUntraced(function* () {
      const input = { filePath: "./folder/file.txt" };

      expect(yield* decodeFilePathPayload(input)).toEqual(input);
    })
  );
});
