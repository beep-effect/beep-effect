import { CacheLocalPilotSummary } from "@beep/repo-cli/commands/Cache";
import { CacheRuntimeProcess } from "@beep/repo-cli/test/Cache";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const LocalPilotSummaryJson = S.fromJsonString(CacheLocalPilotSummary);
const decodeSummary = S.decodeEffect(LocalPilotSummaryJson);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "hosted local observation adapters",
  (it) => {
    it.effect("preserves preparation, publication safety and owned cleanup through tiny fixtures", () =>
      Effect.gen(function* () {
        const root = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporaryDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "cache-local-summary-contract-" });
        const directory = yield* fs.realPath(temporaryDirectory);
        const contract = path.join(directory, "summary.json");
        const result = yield* CacheRuntimeProcess.runCaptured({
          command: "/usr/bin/python3",
          args: ["-I", "-S", "-B", `${root}/scripts/ci-cache-local-summary.test.py`],
          cwd: root,
          extendEnv: false,
          env: {
            PATH: "/usr/bin",
            PYTHONDONTWRITEBYTECODE: "1",
            BEEP_CACHE_SUMMARY_CONTRACT_OUTPUT: contract,
          },
          source: "merge",
          timeout: Duration.seconds(20),
        });
        expect(result.exitCode, result.output).toBe(0);
        const encoded = yield* fs.readFileString(contract);
        const decoded = yield* decodeSummary(encoded);
        expect(decoded.qualificationGranted).toBe(false);
        expect(decoded.authority).toBe("local-observation-only");
      })
    );
  }
);
