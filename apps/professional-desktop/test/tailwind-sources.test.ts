import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";

const filesystemLayerTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds";

const uiPackageSources: Record<string, string> = {
  "@beep/ui": "packages/foundation/ui-system/ui/src",
  "@beep/editor": "packages/foundation/ui-system/editor/src",
  "@beep/ontology-ui": "packages/ontology/ui/src",
  "@beep/cosmos": "packages/drivers/cosmos/src",
};

const Manifest = S.Struct({
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
});

const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(Manifest));

it.layer(BunFileSystem.layer, { timeout: filesystemLayerTimeout })("tailwind source declarations", (it) => {
  it.effect(
    "declares an @source for every @beep UI package the app renders",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const readFileString1 = yield* fs.readFileString("package.json");
      const manifest = yield* decodeManifest(readFileString1);
      const globals = yield* fs.readFileString("src/styles/globals.css");

      const rendered = A.filter(R.keys(uiPackageSources), (name) => manifest.dependencies?.[name] !== undefined);

      expect(rendered.length, "with no UI package dependency this test would pass asserting nothing").toBeGreaterThan(
        0
      );

      const undeclared = A.filter(rendered, (name) => !Str.includes(uiPackageSources[name] ?? " ")(globals));

      expect(
        undeclared,
        "Tailwind v4 skips the node_modules symlinks, so an undeclared package silently loses the classes only it uses"
      ).toStrictEqual([]);
    })
  );
});
