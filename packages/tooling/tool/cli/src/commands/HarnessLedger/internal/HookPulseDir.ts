/**
 * The hook-pulse ledger directory `harness-ledger prune-proposals` reads when
 * no `--state-dir` is passed.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { agentEvidenceRoot, aiMetricsStateHome, hookPulseLedgerDir } from "@beep/repo-ai-metrics";
import { AiMetricsStateHomeInput } from "@beep/repo-ai-metrics/data-root";
import { O, Str } from "@beep/utils";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import { HarnessLedgerInputError } from "../HarnessLedger.errors.ts";

const optionalNonEmpty: (value: O.Option<string>) => O.Option<string> = flow(O.map(Str.trim), O.filter(Str.isNonEmpty));

/**
 * Resolve the hook-pulse ledger directory `prune-proposals` reads when no `--state-dir` is passed.
 *
 * **Details**
 *
 * `BEEP_AGENT_EVIDENCE_ROOT` wins when it is non-empty; otherwise the
 * directory hangs beneath `beep/agent-evidence` of `aiMetricsStateHome`
 * (`@beep/xdg` `XdgBase`, absolute values only). Fails with a
 * `HarnessLedgerInputError` naming `--state-dir` when neither resolves.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { resolveHookPulseDir } from "@beep/repo-cli/test/HarnessLedger"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveHookPulseDir)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveHookPulseDir = Effect.gen(function* () {
  const configuredRoot = optionalNonEmpty(yield* Config.option(Config.String("BEEP_AGENT_EVIDENCE_ROOT")));
  if (O.isSome(configuredRoot)) {
    return hookPulseLedgerDir(configuredRoot.value);
  }
  const stateHome = aiMetricsStateHome(
    AiMetricsStateHomeInput.make({
      homeDir: yield* Config.option(Config.String("HOME")),
      stateHome: yield* Config.option(Config.String("XDG_STATE_HOME")),
    })
  );
  return yield* O.match(stateHome, {
    onNone: () =>
      HarnessLedgerInputError.new(
        "Neither XDG_STATE_HOME nor HOME is set to an absolute path; pass --state-dir <hook-events dir>."
      ),
    onSome: (home) => Effect.succeed(hookPulseLedgerDir(agentEvidenceRoot(home))),
  });
}).pipe(
  Effect.catchTag("ConfigError", () => HarnessLedgerInputError.new("Failed to read the state-home environment."))
);
