// The case-insensitive volume contract. It runs against the host filesystem
// first (integration/case-insensitive.int.test.ts, on a case-folding volume
// such as default APFS) so every expectation below is observed behaviour, not
// assumed behaviour; the memory engine (CaseInsensitive.test.ts) must then
// match it. Every case works under a scoped temp directory.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import type { Vitest } from "@effect/vitest";
import type * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";

// The fixture several cases start from: a directory holding one file.
const directoryWithFile = (fs: FileSystem.FileSystem, directory: string, file: string, content: string) =>
  Effect.andThen(fs.makeDirectory(directory), fs.writeFileString(`${directory}/${file}`, content));

// The copy fixture: a source `a.txt` ("A") beside a target `b.txt` ("B").
const sourceAndTarget = (fs: FileSystem.FileSystem, d: string) =>
  Effect.andThen(fs.writeFileString(`${d}/a.txt`, "A"), fs.writeFileString(`${d}/b.txt`, "B"));

// `${d}/pkg/a.json` reached through a link at `${d}/links` to `target`:
// `query` (relative to `d`) reads the file and realPaths to `resolved`.
const linkedPackageResolves = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  d: string,
  target: string,
  query: string,
  resolved: string
) {
  const realD = yield* fs.realPath(d);
  yield* directoryWithFile(fs, `${d}/pkg`, "a.json", "1");
  yield* fs.symlink(target, `${d}/links`);
  const readFileString1 = yield* fs.readFileString(`${d}/${query}`);
  assert.strictEqual(readFileString1, "1");
  const realPath2 = yield* fs.realPath(`${d}/${query}`);
  assert.strictEqual(realPath2, `${realD}/${resolved}`);
});

// What a test body needs from vitest's context: a run-time skip, so a case
// whose host precondition fails is reported skipped, never vacuously passed.
type SkipContext = { readonly skip: (condition: boolean, note?: string) => void };

// The contract's cases, registered into a harness that already serves
// `FileSystem.FileSystem`. `foldsCase` is checked before every case: the memory
// engine built case-insensitive always folds (`Effect.succeed(true)`); a host
// volume may not, and then every case skips.
type Harness = Vitest.MethodsNonLive<FileSystem.FileSystem>;
type FoldsCase = Effect.Effect<boolean, PlatformError.PlatformError, FileSystem.FileSystem>;

export const caseInsensitiveCases: {
  (foldsCase: FoldsCase): (it: Harness) => void;
  (it: Harness, foldsCase: FoldsCase): void;
} = dual(2, (it: Harness, foldsCase: FoldsCase): void => {
  const run = Effect.fnUntraced(function* <A, E2>(
    ctx: SkipContext,
    body: (fs: FileSystem.FileSystem, d: string) => Effect.Effect<A, E2>
  ) {
    ctx.skip(!(yield* foldsCase), "the volume under test does not fold case");
    const fs = yield* FileSystem.FileSystem;
    const d = yield* fs.makeTempDirectoryScoped();
    return yield* body(fs, d);
  });

  it.effect("a differently-cased lookup resolves the stored entry", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/docs.json`, "{}");
        const readFileString3 = yield* fs.readFileString(`${d}/Docs.json`);
        assert.strictEqual(readFileString3, "{}");
        assert.strictEqual((yield* fs.stat(`${d}/DOCS.JSON`)).type, "File");
      })
    )
  );

  it.effect("listings keep the stored spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/Docs.json`, "{}");
        const readDirectory4 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory4, ["Docs.json"]);
      })
    )
  );

  it.effect("a write under a folded name overwrites and keeps the stored spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/Docs.json`, "1");
        yield* fs.writeFileString(`${d}/docs.json`, "2");
        const readDirectory5 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory5, ["Docs.json"]);
        const readFileString6 = yield* fs.readFileString(`${d}/DOCS.json`);
        assert.strictEqual(readFileString6, "2");
      })
    )
  );

  it.effect("an exclusive create under a folded name is AlreadyExists", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/a.txt`, "");
        const error = yield* Effect.flip(fs.writeFileString(`${d}/A.txt`, "", { flag: "wx" }));
        assert.strictEqual(error.reason._tag, "AlreadyExists");
      })
    )
  );

  it.effect("makeDirectory under a folded name is AlreadyExists", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(`${d}/Dir`);
        const error = yield* Effect.flip(fs.makeDirectory(`${d}/dir`));
        assert.strictEqual(error.reason._tag, "AlreadyExists");
      })
    )
  );

  it.effect("a case-only rename rewrites the spelling and keeps children", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* directoryWithFile(fs, `${d}/Dir`, "child.txt", "c");
        yield* fs.rename(`${d}/Dir`, `${d}/dir`);
        const readDirectory7 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory7, ["dir"]);
        const readDirectory8 = yield* fs.readDirectory(`${d}/DIR`);
        assert.deepStrictEqual(readDirectory8, ["child.txt"]);
        const readFileString9 = yield* fs.readFileString(`${d}/dir/child.txt`);
        assert.strictEqual(readFileString9, "c");
      })
    )
  );

  it.effect("rename onto its own spelling keeps the stored case", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* directoryWithFile(fs, `${d}/Dir`, "c.txt", "c");
        yield* fs.rename(`${d}/dir`, `${d}/dir`);
        const readDirectory10 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory10, ["Dir"]);
        yield* fs.rename(`${d}/DIR`, `${d}/dir`);
        const readDirectory11 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory11, ["dir"]);
        const readFileString12 = yield* fs.readFileString(`${d}/DIR/c.txt`);
        assert.strictEqual(readFileString12, "c");
      })
    )
  );

  it.effect(
    "a rename onto a different, folded-equal entry replaces it and keeps the destination's stored spelling",
    (ctx) =>
      run(ctx, (fs, d) =>
        Effect.gen(function* () {
          yield* fs.writeFileString(`${d}/x.txt`, "src");
          yield* fs.writeFileString(`${d}/b.txt`, "dst");
          yield* fs.rename(`${d}/x.txt`, `${d}/B.txt`);
          const names = yield* fs.readDirectory(d);
          const readFileString13 = yield* fs.readFileString(`${d}/b.TXT`);
          assert.strictEqual(readFileString13, "src");
          assert.deepStrictEqual(names, ["b.txt"]);
        })
      )
  );

  it.effect("glob matches a folded pattern and returns the stored spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/docs.json`, "{}");
        const glob14 = yield* fs.glob("*.JSON", { root: d });
        assert.deepStrictEqual(glob14, ["docs.json"]);
      })
    )
  );

  // The oracle is Effect's node adapter, which wraps the JS `fs.realpath`:
  // it resolves links but never canonicalizes case, so components keep the
  // queried spelling and only a link's target text contributes its own.
  it.effect("realPath keeps the queried spelling and resolves links to their target text", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        const realD = yield* fs.realPath(d);
        yield* directoryWithFile(fs, `${d}/Pkg`, "Main.ts", "");
        yield* fs.symlink(`${d}/Pkg`, `${d}/alias`);
        const realPath15 = yield* fs.realPath(`${d}/pkg/main.TS`);
        assert.strictEqual(realPath15, `${realD}/pkg/main.TS`);
        const realPath16 = yield* fs.realPath(`${d}/ALIAS/main.TS`);
        assert.strictEqual(realPath16, `${realD}/Pkg/main.TS`);
      })
    )
  );

  it.effect("a folded path through a symlinked directory resolves", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* directoryWithFile(fs, `${d}/pkg`, "a.json", "1");
        yield* fs.symlink(`${d}/pkg`, `${d}/links`);
        const readFileString17 = yield* fs.readFileString(`${d}/Links/A.JSON`);
        assert.strictEqual(readFileString17, "1");
      })
    )
  );

  it.effect("a link whose target text differs in case from the stored name resolves", (ctx) =>
    // The link's target text supplies its spelling; the rest stays as queried.
    run(ctx, (fs, d) => linkedPackageResolves(fs, d, `${d}/PKG`, "links/A.JSON", "PKG/A.JSON"))
  );

  it.effect("a link to a parent followed by folded children resolves", (ctx) =>
    run(ctx, (fs, d) => linkedPackageResolves(fs, d, d, "Links/PKG/a.json", "PKG/a.json"))
  );

  it.effect("a symlink onto a folded existing name is AlreadyExists", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(`${d}/pkg`);
        yield* fs.symlink(`${d}/pkg`, `${d}/links`);
        const error = yield* Effect.flip(fs.symlink(`${d}/pkg`, `${d}/LINKS`));
        assert.strictEqual(error.reason._tag, "AlreadyExists");
      })
    )
  );

  it.effect("a create under a folded parent lands in the stored directory", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(`${d}/Dir`);
        yield* fs.writeFileString(`${d}/dir/a.txt`, "a");
        const readDirectory18 = yield* fs.readDirectory(`${d}/Dir`);
        assert.deepStrictEqual(readDirectory18, ["a.txt"]);
        const readDirectory19 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory19, ["Dir"]);
      })
    )
  );

  it.effect("folding is not fuzzy: a different name is still NotFound", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/Docs.json`, "{}");
        const error = yield* Effect.flip(fs.readFileString(`${d}/Doc.json`));
        assert.strictEqual(error.reason._tag, "NotFound");
      })
    )
  );

  it.effect("copyFile onto a folded-equal entry overwrites it in place under the stored spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* sourceAndTarget(fs, d);
        yield* fs.copyFile(`${d}/a.txt`, `${d}/B.TXT`);
        assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["a.txt", "b.txt"]);
        const readFileString20 = yield* fs.readFileString(`${d}/b.txt`);
        assert.strictEqual(readFileString20, "A");
      })
    )
  );

  // node's `fs.cp` unlinks a replaced destination and recreates it, so the
  // requested (or source-child) spelling wins — unlike rename and copyFile.
  it.effect("copy with overwrite onto a folded-equal file takes the requested spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* sourceAndTarget(fs, d);
        yield* fs.copy(`${d}/a.txt`, `${d}/B.TXT`, { overwrite: true });
        assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["B.TXT", "a.txt"]);
        const readFileString21 = yield* fs.readFileString(`${d}/b.txt`);
        assert.strictEqual(readFileString21, "A");
      })
    )
  );

  it.effect("copy with overwrite merges into a folded directory and takes source child spellings", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* directoryWithFile(fs, `${d}/src`, "X.txt", "new");
        yield* directoryWithFile(fs, `${d}/dst`, "x.txt", "old");
        yield* fs.copy(`${d}/src`, `${d}/DST`, { overwrite: true });
        assert.deepStrictEqual([...(yield* fs.readDirectory(d))].sort(), ["dst", "src"]);
        const readDirectory22 = yield* fs.readDirectory(`${d}/dst`);
        assert.deepStrictEqual(readDirectory22, ["X.txt"]);
        const readFileString23 = yield* fs.readFileString(`${d}/dst/x.txt`);
        assert.strictEqual(readFileString23, "new");
      })
    )
  );

  it.effect("copy merges a folded nested directory under its stored spelling", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(`${d}/src/SUB`, { recursive: true });
        yield* fs.writeFileString(`${d}/src/SUB/A.txt`, "new");
        yield* fs.makeDirectory(`${d}/dst/sub`, { recursive: true });
        yield* fs.writeFileString(`${d}/dst/sub/a.txt`, "old");
        yield* fs.writeFileString(`${d}/dst/sub/keep.txt`, "k");
        yield* fs.copy(`${d}/src`, `${d}/dst`, { overwrite: true });
        const readDirectory24 = yield* fs.readDirectory(`${d}/dst`);
        assert.deepStrictEqual(readDirectory24, ["sub"]);
        assert.deepStrictEqual([...(yield* fs.readDirectory(`${d}/dst/sub`))].sort(), ["A.txt", "keep.txt"]);
        const readFileString25 = yield* fs.readFileString(`${d}/dst/sub/a.txt`);
        assert.strictEqual(readFileString25, "new");
      })
    )
  );

  it.effect("remove under a folded name removes the stored entry", (ctx) =>
    run(ctx, (fs, d) =>
      Effect.gen(function* () {
        yield* fs.writeFileString(`${d}/Gone.txt`, "");
        yield* fs.remove(`${d}/gone.TXT`);
        const readDirectory26 = yield* fs.readDirectory(d);
        assert.deepStrictEqual(readDirectory26, []);
      })
    )
  );
});

export const caseInsensitiveSuite: {
  <E>(layer: Layer.Layer<FileSystem.FileSystem, E>): (name: string) => ReturnType<typeof describe>;
  <E>(name: string, layer: Layer.Layer<FileSystem.FileSystem, E>): ReturnType<typeof describe>;
} = dual(2, <E>(name: string, layer: Layer.Layer<FileSystem.FileSystem, E>) =>
  describe(`case-insensitive volume (${name})`, () => {
    it.layer(layer, { timeout: "30 seconds" })((it) => caseInsensitiveCases(it, Effect.succeed(true)));
  })
);
