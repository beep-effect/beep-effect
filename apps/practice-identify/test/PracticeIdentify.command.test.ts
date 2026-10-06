import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";
import { makePracticeIdentifyCommand } from "@/PracticeIdentify.command";
import { IdentificationStages, IdentificationStagesShape } from "@/PracticeIdentify.config";

const fixture = () => {
  const calls: Array<{ stage: string; input: unknown }> = [];
  const stage = (name: string) => (input: unknown) =>
    Effect.sync(() => {
      calls.push({ stage: name, input });
      return 2;
    });
  const live = Layer.succeed(
    IdentificationStages,
    IdentificationStagesShape.make({
      contacts: stage("contacts"),
      index: stage("index"),
      uspto: stage("uspto"),
      resolve: stage("resolve"),
      evaluate: stage("evaluate"),
    })
  );
  const command = Command.runWith(makePracticeIdentifyCommand(live), { version: "0.0.0" });
  return {
    calls,
    run: (args: ReadonlyArray<string>) => command(args),
  };
};
const cases = [
  [
    "contacts",
    "--csv",
    "/private/cards.csv",
    "--vcard",
    "/private/cards.vcf",
    "--output",
    "/private/contacts.jsonl",
    "--projection",
    "/private/projection.jsonl",
  ],
  [
    "index",
    "--input",
    "/private/evidence.jsonl",
    "--contacts",
    "/private/contacts.jsonl",
    "--output",
    "/private/index.json",
  ],
  [
    "uspto",
    "--input",
    "/private/queries.jsonl",
    "--output",
    "/private/uspto.jsonl",
    "--ledger",
    "/private/queries-ledger.jsonl",
  ],
  [
    "resolve",
    "--input",
    "/private/docs.jsonl",
    "--context",
    "/private/context.json",
    "--training",
    "/private/train.jsonl",
    "--batches",
    "/private/batches.json",
    "--uspto",
    "/private/uspto.jsonl",
    "--output",
    "/private/plan.jsonl",
  ],
  [
    "evaluate",
    "--input",
    "/private/truth.jsonl",
    "--context",
    "/private/context.json",
    "--output",
    "/private/report.json",
  ],
];
it.layer(NodeServices.layer)("practice-identify command wiring", (it) => {
  it.effect.each(cases)("routes %s with explicit private flags", (args) =>
    Effect.gen(function* () {
      const f = fixture();
      yield* f.run(args);
      expect(f.calls).toHaveLength(1);
      expect(f.calls[0]?.stage).toBe(args[0]);
      expect(f.calls[0]?.input).toHaveProperty("output");
    })
  );
  it.effect.each(["contacts", "index", "uspto", "resolve", "evaluate"])(
    "refuses %s without required paths before a stage runs",
    (stage) =>
      Effect.gen(function* () {
        const f = fixture();
        const exit = yield* Effect.exit(f.run([stage]));
        expect(exit._tag).toBe("Failure");
        expect(f.calls).toEqual([]);
      })
  );
  it.effect("defaults the evaluation split salt and accepts an explicit one", () =>
    Effect.gen(function* () {
      const f = fixture();
      const base = [
        "evaluate",
        "--input",
        "/private/truth.jsonl",
        "--context",
        "/private/c.json",
        "--output",
        "/private/r.json",
      ];
      yield* f.run(base);
      yield* f.run([...base, "--split-salt", "pass3"]);
      expect(f.calls.map((c) => c.input)).toMatchObject([{ splitSalt: "holdout" }, { splitSalt: "pass3" }]);
    })
  );
  it.effect("rejects unknown commands", () =>
    Effect.gen(function* () {
      const f = fixture();
      const exit = yield* Effect.exit(f.run(["publish"]));
      expect(exit._tag).toBe("Failure");
      expect(f.calls).toEqual([]);
    })
  );
});
