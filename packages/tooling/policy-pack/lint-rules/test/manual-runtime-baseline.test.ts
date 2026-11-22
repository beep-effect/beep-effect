/**
 * Staleness guard for the `no-manual-effect-runtime-in-tests` legacy baseline.
 *
 * Every row must name an existing repo file whose live manual-runner count equals the row's
 * count. A row above the live count would silently admit new violations in that file, so the
 * baseline has to shrink in the same change that migrates a file. Each file is linted under
 * its bare basename in a temp dir, where no baseline row matches, so every runner reports.
 */

import * as NodeURL from "node:url";
import { MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE } from "@beep/lint-rules/oxlint";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import { runOxlintRule } from "./oxlint-harness.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));

describe("no-manual-effect-runtime-in-tests legacy baseline", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })((it) =>
    it.effect("matches each listed file's live violation count", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        for (const [repoPath, count] of MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE) {
          const absolutePath = path.join(repoRoot, repoPath);
          const exists = yield* fs.exists(absolutePath);
          expect(exists, `${repoPath} is listed but missing`).toBe(true);
          const source = yield* fs.readFileString(absolutePath);
          const findings = yield* runOxlintRule("no-manual-effect-runtime-in-tests", source, path.basename(repoPath));
          expect(findings.length, `${repoPath} live count`).toBe(count);
        }
        expect(HashMap.size(MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE)).toBeGreaterThan(0);
      })
    )
  );
});
