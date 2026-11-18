import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { ghOutput } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { GhCommandFailure } from "@beep/repo-cli/test/SharedInternals";

// gh 2.105.0 prints this advice on stderr after a clean `gh pr view` whenever
// `AI_AGENT` or `CLAUDECODE` is set; stdout still carries only the JSON.
const AGENT_HINT =
  "hint: if you need to wait for this pull request to be reviewed, merged, or closed before continuing, use this instead of polling:\n    gh event listen --resource https://github.com/o/r/pull/7\n";
const PR_VIEW_JSON = '{"number":7,"headRefName":"feat/x","state":"OPEN"}';

const PrView = S.Struct({ number: S.Finite, headRefName: S.String, state: S.String });
const decodePrView = S.decodeUnknownEffect(S.fromJsonString(PrView));

const keepFailure = (failure: GhCommandFailure) => failure;

const prView = (spawner: ScriptedSpawner) =>
  ghOutput({ args: ["pr", "view", "--json", "number"], cwd: ".", label: "gh pr view", onFailure: keepFailure }).pipe(
    provideSpawner(spawner)
  );

describe("ghOutput stream separation", () => {
  it.layer(SecureRandom.layerWebCrypto, { timeout: "30 seconds" })((it) => {
    it.effect("hands the parser stdout alone when gh writes advice to stderr on a clean exit", () =>
      Effect.gen(function* () {
        const spawner = ScriptedSpawner.make(() => ({ stdout: PR_VIEW_JSON, stderr: AGENT_HINT, exit: 0 }));
        const output = yield* prView(spawner);
        expect(output).toBe(PR_VIEW_JSON);
        const view = yield* decodePrView(output);
        expect(view.number).toBe(7);
      })
    );

    it.effect("still reports gh's stderr error text, after any stdout, when gh exits nonzero", () =>
      Effect.gen(function* () {
        const errorOnly = yield* Effect.flip(
          prView(ScriptedSpawner.make(() => ({ stderr: 'no pull requests found for branch "feat/x"\n', exit: 1 })))
        );
        expect(errorOnly).toStrictEqual({
          _tag: "nonzero-exit",
          label: "gh pr view",
          command: "gh pr view --json number",
          exitCode: 1,
          output: 'no pull requests found for branch "feat/x"',
        });
        const both = yield* Effect.flip(
          prView(
            ScriptedSpawner.make(() => ({
              stdout: '{"message":"Not Found"}',
              stderr: "gh: Not Found (HTTP 404)",
              exit: 1,
            }))
          )
        );
        expect(both._tag === "nonzero-exit" ? both.output : "").toBe(
          '{"message":"Not Found"}\ngh: Not Found (HTTP 404)'
        );
      })
    );
  });
});
