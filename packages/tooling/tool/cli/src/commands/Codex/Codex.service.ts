/**
 * Instrumented `codex exec` process lifecycle and semantic-witness projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  ActivePhase,
  agentEvidenceRoot,
  aiMetricsStateHome,
  FlightSemanticWitnessInput,
  hashPublicTextSha256,
  LifecycleState,
  makeFlightSemanticWitness,
  TerminalOutcome,
  writeFlightSemanticWitness,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Crypto, Effect, FileSystem, flow, Path, Stream } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { getJsonSchemaFromSchema } from "effect/unstable/ai/Tool";
import { ChildProcess } from "effect/unstable/process";
import { printLines } from "../../internal/cli/Printer.ts";
import { CodexCommandError } from "./Codex.errors.ts";
import type { FlightSemanticWitnessReceipt } from "@beep/repo-ai-metrics";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Codex/Codex.service");

const CodexFlightOutput = S.Struct({
  message: S.String,
  lifecycleState: LifecycleState,
  activePhase: ActivePhase,
  selfReportedTerminalOutcome: TerminalOutcome,
}).pipe(
  $I.annoteSchema("CodexFlightOutput", {
    description: "Ephemeral user-facing response plus bounded first-person flight labels from Codex.",
  })
);
const decodeCodexFlightOutputJson = S.decodeUnknownEffect(S.fromJsonString(CodexFlightOutput));

const defaultInitiativeSummary =
  "Infer the initiative being closed from the current branch, git status, and changed surface.";

const qualityReviewPrompt = (initiativeSummary: string): string => `Use $quality-review-fix-loop.

Initiative summary:
${initiativeSummary}

Start by inspecting the current git state and changed surface. Follow the
repo-local skill exactly. Do not push, open a PR, reply to GitHub review
threads, or publish anything unless the user explicitly requested that in the
initiative summary.
`;

const semanticOutputInstruction = `

Your final response is collected by an instrumented wrapper. Put the complete
user-facing answer in the message field. Set lifecycleState, activePhase, and
selfReportedTerminalOutcome to your bounded first-person assessment of this
invocation. Do not put timestamps, durations, event counts, tool counts, paths,
commands, prompts, tool arguments, or tool results in those three label fields.
`;

const encodeUnknownJson = UnknownFromJsonString.encodeUnknownSync;

const nonBlankOption = (value: O.Option<string>): O.Option<string> => O.filter(value, flow(Str.trim, Str.isNonEmpty));

const readOptionalConfig = (key: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.string(key)).pipe(Effect.orElseSucceed(O.none<string>));

const resolveAgentEvidenceRoot = Effect.fn("Codex.resolveAgentEvidenceRoot")(function* () {
  const path = yield* Path.Path;
  const configuredRoot = nonBlankOption(yield* readOptionalConfig("BEEP_AGENT_EVIDENCE_ROOT"));
  const homeDir = nonBlankOption(yield* readOptionalConfig("HOME"));
  const stateHome = aiMetricsStateHome({
    homeDir,
    stateHome: nonBlankOption(yield* readOptionalConfig("XDG_STATE_HOME")),
  });
  const resolved = O.match(configuredRoot, {
    onNone: () => O.map(stateHome, agentEvidenceRoot),
    onSome: O.some,
  });

  if (O.isNone(resolved)) {
    return yield* CodexCommandError.make({
      message:
        "Unable to resolve the shared agent-evidence root from BEEP_AGENT_EVIDENCE_ROOT, XDG_STATE_HOME, or HOME.",
    });
  }
  if (!path.isAbsolute(resolved.value)) {
    return yield* CodexCommandError.make({
      cause: resolved.value,
      message: "The shared agent-evidence root must be absolute.",
    });
  }
  return resolved.value;
});

const structuredOutputSchema = Effect.try({
  try: () => getJsonSchemaFromSchema(CodexFlightOutput),
  catch: CodexCommandError.new("Failed to generate the Codex flight output schema."),
});

const invocationDigest = Effect.fn("Codex.invocationDigest")(function* () {
  const crypto = yield* Crypto.Crypto;
  const randomId = yield* crypto.randomUUIDv4.pipe(
    Effect.mapError(CodexCommandError.new("Failed to generate a Codex flight invocation id."))
  );
  return yield* hashPublicTextSha256(`codex-flight-invocation\u0000${randomId}`).pipe(
    Effect.mapError(CodexCommandError.new("Failed to hash the Codex flight invocation id."))
  );
});

/**
 * Run one Codex prompt through the instrumented structured-output wrapper.
 *
 * **Details**
 *
 * The wrapper computes objective and invocation digests outside the model,
 * passes them to the hook process for exact `SessionStart` correlation, and
 * constrains the final response with a generated JSON Schema. The unbounded
 * `message` is read from a scoped temporary file, printed, and deleted. Only a
 * `FlightSemanticWitness` containing the digests and bounded labels is written
 * to the shared evidence root.
 *
 * **Example** (Prepare an instrumented invocation)
 *
 * ```ts
 * import { runCodexExecPrompt } from "@beep/repo-cli/commands/Codex"
 *
 * console.log(typeof runCodexExecPrompt("Inspect the checkout.")) // "object"
 * ```
 *
 * @param prompt - Complete prompt passed to `codex exec` through stdin.
 * @returns The content-free receipt for the durable semantic witness.
 * @throws {@link CodexCommandError} when setup, execution, output decoding, or witness persistence fails.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodexExecPrompt = Effect.fn("Codex.runCodexExecPrompt")(function* (
  prompt: string
): Effect.fn.Return<
  FlightSemanticWitnessReceipt,
  CodexCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(CodexCommandError.mapError("Failed to locate repository root."));
  const evidenceRoot = yield* resolveAgentEvidenceRoot();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const invocationId = yield* invocationDigest();
  const objectiveRef = yield* hashPublicTextSha256(prompt).pipe(
    Effect.mapError(CodexCommandError.new("Failed to hash the Codex objective."))
  );

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const temporaryRoot = yield* fs
        .makeTempDirectoryScoped({ prefix: "beep-codex-flight-" })
        .pipe(CodexCommandError.mapError("Failed to prepare scoped Codex flight output."));
      const schemaPath = path.join(temporaryRoot, "output-schema.json");
      const outputPath = path.join(temporaryRoot, "last-message.json");
      const schema = yield* structuredOutputSchema;
      yield* fs
        .writeFileString(schemaPath, `${encodeUnknownJson(schema)}\n`)
        .pipe(CodexCommandError.mapError("Failed to write the scoped Codex output schema."));

      const handle = yield* ChildProcess.make(
        "codex",
        ["exec", "--cd", repoRoot, "--output-schema", schemaPath, "--output-last-message", outputPath, "-"],
        {
          cwd: repoRoot,
          extendEnv: true,
          env: {
            BEEP_FLIGHT_INVOCATION_ID: invocationId,
            BEEP_FLIGHT_OBJECTIVE_REF: objectiveRef,
          },
          stdin: Stream.encodeText(Stream.make(`${prompt}${semanticOutputInstruction}`)),
          stdout: "ignore",
          stderr: "inherit",
        }
      ).pipe(CodexCommandError.mapError("Failed to spawn instrumented codex exec."));
      const exitCode = yield* handle.exitCode.pipe(
        CodexCommandError.mapError("Failed while waiting for instrumented codex exec.")
      );
      if (exitCode !== 0) {
        return yield* CodexCommandError.make({
          message: `Instrumented codex exec failed with exit code ${exitCode}.`,
          exitCode,
        });
      }

      const output = yield* fs
        .readFileString(outputPath)
        .pipe(
          CodexCommandError.mapError("Failed to read the scoped Codex response."),
          Effect.flatMap(decodeCodexFlightOutputJson),
          Effect.mapError(CodexCommandError.new("Codex returned an invalid structured flight response."))
        );
      const witness = makeFlightSemanticWitness(
        FlightSemanticWitnessInput.make({
          invocationId,
          objectiveRef,
          sourceKind: "codex",
          lifecycleState: output.lifecycleState,
          activePhase: output.activePhase,
          selfReportedTerminalOutcome: output.selfReportedTerminalOutcome,
        })
      );
      const receipt = yield* writeFlightSemanticWitness(evidenceRoot, witness).pipe(
        Effect.mapError(CodexCommandError.new("Failed to persist the Codex semantic witness."))
      );
      yield* printLines([output.message]);
      return receipt;
    })
  );
});

/**
 * Run arbitrary prompt words through the instrumented Codex wrapper.
 *
 * @param promptParts - Prompt words supplied after `beep codex exec`.
 * @returns The content-free semantic-witness receipt.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodexExec = (promptParts: ReadonlyArray<string>) =>
  A.isReadonlyArrayEmpty(promptParts)
    ? Effect.fail(CodexCommandError.make({ message: "codex exec requires a non-empty prompt." }))
    : runCodexExecPrompt(A.join(promptParts, " "));

/**
 * Launch Codex with the repo-local quality review fix loop prompt.
 *
 * **Example** (Closing the current initiative)
 *
 * ```ts
 * import { runCodexQualityReviewFixLoop } from "@beep/repo-cli/commands/Codex"
 *
 * const program = runCodexQualityReviewFixLoop(["close", "current", "initiative"])
 * console.log(typeof program) // "object"
 * ```
 *
 * @param summaryParts - Optional initiative summary words.
 * @returns Effect that runs the instrumented `codex exec` wrapper.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodexQualityReviewFixLoop = (summaryParts: ReadonlyArray<string>) => {
  const initiativeSummary = A.isReadonlyArrayEmpty(summaryParts) ? defaultInitiativeSummary : A.join(summaryParts, " ");
  return runCodexExecPrompt(qualityReviewPrompt(initiativeSummary)).pipe(Effect.asVoid);
};
