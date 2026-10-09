/**
 * Private-path document identification CLI.
 * @packageDocumentation
 * @since 0.0.0
 */

import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import {
  ContactsInput,
  EvaluateInput,
  IdentificationStages,
  IndexInput,
  ResolveInput,
  UsptoInput,
} from "./PracticeIdentify.config.ts";
import type * as Layer from "effect/Layer";

const pathFlag = (name: string) =>
  Flag.String(name).pipe(Flag.withDescription("Explicit private file path; no data location default."));
const logCount = (count: number) =>
  Effect.logInfo("identification stage finished").pipe(Effect.annotateLogs({ count }));
const contacts = Command.make(
  "contacts",
  { csv: pathFlag("csv"), vcard: pathFlag("vcard"), output: pathFlag("output"), projection: pathFlag("projection") },
  (input) => IdentificationStages.use((s) => s.contacts(ContactsInput.make(input))).pipe(Effect.flatMap(logCount))
);
const index = Command.make(
  "index",
  { input: pathFlag("input"), contacts: pathFlag("contacts"), output: pathFlag("output") },
  (input) => IdentificationStages.use((s) => s.index(IndexInput.make(input))).pipe(Effect.flatMap(logCount))
);
const uspto = Command.make(
  "uspto",
  { input: pathFlag("input"), output: pathFlag("output"), ledger: pathFlag("ledger") },
  (input) => IdentificationStages.use((s) => s.uspto(UsptoInput.make(input))).pipe(Effect.flatMap(logCount))
);
const resolve = Command.make(
  "resolve",
  {
    input: pathFlag("input"),
    context: pathFlag("context"),
    training: pathFlag("training"),
    batches: pathFlag("batches"),
    uspto: pathFlag("uspto"),
    output: pathFlag("output"),
  },
  (input) => IdentificationStages.use((s) => s.resolve(ResolveInput.make(input))).pipe(Effect.flatMap(logCount))
);
const evaluate = Command.make(
  "evaluate",
  {
    input: pathFlag("input"),
    context: pathFlag("context"),
    output: pathFlag("output"),
    splitSalt: Flag.String("split-salt").pipe(
      Flag.withDescription("Salt for the hash split; reuse a salt to reproduce an earlier hold-out."),
      Flag.withDefault("holdout")
    ),
  },
  (input) => IdentificationStages.use((s) => s.evaluate(EvaluateInput.make(input))).pipe(Effect.flatMap(logCount))
);
/**
 * Constructs all five CLI subcommands over injectable runtime stages.
 * Required paths are parsed before the selected stage runs.
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { makePracticeIdentifyCommand } from "@/PracticeIdentify.command"
 * import { IdentificationStages, IdentificationStagesShape } from "@/PracticeIdentify.config"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const stages = Layer.succeed(IdentificationStages, IdentificationStagesShape.make({ contacts: () => Effect.succeed(0), index: () => Effect.succeed(0), uspto: () => Effect.succeed(0), resolve: () => Effect.succeed(0), evaluate: () => Effect.succeed(0) }))
 * console.log(makePracticeIdentifyCommand(stages).name) // "practice-identify"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const makePracticeIdentifyCommand = <E, R>(stages: Layer.Layer<IdentificationStages, E, R>) =>
  Command.make("practice-identify").pipe(
    Command.withDescription("Resolve private documents to clients and dockets; writes plans only."),
    Command.withSubcommands([contacts, index, uspto, resolve, evaluate]),
    Command.provide(stages)
  );
