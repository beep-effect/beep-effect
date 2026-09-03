import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

// Tailwind v4 roots content detection at the app's CSS and skips node_modules, and
// every @beep UI package reaches this app through a workspace symlink. A package that
// is not declared here has the classes it *alone* uses tree-shaken away — and nothing
// warns: ordinary utilities survive (the app uses them elsewhere too), so only the
// package's distinctive classes vanish and the component simply renders wrong. That is
// what happened to the ontology workbench: its three-column grid never generated, the
// panes collapsed into one column and painted over each other, and the graph container
// had no size for WebGL to mount into. It looked like a layout bug for as long as
// anyone cared to look.
const uiPackageSources: Record<string, string> = {
  "@beep/ui": "packages/foundation/ui-system/ui/src",
  "@beep/editor": "packages/foundation/ui-system/editor/src",
  "@beep/ontology-ui": "packages/ontology/ui/src",
  "@beep/cosmos": "packages/drivers/cosmos/src",
};

const Manifest = S.Struct({
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
});

const decodeManifest = S.decodeUnknownSync(S.fromJsonString(Manifest));

describe("tailwind source declarations", () => {
  it.effect(
    "declares an @source for every @beep UI package the app renders",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const manifest = decodeManifest(yield* fs.readFileString("package.json"));
      const globals = yield* fs.readFileString("src/styles/globals.css");

      const rendered = Object.keys(uiPackageSources).filter((name) => manifest.dependencies?.[name] !== undefined);

      // Guard the guard: were the app to stop depending on the UI packages entirely,
      // this test would otherwise pass while asserting nothing.
      expect(rendered.length).toBeGreaterThan(0);

      const undeclared = rendered.filter((name) => !globals.includes(uiPackageSources[name] ?? " "));

      expect(undeclared).toStrictEqual([]);
    }, provideScopedLayer(BunFileSystem.layer))
  );
});
