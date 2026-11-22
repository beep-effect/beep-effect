import {
  CommentApplyOptions,
  CommentLedgerRow,
  commentStripProof,
  runCommentApply,
  runCommentLedger,
} from "@beep/repo-cli/commands/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";

const decodeRow = S.decodeUnknownEffect(S.fromJsonString(CommentLedgerRow));

const runGit = Effect.fn("CommentStripTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    env: {
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
    extendEnv: true,
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const makeCheckout = Effect.fn("CommentStripTest.makeCheckout")(function* (
  files: ReadonlyArray<readonly [string, string]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "comment-strip-" });
  const write = Effect.fnUntraced(function* (file: string, text: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), text);
  });
  const read = (file: string) => fs.readFileString(path.join(root, file));
  yield* write("bun.lock", "");
  yield* write("packages/a/package.json", `{ "name": "@beep/a" }\n`);
  yield* Effect.forEach(files, ([file, text]) => write(file, text), { concurrency: 1, discard: true });
  yield* runGit(root, ["init", "--quiet", "--initial-branch=main"]);
  yield* runGit(root, ["add", "."]);
  yield* runGit(root, ["commit", "--quiet", "--no-verify", "-m", "base"]);
  const ledger = Effect.fnUntraced(function* () {
    const summary = yield* runCommentLedger(root, "packages/a");
    const text = yield* read(summary.path);
    const rows = yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) => decodeRow(line), {
      concurrency: 1,
    });
    return { summary, rows };
  });
  const vote = Effect.fnUntraced(function* (name: string, lines: ReadonlyArray<string>) {
    yield* write(`votes/${name}.tsv`, `${A.join(lines, "\n")}\n`);
    return `votes/${name}.tsv`;
  });
  const apply = (ledgerPath: string, votes: ReadonlyArray<string>) =>
    runCommentApply(CommentApplyOptions.make({ cwd: root, ledger: ledgerPath, votes }));
  return { root, write, read, ledger, vote, apply };
});

const reasonsOf = (refusals: ReadonlyArray<{ readonly reason: string }>) =>
  A.map(refusals, (refusal) => refusal.reason);

it.layer(NodeTestLayer, { timeout: "60 seconds" })((it) => {
  describe("comment strip", { concurrent: false }, () => {
    it.effect(
      "deletes a row two votes call a tautology and the proof passes",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "export const a = 1;\n// returns one\nexport const one = () => a;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        expect(summary.path).toBe(".beep/comment-law/ledger/packages-a.jsonl");
        expect(A.map(rows, (row) => [row.file, row.line, row.kind, row.text, O.isNone(row.protect)])).toEqual([
          ["packages/a/src/A.ts", 2, "prose", "returns one", true],
        ]);
        const cid = rows[0]?.cid ?? "";
        expect(cid).toMatch(/^[0-9a-f]{16}$/);
        const first = yield* checkout.vote("first", [`${cid}\tT\t`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(1);
        expect(result.filesTouched).toEqual(["packages/a/src/A.ts"]);
        expect(result.refusals).toEqual([]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("export const a = 1;\nexport const one = () => a;\n");
      })
    );

    it.effect(
      "refuses a single vote and disagreeing votes",
      Effect.fnUntraced(function* () {
        const source = "// first note\nexport const a = 1;\n// second note\nexport const b = 2;\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const [single = "", split = ""] = A.map(rows, (row) => row.cid);
        const first = yield* checkout.vote("first", [`${single}\tT`, `${split}\tT`]);
        const second = yield* checkout.vote("second", [`${split}\tH`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(0);
        expect(result.filesTouched).toEqual([]);
        expect(reasonsOf(result.refusals)).toEqual(["too-few-votes", "votes-disagree"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe(source);
      })
    );

    it.effect(
      "protects tool-read tags and the only content of a block",
      Effect.fnUntraced(function* () {
        const source =
          "/**\n * Helper.\n *\n * @since 0.0.0\n */\nconst h = 1;\nexport const x = () => {\n  try {\n    return h;\n  } catch {\n    // ignored\n  }\n};\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        expect(summary.protected).toBe(2);
        expect(A.map(rows, (row) => O.getOrElse(row.protect, () => ""))).toEqual([
          "tool-read tag @since",
          "only content of a block",
        ]);
        const lines = A.map(rows, (row) => `${row.cid}\tT`);
        const first = yield* checkout.vote("first", lines);
        const second = yield* checkout.vote("second", lines);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(0);
        expect(reasonsOf(result.refusals)).toEqual(["protected", "protected"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe(source);
      })
    );

    it.effect(
      "deletes a decision record only after its decision file is committed",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// sent exchanges run to persistence\nexport const a = 1;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const decision = "packages/a/decisions/2026-11-22-sent-exchange-persists.md";
        const first = yield* checkout.vote("first", [`${cid}\tD\t${decision}`]);
        const second = yield* checkout.vote("second", [`${cid}\tD\t${decision}`]);
        const missing = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(missing.refusals)).toEqual(["missing-decision"]);

        yield* checkout.write(decision, "# A sent exchange runs to persistence\n");
        const untracked = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(untracked.refusals)).toEqual(["missing-decision"]);

        yield* runGit(checkout.root, ["add", decision]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "decision"]);
        const applied = yield* checkout.apply(summary.path, [first, second]);
        expect(applied.deleted).toBe(1);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("export const a = 1;\n");
      })
    );

    it.effect(
      "refuses an excuse without an issue or pull request URL",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// cast until the schema lands\nexport const a = 1;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const bare = yield* checkout.vote("bare", [`${cid}\tX`]);
        const refused = yield* checkout.apply(summary.path, [bare, bare]);
        expect(reasonsOf(refused.refusals)).toEqual(["missing-ref"]);
        const linked = yield* checkout.vote("linked", [`${cid}\tX\thttps://github.com/o/r/issues/12`]);
        const applied = yield* checkout.apply(summary.path, [bare, linked]);
        expect(applied.deleted).toBe(1);
      })
    );

    it.effect(
      "removes JSX comment containers without changing the rendered text",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          [
            "packages/a/src/V.tsx",
            "export const V = () => (\n  <div>\n    a {/* inline */}<b />\n    {/* own line */}\n    <i />\n  </div>\n);\n",
          ],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        expect(A.length(rows)).toBe(2);
        const lines = A.map(rows, (row) => `${row.cid}\tG`);
        const first = yield* checkout.vote("first", lines);
        const second = yield* checkout.vote("second", lines);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(2);
        const text = yield* checkout.read("packages/a/src/V.tsx");
        expect(text).toBe("export const V = () => (\n  <div>\n    a <b />\n    <i />\n  </div>\n);\n");
      })
    );

    it.effect("fails the proof when a removed line joins JSX text", () =>
      Effect.sync(() => {
        const before = "export const P = () => (\n  <p>\n    a\n    {/* c */}\n    b\n  </p>\n);\n";
        const after = "export const P = () => (\n  <p>\n    a\n    b\n  </p>\n);\n";
        expect(commentStripProof("P.tsx", before, after)).toEqual(O.some("proof-failed"));
        expect(commentStripProof("a.ts", "export const x = 1;\n", "export const x = 2;\n")).toEqual(
          O.some("proof-failed")
        );
        expect(commentStripProof("a.ts", "export const x = 1;\n", "export const = 1;\n")).toEqual(
          O.some("parse-error")
        );
      })
    );

    it.effect(
      "refuses a row whose cid no longer matches the tree",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", "// old wording\nexport const a = 1;\n"]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        yield* checkout.write("packages/a/src/A.ts", "// new wording\nexport const a = 1;\n");
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(result.refusals)).toEqual(["stale-cid"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("// new wording\nexport const a = 1;\n");
      })
    );
  });
});
