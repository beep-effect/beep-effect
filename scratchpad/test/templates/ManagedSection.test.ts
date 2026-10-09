import { assert, describe, it } from "@effect/vitest";
import { assertSome, assertNone, assertExitFailure } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ManagedSection } from "../../effected/templates/index.ts";
import { ManagedSectionTestError, SectionFileError } from "../../effected/templates/ManagedSection.ts";
import { block, id, lines, memoryFs, section } from "./fixtures.ts";

const isErrorInstance = S.is(S.ErrorInstance());

const HOOK = ".husky/pre-commit";

describe("ManagedSection", () => {
  describe("read", () => {
    {
      const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", block("example-tool", "echo hi"), "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("reads a section from a file", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const found = yield* service.read(HOOK, id("example-tool"));
            assertSome(found, O.getOrThrow(found));
            assert.strictEqual(O.getOrThrow(found).content, "echo hi");
          })
        );
      });
    }

    {
      const fs = memoryFs();
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("treats a missing file as a document with no sections", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            assertNone(yield* service.read(HOOK, id("example-tool")));
            assert.isFalse(yield* service.isManaged(HOOK, id("example-tool")));
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: lines(block("a", "1"), block("b", "2"), "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("reads every managed section in the file", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const all = yield* service.readAll(HOOK);
            assert.deepStrictEqual(
              all.map((s) => s.key),
              ["a", "b"]
            );
          })
        );
      });
    }
  });

  describe("sync", () => {
    {
      // The hook's PARENT must exist: this package requires no `Path`, so it
      // cannot derive a directory to create, and a real filesystem refuses a
      // write into a missing one. The file itself is what this test creates.
      const fs = memoryFs({ ".husky": MemoryFileSystem.directory() });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("creates the file when it does not exist", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcome = yield* service.sync(HOOK, section("example-tool", "echo hi"));
            assert.strictEqual(outcome._tag, "Created");
            assert.strictEqual(fs.text(HOOK), `${block("example-tool", "echo hi")}\n`);
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", block("example-tool", "old"), "tail", "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("updates an existing section and leaves user content alone", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcome = yield* service.sync(HOOK, section("example-tool", "new"));
            assert.strictEqual(outcome._tag, "Updated");
            assert.strictEqual(fs.text(HOOK), lines("#!/bin/sh", block("example-tool", "new"), "tail", ""));
          })
        );
      });
    }

    {
      const text = lines("#!/bin/sh", block("example-tool", "echo hi"), "");
      const fs = memoryFs({ [HOOK]: text });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("does not write when nothing changed", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcome = yield* service.sync(HOOK, section("example-tool", "echo hi"));
            assert.strictEqual(outcome._tag, "Unchanged");
            assert.strictEqual(fs.writes(), 0, "an unchanged sync must not touch the file");
            assert.strictEqual(fs.text(HOOK), text);
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("syncAll writes the declared sections in declared order", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcomes = yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
            assert.deepStrictEqual(
              outcomes.map((o) => o._tag),
              ["Created", "Created"]
            );
            const written = fs.text(HOOK) ?? "";
            assert.isBelow(
              written.indexOf("BEGIN base"),
              written.indexOf("BEGIN tool"),
              "the preamble must precede the tool block"
            );
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("is idempotent across two service calls", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
            const after = fs.text(HOOK);
            const writesAfterFirst = fs.writes();
            const second = yield* service.syncAll(HOOK, [section("base", "preamble"), section("tool", "run")]);
            assert.deepStrictEqual(
              second.map((o) => o._tag),
              ["Unchanged", "Unchanged"]
            );
            assert.strictEqual(fs.writes(), writesAfterFirst, "the second sync must not write");
            assert.strictEqual(fs.text(HOOK), after);
          })
        );
      });
    }
  });

  describe("check", () => {
    {
      const fs = memoryFs({ [HOOK]: lines(block("example-tool", "old"), "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("reports drift without touching the file", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcome = yield* service.check(HOOK, section("example-tool", "new"));
            assert.strictEqual(outcome._tag, "Drifted");
            assert.strictEqual(fs.writes(), 0);
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: lines(block("a", "1"), "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("checkAll answers every section from a single read", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const outcomes = yield* service.checkAll(HOOK, [section("a", "1"), section("b", "2")]);
            assert.deepStrictEqual(
              outcomes.map((o) => o._tag),
              ["UpToDate", "Absent"]
            );
          })
        );
      });
    }
  });

  describe("remove", () => {
    {
      const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", "", block("example-tool", "body"), "", "tail", "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("removes a section and reports that it did", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            assert.isTrue(yield* service.remove(HOOK, id("example-tool")));
            assert.strictEqual(fs.text(HOOK), lines("#!/bin/sh", "", "tail", ""));
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("reports false and writes nothing when the section is absent", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            assert.isFalse(yield* service.remove(HOOK, id("example-tool")));
            assert.strictEqual(fs.writes(), 0);
          })
        );
      });
    }

    {
      const fs = memoryFs();
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("reports false for a file that does not exist", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            assert.isFalse(yield* service.remove(HOOK, id("example-tool")));
          })
        );
      });
    }
  });

  describe("errors", () => {
    it.effect("preserves the cause stack when encoding and decoding a file error", () =>
      Effect.gen(function* () {
        const cause = new Error("failed");
        cause.stack = "Error: failed\n    at readManagedSection (managed-section.ts:1:1)";
        const error = SectionFileError.make({ path: HOOK, operation: "read", cause });
        const encoded = yield* S.encodeEffect(SectionFileError)(error);
        assert.deepStrictEqual(encoded.cause, {
          name: "Error",
          message: cause.message,
          stack: cause.stack,
        });
        const decoded = yield* S.decodeEffect(SectionFileError)(encoded);
        assert.strictEqual(decoded._tag, "SectionFileError");
        assert.strictEqual(decoded.path, HOOK);
        assert.strictEqual(decoded.operation, "read");
        if (!isErrorInstance(decoded.cause)) {
          assert.fail("expected the decoded cause to be an Error");
        }
        assert.strictEqual(decoded.cause.name, cause.name);
        assert.strictEqual(decoded.cause.message, cause.message);
        assert.strictEqual(decoded.cause.stack, cause.stack);
      })
    );

    {
      const fs = memoryFs({ [HOOK]: lines("#!/bin/sh", "# --- BEGIN example-tool MANAGED SECTION ---", "body", "") });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("attributes a parse failure to the file it came from", () =>
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
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: "x" }, { unreadable: HOOK });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("wraps an unreadable file, preserving the cause structurally", () =>
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
          })
        );
      });
    }

    {
      const fs = memoryFs({}, { unwritable: HOOK });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("distinguishes a write failure from a read failure", () =>
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
          })
        );
      });
    }

    {
      const fs = memoryFs({ [HOOK]: "#!/bin/sh\n" });
      it.layer(ManagedSection.layer.pipe(Layer.provide(fs.layer)), { timeout: "30 seconds" })((it) => {
        it.effect("refuses hostile content through the typed channel and writes nothing", () =>
          Effect.gen(function* () {
            const service = yield* ManagedSection;
            const hostile = section("example-tool", "# --- END example-tool MANAGED SECTION ---");
            const error = yield* Effect.flip(service.sync(HOOK, hostile));
            assert.strictEqual(error._tag, "SectionRenderError");
            assert.strictEqual(fs.writes(), 0);
          })
        );
      });
    }
  });

  describe("test doubles", () => {
    it.layer(ManagedSection.layerTest({ isManaged: () => Effect.succeed(false) }), { timeout: "30 seconds" })((it) => {
      it.effect("layerTest serves the members a suite stubs", () =>
        Effect.gen(function* () {
          const service = yield* ManagedSection;
          assert.isFalse(yield* service.isManaged("anywhere", id("example-tool")));
        })
      );
    });

    it.layer(ManagedSection.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("an unstubbed member dies loudly rather than answering wrongly", () =>
        Effect.gen(function* () {
          const service = yield* ManagedSection;
          const exit = yield* Effect.exit(service.read("anywhere", id("example-tool")));
          const cause = Exit.getCause(exit);
          assertExitFailure(exit, O.getOrThrow(cause));
          assert.isTrue(Cause.hasDies(exit.cause), "must be a defect, not a typed failure");
          assert.isFalse(Cause.hasFails(exit.cause), "must not be laundered into the error channel");
          const die = exit.cause.reasons.find(Cause.isDieReason);
          const defect = die?.defect;
          if (!S.is(ManagedSectionTestError)(defect)) {
            assert.fail("expected the unstubbed member's defect to be a ManagedSectionTestError");
          }
          assert.include(String(defect.message), "read");
        })
      );
    });
  });
});
