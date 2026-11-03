import { CommentStyle } from "@beep/managed-section/CommentStyle";
import {
  ManagedSection,
  ManagedSectionOptions,
  ManagedSectionTestError,
  SectionFileError,
} from "@beep/managed-section/ManagedSection";
import { SectionId } from "@beep/managed-section/Section";
import { SectionDialect } from "@beep/managed-section/SectionDialect";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
const section = id.section("echo hi");

describe("ManagedSection uncovered contracts", () => {
  it.effect("file errors describe the failed read or write and path", () =>
    Effect.sync(() => {
      for (const operation of ["read", "write"] as const) {
        const error = SectionFileError.make({ path: "file", operation, cause: "denied" });
        assert.strictEqual(error.message, `Failed to ${operation} managed sections in "file"`);
      }
    })
  );
  it.effect("every unstubbed member fails with a member-specific defect", () =>
    Effect.gen(function* () {
      const service = ManagedSection.makeTest();
      const calls = [
        ["read", service.read("file", id).pipe(Effect.asVoid)],
        ["readAll", service.readAll("file").pipe(Effect.asVoid)],
        ["isManaged", service.isManaged("file", id).pipe(Effect.asVoid)],
        ["sync", service.sync("file", section).pipe(Effect.asVoid)],
        ["syncAll", service.syncAll("file", [section]).pipe(Effect.asVoid)],
        ["check", service.check("file", section).pipe(Effect.asVoid)],
        ["checkAll", service.checkAll("file", [section]).pipe(Effect.asVoid)],
        ["remove", service.remove("file", id).pipe(Effect.asVoid)],
      ] as const;
      for (const [member, call] of calls) {
        const exit1 = yield* Effect.exit(call);
        assertExitFailure(
          exit1,
          Cause.die(
            ManagedSectionTestError.make({
              message: `ManagedSection.makeTest: ${member}() was called but not stubbed — pass a \`${member}\` override.`,
            })
          )
        );
      }
    })
  );

  const fs = MemoryFileSystem.makeSync({ file: "user text\n" });
  const dialect = SectionDialect.make({ phrase: "OWNED", styles: [CommentStyle.hash] });
  it.layer(ManagedSection.layerWith(ManagedSectionOptions.make({ dialect })).pipe(Layer.provide(fs.layer)), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("layerWith writes and reads its supplied marker vocabulary", () =>
      Effect.gen(function* () {
        const service = yield* ManagedSection;
        assert.strictEqual((yield* service.sync("file", section))._tag, "Created");
        assert.strictEqual(
          fs.volume.text("file"),
          "user text\n\n# --- BEGIN tool OWNED ---\necho hi\n# --- END tool OWNED ---\n"
        );
        const readAll2 = yield* service.readAll("file");
        assert.deepStrictEqual(readAll2, [section]);
        const checkAll3 = yield* service.checkAll("file", [section]);
        assert.deepStrictEqual(
          A.map(checkAll3, (outcome) => outcome._tag),
          ["UpToDate"]
        );
      })
    );
  });
});
