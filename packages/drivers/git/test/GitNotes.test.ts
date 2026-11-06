import { Git, GitCommandError, NotARepositoryError, NoteEntry, UnknownRefError } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { parseNotesList, parseObjectId } from "@beep/git/internal/parsers";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { scripted } from "./fixtures.ts";
import type { ScriptResult } from "./fixtures.ts";

const cwd = "/repo";
const noteBlob = Str.repeat(40)("a");
const commitA = Str.repeat(40)("b");
const commitB = Str.repeat(40)("c");

const isSshProbe = (args: ReadonlyArray<string>): boolean =>
  args[0] === "config" && args[1] === "--get" && (args[2] === "core.sshCommand" || args[2] === "ssh.variant");

/** Runs `program` against `Git.layer` over a scripted spawner that records every non-probe argv. */
const run = <A, E>(
  program: Effect.Effect<A, E, Git>,
  byArgs: (args: ReadonlyArray<string>) => ScriptResult,
  seen: Array<ReadonlyArray<string>> = []
) =>
  Effect.scopedWith((scope) =>
    Effect.flatMap(
      Layer.buildWithScope(
        Git.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              scripted((args) => {
                if (isSshProbe(args)) return { exit: 1 };
                seen.push(args);
                return byArgs(args);
              }),
              ConfigProvider.layer(ConfigProvider.fromEnvRecord({}))
            )
          )
        ),
        scope
      ),
      (context) => Effect.provideContext(program, context)
    )
  );

const decodeStdin = Effect.fnUntraced(function* (invocation: ReturnType<typeof GitCommand.hashObject>) {
  const stdin = invocation.command.options.stdin;
  if (stdin === undefined || typeof stdin === "string" || "stream" in stdin) return O.none<string>();
  const chunks = yield* Stream.runCollect(stdin);
  return O.some(
    A.join(
      A.map(chunks, (chunk) => new TextDecoder().decode(chunk)),
      ""
    )
  );
});

describe("GitCommand notes constructors", () => {
  it("notesList keeps the ref inside one --ref= token", () => {
    assert.deepStrictEqual(GitCommand.notesList("refs/notes/history").redactedArgs, [
      "notes",
      "--ref=refs/notes/history",
      "list",
    ]);
  });

  it.effect("hashObject feeds the content on stdin and never writes the object", () =>
    Effect.gen(function* () {
      const invocation = GitCommand.hashObject("feat: subject\n");
      assert.deepStrictEqual(invocation.redactedArgs, ["hash-object", "--no-filters", "--stdin"]);
      assert.isFalse(A.contains(invocation.redactedArgs, "-w"));
      const stdin = yield* decodeStdin(invocation);
      assert.deepStrictEqual(stdin, O.some("feat: subject\n"));
    })
  );
});

describe("notes parsers", () => {
  it("parseNotesList reads note/object pairs and treats empty output as no notes", () => {
    assertSuccess(parseNotesList(`${noteBlob} ${commitA}\n${noteBlob} ${commitB}\n`), [
      NoteEntry.make({ note: noteBlob, object: commitA }),
      NoteEntry.make({ note: noteBlob, object: commitB }),
    ]);
    assertSuccess(parseNotesList(""), []);
  });

  it("parseNotesList fails closed on a malformed line", () => {
    const rejects = (line: string) =>
      assertFailure(parseNotesList(`${line}\n`), `expected "<note> <object>" object ids, received "${line}"`);
    rejects(noteBlob);
    rejects(`${noteBlob} HEAD`);
    rejects("one two three");
  });

  it("parseObjectId trims one id and rejects anything else", () => {
    assertSuccess(parseObjectId(`${commitA}\n`), commitA);
    assertSuccess(parseObjectId(`${Str.repeat(64)("d")}\n`), Str.repeat(64)("d"));
    assertFailure(parseObjectId("ABC\n"), 'expected one object id, received "ABC\\n"');
  });
});

describe("Git.notesList", () => {
  it.effect("spawns `notes --ref=<ref> list` and answers the parsed entries", () =>
    Effect.gen(function* () {
      const seen: Array<ReadonlyArray<string>> = [];
      const entries = yield* run(
        Effect.flatMap(Git, (git) => git.notesList(cwd, "refs/notes/history")),
        () => ({ stdout: `${noteBlob} ${commitA}\n` }),
        seen
      );
      assert.deepStrictEqual(entries, [NoteEntry.make({ note: noteBlob, object: commitA })]);
      assert.deepStrictEqual(seen, [["notes", "--ref=refs/notes/history", "list"]]);
    })
  );

  it.effect("a missing notes ref (empty output, exit 0) answers an empty list", () =>
    Effect.gen(function* () {
      const entries = yield* run(
        Effect.flatMap(Git, (git) => git.notesList(cwd, "refs/notes/history")),
        () => ({ exit: 0 })
      );
      assert.deepStrictEqual(entries, []);
    })
  );

  it.effect("unparseable output fails closed as GitCommandError", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        run(
          Effect.flatMap(Git, (git) => git.notesList(cwd, "refs/notes/history")),
          () => ({ stdout: "not a listing\n" })
        )
      );
      assert.instanceOf(failure, GitCommandError);
    })
  );

  it.effect("repository and ref failures keep their typed errors", () =>
    Effect.gen(function* () {
      const notRepo = yield* Effect.flip(
        run(
          Effect.flatMap(Git, (git) => git.notesList(cwd, "refs/notes/history")),
          () => ({ stderr: "fatal: not a git repository", exit: 128 })
        )
      );
      assert.instanceOf(notRepo, NotARepositoryError);
      const unknown = yield* Effect.flip(
        run(
          Effect.flatMap(Git, (git) => git.notesList(cwd, "refs/notes/history")),
          () => ({ stderr: "fatal: unknown revision", exit: 128 })
        )
      );
      assert.instanceOf(unknown, UnknownRefError);
    })
  );

  it.effect("an option-like ref is refused before spawning", () =>
    Effect.gen(function* () {
      const seen: Array<ReadonlyArray<string>> = [];
      const failure = yield* Effect.flip(
        run(
          Effect.flatMap(Git, (git) => git.notesList(cwd, "--all")),
          () => ({ exit: 0 }),
          seen
        )
      );
      assert.instanceOf(failure, GitCommandError);
      assert.strictEqual(failure.kind, "refused");
      assert.deepStrictEqual(seen, []);
    })
  );
});

describe("Git.hashObject", () => {
  it.effect("answers the trimmed blob id", () =>
    Effect.gen(function* () {
      const seen: Array<ReadonlyArray<string>> = [];
      const id = yield* run(
        Effect.flatMap(Git, (git) => git.hashObject(cwd, "body\n")),
        () => ({ stdout: `${commitA}\n` }),
        seen
      );
      assert.strictEqual(id, commitA);
      assert.deepStrictEqual(seen, [["hash-object", "--no-filters", "--stdin"]]);
    })
  );

  it.effect("output that is not one object id fails closed", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        run(
          Effect.flatMap(Git, (git) => git.hashObject(cwd, "body\n")),
          () => ({ stdout: "garbage\n" })
        )
      );
      assert.instanceOf(failure, GitCommandError);
      assert.strictEqual(failure.kind, "failed");
    })
  );

  it.effect("an unknown-ref classification is a named defect, never a typed error", () =>
    Effect.gen(function* () {
      const cause = yield* run(
        Effect.flatMap(Git, (git) => git.hashObject(cwd, "body\n")),
        () => ({ stderr: "fatal: unknown revision", exit: 128 })
      ).pipe(Effect.sandbox, Effect.flip);
      assertSuccess(
        Cause.findDie(cause).pipe(Result.map((reason) => reason.defect)),
        'Git.hashObject: unexpected classification "unknownRef"'
      );
    })
  );
});
