import { beep, renderBrandAssets, renderThemeCss } from "@beep/brand";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { Effect, FileSystem, HashSet, Path } from "effect";
import * as O from "effect/Option";

const packageRoot = new URL("../", import.meta.url).pathname;

const readPackageFile = Effect.fn("readPackageFile")(function* (relative: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(packageRoot, relative));
});

it.layer(BunServices.layer, { timeout: "5 seconds" })("generated assets", (it) => {
  it.effect("match their render exactly (run `bun run render` after changing tokens)", () =>
    Effect.gen(function* () {
      const assets = renderBrandAssets(beep);
      expect(A.map(assets, (asset) => asset.path)).toStrictEqual([
        "styles/brand.css",
        "assets/mark.svg",
        "assets/favicon.svg",
        "assets/wordmark.svg",
        "assets/wordmark-light.svg",
      ]);
      for (const asset of assets) {
        const onDisk = yield* readPackageFile(asset.path);
        expect(onDisk, asset.path).toBe(asset.content);
      }
    })
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
    })
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
