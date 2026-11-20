// AC-H12: `@beep/sqlite` is the library's only driver, the store module is the
// only one that loads it (by dynamic import), and the Vitest adapter's static
// import graph never reaches the store module or the driver.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Manifest = S.Struct({ dependencies: S.Record(S.String, S.String) });
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(Manifest));

const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)";/gmu;

const staticSpecifiers = (source: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(Str.matchAll(STATIC_IMPORT)(source)), (match) => match[1] ?? "");

const isTypeOnly = (source: string, specifier: string): boolean =>
  new RegExp(`^\\s*(?:import|export)\\s+type\\s[^;]*?from\\s+"${Str.replaceAll("/", "\\/")(specifier)}";`, "mu").test(
    source
  );

const repoRoot = Effect.map(Path.Path, (path) => path.resolve(import.meta.dirname, "../../../../.."));

// A module path resolves to itself, `<path>.ts` or `<path>/index.ts`, whichever exists.
const existing = Effect.fnUntraced(function* (base: string) {
  const fs = yield* FileSystem.FileSystem;
  const candidates = [base, `${base}.ts`, `${base}/index.ts`];
  const found = yield* Effect.filter(
    candidates,
    (candidate) =>
      Effect.map(fs.stat(candidate), (info) => info.type === "File").pipe(Effect.orElseSucceed(() => false)),
    { concurrency: 1 }
  );
  return A.head(found);
});

// `@beep/<pkg>[/<Module>]` resolves through the workspace link to `src/index.ts` or `src/<Module>`.
const resolveBeep = Effect.fnUntraced(function* (specifier: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* repoRoot;
  const [scope = "", name = "", ...rest] = Str.split(specifier, "/");
  const packageDir = yield* fs.realPath(path.join(root, "node_modules", scope, name));
  return yield* existing(path.join(packageDir, "src", A.isReadonlyArrayEmpty(rest) ? "index" : A.join(rest, "/")));
});

const resolveImport = Effect.fnUntraced(function* (from: string, specifier: string) {
  const path = yield* Path.Path;
  if (Str.startsWith(".")(specifier)) return yield* existing(path.resolve(path.dirname(from), specifier));
  if (Str.startsWith("@beep/")(specifier)) return yield* resolveBeep(specifier);
  return O.none<string>();
});

// Every module and bare specifier the entry reaches through runtime (non-type) static imports.
const staticGraph = Effect.fnUntraced(function* (entry: string) {
  const fs = yield* FileSystem.FileSystem;
  let seen = HashSet.empty<string>();
  let reached = HashSet.empty<string>();
  let queue: ReadonlyArray<string> = [entry];
  while (A.isReadonlyArrayNonEmpty(queue)) {
    const file = A.headNonEmpty(queue);
    queue = A.drop(queue, 1);
    if (HashSet.has(seen, file)) continue;
    seen = HashSet.add(seen, file);
    const source = yield* fs.readFileString(file);
    for (const specifier of staticSpecifiers(source)) {
      if (isTypeOnly(source, specifier)) continue;
      reached = HashSet.add(reached, specifier);
      const next = yield* resolveImport(file, specifier);
      queue = O.match(next, { onNone: () => queue, onSome: (target) => A.append(queue, target) });
    }
  }
  return { files: seen, specifiers: reached };
});

describe("history store boundaries (AC-H12)", () => {
  it.layer(NodeServices.layer, { timeout: "30 seconds" })("in the workspace", (it) => {
    it.effect("declares @beep/sqlite as the library's only driver", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* repoRoot;
        const manifest = yield* fs
          .readFileString(path.join(root, "packages/tooling/library/repo-gate-run/package.json"))
          .pipe(Effect.flatMap(decodeManifest));
        const drivers = yield* Effect.filter(
          A.filter(R.keys(manifest.dependencies), Str.startsWith("@beep/")),
          (name) => Effect.map(fs.realPath(path.join(root, "node_modules", name)), Str.includes("/packages/drivers/")),
          { concurrency: 1 }
        );
        assert.deepStrictEqual(drivers, ["@beep/sqlite"]);
      })
    );

    it.effect("loads the driver only from the store module, and the Vitest adapter never reaches it", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* repoRoot;
        const store = path.join(root, "packages/tooling/library/repo-gate-run/src/GateHistorySqlite.ts");
        const library = yield* staticGraph(path.join(root, "packages/tooling/library/repo-gate-run/src/index.ts"));
        const adapter = yield* staticGraph(path.join(root, "packages/tooling/test-kit/repo-gate-vitest/src/index.ts"));
        const storeGraph = yield* staticGraph(store);
        for (const graph of [library, adapter]) {
          assert.isFalse(HashSet.has(graph.files, store));
          assert.isFalse(HashSet.has(graph.specifiers, "@beep/sqlite"));
          assert.isFalse(HashSet.has(graph.specifiers, "bun:sqlite"));
        }
        assert.isFalse(HashSet.has(storeGraph.specifiers, "@beep/sqlite"));
        assert.isTrue(
          HashSet.has(
            storeGraph.files,
            path.join(root, "packages/tooling/library/repo-gate-run/src/GateHistoryStore.ts")
          )
        );
      })
    );
  });
});
