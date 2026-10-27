import {
  enforceReviewerGate,
  releaseReviewerRuleset,
  requireReviewerRuleset,
  reviewerCommand,
} from "@beep/repo-cli/commands/Reviewer";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";

const ROOT = "repos/beep-effect/beep-effect";
const LIST_ARGS = `api ${ROOT}/rulesets?includes_parents=true&per_page=100 --paginate --slurp`;
const encoder = new TextEncoder();
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeObject = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.Unknown)));
const runReviewer = Command.runWith(reviewerCommand, { version: "0.0.0" });
// Ruleset subcommands talk to GitHub only through gh; no filesystem, HTTP, or terminal input is used.
const CommandLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("unused: ruleset commands only call gh"))
  ),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  )
);

const ruleset = (id: number, withReviewer = true) => ({
  id,
  name: "main protection",
  target: "branch",
  source_type: "Repository",
  source: "beep-effect/beep-effect",
  enforcement: "active",
  bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    { type: "deletion" },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: A.appendAll(
          [{ context: "Heavy / Check", integration_id: 15368 }],
          withReviewer ? [{ context: "beep-reviewer", integration_id: 42 }] : []
        ),
      },
    },
  ],
});

const defaults = {
  login: "kriegcloud\n",
  branchRules: [
    { type: "deletion", ruleset_id: 11 },
    { type: "required_status_checks", ruleset_id: 11, parameters: {} },
  ] as ReadonlyArray<unknown>,
  summaries: [
    [
      { id: 11, source_type: "Repository", enforcement: "active" },
      { id: 3, source_type: "Organization", enforcement: "active" },
      { id: 4, source_type: "Repository", enforcement: "disabled" },
    ],
  ] as ReadonlyArray<ReadonlyArray<unknown>>,
  rulesets: [[11, [ruleset(11)]]] as ReadonlyArray<readonly [number, ReadonlyArray<unknown>]>,
};
type GhFixture = typeof defaults;

const twoRulesets: GhFixture = {
  ...defaults,
  branchRules: [
    { type: "required_status_checks", ruleset_id: 11, parameters: {} },
    { type: "required_status_checks", ruleset_id: 12, parameters: {} },
  ],
  summaries: [
    [{ id: 11, source_type: "Repository", enforcement: "active" }],
    [{ id: 12, source_type: "Repository", enforcement: "active" }],
  ],
  rulesets: [
    [11, [ruleset(11)]],
    [12, [ruleset(12)]],
  ],
};

class GhCall extends S.Class<GhCall, { readonly brand: unique symbol }>("GhCall")({
  args: S.String,
  stdin: S.Option(S.String),
}) {}

const handle = (output: string, exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const readStdin = (input: ChildProcess.CommandOptions["stdin"]) =>
  input === undefined || P.isString(input) || "stream" in input
    ? Effect.succeed(O.none<string>())
    : input.pipe(Stream.decodeText, Stream.mkString, Effect.asSome);

// Answers each gh invocation from canned JSON keyed on its argv; unknown requests exit 1 like a failed gh call.
const respond = Effect.fnUntraced(function* (fixture: GhFixture, args: string, priorCalls: ReadonlyArray<GhCall>) {
  if (args === `api ${ROOT}/pulls/7`)
    return O.some(
      yield* encodeJson({
        head: { sha: Str.repeat(40)("a") },
        base: { sha: Str.repeat(40)("b"), ref: "main" },
      })
    );
  if (args === "api user --jq .login") return O.some(fixture.login);
  if (args === `api ${ROOT}`) return O.some(yield* encodeJson({ default_branch: "main" }));
  if (args === `api ${ROOT}/rules/branches/main`) return O.some(yield* encodeJson(fixture.branchRules));
  if (args === LIST_ARGS) return O.some(yield* encodeJson(fixture.summaries));
  if (Str.startsWith("api --method PUT ")(args)) return O.some("{}");
  const reads = A.findFirst(fixture.rulesets, ([id]) => args === `api ${ROOT}/rulesets/${id}`);
  if (O.isNone(reads)) return O.none<string>();
  const nth = A.length(A.filter(priorCalls, (call) => call.args === args));
  const read = A.get(reads.value[1], nth).pipe(O.orElse(() => A.last(reads.value[1])));
  return O.isSome(read) ? O.some(yield* encodeJson(read.value)) : O.none<string>();
});

const fakeGh = Effect.fnUntraced(function* (fixture: GhFixture) {
  const calls = yield* Ref.make<ReadonlyArray<GhCall>>([]);
  const spawner = ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      if (!ChildProcess.isStandardCommand(command) || command.command !== "gh")
        return yield* Effect.die("the reviewer ruleset workflow only spawns gh");
      const args = A.join(command.args, " ");
      const stdin = yield* readStdin(command.options.stdin).pipe(Effect.orDie);
      const priorCalls = yield* Ref.get(calls);
      yield* Ref.update(calls, A.append(GhCall.make({ args, stdin })));
      const output = yield* respond(fixture, args, priorCalls).pipe(Effect.orDie);
      return O.match(output, { onNone: () => handle("", 1), onSome: (text) => handle(text, 0) });
    })
  );
  return { calls, spawner } as const;
});

// Runs a program against the fake gh and a test console, returning its exit, recorded calls, and log lines.
const withFakeGh = Effect.fnUntraced(function* <A, E, R>(fixture: GhFixture, program: Effect.Effect<A, E, R>) {
  const gh = yield* fakeGh(fixture);
  const exit = yield* program.pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, gh.spawner),
    Effect.flatMap((value) => TestConsole.logLines.pipe(Effect.map((lines) => ({ value, lines })))),
    Effect.provideServiceEffect(Console.Console, TestConsole.make),
    Effect.exit
  );
  return { exit, calls: yield* Ref.get(gh.calls) };
});

const putCalls = (calls: ReadonlyArray<GhCall>) =>
  A.filter(calls, (call) => Str.startsWith("api --method PUT ")(call.args));

const failureMessage = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, { onFailure: flow(Cause.pretty, O.some), onSuccess: () => O.none<string>() });

// The PUT body carries only writable fields; read-only identity fields are dropped.
const writable = ({ id: _id, source: _source, source_type: _sourceType, ...fields }: ReturnType<typeof ruleset>) =>
  fields;

describe("reviewer ruleset workflow", () => {
  it.effect("the merge gate stops requiring a reviewer after release", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        {
          ...defaults,
          branchRules: [
            { type: "deletion" },
            {
              type: "required_status_checks",
              parameters: { required_status_checks: [{ context: "Heavy / Check", integration_id: 15368 }] },
            },
          ],
        },
        enforceReviewerGate(7, Str.repeat(40)("a"))
      );
      yield* result.exit;
      expect(A.map(result.calls, (call) => call.args)).toEqual([
        `api ${ROOT}/pulls/7`,
        `api ${ROOT}/rules/branches/main`,
      ]);
    })
  );

  it.effect("a moved PR head holds the merge gate before reading branch rules", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(defaults, enforceReviewerGate(7, Str.repeat(40)("c")));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("Reviewer merge gate held");
      expect(A.map(result.calls, (call) => call.args)).toEqual([`api ${ROOT}/pulls/7`]);
    })
  );

  it.effect("dry run prints the release diff and never writes", () =>
    Effect.gen(function* () {
      const { calls, exit } = yield* withFakeGh(defaults, releaseReviewerRuleset(false, undefined));
      const { lines } = yield* exit;
      expect(A.map(calls, (call) => call.args)).toEqual([
        "api user --jq .login",
        `api ${ROOT}`,
        `api ${ROOT}/rules/branches/main`,
        LIST_ARGS,
        `api ${ROOT}/rulesets/11`,
      ]);
      expect(putCalls(calls)).toEqual([]);
      const diff = A.join(A.map(lines, String), "\n");
      expect(Str.startsWith("--- ruleset 11\n- ")(diff)).toBe(true);
      expect(diff).toContain('{"context":"beep-reviewer","integration_id":42}');
      expect(A.length(Str.split("beep-reviewer")(diff))).toBe(2);
    })
  );

  it.effect("apply with an unchanged re-read issues one lossless PUT without the reviewer", () =>
    Effect.gen(function* () {
      const { calls, exit } = yield* withFakeGh(defaults, releaseReviewerRuleset(true, undefined));
      yield* exit;
      const puts = putCalls(calls);
      expect(A.map(puts, (call) => call.args)).toEqual([`api --method PUT ${ROOT}/rulesets/11 --input -`]);
      expect(A.length(A.filter(calls, (call) => call.args === `api ${ROOT}/rulesets/11`))).toBe(2);
      const put = O.getOrThrow(A.head(puts));
      const payload = yield* put.stdin.pipe(O.getOrThrow, decodeObject);
      expect(payload).toEqual(writable(ruleset(11, false)));
      expect(payload).toMatchObject({ bypass_actors: ruleset(11).bypass_actors, conditions: ruleset(11).conditions });
      expect(yield* encodeJson(payload)).toContain('{"context":"Heavy / Check","integration_id":15368}');
    })
  );

  it.effect("require apply adds the App-bound reviewer to a released ruleset", () =>
    Effect.gen(function* () {
      const { calls, exit } = yield* withFakeGh(
        { ...defaults, rulesets: [[11, [ruleset(11, false)]]] },
        requireReviewerRuleset(42, true, undefined)
      );
      yield* exit;
      const put = O.getOrThrow(A.head(putCalls(calls)));
      expect(yield* put.stdin.pipe(O.getOrThrow, decodeObject)).toEqual(writable(ruleset(11)));
    })
  );

  it.effect("apply skips the write when the ruleset already matches", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        { ...defaults, rulesets: [[11, [ruleset(11, false)]]] },
        releaseReviewerRuleset(true, undefined)
      );
      expect(result.exit._tag).toBe("Success");
      expect(putCalls(result.calls)).toEqual([]);
      expect(A.length(A.filter(result.calls, (call) => call.args === `api ${ROOT}/rulesets/11`))).toBe(1);
    })
  );

  it.effect("refuses to write when the ruleset changes between preview and apply", () =>
    Effect.gen(function* () {
      const moved = { ...ruleset(11), enforcement: "evaluate" };
      const result = yield* withFakeGh(
        { ...defaults, rulesets: [[11, [ruleset(11), moved]]] },
        releaseReviewerRuleset(true, undefined)
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain(
        "Ruleset changed during preview; rerun and inspect the new diff."
      );
      expect(putCalls(result.calls)).toEqual([]);
    })
  );

  it.effect("refuses another gh login before reading administration data", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        { ...defaults, login: "someone-else\n" },
        releaseReviewerRuleset(true, undefined)
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("kriegcloud");
      expect(A.map(result.calls, (call) => call.args)).toEqual(["api user --jq .login"]);
    })
  );

  it.effect("refuses zero matching repository rulesets", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        { ...defaults, branchRules: [{ type: "deletion", ruleset_id: 11 }] },
        releaseReviewerRuleset(false, undefined)
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("zero or multiple matching repository rulesets");
      expect(A.length(result.calls)).toBe(4);
    })
  );

  it.effect("refuses multiple matching rulesets unless --ruleset-id selects one", () =>
    Effect.gen(function* () {
      const ambiguous = yield* withFakeGh(twoRulesets, releaseReviewerRuleset(true, undefined));
      expect(O.getOrThrow(failureMessage(ambiguous.exit))).toContain("select --ruleset-id explicitly");
      expect(putCalls(ambiguous.calls)).toEqual([]);

      const selected = yield* withFakeGh(twoRulesets, releaseReviewerRuleset(true, 12));
      expect(selected.exit._tag).toBe("Success");
      expect(A.map(putCalls(selected.calls), (call) => call.args)).toEqual([
        `api --method PUT ${ROOT}/rulesets/12 --input -`,
      ]);
    })
  );

  it.effect("refuses a failed gh request", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh({ ...defaults, rulesets: [] }, releaseReviewerRuleset(false, undefined));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("Cannot read GitHub administration data.");
    })
  );
});

it.layer(CommandLayer, { timeout: "30 seconds" })("reviewer ruleset command", (it) => {
  it.effect("ruleset release --dry-run prints the diff through the CLI without writing", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(defaults, runReviewer(["ruleset", "release", "--apply", "--dry-run"]));
      const { lines } = yield* result.exit;
      expect(A.map(lines, String)).toContainEqual(expect.stringContaining("--- ruleset 11\n- "));
      expect(putCalls(result.calls)).toEqual([]);
      expect(A.length(result.calls)).toBe(5);
    })
  );

  it.effect("ruleset release reports a refused login as a reviewer error", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh({ ...defaults, login: "someone-else" }, runReviewer(["ruleset", "release"]));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("[reviewer] Ruleset administration must use");
    })
  );
  it.effect("ruleset release --apply writes the selected ruleset through the CLI", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        twoRulesets,
        runReviewer(["ruleset", "release", "--apply", "--ruleset-id", "12"])
      );
      yield* result.exit;
      const puts = putCalls(result.calls);
      expect(A.map(puts, (call) => call.args)).toEqual([`api --method PUT ${ROOT}/rulesets/12 --input -`]);
      const put = O.getOrThrow(A.head(puts));
      expect(yield* put.stdin.pipe(O.getOrThrow, decodeObject)).toEqual(writable(ruleset(12, false)));
    })
  );

  it.effect("ruleset require rejects a nonpositive App id before invoking gh", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGh(
        defaults,
        runReviewer(["ruleset", "require"]).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_REVIEWER_APP_ID: 0 }))
        )
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("A positive App id is required.");
      expect(result.calls).toEqual([]);
    })
  );
});
