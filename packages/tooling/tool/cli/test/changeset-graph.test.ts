import {
  ChangesetGraphError,
  ChangesetGraphPackageReference,
  changesetPackageReferencesFromText,
  findMissingChangesetPackageReferences,
  makeChangesetGraphSummary,
  runChangesetGraphCheck,
} from "@beep/repo-cli/test/Quality";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

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

const withTempRepo = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        return { fs, tmpDir } as const;
      }),
      ({ tmpDir }) => use(tmpDir),
      ({ fs, tmpDir }) => fs.remove(tmpDir, { recursive: true, force: true })
    ).pipe(provideScopedLayer(testLayer))
  );

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
    expect(emptyError.file).toBeUndefined();

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

  it("accepts tracked workspace changesets through the release-path check", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
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
        })
      )
    ));

  it("accepts retired package references declared in the repo retirement record", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
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
        })
      )
    ));

  it("rejects tracked changesets that reference packages outside the workspace graph", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
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
        })
      )
    ));

  it("treats tracked empty changesets as release-path no-ops", () =>
    Effect.runPromise(
      withTempRepo((tmpDir) =>
        Effect.gen(function* () {
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
        })
      )
    ));
});
