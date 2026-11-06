// Integration: the real Node filesystem, against real files in a temp dir.
//
// The unit suite runs on an in-memory double that CONSTRUCTS the platform
// errors it returns, so it can only ever assert this package's assumptions
// back at itself. These tests exist for the handful of facts that only the
// real `NodeFileSystem` can settle — above all the tag it reports for a
// missing file, which is what `ManagedSection` keys its "a missing file is not
// an error" degrade on.

import { CommentStyle, ManagedSection, SectionId } from "@beep/managed-section";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const tempDirOptions = { prefix: "effected-templates-" } as const;

const id = (key: string) => SectionId.make({ key, commentStyle: CommentStyle.hash });

it.layer(ManagedSection.layer.pipe(Layer.provideMerge(NodeServices.layer)), {
  timeout: "30 seconds",
})("ManagedSection (real filesystem)", (it) => {
  describe("the missing-file assumption", () => {
    it.effect("NodeFileSystem reports a missing file as NotFound", () =>
      Effect.gen(function* () {
        // This is the assumption `ManagedSection` encodes to decide that a
        // missing file is an empty document rather than an error. The unit
        // suite constructs this error itself and so cannot prove it. If this
        // tag ever changes, `sync` silently loses the ability to create
        // files and every in-memory test stays green.
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped);
        const nodePath = yield* Path.Path;
        // Asserted against `readFile`, the method `ManagedSection` actually
        // calls — pinning the tag on a method it does not use would prove
        // nothing about the degrade.
        const error = yield* Effect.flip(fs.readFile(nodePath.join(dir, "does-not-exist")));
        assert.strictEqual(error._tag, "PlatformError");
        assert.strictEqual(error.reason._tag, "NotFound");
      })
    );

    it.effect("reads a missing file as a document with no sections", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped1 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped1);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "absent");
        const read2 = yield* sections.read(path, id("example-tool"));
        assertNone(read2);
        const isManaged3 = yield* sections.isManaged(path, id("example-tool"));
        assert.isFalse(isManaged3);
        const remove4 = yield* sections.remove(path, id("example-tool"));
        assert.isFalse(remove4);
      })
    );

    it.effect("creates a file that does not exist yet", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped5 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped5);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "created");
        const outcome = yield* sections.sync(path, id("example-tool").section("echo hi"));
        assert.strictEqual(outcome._tag, "Created");
        const written = yield* fs.readFileString(path);
        assert.include(written, "BEGIN example-tool MANAGED SECTION");
        assert.include(written, "echo hi");
      })
    );

    it.effect("a read failure that is NOT NotFound stays a typed file error", () =>
      Effect.gen(function* () {
        // The converse of the degrade: reading a DIRECTORY as a file is a
        // real platform failure, and it must not be mistaken for "absent".
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped6 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped6);
        const sections = yield* ManagedSection;
        const error = yield* Effect.flip(sections.read(dir, id("example-tool")));
        assert.strictEqual(error._tag, "SectionFileError");
        if (error._tag !== "SectionFileError") {
          return;
        }
        assert.strictEqual(error.operation, "read");
        assert.strictEqual(error.path, dir);
      })
    );
  });

  describe("real bytes on disk", () => {
    it.effect("round-trips a CRLF file without downgrading its line endings", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped7 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped7);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "crlf.sh");
        yield* fs.writeFileString(path, "#!/bin/sh\r\n\r\ntail\r\n");

        yield* sections.sync(path, id("example-tool").section("echo hi"));
        const written = yield* fs.readFileString(path);
        assert.isFalse(/[^\r]\n/.test(written), "a real CRLF file must not gain a lone LF");
        assert.include(written, "tail");

        // And the second run is a genuine no-op on the real file.
        const second = yield* sections.sync(path, id("example-tool").section("echo hi"));
        assert.strictEqual(second._tag, "Unchanged");
        const after = yield* fs.readFileString(path);
        assert.strictEqual(after, written);
      })
    );

    it.effect("does not touch the file's mtime when nothing changed", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped8 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped8);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "stable.sh");
        yield* sections.sync(path, id("example-tool").section("echo hi"));
        // Pin an old timestamp so even a rewrite within one millisecond is detected.
        yield* fs.utimes(path, 0, 0);
        const first = yield* fs.stat(path);

        // File mtimes use the OS clock; wait on live time so a rewrite is observable.
        yield* TestClock.withLive(Effect.sleep("10 millis"));
        const outcome = yield* sections.sync(path, id("example-tool").section("echo hi"));
        assert.strictEqual(outcome._tag, "Unchanged");

        const second = yield* fs.stat(path);
        assert.strictEqual(
          O.getOrThrow(second.mtime).getTime(),
          O.getOrThrow(first.mtime).getTime(),
          "an unchanged sync must not rewrite the file — a watcher would see a change that is not one"
        );
      })
    );

    it.effect("preserves a byte-order mark through a sync", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped9 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped9);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "bom.md");
        yield* fs.writeFileString(path, "\uFEFF# Title\n");
        yield* sections.sync(path, id("example-tool").section("body"));
        const written = yield* fs.readFile(path);
        assert.deepStrictEqual(Array.from(written.subarray(0, 3)), [0xef, 0xbb, 0xbf]);
      })
    );
  });

  describe("the consumer lifecycle", () => {
    it.effect("creates ordered sections, is idempotent, then removes them", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped10 = yield* fs.makeTempDirectoryScoped(tempDirOptions);
        const dir = yield* fs.realPath(madeTempDirectoryScoped10);
        const nodePath = yield* Path.Path;
        const sections = yield* ManagedSection;
        const path = nodePath.join(dir, "pre-commit");
        yield* fs.writeFileString(path, "#!/bin/sh\n");

        const declared = [id("base").section("preamble"), id("tool").section("run-the-tool")];
        const created = yield* sections.syncAll(path, declared);
        assert.deepStrictEqual(
          A.map(created, (outcome) => outcome._tag),
          ["Created", "Created"]
        );

        const text = yield* fs.readFileString(path);
        assert.isBelow(
          O.getOrElse(Str.indexOf("BEGIN base")(text), constant(-1)),
          O.getOrElse(Str.indexOf("BEGIN tool")(text), constant(-1)),
          "declared order is the contract consumers depend on"
        );
        assert.isTrue(Str.startsWith("#!/bin/sh")(text), "the shebang must survive");

        const again = yield* sections.syncAll(path, declared);
        assert.deepStrictEqual(
          A.map(again, (outcome) => outcome._tag),
          ["Unchanged", "Unchanged"]
        );

        const remove11 = yield* sections.remove(path, id("tool"));
        assert.isTrue(remove11);
        const remove12 = yield* sections.remove(path, id("base"));
        assert.isTrue(remove12);
        const cleaned = yield* fs.readFileString(path);
        assert.strictEqual(cleaned, "#!/bin/sh\n");
        const readAll13 = yield* sections.readAll(path);
        assert.lengthOf(readAll13, 0);
      })
    );
  });
});
