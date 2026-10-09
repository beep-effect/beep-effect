// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file nodeBuiltinImport:skip-file globalTimers:skip-file newPromise:skip-file
// Integration: the real Node filesystem, against real files in a temp dir.
//
// The unit suite runs on an in-memory double that CONSTRUCTS the platform
// errors it returns, so it can only ever assert this package's assumptions
// back at itself. These tests exist for the handful of facts that only the
// real `NodeFileSystem` can settle — above all the tag it reports for a
// missing file, which is what `ManagedSection` keys its "a missing file is not
// an error" degrade on.

import * as nodeFs from "node:fs/promises";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { Scope } from "effect";
import { Effect, FileSystem, Option } from "effect";
import { CommentStyle, ManagedSection, SectionId } from "../../../effected/templates/index.ts";

const tempDir = Effect.acquireRelease(
	Effect.promise(() => nodeFs.mkdtemp(nodePath.join(nodeOs.tmpdir(), "effected-templates-"))),
	(dir) => Effect.promise(() => nodeFs.rm(dir, { recursive: true, force: true })),
);

/**
 * `it.effect` already carries a `Scope`, so the temp dir acquired by
 * `Effect.acquireRelease` releases when the test ends — no `Effect.scoped`
 * needed, and the Scope stays in `R` for the runner to discharge.
 */
const live = <A, E>(program: Effect.Effect<A, E, ManagedSection | FileSystem.FileSystem | Scope.Scope>) =>
	program.pipe(Effect.provide(ManagedSection.layer), Effect.provide(NodeFileSystem.layer));

const id = (key: string) => SectionId.make({ key, commentStyle: CommentStyle.hash });

describe("ManagedSection (real filesystem)", () => {
	describe("the missing-file assumption", () => {
		it.effect("NodeFileSystem reports a missing file as NotFound", () =>
			live(
				Effect.gen(function* () {
					// This is the assumption `ManagedSection` encodes to decide that a
					// missing file is an empty document rather than an error. The unit
					// suite constructs this error itself and so cannot prove it. If this
					// tag ever changes, `sync` silently loses the ability to create
					// files and every in-memory test stays green.
					const dir = yield* tempDir;
					const fs = yield* FileSystem.FileSystem;
					// Asserted against `readFile`, the method `ManagedSection` actually
					// calls — pinning the tag on a method it does not use would prove
					// nothing about the degrade.
					const error = yield* Effect.flip(fs.readFile(nodePath.join(dir, "does-not-exist")));
					assert.strictEqual(error._tag, "PlatformError");
					assert.strictEqual(error.reason._tag, "NotFound");
				}),
			),
		);

		it.effect("reads a missing file as a document with no sections", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "absent");
					assert.isTrue(Option.isNone(yield* sections.read(path, id("example-tool"))));
					assert.isFalse(yield* sections.isManaged(path, id("example-tool")));
					assert.isFalse(yield* sections.remove(path, id("example-tool")));
				}),
			),
		);

		it.effect("creates a file that does not exist yet", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "created");
					const outcome = yield* sections.sync(path, id("example-tool").section("echo hi"));
					assert.strictEqual(outcome._tag, "Created");
					const written = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.include(written, "BEGIN example-tool MANAGED SECTION");
					assert.include(written, "echo hi");
				}),
			),
		);

		it.effect("a read failure that is NOT NotFound stays a typed file error", () =>
			live(
				Effect.gen(function* () {
					// The converse of the degrade: reading a DIRECTORY as a file is a
					// real platform failure, and it must not be mistaken for "absent".
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const error = yield* Effect.flip(sections.read(dir, id("example-tool")));
					assert.strictEqual(error._tag, "SectionFileError");
					if (error._tag !== "SectionFileError") {
						return;
					}
					assert.strictEqual(error.operation, "read");
					assert.strictEqual(error.path, dir);
				}),
			),
		);
	});

	describe("real bytes on disk", () => {
		it.effect("round-trips a CRLF file without downgrading its line endings", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "crlf.sh");
					yield* Effect.promise(() => nodeFs.writeFile(path, "#!/bin/sh\r\n\r\ntail\r\n", "utf8"));

					yield* sections.sync(path, id("example-tool").section("echo hi"));
					const written = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.isFalse(/[^\r]\n/.test(written), "a real CRLF file must not gain a lone LF");
					assert.include(written, "tail");

					// And the second run is a genuine no-op on the real file.
					const second = yield* sections.sync(path, id("example-tool").section("echo hi"));
					assert.strictEqual(second._tag, "Unchanged");
					const after = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.strictEqual(after, written);
				}),
			),
		);

		it.effect("does not touch the file's mtime when nothing changed", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "stable.sh");
					yield* sections.sync(path, id("example-tool").section("echo hi"));
					const first = yield* Effect.promise(() => nodeFs.stat(path));

					yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 10)));
					const outcome = yield* sections.sync(path, id("example-tool").section("echo hi"));
					assert.strictEqual(outcome._tag, "Unchanged");

					const second = yield* Effect.promise(() => nodeFs.stat(path));
					assert.strictEqual(
						second.mtimeMs,
						first.mtimeMs,
						"an unchanged sync must not rewrite the file — a watcher would see a change that is not one",
					);
				}),
			),
		);

		it.effect("preserves a byte-order mark through a sync", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "bom.md");
					yield* Effect.promise(() => nodeFs.writeFile(path, "﻿# Title\n", "utf8"));
					yield* sections.sync(path, id("example-tool").section("body"));
					const written = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.isTrue(written.startsWith("﻿"));
				}),
			),
		);
	});

	describe("the consumer lifecycle", () => {
		it.effect("creates ordered sections, is idempotent, then removes them", () =>
			live(
				Effect.gen(function* () {
					const dir = yield* tempDir;
					const sections = yield* ManagedSection;
					const path = nodePath.join(dir, "pre-commit");
					yield* Effect.promise(() => nodeFs.writeFile(path, "#!/bin/sh\n", "utf8"));

					const declared = [id("base").section("preamble"), id("tool").section("run-the-tool")];
					const created = yield* sections.syncAll(path, declared);
					assert.deepStrictEqual(
						created.map((outcome) => outcome._tag),
						["Created", "Created"],
					);

					const text = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.isBelow(
						text.indexOf("BEGIN base"),
						text.indexOf("BEGIN tool"),
						"declared order is the contract consumers depend on",
					);
					assert.isTrue(text.startsWith("#!/bin/sh"), "the shebang must survive");

					const again = yield* sections.syncAll(path, declared);
					assert.deepStrictEqual(
						again.map((outcome) => outcome._tag),
						["Unchanged", "Unchanged"],
					);

					assert.isTrue(yield* sections.remove(path, id("tool")));
					assert.isTrue(yield* sections.remove(path, id("base")));
					const cleaned = yield* Effect.promise(() => nodeFs.readFile(path, "utf8"));
					assert.strictEqual(cleaned, "#!/bin/sh\n");
					assert.lengthOf(yield* sections.readAll(path), 0);
				}),
			),
		);
	});
});
