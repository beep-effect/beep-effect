import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";

// A package's build may write only its own package directory. `tsc -b` is a
// subgraph builder: it rebuilds every project in the tsconfig reference
// closure, writing sibling packages' dist/tsbuildinfo outside Turbo's task
// graph — the torn-dist TS2306 race class (six occurrences, 2026-08-14/16).
// `tsc -p` compiles the single project and fails loud (TS6305) when an
// upstream dist is missing, which is Turbo's `^build` contract made visible.
// This test is the textual tripwire: no build script may reintroduce the
// subgraph builder or its `--force` closure re-emit.

const collectWorkspaceManifests = Effect.fnUntraced(function* (rootDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifests: Array<string> = [];
  const walk = Effect.fnUntraced(function* (dir: string): Effect.fn.Return<void, PlatformError, FileSystem.FileSystem> {
    const entries = yield* fs.readDirectory(dir);
    for (const entry of entries) {
      if (Str.equivalence(entry, "node_modules") || Str.startsWith(".")(entry)) {
        continue;
      }
      const full = path.join(dir, entry);
      const info = yield* fs.stat(full);
      if (info.type === "Directory") {
        yield* walk(full);
      } else if (Str.equivalence(entry, "package.json")) {
        manifests.push(full);
      }
    }
  });
  for (const top of ["packages", "apps"]) {
    const dir = path.join(rootDir, top);
    if (yield* fs.exists(dir)) {
      yield* walk(dir);
    }
  }
  return manifests;
});

const commandBasename = (word: string): string =>
  pipe(
    word,
    Str.replace(/^(["'])([\s\S]*)\1$/, "$2"),
    Str.split("/"),
    A.last,
    O.getOrElse(() => "")
  );

// Launcher flags belong to the launcher, including their separate operands.
// `--` ends launcher options; the child compiler still has its own `--`.
const skipLauncherOptions = (
  words: ReadonlyArray<string>,
  start: number,
  valueOptions: ReadonlyArray<string>
): number => {
  let index = start;
  while (index < words.length) {
    const word = words[index] ?? "";
    if (word === "--") {
      return index + 1;
    }
    if (!Str.startsWith("-")(word)) {
      break;
    }
    index += A.contains(valueOptions, word) ? 2 : 1;
  }
  return index;
};

const compilerArguments = (words: ReadonlyArray<string>): O.Option<ReadonlyArray<string>> => {
  // Shell substitutions can run before any launcher or compiler sees its operands.
  // Keep those forms on the conservative lexical path regardless of the outer command.
  if (A.some(words, (word) => /\$\(|`/u.test(word))) return O.none();
  let index = 0;
  const packageOptions = ["-p", "--package", "--cache", "--registry", "--userconfig", "--prefix"];
  const directoryOptions = ["-C", "--dir", "--cwd", "--filter", "--filter-prod", "-F"];
  while (index < words.length) {
    const remaining = A.drop(words, index);
    index += A.findFirstIndex(remaining, (word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)).pipe(
      O.getOrElse(() => remaining.length)
    );
    const command = commandBasename(words[index++] ?? "");
    if (command === "tsc" || command === "tsgo") {
      return O.some(A.drop(words, index));
    }
    const next = Match.value(command).pipe(
      Match.when("env", () =>
        O.some(skipLauncherOptions(words, index, ["-u", "--unset", "-C", "--chdir", "--argv0", "-a"]))
      ),
      Match.when(Match.is("bunx", "npx"), () => O.some(skipLauncherOptions(words, index, packageOptions))),
      Match.when("bun", () => {
        const start = skipLauncherOptions(words, index, directoryOptions);
        return O.some(
          A.contains(["x", "run"], words[start] ?? "")
            ? skipLauncherOptions(words, start + 1, [...directoryOptions, ...packageOptions])
            : start
        );
      }),
      Match.when(Match.is("pnpm", "npm"), (launcher) => {
        const start = skipLauncherOptions(words, index, [
          ...directoryOptions,
          ...A.filter(packageOptions, (option) => launcher !== "npm" || option !== "-p"),
          ...(launcher === "npm" ? ["--workspace", "-w", "--loglevel"] : []),
        ]);
        const subcommand = words[start];
        if (
          subcommand === "exec" ||
          (launcher === "pnpm" && subcommand === "dlx") ||
          (launcher === "npm" && subcommand === "x")
        ) {
          return O.some(skipLauncherOptions(words, start + 1, packageOptions));
        }
        if (subcommand === "run") return O.some(words.length);
        return launcher === "pnpm" ? O.some(start) : O.none<number>();
      }),
      Match.when(Match.is("echo", "printf"), () => O.some(words.length)),
      // Unknown prefixes remain subject to the conservative lexical tripwire.
      Match.orElse(() => O.none<number>())
    );
    if (O.isNone(next)) return O.none();
    index = next.value;
  }
  return O.some([]);
};

// Known launchers distinguish executable arguments from their own option values.
// Unknown prefixes remain review candidates when compiler/build tokens occur,
// including nested shell strings. This guard does not evaluate shell programs.
const usesSubgraphBuilder = (script: string): boolean => {
  const tokens = Str.matchAll(/(?:[^\s"'\\;&|]+|"(?:\\.|[^"\\])*"|'[^']*'|\\[\s\S])+|[;&|\n]+/g)(script);
  const commandUsesBuild = (words: ReadonlyArray<string>): boolean =>
    O.match(compilerArguments(words), {
      onNone: () => {
        const text = A.join(words, " ");
        return (
          /(?:^|[\s/"'(`])(?:tsc|tsgo)(?=\s|["')`]|$)/u.test(text) &&
          /(?:^|[\s"'])(?:-b|--build|--force)(?=\s|["')`]|$)/u.test(text)
        );
      },
      onSome: (arguments_) => {
        for (const argument of arguments_) {
          const word = Str.replace(/^(["'])([\s\S]*)\1$/, "$2")(argument);
          if (word === "--") {
            break;
          }
          if (word === "-b" || word === "--build" || word === "--force") {
            return true;
          }
        }
        return false;
      },
    });
  let words: Array<string> = [];
  for (const match of tokens) {
    const token = match[0];
    if (/^[;&|\n]+$/.test(token)) {
      if (commandUsesBuild(words)) {
        return true;
      }
      words = [];
    } else {
      words.push(token);
    }
  }
  return commandUsesBuild(words);
};

// `rm -rf dist` breaks single-project emit differently: the incremental
// tsbuildinfo survives outside dist, so `tsc -p` sees an up-to-date build,
// emits nothing, and the babel step dies on the missing directory.
const deletesOwnEmit = (script: string): boolean => Str.includes("rm -rf dist")(script);

const violatesSingleProjectEmit = (script: string): boolean => usesSubgraphBuilder(script) || deletesOwnEmit(script);

const emitScriptsOf = (raw: string): ReadonlyArray<string> => {
  const parsed = JSON.parse(raw) as { readonly scripts?: Readonly<Record<string, string>> };
  return A.getSomes([O.fromNullishOr(parsed.scripts?.["beep:build"]), O.fromNullishOr(parsed.scripts?.["beep:check"])]);
};

const collectViolations = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootDir = yield* findRepoRoot();
  const manifests = yield* collectWorkspaceManifests(rootDir);
  expect(manifests.length).toBeGreaterThan(100);
  const offending: Array<string> = [];
  for (const manifest of manifests) {
    const raw = yield* fs.readFileString(manifest);
    for (const script of emitScriptsOf(raw)) {
      if (violatesSingleProjectEmit(script)) {
        offending.push(`${path.relative(rootDir, manifest)}: ${script}`);
      }
    }
  }
  return offending;
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
  describe("single-project emit law", () => {
    it("detects compiler build flags at command boundaries and retains the emit deletion law", () => {
      for (const script of [
        "tsc -b",
        "tsgo -b",
        "tsc -b tsconfig.json",
        "tsgo --build",
        "tsc --force",
        "tsgo -p tsconfig.json --force",
        "bun run codegen && tsc -b",
        "echo ready;tsgo -b",
        "echo ready || tsc --force",
        "echo ready\ntsgo -b",
        'tsc "-b"',
        "tsgo '-b'",
        "rm -rf dist && tsc -p tsconfig.json",
      ]) {
        expect(violatesSingleProjectEmit(script), script).toBe(true);
      }
    });

    it("ignores quoted command text, flag substrings, and unrelated command operands", () => {
      for (const script of [
        "tsc -p tsconfig.json",
        "tsgo -p tsconfig.check.json && bun run beep:check:tests",
        "tsc -p tsconfig.json && echo -b",
        "echo -b && tsgo -p tsconfig.json",
        'echo "tsc -b"',
        "printf tsc -b",
        "command -v tsc",
        "command -V tsc",
        "echo 'tsgo --force'",
        'tsc -p "folder -b/tsconfig.json"',
        "tsgo -p 'folder --force/tsconfig.json'",
        "tsc -p tsconfig-build.json",
        "tsgo -p tsconfig.json --forceful",
        "echo tsc -b",
        "other-tsc -b",
        "tsc -- -b",
        'echo "ready && tsgo -b"',
      ]) {
        expect(violatesSingleProjectEmit(script), script).toBe(false);
      }
    });

    it("detects launched compiler build flags through environment prefixes, options, and executable paths", () => {
      for (const script of [
        "nice tsc -b project",
        "command tsc -b project",
        "yarn exec tsc -b project",
        "nohup tsc -b project",
        "timeout 30s tsc -b project",
        "corepack pnpm exec tsc -b project",
        "custom-compiler-wrapper tsc -b project",
        'sh -c "tsc -b project"',
        'sh -c "tsc -b"',
        'custom-compiler-wrapper "tsc" -b project',
        "bunx tsc -b project",
        "env FOO=x tsgo -b project",
        "FOO=x tsc -b project",
        "node_modules/.bin/tsc -b project",
        "/usr/bin/tsc -b project",
        "bunx tsc --force",
        "npx --no-install tsc -b packages/foo",
        "pnpm exec tsc -b .",
        "pnpm tsc -b .",
        "npm x tsc -b",
        "npm --loglevel silent exec tsc -b .",
        "npm -p exec tsc -b .",
        'echo "$(tsc -b .)"',
        "X=$(tsc -b .)",
        "echo `tsc -b .`",
        'pnpm run build "$(tsc -b .)"',
        'npm run build "$(tsc -b .)"',
        'tsc -- "$(tsc -b .)"',
        "bunx --bun --no-install tsgo --build",
        "bunx --package typescript tsc -b",
        "bunx -p typescript tsc --force",
        "npx --yes --package typescript tsc -b",
        "npx -p typescript -p other tsc -b",
        "npx --package=typescript -- tsc -b",
        "pnpm --filter foo exec tsgo -b",
        "pnpm --dir packages/foo exec tsc --force",
        "pnpm -C packages/foo exec tsc -b",
        "pnpm -w -r exec tsc -b",
        "pnpm --filter-prod foo exec tsgo -b",
        "npm -w foo exec -- tsc -b",
        "pnpm dlx --package typescript tsc -b",
        "bun run tsc -b project",
        "bun tsc -b project",
        "bun run --cwd packages/foo tsc -b project",
        "bun x --bun tsc -b",
        "bun --cwd packages/foo x tsc -b",
        "npm exec --package typescript -- tsc -b",
        "env -i -u NODE_OPTIONS -C packages/foo FOO=x /usr/bin/tsgo -b",
        "env --unset=NODE_OPTIONS -- /usr/bin/tsc --force",
        "FOO='x y' BAR=x env /usr/bin/bunx tsc -b",
        "npx --no-install './node_modules/.bin/tsc' '-b'",
        "echo ready && env FOO=x pnpm exec tsgo -b",
        '"/usr/bin/tsc" "-b"',
        "./node_modules/.bin/tsgo --build",
      ]) {
        expect(violatesSingleProjectEmit(script), script).toBe(true);
      }
    });

    it("keeps launcher operands, script names, and compiler end-of-options distinct", () => {
      for (const script of [
        "bunx tsc -p tsconfig.json",
        "npx --no-install tsgo -p tsconfig.json",
        "pnpm exec tsc -- -b",
        "env FOO=x tsc -- --force",
        "bunx echo tsc -b",
        "npx --package tsc echo -b",
        "pnpm --filter tsc exec echo -b",
        "pnpm --filter-prod tsc exec echo -b",
        "npm -w tsc exec echo -b",
        "env -u tsc echo -b",
        "env FOO='tsc -b' echo ready",
        "pnpm run tsc -b",
        "npm run tsc -b",
        "bunx nottsc -b",
        "node_modules/.bin/nottsc -b",
        "npx --package 'tsc -b' echo ready",
        "echo '/usr/bin/tsc -b'",
        "npx --no-install tsc --forceful",
        "bunx tsc -p 'folder --force/tsconfig.json'",
      ]) {
        expect(violatesSingleProjectEmit(script), script).toBe(false);
      }
    });

    it.effect("no beep:build or beep:check script uses the subgraph builder or --force", () =>
      Effect.gen(function* () {
        const violations = yield* collectViolations();
        expect(A.join(violations, "\n")).toBe("");
      })
    );
  });
});
