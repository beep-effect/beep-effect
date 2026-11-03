import {
  createInMemoryTsMorphProject,
  createRepoTsMorphProject,
  createWorkspaceOwnerResolver,
  leadingJsDocText,
  topFileoverview,
} from "@beep/repo-cli-kit/tsmorph/index";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";

const json = (value: unknown): string => `${JSON.stringify(value)}\n`;

// A scratch repository: `files` maps repo-relative paths to contents.
const repository = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-tsmorph-" }));
  for (const [relative, content] of R.toEntries(files)) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
  }
  return root;
});

describe("tsmorph/JsDoc", () => {
  it("reads the last leading JSDoc block and ignores line and block comments", () => {
    const project = createInMemoryTsMorphProject();
    const source = project.createSourceFile(
      "a.ts",
      A.join(
        [
          "/** first */",
          "/** second */",
          "// line",
          "export const documented = 1;",
          "/* plain block */",
          "export const undocumented = 2;",
        ],
        "\n"
      )
    );
    const [documented, undocumented] = source.getVariableStatements();
    expect(documented === undefined ? "" : leadingJsDocText(documented)).toBe("/** second */");
    expect(undocumented === undefined ? "missing" : leadingJsDocText(undocumented)).toBe("");
  });

  it("reads a top-of-file overview, after a shebang, and nothing when code comes first", () => {
    const project = createInMemoryTsMorphProject();
    assertSome(
      topFileoverview(project.createSourceFile("plain.ts", "\n/**\n * Overview.\n */\nexport {};\n")),
      "/**\n * Overview.\n */"
    );
    assertSome(
      topFileoverview(project.createSourceFile("bin.ts", "#!/usr/bin/env bun\n/** Entry. */\nexport {};\n")),
      "/** Entry. */"
    );
    assertNone(topFileoverview(project.createSourceFile("code.ts", "export const x = 1;\n/** late */\n")));
  });
});

layer(NodeServices.layer, { timeout: "30 seconds" })("tsmorph repo projects and owners", (it) => {
  it.effect("loads compiler options from tsconfig and only the glob-matched source files", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "tsconfig.json": json({ compilerOptions: { strict: true, target: "ES2022" }, include: ["src", "docs"] }),
        "src/a.ts": "export const a = 1;\n",
        "src/b.ts": "export const b = 2;\n",
        "docs/skip.ts": "export const skip = 3;\n",
      });
      const project = createRepoTsMorphProject({
        tsConfigFilePath: `${root}/tsconfig.json`,
        sourceFileGlobs: [`${root}/src/**/*.ts`],
      });
      expect(project.getCompilerOptions().strict).toBe(true);
      expect(
        A.sort(
          A.map(project.getSourceFiles(), (file) => file.getBaseName()),
          Order.String
        )
      ).toEqual(["a.ts", "b.ts"]);
    })
  );

  it.effect("attributes files to the deepest workspace, then fallback prefixes, then the fallback owner", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*", "packages/a/nested"] }),
        "packages/a/package.json": json({ name: "@beep/a" }),
        "packages/a/nested/package.json": json({ name: "@beep/nested" }),
      });
      const ownerOf = yield* createWorkspaceOwnerResolver({
        root,
        fallbackOwner: "@beep/root",
        fallbackPrefixes: [{ prefix: "scripts/", owner: "@beep/scripts" }],
      });
      expect(ownerOf(`${root}/packages/a/src/A.ts`)).toBe("@beep/a");
      expect(ownerOf(`${root}/packages/a`)).toBe("@beep/a");
      expect(ownerOf(`${root}/packages/a/nested/src/N.ts`)).toBe("@beep/nested");
      expect(ownerOf(`${root}/packages/ab/x.ts`)).toBe("@beep/root");
      expect(ownerOf(`${root}/scripts/run.ts`)).toBe("@beep/scripts");
      expect(ownerOf(`${root}/README.md`)).toBe("@beep/root");
    })
  );

  it.effect("fails on an unreadable workspace list unless asked to swallow it", () =>
    Effect.gen(function* () {
      const root = yield* repository({ "package.json": "{" });
      const failure = yield* Effect.flip(createWorkspaceOwnerResolver({ root, fallbackOwner: "@beep/root" }));
      expect(failure._tag).toBe("WorkspaceDiscoveryError");
      const ownerOf = yield* createWorkspaceOwnerResolver({
        root,
        fallbackOwner: "@beep/root",
        swallowWorkspaceErrors: true,
      });
      expect(ownerOf(`${root}/packages/a/src/A.ts`)).toBe("@beep/root");
    })
  );
});
