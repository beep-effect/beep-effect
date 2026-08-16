import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";

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
  const walk = Effect.fnUntraced(function* (dir: string): Effect.fn.Return<void, unknown, FileSystem.FileSystem> {
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

describe("single-project emit law", () => {
  it("no beep:build script uses the subgraph builder or --force", async () => {
    const violations = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        let rootDir = path.resolve(process.cwd());
        while (!(yield* fs.exists(path.join(rootDir, "turbo.json")))) {
          const parent = path.dirname(rootDir);
          expect(parent).not.toBe(rootDir);
          rootDir = parent;
        }
        const manifests = yield* collectWorkspaceManifests(rootDir);
        expect(manifests.length).toBeGreaterThan(100);
        const offending: Array<string> = [];
        for (const manifest of manifests) {
          const raw = yield* fs.readFileString(manifest);
          const parsed = JSON.parse(raw) as { readonly scripts?: Readonly<Record<string, string>> };
          const build = O.fromNullishOr(parsed.scripts?.["beep:build"], undefined);
          if (O.isNone(build)) {
            continue;
          }
          const script = build.value;
          const usesTsc = Str.includes("tsc ")(script) || Str.includes("tsgo ")(script);
          if (usesTsc && (Str.includes(" -b ")(script) || Str.includes("--force")(script))) {
            offending.push(`${path.relative(rootDir, manifest)}: ${script}`);
          }
        }
        return offending;
      }).pipe(Effect.provide(NodeServices.layer))
    );
    expect(A.join(violations, "\n")).toBe("");
  });
});
