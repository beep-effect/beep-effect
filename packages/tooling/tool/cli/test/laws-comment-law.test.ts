import { Git, GitCommandError } from "@beep/git/Git";
import {
  CommentFileChange,
  CommentLawExecutionError,
  CommentLawOptions,
  CommentLawPending,
  CommentLockInput,
  commentDelta,
  evaluateCommentLock,
  isCommentLawPath,
  lawsCommand,
  runCommentCensus,
  runCommentLaw,
  runCommentLawWrite,
  runCommentList,
  scanCommentSource,
} from "@beep/repo-cli/commands/Laws";
import { TSMorphServiceLive } from "@beep/repo-utils/TSMorph/index";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";

const kindsOf = (file: string, text: string) => A.map(scanCommentSource(file, text), (comment) => comment.kind);
const change = (file: string, before: O.Option<string>, after: O.Option<string>) =>
  CommentFileChange.make({ file, before, after });
const shard = (root: string, scopes: readonly [string, ...Array<string>]) =>
  CommentLawPending.make({ schemaVersion: "comment-law-pending/v1", package: `@beep/${root}`, root, scopes });

const ROOTS = ["packages/a", "packages/b", "packages/c"];

const runLaws = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));
const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const runCommentsCommand = Effect.fn("CommentLawTest.runCommentsCommand")(
  function* (args: ReadonlyArray<string>) {
    const exit = yield* runLaws(["comments", ...args]).pipe(withEmptyConfig, Effect.exit);
    const lines = yield* TestConsole.logLines;
    return { exit, lines: A.map(lines, String) };
  },
  Effect.provideServiceEffect(Console.Console, TestConsole.make)
);

const enterDirectory = (directory: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(directory);
      return previous;
    }),
    (previous) => Effect.sync(() => process.chdir(previous))
  );

const scopedEnv = (name: string, value: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = Bun.env[name];
      Bun.env[name] = value;
      return previous;
    }),
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) delete Bun.env[name];
        else Bun.env[name] = previous;
      })
  );

const LONG_NOTE = "an untracked note long enough that the excerpt is cut before the reader reaches the end of it";

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

it.layer(Layer.provideMerge(TSMorphServiceLive, NodeTestLayer), { timeout: "60 seconds" })((it) => {
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
            basePackageRoots: ROOTS,
            packageRoots: ROOTS,
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
            basePackageRoots: ROOTS,
            packageRoots: ROOTS,
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
            basePackageRoots: ROOTS,
            packageRoots: ROOTS,
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
            basePackageRoots: ROOTS,
            packageRoots: ["packages/new"],
            bannedCounts: HashMap.make(["packages/new/src/A.ts", 2]),
            changedFiles: HashSet.make("packages/new/src/A.ts"),
            wholeTree: false,
          })
        );
        expect(moved.findings).toEqual([]);

        const nested = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [
              shard("packages/a", ["."]),
              CommentLawPending.make({
                schemaVersion: "comment-law-pending/v1",
                package: "(root)",
                root: ".",
                scopes: ["packages"],
              }),
            ],
            baseShards: O.none(),
            basePackageRoots: ROOTS,
            packageRoots: ["packages/a", "packages/a/nested", "packages/x"],
            bannedCounts: HashMap.make(
              ["packages/a/src/A.ts", 1],
              ["packages/a/nested/src/N.ts", 1],
              ["packages/x/src/X.ts", 1],
              ["packages/loose.ts", 1]
            ),
            changedFiles: HashSet.empty(),
            wholeTree: true,
          })
        );
        expect(A.map(nested.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["locked-scope-comment", "packages/a/nested/src/N.ts"],
          ["locked-scope-comment", "packages/x/src/X.ts"],
        ]);

        const deleted = evaluateCommentLock(
          CommentLockInput.make({
            headShards: [shard("packages/a", ["."]), shard("packages/b", ["."])],
            baseShards: O.some([shard("packages/a", ["."]), shard("packages/b", ["."])]),
            basePackageRoots: ROOTS,
            packageRoots: ROOTS,
            bannedCounts: HashMap.make(["packages/a/src/A.ts", 1]),
            changedFiles: HashSet.make("packages/b/src/Gone.ts"),
            wholeTree: false,
          })
        );
        expect(A.map(deleted.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["stale-pending-scope", "packages/b"],
        ]);
      })
    );

    it.effect(
      "judges the whole tree on a main push, the branch delta on a new branch, and reads a blobless clone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        const pushed = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "HEAD", push: true }));
        expect([pushed.changedFiles, pushed.findings]).toEqual([0, []]);

        const landed = yield* makeCheckout("blocking");
        yield* landed.write("packages/a/src/B.ts", "// landed with the push\nexport const b = 2;\n");
        yield* runGit(landed.root, ["commit", "--quiet", "--no-verify", "-am", "push a comment"]);
        const landedPush = yield* runCommentLaw(CommentLawOptions.make({ cwd: landed.root, base: "HEAD", push: true }));
        expect(landedPush.findings).toEqual([]);

        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-am", "sweep without the comment"]);
        const laundered = yield* runCommentLaw(
          CommentLawOptions.make({ cwd: checkout.root, base: "HEAD", push: true })
        );
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
      "uses base package roots when a new nested package locks an unchanged comment",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        yield* checkout.write("packages/a/nested/src/N.ts", "// inherited reason\nexport const n = 1;\n");
        yield* runGit(checkout.root, ["add", "."]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "nested source"]);
        yield* runGit(checkout.root, ["tag", "before-package"]);
        yield* checkout.write("packages/a/nested/package.json", '{ "name": "@beep/nested" }\n');
        const report = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "before-package" }));
        expect(A.map(report.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["locked-scope-comment", "packages/a/nested/src/N.ts"],
        ]);
      })
    );

    it.effect(
      "does not infer push mode from a clean checkout synced to its base",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-am", "sweep"]);
        const local = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "HEAD" }));
        expect(local.findings).toEqual([]);
        const pushed = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, push: true }));
        expect(A.map(pushed.findings, (finding) => finding.rule)).toEqual(["locked-scope-comment"]);
        yield* checkout.write("packages/a/src/B.ts", "export const b = 3;\n");
        const changed = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, push: true }));
        expect(changed.findings).toEqual([]);
        yield* enterDirectory(checkout.root);
        const incompatible = yield* runCommentsCommand(["--staged", "--push"]);
        expect(failureText(incompatible.exit)).toContain("--staged and --push cannot be combined");
      })
    );

    it.effect(
      "falls back to per-file reads when blob prefetch fails",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        const git = yield* Git;
        yield* checkout.write("packages/a/src/B.ts", "// added reason\nexport const b = 2;\n");
        yield* runGit(checkout.root, ["config", "remote.origin.promisor", "true"]);
        const report = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "main" })).pipe(
          Effect.provideService(
            Git,
            Git.makeTest({
              ...git,
              diffPatch: () =>
                Effect.fail(
                  GitCommandError.make({
                    kind: "failed",
                    args: ["diff"],
                    cwd: checkout.root,
                    exitCode: 128,
                    stderr: "truncated prefetch",
                  })
                ),
            })
          )
        );
        expect(report.introduced).toBe(1);
        expect(report.failed).toBe(true);
      })
    );

    it.effect(
      "fails closed naming an unreadable file after blob prefetch fails",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        const git = yield* Git;
        yield* checkout.write("packages/a/src/B.ts", "// added reason\nexport const b = 2;\n");
        yield* runGit(checkout.root, ["config", "remote.origin.promisor", "true"]);
        for (const missing of [false, true]) {
          const error = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "main" })).pipe(
            Effect.provideService(
              Git,
              Git.makeTest({
                ...git,
                diffPatch: () =>
                  Effect.fail(
                    GitCommandError.make({
                      kind: "failed",
                      args: ["diff"],
                      cwd: checkout.root,
                      exitCode: 128,
                      stderr: "truncated prefetch",
                    })
                  ),
                show: (root, ref, file) =>
                  file === "packages/a/src/B.ts"
                    ? missing
                      ? Effect.succeedNone
                      : Effect.fail(
                          GitCommandError.make({
                            kind: "failed",
                            args: ["show"],
                            cwd: root,
                            exitCode: 128,
                            stderr: "unreadable blob",
                          })
                        )
                    : git.show(root, ref, file),
              })
            ),
            Effect.flip
          );
          expect(error).toBeInstanceOf(CommentLawExecutionError);
          expect(error.message).toContain("packages/a/src/B.ts");
          expect(error.message).toContain("the comment law never skips");
        }
      })
    );

    it.effect(
      "updates and prunes a hand-named shard using its source filename",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        yield* fs.rename(
          `${checkout.root}/standards/comment-law/pending/beep-a.jsonc`,
          `${checkout.root}/standards/comment-law/pending/a.jsonc`
        );
        yield* checkout.write(
          "standards/comment-law/pending/a.jsonc",
          '{ "schemaVersion": "comment-law-pending/v1", "package": "@beep/a", "root": "packages/a", "scopes": ["src", "test"] }\n'
        );
        const updated = yield* runCommentLawWrite(checkout.root);
        expect(updated[0]?.scopes).toEqual(["src"]);
        const rewritten = yield* fs.readFileString(`${checkout.root}/standards/comment-law/pending/a.jsonc`);
        expect(rewritten).not.toContain('"test"');
        const derivedExists = yield* fs.exists(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        expect(derivedExists).toBe(false);
        yield* checkout.write("packages/a/src/A.ts", "export const a = 1;\n");
        const pruned = yield* runCommentLawWrite(checkout.root);
        expect(pruned).toEqual([]);
        const sourceExists = yield* fs.exists(`${checkout.root}/standards/comment-law/pending/a.jsonc`);
        expect(sourceExists).toBe(false);
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
    it.effect(
      "counts, lists and seeds shards by package root across nested, nameless, loose, deleted and untracked files",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("advisory");
        yield* checkout.write("vitest.config.ts", "// root note\nexport default 1;\n");
        yield* checkout.write("scripts/tool.ts", "// script note\nexport const s = 1;\n");
        yield* checkout.write("packages/a/nested/package.json", `{ "private": true }\n`);
        yield* checkout.write("packages/a/nested/src/N.ts", "/** Local. */\nconst n = 1;\nexport const m = n;\n");
        yield* checkout.write("packages/a/src/Gone.ts", "// gone soon\nexport const g = 1;\n");
        yield* runGit(checkout.root, ["add", "."]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "fixture"]);
        yield* fs.remove(`${checkout.root}/packages/a/src/Gone.ts`);
        yield* checkout.write("packages/a/src/U.ts", `// ${LONG_NOTE}\nexport const u = 1;\n`);

        const census = yield* runCommentCensus(checkout.root);
        expect(A.map(census, (row) => [row.root, row.kind, row.count])).toEqual([
          [".", "prose", 2],
          ["packages/a", "prose", 2],
          ["packages/a/nested", "jsdoc-local", 1],
        ]);

        const listed = yield* runCommentList(checkout.root, "packages/a/");
        expect(A.map(listed, (finding) => [finding.file, finding.line, finding.kind])).toEqual([
          ["packages/a/nested/src/N.ts", 1, "jsdoc-local"],
          ["packages/a/src/A.ts", 1, "prose"],
          ["packages/a/src/U.ts", 1, "prose"],
        ]);
        expect(listed[2]?.excerpt).toBe(`${Str.slice(0, 72)(LONG_NOTE)}...`);
        const whole = yield* runCommentList(checkout.root, ".");
        expect(A.length(whole)).toBe(5);
        const bare = yield* runCommentList(checkout.root, "./");
        expect(A.length(bare)).toBe(5);
        const dotted = yield* runCommentList(checkout.root, "./packages/a/src/");
        expect(A.map(dotted, (finding) => finding.file)).toEqual(["packages/a/src/A.ts", "packages/a/src/U.ts"]);
        const single = yield* runCommentList(checkout.root, "vitest.config.ts");
        expect(A.map(single, (finding) => finding.excerpt)).toEqual(["root note"]);

        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        const seeded = yield* runCommentLawWrite(checkout.root);
        expect(A.map(seeded, (entry) => [entry.package, entry.root, entry.scopes])).toEqual([
          ["(root)", ".", ["scripts", "vitest.config.ts"]],
          ["@beep/a", "packages/a", ["."]],
          ["packages/a/nested", "packages/a/nested", ["."]],
        ]);
        const pending = yield* fs.readDirectory(`${checkout.root}/standards/comment-law/pending`);
        expect(A.sort(pending, Order.String)).toEqual(["_root.jsonc", "beep-a.jsonc", "packages-a-nested.jsonc"]);

        const steady = yield* runCommentLawWrite(checkout.root);
        expect(steady).toEqual(seeded);

        yield* checkout.write("vitest.config.ts", "export default 1;\n");
        yield* checkout.write(
          "standards/comment-law/pending/beep-a.jsonc",
          `{ "schemaVersion": "comment-law-pending/v1", "package": "@beep/a", "root": "packages/a", "scopes": ["src", "test"] }\n`
        );
        const narrowed = yield* runCommentLawWrite(checkout.root);
        expect(A.map(narrowed, (entry) => [entry.root, entry.scopes])).toEqual([
          [".", ["scripts"]],
          ["packages/a", ["src"]],
          ["packages/a/nested", ["."]],
        ]);
        const rewritten = yield* fs.readFileString(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        expect(rewritten).not.toContain('"test"');
      })
    );

    it.effect(
      "compares the index with HEAD in staged mode and skips the lock",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        yield* checkout.write("packages/a/src/B.ts", "// explains b\nexport const b = 2;\n");
        yield* checkout.write("README.md", "# readme\n");
        yield* runGit(checkout.root, ["add", "packages/a/src/B.ts", "README.md"]);
        yield* checkout.write("packages/a/src/A.ts", "// unstaged edit\nexport const a = 1;\n");

        const staged = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, staged: true }));
        expect([staged.changedFiles, staged.introduced, staged.failed]).toEqual([1, 1, true]);
        expect(A.map(staged.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["introduced-comment", "packages/a/src/B.ts"],
        ]);
        expect(staged.advisories).toEqual([]);

        yield* runGit(checkout.root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        const defaulted = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root }));
        expect(defaulted.introduced).toBe(2);
      })
    );

    it.effect(
      "reads a merge base without a policy or pending shards and counts a deleted comment as removed",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        yield* runGit(checkout.root, ["rm", "-r", "--quiet", "standards"]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "drop the law"]);
        yield* runGit(checkout.root, ["tag", "bare"]);
        yield* checkout.write(
          "standards/comment-law/policy.jsonc",
          `{ "schemaVersion": "comment-law-policy/v1", "enforcement": "blocking" }\n`
        );
        yield* runGit(checkout.root, ["add", "."]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "restore the policy"]);
        yield* fs.remove(`${checkout.root}/packages/a/src/A.ts`);

        const summary = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "bare" }));
        expect([summary.changedFiles, summary.introduced, summary.removed, summary.failed]).toEqual([1, 0, 1, false]);
        expect(summary.findings).toEqual([]);
      })
    );

    it.effect(
      "fails on a missing policy, an undecodable shard and a history with no merge base",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const unpoliced = yield* makeCheckout("advisory");
        yield* fs.remove(`${unpoliced.root}/standards/comment-law/policy.jsonc`);
        const missing = yield* runCommentLaw(CommentLawOptions.make({ cwd: unpoliced.root, base: "main" })).pipe(
          Effect.flip
        );
        expect(missing.message).toBe("standards/comment-law/policy.jsonc is missing.");

        const broken = yield* makeCheckout("advisory");
        yield* broken.write("standards/comment-law/pending/zz.jsonc", "{ not jsonc\n");
        const undecodable = yield* runCommentLaw(CommentLawOptions.make({ cwd: broken.root, base: "main" })).pipe(
          Effect.flip
        );
        expect(undecodable.message).toContain("Failed to decode standards/comment-law/pending/zz.jsonc");

        const lonely = yield* makeCheckout("advisory");
        yield* runGit(lonely.root, ["switch", "--quiet", "--orphan", "lonely"]);
        yield* lonely.write(
          "standards/comment-law/policy.jsonc",
          `{ "schemaVersion": "comment-law-policy/v1", "enforcement": "advisory" }\n`
        );
        yield* runGit(lonely.root, ["add", "."]);
        yield* runGit(lonely.root, ["commit", "--quiet", "--no-verify", "-m", "unrelated"]);
        const unrelated = yield* runCommentLaw(CommentLawOptions.make({ cwd: lonely.root, base: "main" })).pipe(
          Effect.flip
        );
        expect(unrelated.message).toBe("No merge base between main and HEAD; the comment law never skips.");
      })
    );

    it.effect(
      "runs `laws comments` census, list, write and an advisory check with and without annotations",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("advisory");
        yield* checkout.write("packages/a/src/B.ts", "// explains b\nexport const b = 2;\n");
        yield* enterDirectory(checkout.root);

        const census = yield* runCommentsCommand(["--census"]);
        assertTrue(Exit.isSuccess(census.exit), failureText(census.exit));
        expect(census.lines).toEqual(["packages/a\tprose\t2"]);
        const censusJson = yield* runCommentsCommand(["--census", "--json"]);
        assertTrue(Exit.isSuccess(censusJson.exit), failureText(censusJson.exit));

        const listed = yield* runCommentsCommand(["--list", "packages/a"]);
        assertTrue(Exit.isSuccess(listed.exit), failureText(listed.exit));
        expect(listed.lines).toEqual([
          '  - packages/a/src/A.ts:1  prose  "keeps the reason"',
          '  - packages/a/src/B.ts:1  prose  "explains b"',
        ]);
        const listedJson = yield* runCommentsCommand(["--list", "packages/a", "--json"]);
        assertTrue(Exit.isSuccess(listedJson.exit), failureText(listedJson.exit));

        yield* scopedEnv("GITHUB_ACTIONS", "false");
        const plain = yield* runCommentsCommand(["--base", "main"]);
        assertTrue(Exit.isSuccess(plain.exit), failureText(plain.exit));
        expect(plain.lines).toContain('  - packages/a/src/B.ts:1  prose  "explains b"');
        expect(plain.lines).toContain(
          "[comment-law] advisory: these findings do not fail the check until the law turns blocking."
        );
        expect(A.some(plain.lines, Str.startsWith("::"))).toBe(false);

        const checkJson = yield* runCommentsCommand(["--check", "--base", "main", "--json"]);
        assertTrue(Exit.isSuccess(checkJson.exit), failureText(checkJson.exit));

        yield* scopedEnv("GITHUB_ACTIONS", "true");
        const annotated = yield* runCommentsCommand(["--base", "main"]);
        assertTrue(Exit.isSuccess(annotated.exit), failureText(annotated.exit));
        expect(annotated.lines).toContain(
          "::warning file=packages/a/src/B.ts,line=1,title=comment-law introduced-comment::explains b"
        );

        yield* runGit(checkout.root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        yield* scopedEnv("BEEP_PROOF_BASE", "");
        yield* scopedEnv("BEEP_YEET_PROOF_BASE", " ");
        const defaulted = yield* runCommentsCommand([]);
        assertTrue(Exit.isSuccess(defaulted.exit), failureText(defaulted.exit));
        expect(defaulted.lines).toContain('  - packages/a/src/B.ts:1  prose  "explains b"');

        const usage = yield* runLaws([]).pipe(withEmptyConfig, Effect.exit);
        assertTrue(Exit.isSuccess(usage), failureText(usage));

        const written = yield* runCommentsCommand(["--write"]);
        assertTrue(Exit.isSuccess(written.exit), failureText(written.exit));
        expect(written.lines).toEqual(["[comment-law] pending shards=1"]);
        const writtenJson = yield* runCommentsCommand(["--write", "--json"]);
        assertTrue(Exit.isSuccess(writtenJson.exit), failureText(writtenJson.exit));
        expect(writtenJson.lines).toEqual([]);
      })
    );

    it.effect(
      "rejects a decision pointer whose owning package records no decision file",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        yield* checkout.write("packages/a/src/P.ts", "// decision: keep-it\n// decision: plain\nexport const p = 1;\n");
        yield* checkout.write("scripts/tool.ts", "// decision: root-call\nexport const s = 1;\n");
        const dangling = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "main" }));
        expect(A.map(dangling.findings, (finding) => [finding.rule, finding.file, finding.line])).toEqual([
          ["dangling-decision-pointer", "packages/a/src/P.ts", 1],
          ["dangling-decision-pointer", "packages/a/src/P.ts", 2],
          ["dangling-decision-pointer", "scripts/tool.ts", 1],
        ]);
        expect(dangling.findings[2]?.excerpt).toBe("no decisions/<date>-root-call.md records this decision");
        yield* enterDirectory(checkout.root);
        const printed = yield* runCommentsCommand(["--base", "main"]);
        expect(printed.lines).toContain(
          '  - scripts/tool.ts:1  decision-pointer  "no decisions/<date>-root-call.md records this decision"'
        );

        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`${checkout.root}/packages/a/decisions/2026-11-22-keep-it.md`, { recursive: true });
        yield* fs.makeDirectory(`${checkout.root}/packages/a/decisions/plain.md`, { recursive: true });
        const directories = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "main" }));
        expect(directories.findings).toEqual(dangling.findings);
        yield* fs.remove(`${checkout.root}/packages/a/decisions`, { recursive: true });
        yield* checkout.write("packages/a/decisions/2026-11-22-keep-it.md", "# Keep it\n");
        yield* checkout.write("packages/a/decisions/plain.md", "# Plain\n");
        yield* checkout.write("packages/a/decisions/2026-11-22-other.md", "# Other\n");
        yield* checkout.write("decisions/root-call-later.md", "# Later\n");
        const resolved = yield* runCommentLaw(CommentLawOptions.make({ cwd: checkout.root, base: "main" }));
        expect(A.map(resolved.findings, (finding) => [finding.rule, finding.file])).toEqual([
          ["dangling-decision-pointer", "scripts/tool.ts"],
        ]);
        expect(resolved.introduced).toBe(0);
      })
    );

    it.effect(
      "escapes workflow-command properties and data in annotations",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("advisory");
        yield* checkout.write("packages/a/src/a,b:c.ts", "// 100% sure\nexport const x = 1;\n");
        yield* enterDirectory(checkout.root);
        yield* scopedEnv("GITHUB_ACTIONS", "true");
        const annotated = yield* runCommentsCommand(["--base", "main"]);
        assertTrue(Exit.isSuccess(annotated.exit), failureText(annotated.exit));
        expect(annotated.lines).toContain(
          "::warning file=packages/a/src/a%2Cb%3Ac.ts,line=1,title=comment-law introduced-comment::100%25 sure"
        );
      })
    );

    it.effect(
      "fails a blocking `laws comments` check on a locked scope and prints the stale scope as advisory",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const checkout = yield* makeCheckout("blocking");
        yield* fs.remove(`${checkout.root}/standards/comment-law/pending/beep-a.jsonc`);
        yield* checkout.write(
          "standards/comment-law/pending/beep-b.jsonc",
          `{ "schemaVersion": "comment-law-pending/v1", "package": "@beep/b", "root": "packages/b", "scopes": ["."] }\n`
        );
        yield* runGit(checkout.root, ["add", "-A"]);
        yield* runGit(checkout.root, ["commit", "--quiet", "--no-verify", "-m", "move the pending scope"]);
        yield* enterDirectory(checkout.root);
        yield* scopedEnv("GITHUB_ACTIONS", "true");

        const blocked = yield* runCommentsCommand(["--base", "HEAD", "--push"]);
        expect(failureText(blocked.exit)).toContain("[comment-law] check failed.");
        expect(blocked.lines).toContain("[comment-law] pending-scope lock:");
        expect(blocked.lines).toContain(
          "  - locked-scope-comment  packages/a/src/A.ts  1 banned comment(s) in a swept scope"
        );
        expect(A.some(blocked.lines, Str.startsWith("[comment-law] advisory:   - stale-pending-scope"))).toBe(true);
        expect(blocked.lines).toContain(
          "::error file=packages/a/src/A.ts,title=comment-law locked-scope-comment::1 banned comment(s) in a swept scope"
        );
      })
    );

    it.effect(
      "renders diagnostic law commands in process and preserves strict failure exits",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("advisory");
        yield* checkout.write(
          "tsconfig.json",
          '{ "compilerOptions": { "target": "ES2022", "module": "ESNext" }, "include": ["packages/**/*.ts"] }'
        );
        yield* checkout.write(
          "packages/a/src/A.ts",
          'import * as Effect from "effect/Effect";\nexport const load = () => Effect.gen(function* () { return 1; });\ndeclare const FrozenGrantSet: { make: (input: object) => unknown };\nexport const grants = FrozenGrantSet.make({});\n'
        );
        yield* enterDirectory(checkout.root);
        const cases = A.flatMap(["effect-fn", "frozen-grant-set"], (law) => [
          { args: [law], fails: false },
          { args: [law, "--check"], fails: true },
        ]);
        for (const { args, fails } of cases) {
          const exit = yield* runLaws([
            ...args,
            "--include",
            "packages/a/src/A.ts",
            "--exclude",
            "packages/a/src/B.ts",
          ]).pipe(withEmptyConfig, Effect.exit);
          exit.pipe(fails ? Exit.isFailure : Exit.isSuccess, assertTrue);
        }
      })
    );

    it.effect(
      "renders terse-effect dry-run, advisory, write and manual candidates in process",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("advisory");
        yield* checkout.write("tsconfig.json", '{ "compilerOptions": { "target": "ES2022", "module": "ESNext" } }');
        yield* checkout.write(
          "packages/a/src/A.ts",
          'import * as A from "effect/Array";\nimport { pipe } from "effect/Function";\nimport * as O from "effect/Option";\ndeclare const parse: (input: string) => O.Option<string>;\nexport const value = { onNone: () => A.empty<string>(), parse: (input: string) => pipe(input, parse) };\n'
        );
        yield* enterDirectory(checkout.root);
        for (const flags of [[], ["--check"], ["--check", "--advisory"], ["--write"]]) {
          const exit = yield* runLaws(["terse-effect", "--include", "packages/a/src/A.ts", ...flags]).pipe(
            withEmptyConfig,
            Effect.exit
          );
          const shouldFail = A.contains(flags, "--check") && !A.contains(flags, "--advisory");
          if (shouldFail) exit.pipe(Exit.isFailure, assertTrue);
          else exit.pipe(Exit.isSuccess, assertTrue);
        }
      })
    );

    it.effect(
      "runs the allowlist command in process and reports invalid documents",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("advisory");
        yield* enterDirectory(checkout.root);
        const absent = yield* runLaws(["allowlist-check"]).pipe(withEmptyConfig, Effect.exit);
        absent.pipe(Exit.isFailure, assertTrue);
        yield* checkout.write("standards/effect-laws.allowlist.jsonc", '{ "version": 1, "entries": [] }');
        const empty = yield* runLaws(["allowlist-check"]).pipe(withEmptyConfig, Effect.exit);
        empty.pipe(Exit.isSuccess, assertTrue);
      })
    );

    it.effect(
      "fails `laws comments --check` closed on an unresolvable base and on a blocking introduced comment",
      Effect.fnUntraced(function* () {
        const checkout = yield* makeCheckout("blocking");
        yield* enterDirectory(checkout.root);
        const unresolved = yield* runCommentsCommand(["--check", "--base", "no-such-ref"]);
        unresolved.exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(unresolved.exit)).toContain("CommentLawExecutionError");

        yield* checkout.write("packages/a/src/B.ts", "// explains b\nexport const b = 2;\n");
        const introduced = yield* runCommentsCommand(["--check", "--base", "main"]);
        introduced.exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(introduced.exit)).toContain("[comment-law] check failed.");
        expect(introduced.lines).toContain('  - packages/a/src/B.ts:1  prose  "explains b"');
      })
    );
  });
});
