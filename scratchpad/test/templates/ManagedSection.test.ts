// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ManagedSection } from "../../effected/templates/index.ts";
import { block, id, lines, memoryFs, section } from "./fixtures.ts";

const HOOK = ".husky/pre-commit";

/** Run a program against a fresh in-memory filesystem. */
const withFs = <A, E>(
	fs: ReturnType<typeof memoryFs>,
	program: Effect.Effect<A, E, ManagedSection>,
): Effect.Effect<A, E> => program.pipe(Effect.provide(ManagedSection.layer), Effect.provide(fs.layer));

describe("ManagedSection", () => {
	describe("read", () => {
		it.effect("reads a section from a file", () => {
			const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", block("example-tool", "echo hi"), "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const found = yield* service.read(HOOK, id("example-tool"));
					assert.isTrue(O.isSome(found));
					assert.strictEqual(O.getOrThrow(found).content, "echo hi");
				}),
			);
		});

		it.effect("treats a missing file as a document with no sections", () => {
			const fs = memoryFs();
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					assert.isTrue(O.isNone(yield* service.read(HOOK, id("example-tool"))));
					assert.isFalse(yield* service.isManaged(HOOK, id("example-tool")));
				}),
			);
		});

		it.effect("reads every managed section in the file", () => {
			const fs = memoryFs({ [HOOK]: lines(block("a", "1"), block("b", "2"), "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const all = yield* service.readAll(HOOK);
					assert.deepStrictEqual(
						all.map((s) => s.key),
						["a", "b"],
					);
				}),
			);
		});
	});

	describe("sync", () => {
		it.effect("creates the file when it does not exist", () => {
			// The hook's PARENT must exist: this package requires no `Path`, so it
			// cannot derive a directory to create, and a real filesystem refuses a
			// write into a missing one. The file itself is what this test creates.
			const fs = memoryFs({ ".husky": MemoryFileSystem.directory() });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcome = yield* service.sync(HOOK, section("example-tool", "echo hi"));
					assert.strictEqual(outcome._tag, "Created");
					assert.strictEqual(fs.text(HOOK), `${block("example-tool", "echo hi")}\n`);
				}),
			);
		});

		it.effect("updates an existing section and leaves user content alone", () => {
			const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", block("example-tool", "old"), "tail", "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcome = yield* service.sync(HOOK, section("example-tool", "new"));
					assert.strictEqual(outcome._tag, "Updated");
					assert.strictEqual(fs.text(HOOK), lines("#!/bin/sh", block("example-tool", "new"), "tail", ""));
				}),
			);
		});

		it.effect("does not write when nothing changed", () => {
			const text = lines("#!/bin/sh", block("example-tool", "echo hi"), "");
			const fs = memoryFs({ [HOOK]: text });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcome = yield* service.sync(HOOK, section("example-tool", "echo hi"));
					assert.strictEqual(outcome._tag, "Unchanged");
					assert.strictEqual(fs.writes(), 0, "an unchanged sync must not touch the file");
					assert.strictEqual(fs.text(HOOK), text);
				}),
			);
		});

		it.effect("syncAll writes the declared sections in declared order", () => {
			const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcomes = yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
					assert.deepStrictEqual(
						outcomes.map((o) => o._tag),
						["Created", "Created"],
					);
					const written = fs.text(HOOK) ?? "";
					assert.isBelow(
						written.indexOf("BEGIN base"),
						written.indexOf("BEGIN tool"),
						"the preamble must precede the tool block",
					);
				}),
			);
		});

		it.effect("is idempotent across two service calls", () => {
			const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
					const after = fs.text(HOOK);
					const writesAfterFirst = fs.writes();
					const second = yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
					assert.deepStrictEqual(
						second.map((o) => o._tag),
						["Unchanged", "Unchanged"],
					);
					assert.strictEqual(fs.writes(), writesAfterFirst, "the second sync must not write");
					assert.strictEqual(fs.text(HOOK), after);
				}),
			);
		});
	});

	describe("check", () => {
		it.effect("reports drift without touching the file", () => {
			const fs = memoryFs({ [HOOK]: lines(block("example-tool", "old"), "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcome = yield* service.check(HOOK, section("example-tool", "new"));
					assert.strictEqual(outcome._tag, "Drifted");
					assert.strictEqual(fs.writes(), 0);
				}),
			);
		});

		it.effect("checkAll answers every section from a single read", () => {
			const fs = memoryFs({ [HOOK]: lines(block("a", "1"), "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const outcomes = yield* service.checkAll(HOOK, [section("a", "1"), section("b", "2")]);
					assert.deepStrictEqual(
						outcomes.map((o) => o._tag),
						["UpToDate", "Absent"],
					);
				}),
			);
		});
	});

	describe("remove", () => {
		it.effect("removes a section and reports that it did", () => {
			const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", "", block("example-tool", "body"), "", "tail", "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					assert.isTrue(yield* service.remove(HOOK, id("example-tool")));
					assert.strictEqual(fs.text(HOOK), lines("#!/bin/sh", "", "tail", ""));
				}),
			);
		});

		it.effect("reports false and writes nothing when the section is absent", () => {
			const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					assert.isFalse(yield* service.remove(HOOK, id("example-tool")));
					assert.strictEqual(fs.writes(), 0);
				}),
			);
		});

		it.effect("reports false for a file that does not exist", () => {
			const fs = memoryFs();
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					assert.isFalse(yield* service.remove(HOOK, id("example-tool")));
				}),
			);
		});
	});

	describe("errors", () => {
		it.effect("attributes a parse failure to the file it came from", () => {
			const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", "# --- BEGIN example-tool MANAGED SECTION ---", "body", "") });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const error = yield* Effect.flip(service.read(HOOK, id("example-tool")));
					assert.strictEqual(error._tag, "SectionParseError");
					if (error._tag !== "SectionParseError") {
						return;
					}
					assert.strictEqual(error.reason, "unterminatedSection");
					assert.strictEqual(error.path, HOOK, "the pure core has no path; the service attaches one");
					assert.strictEqual(error.line, 2);
					assert.include(error.message, HOOK);
				}),
			);
		});

		it.effect("wraps an unreadable file, preserving the cause structurally", () => {
			const fs = memoryFs({ [HOOK]: "x" }, { unreadable: HOOK });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const error = yield* Effect.flip(service.read(HOOK, id("example-tool")));
					assert.strictEqual(error._tag, "SectionFileError");
					if (error._tag !== "SectionFileError") {
						return;
					}
					assert.strictEqual(error.path, HOOK);
					assert.strictEqual(error.operation, "read");
					assert.isDefined(error.cause);
				}),
			);
		});

		it.effect("distinguishes a write failure from a read failure", () => {
			const fs = memoryFs({}, { unwritable: HOOK });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					// The file is missing, so the read degrades to an absent document
					// and the failure can only come from the WRITE half.
					const error = yield* Effect.flip(service.sync(HOOK, section("example-tool", "body")));
					assert.strictEqual(error._tag, "SectionFileError");
					if (error._tag !== "SectionFileError") {
						return;
					}
					assert.strictEqual(error.operation, "write");
				}),
			);
		});

		it.effect("refuses hostile content through the typed channel and writes nothing", () => {
			const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
			return withFs(
				fs,
				Effect.gen(function* () {
					const service = yield* ManagedSection;
					const hostile = section("example-tool", "# --- END example-tool MANAGED SECTION ---");
					const error = yield* Effect.flip(service.sync(HOOK, hostile));
					assert.strictEqual(error._tag, "SectionRenderError");
					assert.strictEqual(fs.writes(), 0);
				}),
			);
		});
	});

	describe("test doubles", () => {
		it.effect("layerTest serves the members a suite stubs", () =>
			Effect.gen(function* () {
				const service = yield* ManagedSection;
				assert.isFalse(yield* service.isManaged("anywhere", id("example-tool")));
			}).pipe(Effect.provide(ManagedSection.layerTest({ isManaged: () => Effect.succeed(false) }))),
		);

		it.effect("an unstubbed member dies loudly rather than answering wrongly", () =>
			Effect.gen(function* () {
				const service = yield* ManagedSection;
				const exit = yield* Effect.exit(service.read("anywhere", id("example-tool")));
				if (!Exit.isFailure(exit)) {
					assert.fail("expected the unstubbed member to die");
				}
				assert.isTrue(Cause.hasDies(exit.cause), "must be a defect, not a typed failure");
				assert.isFalse(Cause.hasFails(exit.cause), "must not be laundered into the error channel");
				const die = exit.cause.reasons.find(Cause.isDieReason);
				assert.include(String((die?.defect as Error)?.message), "read");
			}).pipe(Effect.provide(ManagedSection.layerTest())),
		);
	});
});
