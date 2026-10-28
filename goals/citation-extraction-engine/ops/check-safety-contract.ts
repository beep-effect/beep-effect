/** Verify the frozen policy and process-stop controls without live subprocesses. */
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineEffectivePolicy,
  CitationEngineLimits,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const PolicyProof = S.Struct({
  schemaVersion: S.Literal("citation-policy-contract-proof/v1"),
  durationEncoding: S.Literal("whole-milliseconds"),
  schemaSourceSha256: S.String,
  fixtureSourceSha256: S.String,
  absoluteCeilings: CitationEngineLimits,
  defaultPolicy: CitationEngineEffectivePolicy,
});
const Run = S.Struct({
  runtimeKind: S.Literals(["node", "bun"]),
  runtime: S.NonEmptyString,
  bunVersion: S.NullOr(S.String),
  repetition: S.Natural,
  control: S.Literals(["safe-linear", "catastrophic-backtracking"]),
  inputUtf16: S.Natural,
  deadlineMillis: S.Literal(100),
  outcome: S.Literals(["result", "deadline"]),
  matched: S.NullOr(S.Boolean),
  heartbeats: S.Natural,
  observedWindowMillis: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  exitConfirmed: S.Literal(true),
  exitSignal: S.NullOr(S.String),
  exitCode: S.NullOr(S.Number),
});
const Probe = S.Struct({
  schemaVersion: S.Literal("citation-regex-process-isolation-probe/v1"),
  scope: S.Literal("Kill/cleanup mechanism controls only; not pattern compatibility or geometric scaling proof."),
  parentRuntime: S.NonEmptyString,
  parentBunVersion: S.NonEmptyString,
  platform: S.NonEmptyString,
  architecture: S.NonEmptyString,
  cpuModel: S.NonEmptyString,
  warmups: S.Literal(0),
  repetitions: S.Literal(3),
  parentSourceSha256: S.String,
  childSourceSha256: S.String,
  results: S.Array(Run),
});
const sha = (value: Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const reject = () => Effect.fail(new Error("Citation safety contract has stale or inconsistent evidence."));
const read = (name: string) =>
  Effect.tryPromise(() =>
    Bun.file(
      process.argv[2] ? `${process.argv[2]}/${name}` : new URL(`../history/evidence/${name}`, import.meta.url)
    ).text()
  );
const program = Effect.gen(function* () {
  const policy = yield* read("citation-policy-contract.json").pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(PolicyProof)))
  );
  const probe = yield* read("regex-process-isolation-probe.json").pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Probe)))
  );
  for (const [path, expected] of [
    ["../../../packages/law-practice/use-cases/src/CitationEngine/CitationEngine.limits.ts", policy.schemaSourceSha256],
    [
      "../../../packages/law-practice/use-cases/src/internal/citationEnginePolicyFixture.ts",
      policy.fixtureSourceSha256,
    ],
    ["./probe-regex-isolation.mjs", probe.parentSourceSha256],
    ["./regex-isolation-probe.child.mjs", probe.childSourceSha256],
  ]) {
    const bytes = yield* Effect.tryPromise(() => Bun.file(new URL(path, import.meta.url)).bytes());
    if (sha(bytes) !== expected) return yield* reject();
  }
  const maxima = R.fromEntries(
    A.map(
      R.toEntries(CitationEngineAbsoluteMaxima),
      ([key, value]) => [Str.replace(/Millis$/, "")(key), value] as const
    )
  );
  const decodedMaxima = yield* S.decodeUnknownEffect(CitationEngineLimits)(maxima);
  const currentDefault = yield* defaultCitationEnginePolicy;
  if (
    !S.toEquivalence(S.toType(CitationEngineLimits))(decodedMaxima, policy.absoluteCeilings) ||
    !S.toEquivalence(S.toType(CitationEngineEffectivePolicy))(currentDefault, policy.defaultPolicy)
  )
    return yield* reject();
  const ids = A.map(probe.results, (row) => `${row.runtimeKind}::${row.control}::${row.repetition}`);
  if (ids.length !== 12 || A.dedupe(ids).length !== 12) return yield* reject();
  for (const row of probe.results) {
    if (row.exitSignal === null ? row.exitCode !== 0 : row.exitSignal !== "SIGKILL" || row.exitCode !== null)
      return yield* reject();
    if (row.repetition < 1 || row.repetition > 3) return yield* reject();
    if (row.runtimeKind === "node" ? row.runtime !== "v24.22.1" || row.bunVersion !== null : row.bunVersion !== "1.4.4")
      return yield* reject();
    if (
      row.control === "catastrophic-backtracking"
        ? row.outcome !== "deadline" ||
          row.matched !== null ||
          row.exitCode !== null ||
          row.exitSignal !== "SIGKILL" ||
          row.heartbeats < 1 ||
          row.inputUtf16 !== 41
        : row.outcome !== "result" || row.matched !== true || row.inputUtf16 !== 4096
    )
      return yield* reject();
  }
  yield* Console.log(
    "Citation safety contract valid: 29 bounded fields, explicit fixture and 12 confirmed process isolation controls; family-level regex proof remains open."
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catchCause(() =>
      Console.error("Citation safety contract validation failed.").pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    )
  )
);
