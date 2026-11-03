import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubClient } from "@beep/github/GitHubClient";
import {
  enforceReviewerGate,
  releaseReviewerRuleset,
  requireReviewerRuleset,
  reviewerCommand,
} from "@beep/repo-cli/commands/Reviewer";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
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
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { SpawnRecord } from "@beep/commands/ScriptedSpawner";
import type { GithubFetchCall } from "./support/GithubFetch.ts";

const ROOT = "/repos/beep-effect/beep-effect";
const LIST = `GET ${ROOT}/rulesets`;
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeObject = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));
const runReviewer = Command.runWith(reviewerCommand, { version: "0.0.0" });
// Ruleset subcommands talk to GitHub only through the `@beep/github` client; no filesystem or terminal input is used.
const CommandLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
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
  login: "kriegcloud",
  branchRules: [
    { type: "deletion", ruleset_id: 11 },
    { type: "required_status_checks", ruleset_id: 11, parameters: {} },
  ] as ReadonlyArray<unknown>,
  summaries: [
    { id: 11, source_type: "Repository", enforcement: "active" },
    { id: 3, source_type: "Organization", enforcement: "active" },
    { id: 4, source_type: "Repository", enforcement: "disabled" },
  ] as ReadonlyArray<unknown>,
  rulesets: [[11, [ruleset(11)]]] as ReadonlyArray<readonly [number, ReadonlyArray<unknown>]>,
};
type GithubFixture = typeof defaults;

const twoRulesets: GithubFixture = {
  ...defaults,
  branchRules: [
    { type: "required_status_checks", ruleset_id: 11, parameters: {} },
    { type: "required_status_checks", ruleset_id: 12, parameters: {} },
  ],
  summaries: [
    { id: 11, source_type: "Repository", enforcement: "active" },
    { id: 12, source_type: "Repository", enforcement: "active" },
  ],
  rulesets: [
    [11, [ruleset(11)]],
    [12, [ruleset(12)]],
  ],
};

// One REST call as `METHOD /path`, the query string dropped.
const callKey = (call: GithubFetchCall) => `${call.method} ${call.url.pathname}`;

// Answers each REST call from canned JSON keyed on method and path; unknown requests answer 404.
const respond = (fixture: GithubFixture, call: GithubFetchCall, priorCalls: ReadonlyArray<GithubFetchCall>) => {
  const key = callKey(call);
  if (key === `GET ${ROOT}/pulls/7`)
    return { head: { sha: Str.repeat(40)("a") }, base: { sha: Str.repeat(40)("b"), ref: "main" } };
  if (key === "GET /user") return { login: fixture.login };
  if (key === `GET ${ROOT}`) return { default_branch: "main" };
  if (key === `GET ${ROOT}/rules/branches/main`) return fixture.branchRules;
  if (key === LIST) return fixture.summaries;
  if (call.method === "PUT") return {};
  const reads = A.findFirst(fixture.rulesets, ([id]) => key === `GET ${ROOT}/rulesets/${id}`);
  if (O.isNone(reads)) return reply(404)({ message: "Not Found" });
  const nth = A.length(A.filter(priorCalls, (prior) => callKey(prior) === key));
  return O.getOrElse(A.get(reads.value[1], nth).pipe(O.orElse(() => A.last(reads.value[1]))), () =>
    reply(404)({ message: "Not Found" })
  );
};

// The `reviewer` commands read the operator token through `gh auth token`; nothing else is spawned, which
// `withFakeGithub` asserts on the recorded spawns.
const ghAuthToken = () => ScriptedSpawner.make(() => ({ stdout: "gho_operator-fixture\n" }));
const isGhAuthToken = (spawn: SpawnRecord) => spawn.command === "gh" && A.join(spawn.args, " ") === "auth token";

// Runs a program against the fake GitHub API and a test console, returning its exit, recorded calls, and log lines.
// The direct calls take the client from the context; the CLI builds its own from `gh auth token`, so the global
// `fetch` that client falls back to is the same fake.
const withFakeGithub = Effect.fnUntraced(function* <A, E, R>(fixture: GithubFixture, program: Effect.Effect<A, E, R>) {
  const api = githubFetch((call) => respond(fixture, call, A.dropRight(api.calls, 1)));
  const spawner = ghAuthToken();
  const client = yield* Layer.build(
    GitHubClient.layerFromToken({ token: Redacted.make("gho_fixture"), retry: "off", fetch: api.fetch })
  );
  const exit = yield* program.pipe(
    Effect.provideContext(client),
    Effect.provideService(GithubTransportFetch, O.some(api.fetch)),
    provideSpawner(spawner),
    Effect.flatMap((value) => TestConsole.logLines.pipe(Effect.map((lines) => ({ value, lines })))),
    Effect.provideServiceEffect(Console.Console, TestConsole.make),
    Effect.exit
  );
  expect(A.every(spawner.spawns, isGhAuthToken)).toBe(true);
  return { exit, calls: A.copy(api.calls) };
}, Effect.scoped);

const putCalls = (calls: ReadonlyArray<GithubFetchCall>) => A.filter(calls, (call) => call.method === "PUT");
const callKeys = (calls: ReadonlyArray<GithubFetchCall>) => A.map(calls, callKey);

const failureMessage = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, { onFailure: flow(Cause.pretty, O.some), onSuccess: () => O.none<string>() });

// The PUT body carries only writable fields; read-only identity fields are dropped.
const writable = ({ id: _id, source: _source, source_type: _sourceType, ...fields }: ReturnType<typeof ruleset>) =>
  fields;

describe("reviewer ruleset workflow", () => {
  it.effect("the merge gate stops requiring a reviewer after release", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(
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
      expect(callKeys(result.calls)).toEqual([`GET ${ROOT}/pulls/7`, `GET ${ROOT}/rules/branches/main`]);
    })
  );

  it.effect("a moved PR head holds the merge gate before reading branch rules", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(defaults, enforceReviewerGate(7, Str.repeat(40)("c")));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("Reviewer merge gate held");
      expect(callKeys(result.calls)).toEqual([`GET ${ROOT}/pulls/7`]);
    })
  );

  it.effect("dry run prints the release diff and never writes", () =>
    Effect.gen(function* () {
      const { calls, exit } = yield* withFakeGithub(defaults, releaseReviewerRuleset(false, undefined));
      const { lines } = yield* exit;
      expect(callKeys(calls)).toEqual([
        "GET /user",
        `GET ${ROOT}`,
        `GET ${ROOT}/rules/branches/main`,
        LIST,
        `GET ${ROOT}/rulesets/11`,
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
      const { calls, exit } = yield* withFakeGithub(defaults, releaseReviewerRuleset(true, undefined));
      yield* exit;
      const puts = putCalls(calls);
      expect(callKeys(puts)).toEqual([`PUT ${ROOT}/rulesets/11`]);
      expect(A.length(A.filter(calls, (call) => callKey(call) === `GET ${ROOT}/rulesets/11`))).toBe(2);
      const put = O.getOrThrow(A.head(puts));
      const payload = yield* decodeObject(put.body);
      expect(payload).toEqual(writable(ruleset(11, false)));
      expect(payload).toMatchObject({ bypass_actors: ruleset(11).bypass_actors, conditions: ruleset(11).conditions });
      const encodedJson = yield* encodeJson(payload);
      expect(encodedJson).toContain('{"context":"Heavy / Check","integration_id":15368}');
    })
  );

  it.effect("require apply adds the App-bound reviewer to a released ruleset", () =>
    Effect.gen(function* () {
      const { calls, exit } = yield* withFakeGithub(
        { ...defaults, rulesets: [[11, [ruleset(11, false)]]] },
        requireReviewerRuleset(42, true, undefined)
      );
      yield* exit;
      const put = O.getOrThrow(A.head(putCalls(calls)));
      const decodedObject = yield* decodeObject(put.body);
      expect(decodedObject).toEqual(writable(ruleset(11)));
    })
  );

  it.effect("apply skips the write when the ruleset already matches", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(
        { ...defaults, rulesets: [[11, [ruleset(11, false)]]] },
        releaseReviewerRuleset(true, undefined)
      );
      expect(result.exit._tag).toBe("Success");
      expect(putCalls(result.calls)).toEqual([]);
      expect(A.length(A.filter(result.calls, (call) => callKey(call) === `GET ${ROOT}/rulesets/11`))).toBe(1);
    })
  );

  it.effect("refuses to write when the ruleset changes between preview and apply", () =>
    Effect.gen(function* () {
      const moved = { ...ruleset(11), enforcement: "evaluate" };
      const result = yield* withFakeGithub(
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
      const result = yield* withFakeGithub(
        { ...defaults, login: "someone-else" },
        releaseReviewerRuleset(true, undefined)
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("kriegcloud");
      expect(callKeys(result.calls)).toEqual(["GET /user"]);
    })
  );

  it.effect("refuses zero matching repository rulesets", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(
        { ...defaults, branchRules: [{ type: "deletion", ruleset_id: 11 }] },
        releaseReviewerRuleset(false, undefined)
      );
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("zero or multiple matching repository rulesets");
      expect(A.length(result.calls)).toBe(4);
    })
  );

  it.effect("refuses multiple matching rulesets unless --ruleset-id selects one", () =>
    Effect.gen(function* () {
      const ambiguous = yield* withFakeGithub(twoRulesets, releaseReviewerRuleset(true, undefined));
      expect(O.getOrThrow(failureMessage(ambiguous.exit))).toContain("select --ruleset-id explicitly");
      expect(putCalls(ambiguous.calls)).toEqual([]);

      const selected = yield* withFakeGithub(twoRulesets, releaseReviewerRuleset(true, 12));
      expect(selected.exit._tag).toBe("Success");
      expect(callKeys(putCalls(selected.calls))).toEqual([`PUT ${ROOT}/rulesets/12`]);
    })
  );

  it.effect("refuses a failed gh request", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub({ ...defaults, rulesets: [] }, releaseReviewerRuleset(false, undefined));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("Cannot read GitHub administration data.");
    })
  );
});

it.layer(CommandLayer, { timeout: "30 seconds" })("reviewer ruleset command", (it) => {
  it.effect("ruleset release --dry-run prints the diff through the CLI without writing", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(defaults, runReviewer(["ruleset", "release", "--apply", "--dry-run"]));
      const { lines } = yield* result.exit;
      expect(A.map(lines, String)).toContainEqual(expect.stringContaining("--- ruleset 11\n- "));
      expect(putCalls(result.calls)).toEqual([]);
      expect(A.length(result.calls)).toBe(5);
    })
  );

  it.effect("ruleset release reports a refused login as a reviewer error", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub({ ...defaults, login: "someone-else" }, runReviewer(["ruleset", "release"]));
      expect(O.getOrThrow(failureMessage(result.exit))).toContain("[reviewer] Ruleset administration must use");
    })
  );
  it.effect("ruleset release --apply writes the selected ruleset through the CLI", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(
        twoRulesets,
        runReviewer(["ruleset", "release", "--apply", "--ruleset-id", "12"])
      );
      yield* result.exit;
      const puts = putCalls(result.calls);
      expect(callKeys(puts)).toEqual([`PUT ${ROOT}/rulesets/12`]);
      const put = O.getOrThrow(A.head(puts));
      const decodedObject1 = yield* decodeObject(put.body);
      expect(decodedObject1).toEqual(writable(ruleset(12, false)));
    })
  );

  it.effect("ruleset require rejects a nonpositive App id before calling GitHub", () =>
    Effect.gen(function* () {
      const result = yield* withFakeGithub(
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
