import {
  CommentFileChange,
  CommentLawExecutionError,
  CommentLawOptions,
  CommentLawPending,
  CommentLockInput,
  commentDelta,
  evaluateCommentLock,
  isCommentLawPath,
  runCommentLaw,
  runCommentLawWrite,
  scanCommentSource,
} from "@beep/repo-cli/commands/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { NodeTestLayer } from "./support/CommandTest.ts";

const kindsOf = (file: string, text: string) => A.map(scanCommentSource(file, text), (comment) => comment.kind);
const change = (file: string, before: O.Option<string>, after: O.Option<string>) =>
  CommentFileChange.make({ file, before, after });
const shard = (root: string, scopes: readonly [string, ...Array<string>]) =>
  CommentLawPending.make({ schemaVersion: "comment-law-pending/v1", package: `@beep/${root}`, root, scopes });

const runGit = Effect.fn("CommentLawTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
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

const makeCheckout = Effect.fn("CommentLawTest.makeCheckout")(function* (enforcement: "advisory" | "blocking") {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "comment-law-" });
  const write = Effect.fnUntraced(function* (file: string, text: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), text);
  });
  yield* write("bun.lock", "");
  yield* write("packages/a/package.json", `{ "name": "@beep/a" }\n`);
  yield* write("packages/a/src/A.ts", "// keeps the reason\nexport const a = 1;\n");
  yield* write("packages/a/src/B.ts", "export const b = 2;\n");
  yield* write(
    "standards/comment-law/policy.jsonc",
    `{ "schemaVersion": "comment-law-policy/v1", "enforcement": "${enforcement}" }\n`
  );
  yield* write(
    "standards/comment-law/pending/beep-a.jsonc",
    `{ "schemaVersion": "comment-law-pending/v1", "package": "@beep/a", "root": "packages/a", "scopes": ["."] }\n`
  );
  yield* runGit(root, ["init", "--quiet", "--initial-branch=main"]);
  yield* runGit(root, ["add", "."]);
  yield* runGit(root, ["commit", "--quiet", "--no-verify", "-m", "base"]);
  return { root, write };
});

it.layer(NodeTestLayer, { timeout: "60 seconds" })((it) => {
  describe("comment law", { concurrent: false }, () => {
    it.effect("covers source under the enforced zones only", () =>
      Effect.sync(() => {
        for (const file of [
          "packages/x/src/A.ts",
          "apps/web/src/b.tsx",
          "infra/c.mts",
          "vitest.config.ts",
          ".claude/hooks/a.ts",
        ])
          expect(isCommentLawPath(file), file).toBe(true);
        for (const file of [
          "goals/x/ops/a.ts",
          "packages/x/src/generated/A.ts",
          "packages/x/test/fixtures/a.ts",
          "packages/x/src/A.d.ts",
          "packages/x/src/a.gen.ts",
          "packages/x/README.md",
          "scratchpad/a.ts",
        ])
          expect(isCommentLawPath(file), file).toBe(false);
      })
    );

    it.effect("classifies directives by exact tokens and prose that only looks like one", () =>
      Effect.sync(() => {
        expect(kindsOf("a.ts", "// Region-confined replacement\nexport const x = 1;\n")).toEqual(["prose"]);
        expect(kindsOf("a.ts", "// @ts-expect-error string is not a number\nexport const x: number = 'a';\n")).toEqual([
          "directive",
        ]);
        expect(kindsOf("a.ts", "// @ts-ignore\nexport const x = 1;\n")).toEqual(["bad-suppression"]);
        expect(kindsOf("a.ts", "/* oxlint-disable */\nexport const x = 1;\n")).toEqual(["law-disable"]);
        expect(kindsOf("a.ts", "/* eslint-disable beep/no-comments */\nexport const x = 1;\n")).toEqual([
          "law-disable",
        ]);
        expect(kindsOf("a.ts", "// eslint-disable-next-line no-console\nexport const x = 1;\n")).toEqual([
          "bad-suppression",
        ]);
        expect(
          kindsOf("a.ts", "// oxlint-disable-next-line beep/no-comments -- because\nexport const x = 1;\n")
        ).toEqual(["law-disable"]);
        expect(
          kindsOf("a.ts", "// oxlint-disable-next-line no-console -- fixture output\nexport const x = 1;\n")
        ).toEqual(["directive"]);
        expect(kindsOf("a.ts", '/// <reference lib="dom" />\nexport const x = 1;\n')).toEqual(["directive"]);
        expect(kindsOf("a.ts", 'export const k = "abc"; // gitleaks:allow\n')).toEqual(["directive"]);
        expect(kindsOf("a.ts", "// see gitleaks:allow for why\nexport const k = 1;\n")).toEqual(["prose"]);
        expect(kindsOf("a.ts", "// SPDX-License-Identifier: MIT\n\nexport const x = 1;\n")).toEqual(["license"]);
        expect(kindsOf("a.ts", "// Ported from effect-smol\nexport const x = 1;\n")).toEqual(["provenance"]);
        expect(kindsOf("a.ts", "// beep: upstream reads the env here\nexport const x = 1;\n")).toEqual(["port-marker"]);
        expect(kindsOf("a.ts", "// decision: git-option-like-arguments\nexport const x = 1;\n")).toEqual([
          "decision-pointer",
        ]);
        expect(kindsOf("a.ts", "// decision: see the README\nexport const x = 1;\n")).toEqual(["prose"]);
        expect(
          kindsOf("a.ts", 'export const s = "// no"; export const t = `/* no */`; export const r = /\\/\\/no/;\n')
        ).toEqual([]);
      })
    );

    it.effect("resolves exports through specifiers, default exports and module headers", () =>
      Effect.sync(() => {
        expect(kindsOf("a.ts", "/** Later. */\nconst y = 1;\nexport { y };\n")).toEqual(["jsdoc-export"]);
        expect(kindsOf("a.ts", "const z = 1;\nexport { /** On it. */ z };\n")).toEqual(["jsdoc-export"]);
        expect(kindsOf("a.ts", "/** Default. */\nfunction f() {}\nexport default f;\n")).toEqual(["jsdoc-export"]);
        expect(kindsOf("a.ts", "/**\n * Mod.\n *\n * @packageDocumentation\n */\nexport const x = 1;\n")).toEqual([
          "jsdoc-module",
        ]);
        expect(
          kindsOf("a.ts", '/** File header. */\nimport * as A from "effect/Array";\nexport const x = A.empty();\n')
        ).toEqual(["jsdoc-module"]);
        expect(kindsOf("a.ts", "/** Local. */\nconst h = 1;\nexport const x = h;\n")).toEqual(["jsdoc-local"]);
        expect(kindsOf("a.ts", "/** @internal */\nconst h = 1;\nexport const x = h;\n")).toEqual(["jsdoc-tagged"]);
        expect(kindsOf("a.ts", "export class C {\n  /** Member. */\n  m() {}\n}\n")).toEqual(["jsdoc-member"]);
        expect(kindsOf("a.ts", "class D {\n  /** Member. */\n  m() {}\n}\nexport const d = D;\n")).toEqual([
          "jsdoc-local",
        ]);
      })
    );

    it.effect(
      "passes moves and deletions and fails new, reworded and un-exported comments",
      Effect.fnUntraced(function* () {
        const moved = yield* commentDelta([
          change("a.ts", O.some("// keep\nexport const x = 1;\n"), O.some("export const x = 1;\n")),
          change("b.ts", O.none(), O.some("// keep\nexport const y = 1;\n")),
        ]);
        expect(moved.introduced).toEqual([]);

        const deleted = yield* commentDelta([change("a.ts", O.some("// gone\nexport const x = 1;\n"), O.none())]);
        expect(deleted).toEqual({ introduced: [], removed: 1 });

        const reworded = yield* commentDelta([
          change(
            "a.ts",
            O.some("// retry twice\nexport const x = 1;\n"),
            O.some("// retry three times\nexport const x = 1;\n")
          ),
        ]);
        expect(
          A.map(reworded.introduced, (finding) => [finding.file, finding.line, finding.kind, finding.excerpt])
        ).toEqual([["a.ts", 1, "prose", "retry three times"]]);

        const reflowed = yield* commentDelta([
          change(
            "a.ts",
            O.some("  // keep   this\nexport const x = 1;\n"),
            O.some("// keep this\nexport const x = 1;\n")
          ),
        ]);
        expect(reflowed.introduced).toEqual([]);

        const unexported = yield* commentDelta([
          change(
            "a.ts",
            O.some("/** Doc. */\nexport const x = 1;\n"),
            O.some("/** Doc. */\nconst x = 1;\nexport const y = x;\n")
          ),
        ]);
        expect(A.map(unexported.introduced, (finding) => finding.kind)).toEqual(["jsdoc-local"]);
      })
    );

    it.effect("locks unlisted scopes and keeps the pending list shrink-only", () =>
      Effect.sync(() => {
        const counts = HashMap.make(["packages/a/src/A.ts", 2], ["packages/b/src/B.ts", 0], ["packages/c/src/C.ts", 1]);
        const pr = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [shard("packages/a", ["."]), shard("packages/b", ["."])],
            baseShards: O.some([shard("packages/a", ["."]), shard("packages/b", ["."]), shard("packages/c", ["."])]),
            bannedCounts: counts,
            changedFiles: HashSet.make("packages/b/src/B.ts"),
            wholeTree: false,
          })
        );
        expect(A.map(pr.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["locked-scope-comment", "packages/c/src/C.ts"],
          ["stale-pending-scope", "packages/b"],
        ]);

        const push = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [shard("packages/a", ["."]), shard("packages/b", ["."])],
            baseShards: O.some([shard("packages/a", ["."]), shard("packages/b", ["."])]),
            bannedCounts: counts,
            changedFiles: HashSet.empty(),
            wholeTree: true,
          })
        );
        expect(A.map(push.findings, (finding) => finding.rule)).toEqual(["locked-scope-comment"]);
        expect(A.map(push.advisories, (finding) => finding.rule)).toEqual(["stale-pending-scope"]);

        const grew = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [shard("packages/a", ["."]), shard("packages/c", ["."])],
            baseShards: O.some([shard("packages/a", ["src"])]),
            bannedCounts: counts,
            changedFiles: HashSet.empty(),
            wholeTree: false,
          })
        );
        expect(A.map(grew.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["pending-scope-grew", "packages/a"],
          ["pending-scope-grew", "packages/c"],
        ]);
        const moved = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [
              CommentLawPending.make({
                schemaVersion: "comment-law-pending/v1",
                package: "@beep/moved",
                root: "packages/new",
                scopes: ["."],
              }),
            ],
            baseShards: O.some([
              CommentLawPending.make({
                schemaVersion: "comment-law-pending/v1",
                package: "@beep/moved",
                root: "packages/old",
                scopes: ["."],
              }),
            ]),
            bannedCounts: HashMap.make(["packages/new/src/A.ts", 2]),
            changedFiles: HashSet.make("packages/new/src/A.ts"),
            wholeTree: false,
          })
        );
        expect(moved.findings).toEqual([]);
      })
    );

    it.effect(
      "judges the whole tree on a main push, the branch delta on a new branch, and reads a blobless clone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        const pushed = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "HEAD" }));
        expect([pushed.changedFiles, pushed.findings]).toEqual([0, []]);

        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-am", "sweep without the comment"]);
        const laundered = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "HEAD" }));
        expect(A.map(laundered.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["locked-scope-comment", "packages/a/src/A.ts"],
        ]);
        expect(laundered.failed).toBe(true);

        const branch = yield* makeCheckout("advisory");
        yield* runGit(branch.root, ["switch", "--quiet", "-c", "feature"]);
        yield* branch.write("packages/a/src/C.ts", "// a new reason\nexport const c = 3;\n");
        yield* runGit(branch.root, ["add", "."]);
        yield* runGit(branch.root, ["commit", "--quiet", "--no-verify", "-m", "first push"]);
        const firstPush = yield* runCommentLaw(CommentLawOptions.make({ cwd: branch.root, base: "main" }));
        expect(A.map(firstPush.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["introduced-comment", "packages/a/src/C.ts"],
        ]);

        yield* runGit(branch.root, ["config", "uploadpack.allowFilter", "true"]);
        const clone = yield* fs.makeTempDirectoryScoped({ prefix: "comment-law-blobless-" });
        yield* runGit(clone, ["clone", "--quiet", "--filter=blob:none", "--no-local", `file://${branch.root}`, "repo"]);
        const repo = `${clone}/repo`;
        yield* fs.writeFileString(`${repo}/packages/a/src/B.ts`, "// explains b\nexport const b = 2;\n");
        const blobless = yield* runCommentLaw(CommentLawOptions.make({ cwd: repo, base: "origin/main" }));
        expect(A.map(blobless.findings, (finding) => finding.file)).toEqual([
          "packages/a/src/B.ts",
          "packages/a/src/C.ts",
        ]);
      })
    );

    it.effect(
      "reports an introduced comment against the merge base, fails only when blocking, and never skips",
      Effect.fnUntraced(function* () {
        const advisory = yield* makeCheckout("advisory");
        yield* advisory.write("packages/a/src/B.ts", "// explains b\nexport const b = 2;\n");
        const report = yield* runCommentLaw(CommentLawOptions.make({ cwd: advisory.root, base: "main" }));
        expect(report.enforcement).toBe("advisory");
        expect(report.failed).toBe(false);
        expect(A.map(report.findings, (finding) => [finding.rule, finding.file, finding.line])).toEqual([
          ["introduced-comment", "packages/a/src/B.ts", 1],
        ]);

        const blocking = yield* makeCheckout("blocking");
        yield* blocking.write("packages/a/src/B.ts", "// keeps the reason\nexport const b = 2;\n");
        yield* blocking.write("packages/a/src/A.ts", "export const a = 1;\n");
        const movedOnly = yield* runCommentLaw(CommentLawOptions.make({ cwd: blocking.root, base: "main" }));
        expect(movedOnly.findings).toEqual([]);
        expect(movedOnly.failed).toBe(false);

        yield* blocking.write("packages/a/src/New.ts", "/** Local helper. */\nconst h = 1;\nexport const n = h;\n");
        const failed = yield* runCommentLaw(CommentLawOptions.make({ cwd: blocking.root, base: "main" }));
        expect(failed.failed).toBe(true);
        expect(A.map(failed.findings, (finding) => [finding.file, finding.kind])).toEqual([
          ["packages/a/src/New.ts", "jsdoc-local"],
        ]);

        const missing = yield* runCommentLaw(CommentLawOptions.make({ cwd: blocking.root, base: "no-such-ref" })).pipe(
          Effect.flip
        );
        expect(missing).toBeInstanceOf(CommentLawExecutionError);
      })
    );

    it.effect(
      "seeds shards for packages that hold banned comments and prunes swept scopes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("advisory");
        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        const seeded = yield* runCommentLawWrite(checkout.root);
        expect(A.map(seeded, (entry) => [entry.package, entry.root, entry.scopes])).toEqual([
          ["@beep/a", "packages/a", ["."]],
        ]);

        yield* checkout.write("packages/a/src/A.ts", "export const a = 1;\n");
        const pruned = yield* runCommentLawWrite(checkout.root);
        expect(pruned).toEqual([]);
        const shardLeft = yield* fs.exists(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        expect(shardLeft).toBe(false);
      })
    );
  });
});
