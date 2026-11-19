import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";

// The CI binary is compiled with `bun build`, so the guard bundles with the same engine. Effect stays
// external: the probe measures only what `@beep/identity/packages` contributes to a consumer bundle.
const USED_SLUG = "repo-cli";

// Bundle one entry module that sits under this package's git-ignored `.beep/` directory, so
// `@beep/identity/packages` resolves through the workspace exactly as it does for the CI binary.
const bundleEntry = Effect.fn("bundleEntry")(function* (entrySource: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const packageRoot = path.resolve(import.meta.dirname, "..");
  const scratchRoot = path.join(packageRoot, ".beep");
  yield* fs.makeDirectory(scratchRoot, { recursive: true });
  const directory = yield* fs.makeTempDirectoryScoped({ directory: scratchRoot, prefix: "identity-tree-shake-" });
  const entry = path.join(directory, "entry.ts");
  const outfile = path.join(directory, "out.js");
  yield* fs.writeFileString(entry, entrySource);
  const handle = yield* spawner.spawn(
    ChildProcess.make(
      "bun",
      ["build", entry, "--target=bun", "--external", "effect", "--external", "effect/*", "--outfile", outfile],
      { cwd: packageRoot, stdin: "ignore", stdout: "pipe", stderr: "pipe" }
    )
  );
  const [stderr, exitCode] = yield* Effect.all(
    [handle.stderr.pipe(Stream.decodeText, Stream.mkString), handle.exitCode, handle.stdout.pipe(Stream.runDrain)],
    { concurrency: 3 }
  );
  expect(exitCode, stderr).toBe(0);
  return yield* fs.readFileString(outfile);
});

// Every registered slug the one-composer bundle must not carry: all compose-group slugs but the
// used one. Quoted, so a slug that prefixes another (`repo-cli` / `repo-cli-kit`) never collides.
const otherRegisteredSlugs = Effect.fn("otherRegisteredSlugs")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const registryPath = path.resolve(import.meta.dirname, "../../../../foundation/modeling/identity/src/packages.ts");
  const registry = yield* fs.readFileString(registryPath);
  const slugs = CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(registry);
  expect(A.contains(slugs, USED_SLUG)).toBe(true);
  return A.filter(slugs, (slug) => !Str.equivalence(slug, USED_SLUG));
});

const quotedSlugsIn = (bundle: string, slugs: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(slugs, (slug) => Str.includes(`"${slug}"`)(bundle));

it.layer(NodeServices.layer, { timeout: "120 seconds" })((it) => {
  describe("@beep/identity/packages tree-shaking", () => {
    it.effect("keeps only the used composer's slug when a bundle imports one composer", () =>
      Effect.gen(function* () {
        const others = yield* otherRegisteredSlugs();
        const bundle = yield* bundleEntry(
          'import { $RepoCliId } from "@beep/identity/packages";\n\nconsole.log($RepoCliId.make("Probe"));\n'
        );

        expect(Str.includes(`"${USED_SLUG}"`)(bundle)).toBe(true);
        expect(quotedSlugsIn(bundle, others)).toEqual([]);
        expect(Str.includes(".compose(")(bundle)).toBe(false);
      })
    );

    it.effect("still carries every slug when a bundle reads the whole RepoPkgs record", () =>
      Effect.gen(function* () {
        const others = yield* otherRegisteredSlugs();
        const bundle = yield* bundleEntry(
          'import { RepoPkgs } from "@beep/identity/packages";\n\nconsole.log(RepoPkgs.$RepoCliId.make("Probe"));\n'
        );

        expect(quotedSlugsIn(bundle, others)).toEqual(others);
      })
    );
  });
});
