import { Git, NoteEntry, UnknownRefError } from "@beep/git/Git";
import {
  decodeHistoryCommitMessageMap,
  HistoryCommitMessage,
  HistoryGitError,
  HistoryMapError,
  HistoryNotes,
  HistoryNotesCheckOptions,
  HistoryNotesLive,
  historyNoteBody,
  historyNotesCheckProblems,
  renderHistoryNotesCheck,
} from "@beep/repo-cli/commands/History";
import { assert, describe, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GitStubs } from "@beep/git/Git";

const sha = (digit: string): string => Str.repeat(40)(digit);
const SHA_A = sha("a");
const SHA_B = sha("b");
const SHA_C = sha("c");
const SHA_D = sha("d");

const encodeMap = S.encodeEffect(S.fromJsonString(S.Record(S.String, S.String)));

/** A fake blob id: deterministic per content, so a test can publish matching or drifting notes. */
const fakeBlob = (content: string): string => `blob:${content}`;

const options = (overrides: Partial<{ readonly requirePublished: boolean }> = {}) =>
  HistoryNotesCheckOptions.make({
    root: "/repo",
    mapPath: "docs/history/commit-message-map.json",
    ref: "refs/notes/history",
    base: "origin/main",
    requirePublished: overrides.requirePublished ?? false,
  });

/** The live service over a map file that holds `mapText` and a Git double built from `stubs`. */
const historyLayer = (mapText: string, stubs: Partial<GitStubs>) =>
  HistoryNotesLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        FileSystem.layerNoop({
          readFileString: (file) =>
            file === "/repo/docs/history/commit-message-map.json"
              ? Effect.succeed(mapText)
              : Effect.fail(
                  PlatformError.systemError({
                    _tag: "NotFound",
                    module: "HistoryNotesTest",
                    method: "readFileString",
                    pathOrDescriptor: file,
                  })
                ),
        }),
        Path.layer,
        Git.layerTest(stubs)
      )
    )
  );

const runCheck = Effect.fnUntraced(function* (
  rows: Readonly<Record<string, string>>,
  stubs: Partial<GitStubs>,
  requirePublished = false
) {
  const mapText = yield* encodeMap(rows);
  const check = HistoryNotes.use((history) => history.check(options({ requirePublished })));
  return yield* Layer.build(historyLayer(mapText, stubs)).pipe(
    Effect.flatMap((context) => Effect.provideContext(check, context))
  );
});

const unpublished: Partial<GitStubs> = {
  revList: () => Effect.succeed([SHA_A, SHA_B, SHA_C, SHA_D]),
  refExists: () => Effect.succeed(false),
};

describe("HistoryCommitMessage", () => {
  const isMessage = S.is(HistoryCommitMessage);

  it("accepts a subject alone, with a trailing newline, or followed by a blank line and a body", () => {
    assert.isTrue(isMessage("chore(repo): checkpoint work"));
    assert.isTrue(isMessage("chore(repo): checkpoint work\n"));
    assert.isTrue(isMessage("chore(repo): checkpoint work\n\nFirst paragraph.\n\nSecond paragraph.\n"));
    assert.isTrue(isMessage(`feat: ${Str.repeat(66)("x")}`));
  });

  it("rejects an empty subject, a long subject, a missing blank line and stripspace-unstable text", () => {
    assert.isFalse(isMessage(""));
    assert.isFalse(isMessage("   \n\nbody"));
    assert.isFalse(isMessage(`feat: ${Str.repeat(67)("x")}`));
    assert.isFalse(isMessage("feat: subject\nbody without a blank line"));
    assert.isFalse(isMessage("feat: subject \n\nbody"));
    assert.isFalse(isMessage("feat: subject\n\n\nbody"));
  });
});

describe("decodeHistoryCommitMessageMap", () => {
  it.effect("decodes full-SHA keys and rejects abbreviated ones and bad messages", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeHistoryCommitMessageMap(`{"${SHA_A}":"chore: one\\n"}`);
      assert.deepStrictEqual(decoded, { [SHA_A]: "chore: one\n" });
      const shortKey = yield* Effect.flip(decodeHistoryCommitMessageMap(`{"aaaaaaa":"chore: one"}`));
      assertInstanceOf(shortKey, S.SchemaError);
      const badMessage = yield* Effect.flip(decodeHistoryCommitMessageMap(`{"${SHA_A}":"chore: one\\nno blank"}`));
      assertInstanceOf(badMessage, S.SchemaError);
    })
  );
});

describe("historyNoteBody", () => {
  it("ends the message with exactly one newline", () => {
    assert.strictEqual(historyNoteBody("chore: one"), "chore: one\n");
    assert.strictEqual(historyNoteBody("chore: one\n"), "chore: one\n");
    assert.strictEqual(historyNoteBody("chore: one\n\nBody.\n"), "chore: one\n\nBody.\n");
  });
});

describe("HistoryNotes.check", () => {
  it.effect("an absent notes ref passes with a notice and lists no notes", () =>
    Effect.gen(function* () {
      const report = yield* runCheck({ [SHA_B]: "chore: two\n", [SHA_A]: "chore: one\n" }, unpublished);
      assert.strictEqual(report.rows, 2);
      assert.isFalse(report.published);
      assert.deepStrictEqual(historyNotesCheckProblems(report), []);
      assert.deepStrictEqual(renderHistoryNotesCheck(report), [
        "history notes check: docs/history/commit-message-map.json",
        "  map rows: 2 decoded, 2 reachable from origin/main, 0 unreachable",
        "  refs/notes/history: not yet published in this clone; nothing to compare (pass --require-published to fail on this)",
        "result: ok",
      ]);
    })
  );

  it.effect("an absent notes ref fails under requirePublished", () =>
    Effect.gen(function* () {
      const report = yield* runCheck({ [SHA_A]: "chore: one\n" }, unpublished, true);
      assert.deepStrictEqual(historyNotesCheckProblems(report), ["refs/notes/history is not published"]);
    })
  );

  it.effect("a key that is not reachable from the base fails, listed in sorted order", () =>
    Effect.gen(function* () {
      const report = yield* runCheck(
        { [SHA_D]: "chore: four\n", [SHA_A]: "chore: one\n", [SHA_C]: "chore: three\n" },
        { ...unpublished, revList: () => Effect.succeed([SHA_A]) }
      );
      assert.deepStrictEqual(report.unreachable, [SHA_C, SHA_D]);
      assert.deepStrictEqual(historyNotesCheckProblems(report), ["2 map keys are not reachable from origin/main"]);
    })
  );

  it.effect("a published ref reports matching, missing, extra and differing notes", () =>
    Effect.gen(function* () {
      const hashed: Array<string> = [];
      const report = yield* runCheck(
        { [SHA_A]: "chore: one\n", [SHA_B]: "chore: two", [SHA_C]: "chore: three\n" },
        {
          revList: () => Effect.succeed([SHA_A, SHA_B, SHA_C, SHA_D]),
          refExists: () => Effect.succeed(true),
          notesList: () =>
            Effect.succeed([
              NoteEntry.make({ note: fakeBlob("chore: two\n"), object: SHA_B }),
              NoteEntry.make({ note: fakeBlob("chore: stale\n"), object: SHA_A }),
              NoteEntry.make({ note: fakeBlob("chore: orphan\n"), object: SHA_D }),
            ]),
          hashObject: (_cwd, content) => {
            hashed.push(content);
            return Effect.succeed(fakeBlob(content));
          },
        }
      );
      assert.isTrue(report.published);
      assert.strictEqual(report.notes, 3);
      assert.strictEqual(report.matching, 1);
      assert.deepStrictEqual(report.missing, [SHA_C]);
      assert.deepStrictEqual(report.extra, [SHA_D]);
      assert.deepStrictEqual(report.differing, [SHA_A]);
      // Only rows that carry a note are hashed, and each as its canonical body.
      assert.deepStrictEqual(A.sort(hashed, Order.String), ["chore: one\n", "chore: two\n"]);
      assert.deepStrictEqual(historyNotesCheckProblems(report), [
        "1 map rows have no note",
        "1 notes have no map row",
        "1 notes differ from their canonical body",
      ]);
      assert.deepStrictEqual(A.drop(renderHistoryNotesCheck(report), 2), [
        "  refs/notes/history: 3 notes; 1 match, 1 missing, 1 extra, 1 differ",
        `  missing: ${SHA_C}`,
        `  extra: ${SHA_D}`,
        `  differs: ${SHA_A}`,
        "result: failed (1 map rows have no note; 1 notes have no map row; 1 notes differ from their canonical body)",
      ]);
    })
  );

  it.effect("a fully matching published ref passes", () =>
    Effect.gen(function* () {
      const report = yield* runCheck(
        { [SHA_A]: "chore: one\n" },
        {
          revList: () => Effect.succeed([SHA_A]),
          refExists: () => Effect.succeed(true),
          notesList: () => Effect.succeed([NoteEntry.make({ note: fakeBlob("chore: one\n"), object: SHA_A })]),
          hashObject: (_cwd, content) => Effect.succeed(fakeBlob(content)),
        },
        true
      );
      assert.strictEqual(report.matching, 1);
      assert.deepStrictEqual(historyNotesCheckProblems(report), []);
    })
  );

  it.effect("an undecodable map fails as HistoryMapError before any git read", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(runCheck({ abc: "chore: one" }, {}));
      assertInstanceOf(failure, HistoryMapError);
      assert.strictEqual(failure.path, "docs/history/commit-message-map.json");
    })
  );

  it.effect("an unresolvable base fails as HistoryGitError", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        runCheck(
          { [SHA_A]: "chore: one\n" },
          { revList: (cwd, ref) => Effect.fail(UnknownRefError.make({ cwd, ref })) }
        )
      );
      assertInstanceOf(failure, HistoryGitError);
      assert.strictEqual(failure.operation, "rev-list");
    })
  );
});

describe("renderHistoryNotesCheck", () => {
  it.effect("lists at most twenty SHAs per category and counts the rest", () =>
    Effect.gen(function* () {
      const rows = A.map(A.range(0, 24), (index) => [Str.padStart(40, "0")(`${index}`), "chore: row\n"] as const);
      const report = yield* runCheck(R.fromEntries(rows), { ...unpublished, revList: () => Effect.succeed([]) });
      const lines = renderHistoryNotesCheck(report);
      assert.strictEqual(A.filter(lines, Str.startsWith("  unreachable: 0")).length, 20);
      assert.include(lines, "  unreachable: ... and 5 more");
    })
  );
});
