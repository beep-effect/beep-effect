import {
  ChangesetGraphError,
  ChangesetGraphPackageReference,
  changesetPackageReferencesFromText,
  changesetsParseClosingFenceLine,
  collectWorkspacePackageJsonFiles,
  findMissingChangesetPackageReferences,
  makeChangesetGraphSummary,
  runChangesetGraphCheck,
} from "@beep/repo-cli/test/Quality";
import { parseChangesetFile } from "@changesets/parse";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const runGit = Effect.fn("ChangesetGraphTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const writeRepoFile = Effect.fn("ChangesetGraphTest.writeRepoFile")(function* (
  repoRoot: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(repoRoot, relativePath);

  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writePackageJson = (repoRoot: string, relativePath: string, document: unknown) =>
  writeRepoFile(repoRoot, relativePath, `${encodeJson(document)}\n`);

const writeFixtureRepo = Effect.fn("ChangesetGraphTest.writeFixtureRepo")(function* (
  repoRoot: string,
  changesetContent: string,
  retiredPackageRecord?: unknown
) {
  yield* writePackageJson(repoRoot, "package.json", {
    private: true,
    workspaces: ["packages/*"],
  });
  yield* writePackageJson(repoRoot, "packages/demo/package.json", {
    name: "@beep/demo",
    version: "0.0.0",
  });
  yield* writeRepoFile(repoRoot, ".changeset/README.md", "# Changesets\n");
  yield* writeRepoFile(repoRoot, ".changeset/demo.md", changesetContent);
  if (!P.isUndefined(retiredPackageRecord)) {
    yield* writeRepoFile(
      repoRoot,
      "standards/changesets.retired-packages.json",
      `${encodeJson(retiredPackageRecord)}\n`
    );
  }
  yield* runGit(repoRoot, ["init"]);
  yield* runGit(repoRoot, ["add", "."]);
});

describe("changeset graph", () => {
  it("keeps changeset graph error optional file context at the command boundary", () => {
    const emptyError = ChangesetGraphError.new(new Error("cause"), "failed");
    expect(emptyError).toBeInstanceOf(ChangesetGraphError);
    expect(emptyError.message).toBe("failed");
    expect(emptyError.file).toBeUndefined();

    const curried = ChangesetGraphError.new("failed")(new Error("cause"));
    expect(curried).toBeInstanceOf(ChangesetGraphError);
    expect(curried.message).toBe("failed");

    const detailedError = ChangesetGraphError.new(new Error("cause"), "failed", ".changeset/demo.md");
    expect(detailedError.file).toBe(".changeset/demo.md");
  });

  it.effect(
    "parses package names from changeset frontmatter",
    Effect.fnUntraced(function* () {
      const references = yield* changesetPackageReferencesFromText(
        ".changeset/demo.md",
        `---
"@beep/schema": patch
"@beep/repo-cli": minor
---

Patch package metadata.
`
      );

      expect(references).toEqual([
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/repo-cli",
        }),
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/schema",
        }),
      ]);
    })
  );

  it.effect(
    "fails typed with the file and the parser cause on malformed changeset frontmatter",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        changesetPackageReferencesFromText(".changeset/x.md", `---\n"@beep/schema": [patch\n---\n\nBroken.\n`)
      );

      expect(error).toBeInstanceOf(ChangesetGraphError);
      expect(error.file).toBe(".changeset/x.md");
      expect(error.message).toMatch(/^Invalid changeset frontmatter in \.changeset\/x\.md: \S/);
    })
  );

  it.effect(
    "treats empty changeset frontmatter as a valid no-op",
    Effect.fnUntraced(function* () {
      const references = yield* changesetPackageReferencesFromText(
        ".changeset/noop.md",
        `---
---

Record a private workspace change.
`
      );

      expect(references).toEqual([]);
    })
  );

  it("visits each malformed frontmatter line once even with many opening candidates", () => {
    const size = 50_000;
    let steps = 0;
    function* lines() {
      for (let index = 0; index < size; index += 1) {
        steps += 1;
        yield "---not-a-closing-fence";
      }
    }
    assertNone(changesetsParseClosingFenceLine(lines()));
    expect(steps).toBe(size);
    assertSome(changesetsParseClosingFenceLine(["prefix---yaml", "body", "  ---\t"]), 3);
    assertNone(changesetsParseClosingFenceLine(["---"]));
  });

  it.effect("reads CRLF-fenced changeset frontmatter", () =>
    Effect.gen(function* () {
      const references = yield* changesetPackageReferencesFromText(
        ".changeset/crlf.md",
        '---\r\n"@beep/schema": patch\r\n---\r\n\r\nPatch schema.\r\n'
      );

      expect(references).toEqual([
        ChangesetGraphPackageReference.make({ file: ".changeset/crlf.md", packageName: "@beep/schema" }),
      ]);
    })
  );

  it.effect("reads no references from a source @changesets/parse also rejects", () =>
    Effect.gen(function* () {
      const unclosed = yield* changesetPackageReferencesFromText(
        ".changeset/unclosed.md",
        '---\n"@beep/schema": patch\n\nNo closing fence.\n'
      );
      const inexactClose = yield* changesetPackageReferencesFromText(
        ".changeset/inexact.md",
        '---\n"@beep/schema": patch\n----\n\nFour dashes do not close the fence.\n'
      );

      expect(unclosed).toEqual([]);
      expect(inexactClose).toEqual([]);
    })
  );

  it.effect("reads a closing fence with trailing whitespace, as @changesets/parse does", () =>
    Effect.gen(function* () {
      const file = ".changeset/padded.md";
      const trailingSpace = yield* changesetPackageReferencesFromText(file, '---\n"@beep/x": patch\n--- \n\nBody\n');
      const trailingTab = yield* changesetPackageReferencesFromText(file, '---\t\n"@beep/x": patch\n---\t\n\nBody\n');

      expect(trailingSpace).toEqual([ChangesetGraphPackageReference.make({ file, packageName: "@beep/x" })]);
      expect(trailingTab).toEqual([ChangesetGraphPackageReference.make({ file, packageName: "@beep/x" })]);
    })
  );

  it.effect("fails loudly when @changesets/parse reads frontmatter the shared grammar does not", () =>
    Effect.gen(function* () {
      const indentedClose = yield* changesetPackageReferencesFromText(
        ".changeset/indented.md",
        '---\n"@beep/x": patch\n  ---\n\nBody\n'
      ).pipe(Effect.flip);
      const leadingBlankLine = yield* changesetPackageReferencesFromText(
        ".changeset/leading.md",
        '\n---\n"@beep/x": patch\n---\n\nBody\n'
      ).pipe(Effect.flip);
      const jsonFence = yield* changesetPackageReferencesFromText(
        ".changeset/json.md",
        '---json\n{"@beep/schema": "patch"}\n---\n\nJSON fence.\n'
      ).pipe(Effect.flip);

      expect(indentedClose).toBeInstanceOf(ChangesetGraphError);
      expect(indentedClose.file).toBe(".changeset/indented.md");
      expect(indentedClose.message).toContain("closes on line 3 for @changesets/parse");
      expect(leadingBlankLine.file).toBe(".changeset/leading.md");
      expect(leadingBlankLine.message).toContain("closes on line 4 for @changesets/parse");
      expect(jsonFence.file).toBe(".changeset/json.md");
      expect(jsonFence.message).toContain("closes on line 3 for @changesets/parse");
    })
  );

  describe("parity with @changesets/parse", () => {
    // Each fixture's agreed outcome. "same": both read these package names.
    // "loud": @changesets/parse reads frontmatter the shared grammar does not,
    // so the guard fails instead of reading an empty changeset. "rejected":
    // @changesets/parse throws on the file and the guard reads nothing.
    const fixtures: ReadonlyArray<
      readonly [name: string, content: string, outcome: "same" | "loud" | "rejected", packages: ReadonlyArray<string>]
    > = [
      [
        "two packages",
        '---\n"@beep/schema": patch\n"@beep/utils": minor\n---\n\nBody\n',
        "same",
        ["@beep/schema", "@beep/utils"],
      ],
      ["crlf", '---\r\n"@beep/schema": patch\r\n---\r\n\r\nBody\r\n', "same", ["@beep/schema"]],
      ["empty block", "---\n---\n\nNo packages.\n", "same", []],
      ["close with trailing space", '---\n"@beep/x": patch\n--- \n\nBody\n', "same", ["@beep/x"]],
      ["close with trailing tab", '---\n"@beep/x": patch\n---\t\n\nBody\n', "same", ["@beep/x"]],
      ["open with trailing space", '--- \n"@beep/x": patch\n---\n\nBody\n', "same", ["@beep/x"]],
      ["both padded", '---\t \n"@beep/x": major\n--- \t\n\nBody\n', "same", ["@beep/x"]],
      ["both padded under crlf", '--- \r\n"@beep/x": patch\r\n---\t\r\n\r\nBody\r\n', "same", ["@beep/x"]],
      ["padded close at end of file", '---\n"@beep/x": patch\n--- ', "same", ["@beep/x"]],
      ["indented close", '---\n"@beep/x": patch\n  ---\n\nBody\n', "loud", []],
      ["leading blank line", '\n---\n"@beep/x": patch\n---\n\nBody\n', "loud", []],
      ["json fence", '---json\n{"@beep/schema": "patch"}\n---\n\nBody\n', "loud", []],
      ["unclosed", '---\n"@beep/schema": patch\n\nBody\n', "rejected", []],
      ["four-dash close", '---\n"@beep/schema": patch\n----\n\nBody\n', "rejected", []],
      ["text after the close", '---\n"@beep/schema": patch\n---x\n\nBody\n', "rejected", []],
      ["toml fence", '+++\n"@beep/schema" = "patch"\n+++\n', "rejected", []],
    ];

    it.effect("agrees with @changesets/parse on every fixture or fails loudly", () =>
      Effect.forEach(
        fixtures,
        Effect.fnUntraced(function* ([name, content, outcome, packages]) {
          const file = `.changeset/${name}.md`;
          if (outcome === "rejected") {
            expect(() => parseChangesetFile(content), name).toThrow();
            expect(yield* changesetPackageReferencesFromText(file, content), name).toEqual([]);
            return;
          }
          if (outcome === "loud") {
            const error = yield* Effect.flip(changesetPackageReferencesFromText(file, content));
            expect(error.file, name).toBe(file);
            expect(error.message, name).toContain("for @changesets/parse");
            return;
          }
          const releaseNames = A.sort(
            A.map(parseChangesetFile(content).releases, (release) => release.name),
            Order.String
          );
          const guardNames = A.map(
            yield* changesetPackageReferencesFromText(file, content),
            (reference) => reference.packageName
          );
          expect(releaseNames, name).toEqual(packages);
          expect(guardNames, name).toEqual(releaseNames);
        }),
        { discard: true }
      )
    );
  });

  it.effect(
    "rejects frontmatter whose bump value is outside the major | minor | patch domain",
    Effect.fnUntraced(function* () {
      const error = yield* changesetPackageReferencesFromText(
        ".changeset/typo.md",
        `---
"@beep/schema": typo
---

Record a mistyped bump.
`
      ).pipe(Effect.flip);

      expect(error.file).toBe(".changeset/typo.md");
      expect(error.message).toContain("must map package names to major | minor | patch bumps");
    })
  );

  it.effect(
    "rejects frontmatter whose bump value is null",
    Effect.fnUntraced(function* () {
      const error = yield* changesetPackageReferencesFromText(
        ".changeset/null-bump.md",
        `---
"@beep/schema": null
---

Record a null bump.
`
      ).pipe(Effect.flip);

      expect(error.file).toBe(".changeset/null-bump.md");
      expect(error.message).toContain("must map package names to major | minor | patch bumps");
    })
  );

  it("reports only package references outside the workspace graph", () => {
    const missing = findMissingChangesetPackageReferences(
      ["@beep/schema"],
      [
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/schema",
        }),
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/missing",
        }),
      ]
    );

    expect(missing).toEqual([
      ChangesetGraphPackageReference.make({
        file: ".changeset/demo.md",
        packageName: "@beep/missing",
      }),
    ]);
  });

  it("builds a stable summary for release preflight output", () => {
    const summary = makeChangesetGraphSummary(
      ["@beep/schema"],
      [".changeset/demo.md"],
      [
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/missing",
        }),
      ]
    );

    expect(summary).toMatchObject({
      workspacePackages: 1,
      changesetFiles: 1,
      references: 1,
      missingReferences: [
        ChangesetGraphPackageReference.make({
          file: ".changeset/demo.md",
          packageName: "@beep/missing",
        }),
      ],
    });
  });

  it.layer(NodeServices.layer, { concurrent: false, timeout: "30 seconds" })((it) => {
    // 4-A2: the root patterns come from `@beep/repo-workspaces` `WorkspacePatterns.read`;
    // its typed read failure maps onto ChangesetGraphError with the failing file.
    it.effect("reports an unreadable root manifest as a ChangesetGraphError naming the file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeRepoFile(tmpDir, "package.json", "{");
        const error = yield* collectWorkspacePackageJsonFiles(tmpDir).pipe(Effect.flip);
        expect(error._tag).toBe("ChangesetGraphError");
        expect(error.file).toBe(path.join(tmpDir, "package.json"));
        expect(error.message).toContain("invalidJson");
      })
    );

    // Pinned shift (4-A2, SPEC W4-f): the retired reader took the root `package.json`
    // `workspaces` alone; through the kit a non-empty `pnpm-workspace.yaml`
    // `packages:` list wins, the precedence `WorkspaceDiscovery` always applied.
    // The live repository has no `pnpm-workspace.yaml`, so this is the one place
    // the divergent input is exercised.
    it.effect("follows a non-empty pnpm-workspace.yaml over the root package.json workspaces field", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeRepoFile(tmpDir, "pnpm-workspace.yaml", "packages:\n  - 'a/*'\n");
        yield* writePackageJson(tmpDir, "package.json", { private: true, workspaces: ["b/*"] });
        yield* writePackageJson(tmpDir, "a/from-yaml/package.json", { name: "@beep/from-yaml", version: "0.0.0" });
        yield* writePackageJson(tmpDir, "b/from-manifest/package.json", {
          name: "@beep/from-manifest",
          version: "0.0.0",
        });
        yield* runGit(tmpDir, ["init"]);
        yield* runGit(tmpDir, ["add", "."]);
        expect(yield* collectWorkspacePackageJsonFiles(tmpDir)).toEqual(["a/from-yaml/package.json"]);
      })
    );

    // A `!pattern` workspace entry excludes members: it becomes a git exclude
    // pathspec rather than a positive `:(glob)!...` pathspec git reads literally.
    it.effect("drops members matched by a negated workspace pattern", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writePackageJson(tmpDir, "package.json", {
          private: true,
          workspaces: ["packages/*", "!packages/private-*"],
        });
        yield* writePackageJson(tmpDir, "packages/public/package.json", { name: "@beep/public", version: "0.0.0" });
        yield* writePackageJson(tmpDir, "packages/private-a/package.json", {
          name: "@beep/private-a",
          version: "0.0.0",
        });
        yield* runGit(tmpDir, ["init"]);
        yield* runGit(tmpDir, ["add", "."]);
        expect(yield* collectWorkspacePackageJsonFiles(tmpDir)).toEqual(["packages/public/package.json"]);
      })
    );

    // Git `:(glob)` pathspecs do not expand braces, so the tracked manifests are
    // matched by the shared `GlobSet` instead.
    it.effect("selects members through a brace workspace pattern with a trailing wildcard", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writePackageJson(tmpDir, "package.json", { private: true, workspaces: ["{apps,libs}/*"] });
        yield* writePackageJson(tmpDir, "apps/web/package.json", { name: "@beep/web", version: "0.0.0" });
        yield* writePackageJson(tmpDir, "libs/core/package.json", { name: "@beep/core", version: "0.0.0" });
        yield* writePackageJson(tmpDir, "tools/cli/package.json", { name: "@beep/cli", version: "0.0.0" });
        yield* runGit(tmpDir, ["init"]);
        yield* runGit(tmpDir, ["add", "."]);
        expect(yield* collectWorkspacePackageJsonFiles(tmpDir)).toEqual([
          "apps/web/package.json",
          "libs/core/package.json",
        ]);
      })
    );

    it.effect("fails typed when a workspace pattern exceeds the glob expansion budget", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        const pattern = "packages/{1..999999999999}";
        yield* writePackageJson(tmpDir, "package.json", { private: true, workspaces: [pattern] });
        const error = yield* Effect.flip(collectWorkspacePackageJsonFiles(tmpDir));
        expect(error).toBeInstanceOf(ChangesetGraphError);
        expect(error.message).toContain(pattern);
      })
    );

    it.effect("selects members through ./-prefixed and negated ./-prefixed workspace patterns", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writePackageJson(tmpDir, "package.json", {
          private: true,
          workspaces: ["./packages/*", "!./packages/private-*"],
        });
        yield* writePackageJson(tmpDir, "packages/demo/package.json", { name: "@beep/demo", version: "0.0.0" });
        yield* writePackageJson(tmpDir, "packages/private-x/package.json", {
          name: "@beep/private-x",
          version: "0.0.0",
        });
        yield* runGit(tmpDir, ["init"]);
        yield* runGit(tmpDir, ["add", "."]);
        expect(yield* collectWorkspacePackageJsonFiles(tmpDir)).toEqual(["packages/demo/package.json"]);
      })
    );

    it.effect("accepts tracked workspace changesets through the release-path check", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          `---
"@beep/demo": patch
---

Patch demo.
`
        );

        const summary = yield* runChangesetGraphCheck(tmpDir);

        expect(summary).toMatchObject({
          workspacePackages: 1,
          changesetFiles: 1,
          references: 1,
          missingReferences: [],
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rejects notes naming private workspaces even when the retired registry allows the name", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(tmpDir, '---\n"@beep/demo": patch\n---\n\nPrivate note.\n', {
          packages: [{ name: "@beep/demo", rationale: "Stale retirement record." }],
        });
        yield* writePackageJson(tmpDir, "packages/demo/package.json", {
          name: "@beep/demo",
          version: "0.0.0",
          private: true,
        });
        const error = yield* runChangesetGraphCheck(tmpDir).pipe(Effect.flip);
        expect(error.message).toContain("private workspaces must not accumulate release notes");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("accepts retired package references declared in the repo retirement record", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          `---
"@beep/ontology": patch
---

Record retired package release cleanup.
`,
          {
            packages: [
              {
                name: "@beep/ontology",
                rationale: "Retired workspace package retained only for pending release cleanup changesets.",
              },
            ],
          }
        );

        const summary = yield* runChangesetGraphCheck(tmpDir);

        expect(summary).toMatchObject({
          workspacePackages: 1,
          changesetFiles: 1,
          references: 1,
          missingReferences: [],
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rejects tracked changesets that reference packages outside the workspace graph", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          `---
"@beep/missing": patch
---

Patch missing package.
`
        );

        const error = yield* runChangesetGraphCheck(tmpDir).pipe(Effect.flip);
        const errorLines = yield* TestConsole.errorLines;

        expect(error).toMatchObject({
          message: "Changeset package graph validation failed.",
        });
        expect(errorLines).toEqual([
          "[changeset-graph] changeset package references outside current workspace graph:",
          "- .changeset/demo.md :: @beep/missing",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("does not carry a previous release-path error into the next test", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          `---
"@beep/another-missing": patch
---

Patch another missing package.
`
        );

        const error = yield* runChangesetGraphCheck(tmpDir).pipe(Effect.flip);
        const errorLines = yield* TestConsole.errorLines;

        expect(error).toMatchObject({ message: "Changeset package graph validation failed." });
        expect(errorLines).toEqual([
          "[changeset-graph] changeset package references outside current workspace graph:",
          "- .changeset/demo.md :: @beep/another-missing",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("treats tracked empty changesets as release-path no-ops", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "changeset-graph-test-" });
        yield* writeFixtureRepo(
          tmpDir,
          `---
---

Record a private workspace change.
`
        );

        const summary = yield* runChangesetGraphCheck(tmpDir);

        expect(summary).toMatchObject({
          workspacePackages: 1,
          changesetFiles: 1,
          references: 0,
          missingReferences: [],
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
