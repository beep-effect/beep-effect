import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AuthorityModel } from "@proto/authority-model/Authority.model";
import { PartyModel } from "@proto/party-model/Party.model";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { uncoveredOutcomes } from "../proofs/Outcomes.allow.ts";

// `bun run outcomes`: which declared outcomes (every command's accepted path and each declared
// rejection) no story or test executed, read from what the test run recorded
// (shared/tooling/vitest/outcomes.setup.ts). `--check` fails on an unlisted gap, or on a listed
// gap that is now covered.
const Row = S.Struct({ aggregate: S.String, command: S.String, outcome: S.String });
const keyOf = (row: typeof Row.Type) => `${row.aggregate}.${row.command}:${row.outcome}`;

type AnyAggregate = {
  readonly aggregateName: string;
  readonly definition: {
    readonly commands: ReadonlyArray<{ readonly tag: string; readonly rejects: ReadonlyArray<{ readonly tag: string }> }>;
  };
};

const required = A.flatMap([PartyModel, RunsModel, AuthorityModel], (model) =>
  A.flatMap(model.aggregates as unknown as ReadonlyArray<AnyAggregate>, (aggregate) =>
    A.flatMap(aggregate.definition.commands, (command) =>
      A.map(["accepted", ...A.map(command.rejects, (rejection) => rejection.tag)], (outcome) => ({
        aggregate: aggregate.aggregateName,
        command: command.tag,
        outcome,
      })),
    ),
  ),
);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* path.fromFileUrl(new URL("../node_modules/.cache/proto-outcomes/", import.meta.url));
  const files = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => []));
  const lines = yield* Effect.forEach(files, (file) => fs.readFileString(path.join(dir, file)));
  const executed = yield* Effect.forEach(
    A.filter(A.flatMap(lines, Str.split("\n")), Str.isNonEmpty),
    (line) => S.decodeUnknownEffect(S.fromJsonString(Row))(line),
  );
  const seen = HashSet.fromIterable(A.map(executed, keyOf));
  const listed = HashSet.fromIterable(A.map(uncoveredOutcomes, keyOf));
  const gaps = A.filter(required, (row) => !HashSet.has(seen, keyOf(row)));
  const unlisted = A.filter(gaps, (row) => !HashSet.has(listed, keyOf(row)));
  const stale = A.filter(uncoveredOutcomes, (row) => HashSet.has(seen, keyOf(row)));
  yield* Console.log(
    `${required.length - gaps.length} of ${required.length} declared outcomes executed; ${gaps.length} not, ${uncoveredOutcomes.length} listed.`,
  );
  for (const row of unlisted) yield* Console.log(`  unlisted gap: ${keyOf(row)}`);
  for (const row of stale) yield* Console.log(`  listed but now covered: ${keyOf(row)}`);
  if (A.contains(process.argv, "--check") && (unlisted.length > 0 || stale.length > 0)) {
    return yield* Effect.fail(new Error("outcome coverage drifted from proofs/Outcomes.allow.ts"));
  }
  if (A.isReadonlyArrayEmpty(files)) yield* Console.log("  no recorded outcomes: run `bun run test` first");
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
