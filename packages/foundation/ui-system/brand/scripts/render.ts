/**
 * Writes every generated brand file (theme stylesheet and SVG assets) from the identity in `src/Brand.tokens.ts`.
 *
 * Run with `bun run render` from the package root. The parity test in `test/assets.test.ts`
 * fails until the checked-in files match this output.
 */
import { beep, renderBrandAssets } from "@beep/brand";
import { A } from "@beep/utils";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Console, Effect, FileSystem, Layer, Path } from "effect";

const packageRoot = new URL("../", import.meta.url).pathname;

const writeAsset = Effect.fn("writeAsset")(function* (asset: { readonly path: string; readonly content: string }) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(packageRoot, asset.path);
  yield* fs.writeFileString(target, asset.content);
  yield* Console.log(`wrote ${asset.path}`);
});

const assets = renderBrandAssets(beep);

const writeAll = Effect.forEach(assets, writeAsset, { discard: true }).pipe(
  Effect.andThen(Console.log(`rendered ${A.length(assets)} files`))
);

const program = Effect.scoped(
  Layer.build(BunServices.layer).pipe(Effect.flatMap((context) => writeAll.pipe(Effect.provide(context))))
);

BunRuntime.runMain(program);
