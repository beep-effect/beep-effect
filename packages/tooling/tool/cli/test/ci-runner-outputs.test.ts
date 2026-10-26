// Parity for the runner-file writes that moved from repo-cli's own appends to
// `@beep/github-actions` (W5, reuse-ledger #87, #93, #271, #312): the
// `::warning::` line `ci runner-resources` prints, the `GITHUB_ENV` heredoc
// blocks `ci job-env` writes, and the `CiRunnerOutputsLive` seeding that lets
// a `ConfigProvider` name the runner files. The runner files live on an
// in-memory volume: what is under test is what lands in them.
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { WorkflowCommand } from "@beep/github-commands/WorkflowCommand";
import { MemoryFileSystem } from "@beep/memfs";
import { CiRunnerOutputsLive } from "@beep/repo-cli/commands/Ci";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { parseRunnerFile } from "./support/runnerFile.ts";

/**
 * The `GITHUB_ENV` block `ci job-env` rendered before the move, with the
 * random `beep_ci_env_<uuid>` delimiter fixed to one the values avoid.
 */
const legacyEnvironmentBlock = (name: string, value: string): string =>
  `${name}<<beep_ci_env_fixed\n${value}\nbeep_ci_env_fixed\n`;

const ENVIRONMENT: ReadonlyArray<readonly [string, string]> = [
  ["TURBO_API", "https://cache.example.test"],
  ["TURBO_TOKEN", "write-token"],
  ["TURBO_CACHE", "local:rw,remote:rw"],
  ["AUTH_SECRET", "auth-secret\nwith newline"],
  ["BETTER_AUTH_URL", ""],
  ["DATABASE_URL", "postgres://push-only\n"],
  // A value naming either delimiter family cannot close its own block.
  ["ADVERSARIAL", "EFFECTED_EOF\nbeep_ci_env_fixed_not\nEFFECTED_EOF_"],
];

const GITHUB_ENV = "/runner/github-env";
const GITHUB_OUTPUT = "/runner/github-output";
const GITHUB_STEP_SUMMARY = "/runner/step-summary";

const jobEnvOutputs = ActionOutputs.layer.pipe(
  Layer.provide(ActionEnvironment.layerTest({ GITHUB_ENV })),
  Layer.provideMerge(MemoryFileSystem.layer)
);

const configured = (env: Readonly<Record<string, string>>) =>
  CiRunnerOutputsLive.pipe(
    Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(env))))
  );

describe("ci runner outputs", () => {
  it("prints the runner-resources warning with the bytes it printed before", () => {
    expect(WorkflowCommand.warning("Runner resource measurement unavailable; lane exit status is preserved.")).toBe(
      "::warning::Runner resource measurement unavailable; lane exit status is preserved."
    );
  });

  it.layer(jobEnvOutputs, { timeout: "30 seconds" })((it) => {
    it.effect("writes GITHUB_ENV entries the runner reads exactly as it read the old blocks", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const outputs = yield* ActionOutputs;
        yield* fs.makeDirectory("/runner", { recursive: true });
        yield* Effect.forEach(ENVIRONMENT, ([name, value]) => outputs.exportVariable(name, value), { discard: true });
        const written = parseRunnerFile(yield* fs.readFileString(GITHUB_ENV));
        expect(written).toEqual(ENVIRONMENT);
        expect(written).toEqual(
          parseRunnerFile(
            A.join(
              A.map(ENVIRONMENT, ([name, value]) => legacyEnvironmentBlock(name, value)),
              ""
            )
          )
        );
      })
    );
  });

  it.layer(configured({ GITHUB_OUTPUT, GITHUB_STEP_SUMMARY, GITHUB_ENV: "" }), { timeout: "30 seconds" })((it) => {
    it.effect("resolves the runner files from the current ConfigProvider, and an empty one is absent", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const outputs = yield* ActionOutputs;
        yield* fs.makeDirectory("/runner", { recursive: true });
        yield* fs.writeFileString(GITHUB_OUTPUT, "prior=1\n");
        yield* outputs.set("verdict", "run");
        yield* outputs.summary("## Summary\n");
        expect(parseRunnerFile(yield* fs.readFileString(GITHUB_OUTPUT))).toEqual([
          ["prior", "1"],
          ["verdict", "run"],
        ]);
        expect(yield* fs.readFileString(GITHUB_STEP_SUMMARY)).toBe("## Summary\n");
        // An empty runner variable is absent: the write fails typed instead of
        // appending to a file named "".
        const missing = yield* Effect.flip(outputs.exportVariable("A", "1"));
        expect(missing._tag).toBe("RunnerFileUnavailableError");
      })
    );
  });
});
