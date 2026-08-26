import { beep, renderBrandAssets, renderThemeCss } from "@beep/brand";
import { A } from "@beep/utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, HashSet, Layer, Path } from "effect";
import * as O from "effect/Option";

const packageRoot = new URL("../", import.meta.url).pathname;

const withBunServices = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.scoped(Layer.build(BunServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const readPackageFile = Effect.fn("readPackageFile")(function* (relative: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(packageRoot, relative));
});

describe("generated assets", () => {
  it.effect("match their render exactly (run `bun run render` after changing tokens)", () =>
    Effect.gen(function* () {
      for (const asset of renderBrandAssets(beep)) {
        const onDisk = yield* readPackageFile(asset.path);
        expect(onDisk, asset.path).toBe(asset.content);
      }
    }).pipe(withBunServices)
  );

  it.effect("bridge.css only references custom properties that brand.css declares", () =>
    Effect.gen(function* () {
      const bridge = yield* readPackageFile("styles/bridge.css");
      const declared = HashSet.fromIterable(
        A.map(A.fromIterable(renderThemeCss(beep).matchAll(/^\s+(--[\w-]+):/gm)), (match) => match[1])
      );
      const referenced = A.map(A.fromIterable(bridge.matchAll(/var\((--[\w-]+)\)/g)), (match) => match[1]);

      expect(A.length(referenced)).toBeGreaterThan(0);
      for (const name of referenced) {
        expect(HashSet.has(declared, name), name).toBe(true);
      }
    }).pipe(withBunServices)
  );

  it("renders the favicon on a brand-900 ground with the mark scaled to 32 units", () => {
    const favicon = A.findFirst(renderBrandAssets(beep), (asset) => asset.path === "assets/favicon.svg");
    const content = O.map(favicon, (asset) => asset.content);

    expect(O.getOrElse(content, () => "")).toContain(
      `<rect width="32" height="32" rx="6" fill="${beep.dark.brand["900"]}"/>`
    );
    expect(O.getOrElse(content, () => "")).toContain('<g transform="scale(1.3333)">');
  });
});
