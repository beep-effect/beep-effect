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
import { assertSome } from "@effect/vitest/utils";
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
  yield* runGit(root, ["commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", "base"]);
  const ledger = Effect.fnUntraced(function* (scope = "packages/a") {
    const summary = yield* runCommentLedger(root, scope);
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
  const commit = Effect.fnUntraced(function* (files: ReadonlyArray<string>) {
    yield* runGit(root, ["add", "-A", "--", ...files]);
    yield* runGit(root, ["commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", "edit"]);
  });
  const leftovers = Effect.fnUntraced(function* (directory: string) {
    const names = yield* fs.readDirectory(path.join(root, directory));
    return A.filter(names, Str.endsWith(".tmp"));
  });
  return { root, write, read, ledger, vote, apply, commit, leftovers };
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
        const left = yield* checkout.leftovers("packages/a/src");
        expect(left).toEqual([]);
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
        const staged = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(staged.refusals)).toEqual(["missing-decision"]);

        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", "decision"]);
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
        const alsoBare = yield* checkout.vote("also-bare", [`${cid}\tX`]);
        const refused = yield* checkout.apply(summary.path, [bare, alsoBare]);
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
        assertSome(commentStripProof("P.tsx", before, after), "proof-failed");
        assertSome(commentStripProof("a.ts", "export const x = 1;\n", "export const x = 2;\n"), "proof-failed");
        assertSome(commentStripProof("a.ts", "export const x = 1;\n", "export const = 1;\n"), "parse-error");
      })
    );

    it.effect(
      "refuses a row whose cid no longer matches the tree",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", "// old wording\nexport const a = 1;\n"]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        yield* checkout.write("packages/a/src/A.ts", "// new wording\nexport const a = 1;\n");
        yield* checkout.commit(["packages/a/src/A.ts"]);
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(result.refusals)).toEqual(["stale-cid"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("// new wording\nexport const a = 1;\n");
      })
    );

    it.effect(
      "reads ./ scopes and the whole repository like --list",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", "// note\nexport const a = 1;\n"]]);
        const dotted = yield* checkout.ledger("./packages/a/");
        expect(dotted.summary.path).toBe(".beep/comment-law/ledger/packages-a.jsonl");
        expect(dotted.summary.rows).toBe(1);
        const whole = yield* checkout.ledger(".");
        expect(whole.summary.path).toBe(".beep/comment-law/ledger/_root.jsonl");
        expect(whole.summary.rows).toBe(1);
      })
    );

    it.effect(
      "refuses a row whose identical sibling vanished after the census",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "export const f = () => {\n  // twin\n  // twin\n  return 1;\n};\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        expect(A.length(rows)).toBe(2);
        const firstCid = rows[0]?.cid ?? "";
        yield* checkout.write("packages/a/src/A.ts", "export const f = () => {\n  // twin\n  return 1;\n};\n");
        yield* checkout.commit(["packages/a/src/A.ts"]);
        const first = yield* checkout.vote("first", [`${firstCid}\tT`]);
        const second = yield* checkout.vote("second", [`${firstCid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(0);
        expect(
          A.map(
            A.filter(result.refusals, (refusal) => refusal.cid === firstCid),
            (refusal) => [refusal.reason, refusal.detail]
          )
        ).toEqual([["stale-cid", "an identical comment censused with it is gone; run --ledger again"]]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("export const f = () => {\n  // twin\n  return 1;\n};\n");
      })
    );

    it.effect("fails the proof when a removed container joins two JSX text children", () =>
      Effect.sync(() => {
        const before = "export const W = () => <Widget>a{/* note */}b</Widget>;\n";
        const after = "export const W = () => <Widget>ab</Widget>;\n";
        assertSome(commentStripProof("W.tsx", before, after), "proof-failed");
      })
    );

    it.effect(
      "refuses a file that resolves through a symlink",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = "// note\nexport const a = 1;\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const outside = yield* fs.makeTempDirectoryScoped({ prefix: "comment-strip-outside-" });
        const target = path.join(outside, "A.ts");
        yield* fs.writeFileString(target, source);
        yield* fs.remove(path.join(checkout.root, "packages/a/src/A.ts"));
        yield* fs.symlink(target, path.join(checkout.root, "packages/a/src/A.ts"));
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(result.refusals)).toEqual(["symlinked-path"]);
        const text = yield* fs.readFileString(target);
        expect(text).toBe(source);
      })
    );

    it.effect(
      "leaves a file alone when it changes while apply runs",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const source = "// note\nexport const a = 1;\n";
        const edited = "// note\nexport const a = 2;\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        let reads = 0;
        const editing: FileSystem.FileSystem = {
          ...fs,
          readFileString: (file, encoding) =>
            Effect.tap(fs.readFileString(file, encoding), () => {
              reads = Str.endsWith("/packages/a/src/A.ts")(file) ? reads + 1 : reads;
              return reads === 1 && Str.endsWith("/packages/a/src/A.ts")(file)
                ? fs.writeFileString(file, edited)
                : Effect.void;
            }),
        };
        const result = yield* checkout
          .apply(summary.path, [first, second])
          .pipe(Effect.provideService(FileSystem.FileSystem, editing));
        expect(result.deleted).toBe(0);
        expect(reasonsOf(result.refusals)).toEqual(["file-changed"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe(edited);
        const left = yield* checkout.leftovers("packages/a/src");
        expect(left).toEqual([]);
      })
    );

    it.effect(
      "counts one vote file once, even through another spelling or a hard link",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", "// note\nexport const a = 1;\n"]]);
        const { summary, rows } = yield* checkout.ledger();
        const only = yield* checkout.vote("only", [`${rows[0]?.cid ?? ""}\tT`]);
        const error = yield* Effect.flip(checkout.apply(summary.path, [only, `./votes/../${only}`]));
        expect(error.message).toContain("each vote file counts once");
        yield* fs.link(path.join(checkout.root, only), path.join(checkout.root, "votes/linked.tsv"));
        const linked = yield* Effect.flip(checkout.apply(summary.path, [only, "votes/linked.tsv"]));
        expect(linked.message).toContain("each vote file counts once");
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("// note\nexport const a = 1;\n");
      })
    );

    it.effect(
      "names the files already written when a later file fails",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// note\nexport const a = 1;\n"],
          ["packages/a/src/B.ts", "export const b = 1;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        yield* fs.remove(path.join(checkout.root, "packages/a/src/B.ts"));
        yield* fs.makeDirectory(path.join(checkout.root, "packages/a/src/B.ts"));
        const broken = `{"cid":"0000000000000000","file":"packages/a/src/B.ts","line":1,"kind":"prose","text":"x","protect":null}`;
        yield* checkout.write("broken.jsonl", `${broken}\n`);
        const ledgerText = yield* checkout.read(summary.path);
        yield* checkout.write("both.jsonl", `${ledgerText}${broken}\n`);
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const alone = yield* Effect.flip(checkout.apply("broken.jsonl", [first, second]));
        expect(alone.message).toContain("already written: none");
        const after = yield* Effect.flip(checkout.apply("both.jsonl", [first, second]));
        expect(after.message).toContain("already written: packages/a/src/A.ts");
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("export const a = 1;\n");
      })
    );

    it.effect(
      "protects directive continuations and stacked JSDoc, nothing near them",
      Effect.fnUntraced(function* () {
        const source = A.join(
          [
            "// biome-ignore lint/a: r",
            "// continues the reason",
            "export const a = 1;",
            "/* biome-ignore lint/b: r */",
            "// after a block directive",
            "export const b = 2;",
            "// biome-ignore lint/c: r",
            "/* a block after a directive */",
            "export const c = 3;",
            "// biome-ignore lint/d: r",
            "export const d = 4; // trailing note",
            "// biome-ignore lint/e: r",
            "",
            "// after a gap",
            "export const e = 5;",
            "/** first local doc */",
            "/** stacked local doc */",
            "const f = 6;",
            "// lead",
            "/** after a line */",
            "const g = 7;",
            "export const h = f + g;",
            "",
          ],
          "\n"
        );
        const checkout = yield* makeCheckout([
          ["packages/a/src/P.ts", source],
          ["packages/a/src/Q.ts", "/** top local doc */\nconst q = 1;\nexport const r = q;\n"],
        ]);
        const { rows } = yield* checkout.ledger();
        expect(A.map(rows, (row) => [row.text, O.getOrElse(row.protect, () => "")])).toEqual([
          ["continues the reason", "continues the directive above"],
          ["after a block directive", ""],
          ["a block after a directive", ""],
          ["trailing note", ""],
          ["after a gap", ""],
          ["first local doc", ""],
          ["stacked local doc", "JSDoc stacked under another JSDoc block"],
          ["lead", ""],
          ["after a line", ""],
          ["top local doc", ""],
        ]);
      })
    );

    it.effect(
      "skips missing and comment-free files and writes an empty ledger",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// note\nexport const a = 1;\n"],
          ["packages/a/src/B.ts", "export const b = 1;\n"],
          ["packages/a/src/C.ts", "// gone\nexport const c = 1;\n"],
          ["packages/a/src/D.ts", "/* only a block */\nexport const d = 1;\n"],
        ]);
        yield* fs.remove(path.join(checkout.root, "packages/a/src/C.ts"));
        const { rows } = yield* checkout.ledger();
        expect(A.map(rows, (row) => row.file)).toEqual(["packages/a/src/A.ts", "packages/a/src/D.ts"]);
        const empty = yield* checkout.ledger("packages/a/src/B.ts");
        expect(empty.summary.rows).toBe(0);
        const text = yield* checkout.read(empty.summary.path);
        expect(text).toBe("");
      })
    );

    it.effect(
      "fails on a missing ledger, one vote file and a cid voted twice",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", "// note\nexport const a = 1;\n"]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const twice = yield* checkout.vote("twice", [`${cid}\tT`, `${cid}\tS`]);
        const missing = yield* Effect.flip(checkout.apply("absent.jsonl", [first, twice]));
        expect(missing.message).toBe("absent.jsonl does not exist.");
        const single = yield* Effect.flip(checkout.apply(summary.path, [first]));
        expect(single.message).toBe("--apply needs at least two --votes files.");
        const repeated = yield* Effect.flip(checkout.apply(summary.path, [first, twice]));
        expect(repeated.message).toBe(`votes/twice.tsv:2 votes ${cid} a second time`);
      })
    );

    it.effect(
      "refuses tied votes and an agreed retained code",
      Effect.fnUntraced(function* () {
        const source = "// first note\nexport const a = 1;\n// second note\nexport const b = 2;\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const [tied = "", kept = ""] = A.map(rows, (row) => row.cid);
        const votes = yield* Effect.forEach(
          [
            ["one", [`${tied}\tT`, `${kept}\tH`]],
            ["two", [`${tied}\tT`, `${kept}\tH`]],
            ["three", [`${tied}\tH`]],
            ["four", [`${tied}\tH`]],
          ] as const,
          ([name, lines]) => checkout.vote(name, lines),
          { concurrency: 1 }
        );
        const result = yield* checkout.apply(summary.path, votes);
        expect(A.map(result.refusals, (refusal) => [refusal.reason, refusal.detail])).toEqual([
          ["votes-disagree", "T and H tie"],
          ["retained-code", "agreed H"],
        ]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe(source);
      })
    );

    it.effect(
      "reads package-relative and repository-root decision refs",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// relative why\nexport const a = 1;\n// bad ref why\nexport const b = 2;\n"],
          ["packages/a/decisions/2026-11-22-relative.md", "# Relative\n"],
          ["tool.ts", "// root why\nexport const t = 1;\n"],
          ["decisions/2026-11-22-root.md", "# Root\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger(".");
        expect(A.map(rows, (row) => row.file)).toEqual(["packages/a/src/A.ts", "packages/a/src/A.ts", "tool.ts"]);
        const [relative = "", bad = "", root = ""] = A.map(rows, (row) => row.cid);
        const lines = [
          `${relative}\tD\tdecisions/2026-11-22-relative.md`,
          `${bad}\tD\tnotes.md`,
          `${root}\tD\tdecisions/2026-11-22-root.md`,
        ];
        const first = yield* checkout.vote("first", lines);
        const second = yield* checkout.vote("second", lines);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.deleted).toBe(2);
        expect(reasonsOf(result.refusals)).toEqual(["missing-decision"]);
        const text = yield* checkout.read("tool.ts");
        expect(text).toBe("export const t = 1;\n");
      })
    );

    it.effect(
      "refuses a deletion that leaves an identical sibling behind",
      Effect.fnUntraced(function* () {
        const source = "export const f = () => {\n  // twin\n  // twin\n  return 1;\n};\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(result.refusals)).toEqual(["too-few-votes", "ordinal-sibling"]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe(source);
      })
    );

    it.effect(
      "keeps tokens apart, removes a trailing comment and merges one container's comments",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          [
            "packages/a/src/A.ts",
            "export const xs = [1,/* a */2];\nexport const f = (a: number,/* b */ c: number) => a + c;\n// tail",
          ],
          ["packages/a/src/V.tsx", "export const V = () => <div>{/* a */ /* b */}</div>;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        const lines = A.map(rows, (row) => `${row.cid}\tG`);
        const first = yield* checkout.vote("first", lines);
        const second = yield* checkout.vote("second", lines);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(result.refusals).toEqual([]);
        const text = yield* checkout.read("packages/a/src/A.ts");
        expect(text).toBe("export const xs = [1, 2];\nexport const f = (a: number, c: number) => a + c;\n");
        const view = yield* checkout.read("packages/a/src/V.tsx");
        expect(view).toBe("export const V = () => <div></div>;\n");
      })
    );

    it.effect(
      "refuses a gone file, a file that no longer parses and a strip the proof rejects",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const checkout = yield* makeCheckout([
          ["packages/a/src/E.ts", "// broken soon\nexport const e = 1;\n"],
          ["packages/a/src/G.ts", "// gone soon\nexport const g = 1;\n"],
          ["packages/a/src/J.tsx", "export const J = () => <Widget>a{/* note */}b</Widget>;\n"],
        ]);
        const { summary, rows } = yield* checkout.ledger();
        yield* checkout.write("packages/a/src/E.ts", "// broken soon\nexport const = 1;\n");
        yield* fs.remove(path.join(checkout.root, "packages/a/src/G.ts"));
        yield* checkout.commit(["packages/a/src/E.ts"]);
        const lines = A.map(rows, (row) => `${row.cid}\tG`);
        const first = yield* checkout.vote("first", lines);
        const second = yield* checkout.vote("second", lines);
        const result = yield* checkout.apply(summary.path, [first, second]);
        expect(A.map(result.refusals, (refusal) => [refusal.file, refusal.reason])).toEqual([
          ["packages/a/src/E.ts", "parse-error"],
          ["packages/a/src/G.ts", "stale-cid"],
          ["packages/a/src/J.tsx", "proof-failed"],
        ]);
        const view = yield* checkout.read("packages/a/src/J.tsx");
        expect(view).toBe("export const J = () => <Widget>a{/* note */}b</Widget>;\n");
      })
    );

    it.effect("tells regular expression literals apart", () =>
      Effect.sync(() => {
        assertSome(commentStripProof("r.ts", "export const r = /a/;\n", "export const r = /b/;\n"), "proof-failed");
      })
    );

    it.effect(
      "rejects ledger paths that leave the checkout and refuses files the law does not cover",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout([
          ["packages/a/src/A.ts", "// note\nexport const a = 1;\n"],
          ["goals/x/probe.ts", "// note\nexport const p = 1;\n"],
        ]);
        const { rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const rowFor = (file: string) =>
          `{"cid":"${cid}","file":"${file}","line":1,"kind":"prose","text":"note","protect":null}\n`;
        for (const file of [
          "../other/src/A.ts",
          "/etc/A.ts",
          "packages\\\\a\\\\src\\\\A.ts",
          "packages//a/A.ts",
          "./A.ts",
        ]) {
          yield* checkout.write("escape.jsonl", rowFor(file));
          const error = yield* Effect.flip(checkout.apply("escape.jsonl", [first, second]));
          expect(error.message).toContain("escape.jsonl:1 is not a ledger row");
        }
        yield* checkout.write("uncovered.jsonl", rowFor("goals/x/probe.ts"));
        const result = yield* checkout.apply("uncovered.jsonl", [first, second]);
        expect(reasonsOf(result.refusals)).toEqual(["uncovered-path"]);
        const text = yield* checkout.read("goals/x/probe.ts");
        expect(text).toBe("// note\nexport const p = 1;\n");
      })
    );

    it.effect(
      "refuses a target whose working copy differs from HEAD and keeps its mode on a write",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const source = "// note\nexport const a = 1;\n";
        const checkout = yield* makeCheckout([["packages/a/src/A.ts", source]]);
        const { summary, rows } = yield* checkout.ledger();
        const cid = rows[0]?.cid ?? "";
        const first = yield* checkout.vote("first", [`${cid}\tT`]);
        const second = yield* checkout.vote("second", [`${cid}\tT`]);
        const dirty = `${source}export const b = 2;\n`;
        yield* checkout.write("packages/a/src/A.ts", dirty);
        const refused = yield* checkout.apply(summary.path, [first, second]);
        expect(reasonsOf(refused.refusals)).toEqual(["target-dirty"]);
        const kept = yield* checkout.read("packages/a/src/A.ts");
        expect(kept).toBe(dirty);
        yield* checkout.write("packages/a/src/A.ts", source);
        yield* fs.chmod(path.join(checkout.root, "packages/a/src/A.ts"), 0o755);
        const applied = yield* checkout.apply(summary.path, [first, second]);
        expect(applied.deleted).toBe(1);
        const info = yield* fs.stat(path.join(checkout.root, "packages/a/src/A.ts"));
        expect(info.mode % 0o1000).toBe(0o755);
      })
    );
  });
});
