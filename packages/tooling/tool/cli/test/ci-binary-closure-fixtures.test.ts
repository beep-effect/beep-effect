import { ciBinaryClosureOf } from "@beep/repo-cli/commands/Ci/CiBinaryClosure";
import { PolicyFingerprintError, PolicyWorkspace } from "@beep/repo-cli/commands/Lint";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";

// PERIH-11 (goals/heavy-pool-diet): the closure computation over a synthetic, in-memory tree, so
// every path through the walk and its failures is pinned without reading the live checkout.

type SourceTree = Parameters<typeof ciBinaryClosureOf>[0]["tree"];

const CLI = "packages/tooling/tool/cli";
const ENTRY = `${CLI}/src/bin-ci.ts`;
const BUILD_INPUTS = [
  ".bun-version",
  ".github/workflows/beep-ci-binary.yml",
  "bun.lock",
  "bunfig.toml",
  `${CLI}/src/commands/Ci/CiCompileBinary.ts`,
] as const;

const cliWorkspace = PolicyWorkspace.make({
  name: "@beep/repo-cli",
  directory: CLI,
  exports: { ".": "./src/index.ts" },
  imports: undefined,
});

const baseFiles: ReadonlyArray<readonly [string, string]> = [
  [`${CLI}/package.json`, '{ "name": "@beep/repo-cli" }'],
  [ENTRY, 'import { dep } from "./dep.ts";\nconsole.log(dep);\n'],
  [`${CLI}/src/dep.ts`, "export const dep = 1;\n"],
  [`${CLI}/src/unreached.ts`, "export const unreached = 2;\n"],
  ["patches/pkg@1.0.0.patch", "--- a\n+++ b\n"],
  ...A.map(BUILD_INPUTS, (file) => [file, `${file}\n`] as const),
];

const memoryTree = (
  files: ReadonlyArray<readonly [string, string]>,
  failing: O.Option<string> = O.none()
): SourceTree => {
  const contents = HashMap.fromIterable(files);
  return {
    read: (file) =>
      O.contains(failing, file)
        ? Effect.fail(PolicyFingerprintError.make({ message: `synthetic read failure for ${file}`, cause: file }))
        : Effect.succeed(HashMap.get(contents, file)),
    files: (directory) =>
      Effect.succeed(
        contents.pipe(HashMap.keys, A.fromIterable, A.filter(Str.startsWith(`${directory}/`)), A.sort(Order.String))
      ),
  };
};

const withFile = (path: string, text: string) =>
  A.append(
    A.filter(baseFiles, ([file]) => file !== path),
    [path, text] as const
  );

const closureOf = (tree: SourceTree) => ciBinaryClosureOf({ tree, workspaces: [cliWorkspace] });

describe("ci binary closure over a synthetic tree", () => {
  it.layer(Digest.layerWebCrypto)((it) => {
    it.effect(
      "lists reached modules, their manifest, patches and build inputs, never an unreached module",
      Effect.fnUntraced(function* () {
        const closure = yield* closureOf(memoryTree(baseFiles));
        expect(A.map(closure.files, (file) => file.path)).toStrictEqual(
          A.sort(
            [`${CLI}/package.json`, ENTRY, `${CLI}/src/dep.ts`, "patches/pkg@1.0.0.patch", ...BUILD_INPUTS],
            Order.String
          )
        );
        expect(closure.entry).toBe(ENTRY);
        expect(closure.digest).toMatch(/^[0-9a-f]{64}$/u);
      })
    );

    it.effect(
      "takes every source file of a workspace whose reached module has a non-literal dynamic import",
      Effect.fnUntraced(function* () {
        const tree = memoryTree(
          withFile(`${CLI}/src/dep.ts`, 'const target = "./unreached.ts";\nexport const dep = await import(target);\n')
        );
        const closure = yield* closureOf(tree);
        expect(A.map(closure.files, (file) => file.path)).toContain(`${CLI}/src/unreached.ts`);
      })
    );

    it.effect(
      "fails when a build input is missing",
      Effect.fnUntraced(function* () {
        const tree = memoryTree(A.filter(baseFiles, ([file]) => file !== "bun.lock"));
        const error = yield* Effect.flip(closureOf(tree));
        expect(error.message).toBe("CI binary closure file bun.lock does not exist.");
      })
    );

    it.effect(
      "fails when a closure file cannot be read",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(closureOf(memoryTree(baseFiles, O.some("bun.lock"))));
        expect(error.message).toBe("Cannot read bun.lock.");
      })
    );

    it.effect(
      "fails when the entry imports a module that does not exist",
      Effect.fnUntraced(function* () {
        const tree = memoryTree(withFile(ENTRY, 'import "./missing.ts";\n'));
        const error = yield* Effect.flip(closureOf(tree));
        expect(error.message).toBe("Failed to walk the CI binary import closure.");
      })
    );
  });
});
