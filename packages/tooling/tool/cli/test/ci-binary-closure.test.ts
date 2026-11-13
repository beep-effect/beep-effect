import { ciBinaryClosureOf } from "@beep/repo-cli/commands/Ci/CiBinaryClosure";
import { livePolicySourceTree, readPolicyWorkspaces } from "@beep/repo-cli/commands/Lint";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

// PERIH-11 slice 1 (goals/heavy-pool-diet): the CI binary release gate compares closure digests.
// These fixtures overlay single files on the live checkout and prove which edits move the digest.

type SourceTree = Parameters<typeof ciBinaryClosureOf>[0]["tree"];

const platform = Layer.mergeAll(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)), Digest.layerWebCrypto);

const CI_BINARY = "packages/tooling/tool/cli/src/commands/Ci/CiBinary.ts";
// bun.lock names a patch by path only, so the patch content is a closure input of its own.
const PATCH_FILE = "patches/alchemy@2.0.0-beta.85.patch";
const PATTERNS_JSON = "packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json";

// The live tree with some files' content replaced (an edit) or created (a new file).
const overlay = (tree: SourceTree, edits: HashMap.HashMap<string, (text: O.Option<string>) => string>): SourceTree => ({
  files: tree.files,
  read: (file) =>
    O.match(HashMap.get(edits, file), {
      onNone: () => tree.read(file),
      onSome: (edit) => Effect.map(tree.read(file), (text) => O.some(edit(text))),
    }),
});

const append =
  (suffix: string) =>
  (text: O.Option<string>): string =>
    `${O.getOrElse(text, () => "")}${suffix}`;

const live = Effect.gen(function* () {
  const root = yield* findRepoRoot();
  const tree = yield* livePolicySourceTree(root);
  const workspaces = yield* readPolicyWorkspaces(root);
  return { tree, workspaces } as const;
});

const digestWith = Effect.fnUntraced(function* (edits: ReadonlyArray<readonly [string, string]>) {
  const { tree, workspaces } = yield* live;
  const closure = yield* ciBinaryClosureOf({
    tree: overlay(tree, HashMap.fromIterable(A.map(edits, ([file, suffix]) => [file, append(suffix)] as const))),
    workspaces,
  });
  return closure;
});

describe("ci binary closure", () => {
  it.layer(platform, { timeout: "60 seconds" })((it) => {
    it.effect(
      "is deterministic across runs and workspace order",
      Effect.fnUntraced(function* () {
        const { tree, workspaces } = yield* live;
        const first = yield* ciBinaryClosureOf({ tree, workspaces });
        const second = yield* ciBinaryClosureOf({ tree, workspaces: A.reverse(workspaces) });
        expect(second.digest).toBe(first.digest);
        expect(A.map(second.files, (file) => file.path)).toStrictEqual(A.map(first.files, (file) => file.path));
        expect(first.digest).toMatch(/^[0-9a-f]{64}$/u);
      })
    );

    it.effect(
      "covers the entry, reached workspace modules and the build inputs, never the patterns projection",
      Effect.fnUntraced(function* () {
        const closure = yield* digestWith([]);
        const paths = A.map(closure.files, (file) => file.path);
        expect(paths).toContain("packages/tooling/tool/cli/src/bin-ci.ts");
        expect(paths).toContain(CI_BINARY);
        expect(paths).toContain("packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts");
        expect(paths).toContain("packages/foundation/modeling/utils/package.json");
        expect(paths).toContain("bun.lock");
        expect(paths).toContain(".bun-version");
        expect(paths).toContain(".github/workflows/beep-ci-binary.yml");
        expect(paths).toContain(PATCH_FILE);
        expect(paths).not.toContain(PATTERNS_JSON);
        expect(A.some(paths, Str.startsWith("goals/"))).toBe(false);
      })
    );

    it.effect(
      "moves when a file inside the closure changes",
      Effect.fnUntraced(function* () {
        const base = yield* digestWith([]);
        for (const file of [
          CI_BINARY,
          "packages/foundation/modeling/utils/src/Str.ts",
          "bun.lock",
          ".bun-version",
          ".github/workflows/beep-ci-binary.yml",
          PATCH_FILE,
        ]) {
          const edited = yield* digestWith([[file, "\n// closure mutation fixture\n"]]);
          expect(edited.digest, file).not.toBe(base.digest);
        }
      })
    );

    it.effect(
      "moves when a new import edge pulls a module into the closure",
      Effect.fnUntraced(function* () {
        const base = yield* digestWith([]);
        const edited = yield* digestWith([[CI_BINARY, '\nimport "./CiLane.ts";\n']]);
        const paths = A.map(edited.files, (file) => file.path);
        expect(A.map(base.files, (file) => file.path)).not.toContain(
          "packages/tooling/tool/cli/src/commands/Ci/CiLane.ts"
        );
        expect(paths).toContain("packages/tooling/tool/cli/src/commands/Ci/CiLane.ts");
        expect(edited.digest).not.toBe(base.digest);
      })
    );

    it.effect(
      "holds when a file outside the closure changes",
      Effect.fnUntraced(function* () {
        const base = yield* digestWith([]);
        for (const file of [
          "goals/heavy-pool-diet/PLAN.md",
          "packages/drivers/git/src/Git.ts",
          "packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts",
          PATTERNS_JSON,
        ]) {
          const edited = yield* digestWith([[file, "\n// outside the closure\n"]]);
          expect(edited.digest, file).toBe(base.digest);
        }
      })
    );
  });
});
