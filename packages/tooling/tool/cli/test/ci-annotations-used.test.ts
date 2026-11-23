import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  addAnnotationsUsed,
  annotationsUsedTotal,
  CI_ANNOTATIONS_USED_PATH,
  CiAnnotationsUsed,
  emptyWorkflowCommandTally,
  finishWorkflowCommandScan,
  GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP,
  readAnnotationsUsed,
  resolveAnnotationsUsed,
  scanWorkflowCommands,
  shownAnnotationsOf,
  WorkflowCommandScan,
  WorkflowCommandTally,
  workflowCommandLevelOf,
} from "@beep/repo-cli/commands/Ci";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";

const tally = (errors: number, warnings: number, notices: number) =>
  WorkflowCommandTally.make({ errors, warnings, notices });

const scanAll = (chunks: ReadonlyArray<string>) =>
  finishWorkflowCommandScan(
    A.reduce(chunks, WorkflowCommandScan.make({ carry: "", tally: emptyWorkflowCommandTally }), scanWorkflowCommands)
  );

describe("workflow command levels", () => {
  it("reads the three annotation commands, with properties, leading whitespace or any case", () => {
    assertSome(workflowCommandLevelOf("::error file=src/a.ts,line=3::boom"), "error");
    assertSome(workflowCommandLevelOf("  ::warning::careful"), "warning");
    assertSome(workflowCommandLevelOf("::NOTICE title=x::done"), "notice");
  });

  it("ignores other commands, unclosed commands and plain lines", () => {
    assertNone(workflowCommandLevelOf("::group::tests"));
    assertNone(workflowCommandLevelOf("::error file=a.ts"));
    assertNone(workflowCommandLevelOf("error::not a command"));
    assertNone(workflowCommandLevelOf(""));
  });
});

describe("workflow command scan", () => {
  it("counts commands across chunk boundaries and the unfinished last line", () => {
    deepStrictEqual(scanAll(["::err", "or::a\n::warn", "ing::b\nplain\n", "::notice::c"]), tally(1, 1, 1));
  });

  it("counts every line of one chunk and carries the part after the last newline", () => {
    const scan = scanWorkflowCommands("::error::a\r\n::error::b\n::notice")(
      WorkflowCommandScan.make({ carry: "", tally: emptyWorkflowCommandTally })
    );
    deepStrictEqual(scan.tally, tally(2, 0, 0));
    strictEqual(scan.carry, "::notice");
    deepStrictEqual(finishWorkflowCommandScan(scan), tally(2, 0, 0));
  });

  it("caps each level at GitHub's per-step limit and totals a record", () => {
    strictEqual(GITHUB_ANNOTATIONS_PER_LEVEL_PER_STEP, 10);
    deepStrictEqual(shownAnnotationsOf(tally(200, 3, 11)), tally(10, 3, 10));
    strictEqual(
      annotationsUsedTotal(
        CiAnnotationsUsed.make({ schemaVersion: "ci-annotations-used/v1", errors: 10, warnings: 3, notices: 10 })
      ),
      23
    );
  });
});

it.layer(Layer.merge(MemoryFileSystem.layer, Path.layer), { timeout: "30 seconds" })(
  "the job's annotation record",
  (it) => {
    it.effect("a checkout with no record has spent none, and each step adds to the record", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = "/home/alice/beep-effect-count";
        yield* fs.makeDirectory(root, { recursive: true });
        const empty = yield* readAnnotationsUsed(root);
        strictEqual(annotationsUsedTotal(empty), 0);
        yield* addAnnotationsUsed(root, tally(10, 2, 0));
        const after = yield* addAnnotationsUsed(root, tally(3, 0, 1));
        deepStrictEqual([after.errors, after.warnings, after.notices], [13, 2, 1]);
        const read = yield* readAnnotationsUsed(root);
        strictEqual(annotationsUsedTotal(read), 16);
      })
    );

    it.effect("a record that does not decode fails the read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/home/alice/beep-effect-bad";
        yield* fs.makeDirectory(path.join(root, ".beep", "ci"), { recursive: true });
        yield* fs.writeFileString(path.join(root, CI_ANNOTATIONS_USED_PATH), '{"errors":-1}');
        const error = yield* Effect.flip(readAnnotationsUsed(root));
        strictEqual(error.message, ".beep/ci/annotations-used.json is not a ci-annotations-used/v1 record.");
      })
    );

    it.effect("append-gate-reports takes a given count, else the count the lane steps kept", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = "/home/alice/beep-effect-resolve";
        yield* fs.makeDirectory(root, { recursive: true });
        const none = yield* resolveAnnotationsUsed(root, O.none());
        yield* addAnnotationsUsed(root, tally(10, 10, 1));
        const kept = yield* resolveAnnotationsUsed(root, O.none());
        const given = yield* resolveAnnotationsUsed(O.some(4))(root);
        deepStrictEqual([none, kept, given], [0, 21, 4]);
      })
    );
  }
);
