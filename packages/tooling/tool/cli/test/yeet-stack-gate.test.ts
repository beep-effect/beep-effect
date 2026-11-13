import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GithubPullRequestRecord, GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import {
  decideYeetStackGate,
  MergeGateMerged,
  MergeGateRunOptions,
  mergePr,
  RepoRunContext,
  renderMergeGateMergedLines,
  runMergeGate,
  runYeetGhMerge,
  YeetStackGateInput,
  YeetStackGatePlan,
  YeetStackLayer,
  YeetStackMergedLayer,
  YeetStackMergeScope,
  yeetStackLowerHeadDrift,
  yeetStackLowerMergeCommit,
  yeetStackUngatedRefusal,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import checkSuitesFixture from "./fixtures/yeet-merge-gate/check-suites.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { legacyGhAnswer, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { GithubFetchCall } from "./support/GithubFetch.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

// The shape of the probed stack #3159 (2026-11-13): #3157 on main, #3158 on #3157's branch.
const STACK = 3159;
const LOWER = 3157;
const TOP = 3158;
const TRUNK = "main";
const LOWER_REF = "probe/stack-lower";
const TOP_REF = "probe/stack-top";
const lowerHead = `1111111111${Str.repeat(30)("0")}`;
const topHead = `2222222222${Str.repeat(30)("0")}`;
const movedLowerHead = `3333333333${Str.repeat(30)("0")}`;
const trunkSha = Str.repeat(40)("0");
const lowerSquash = `1f562ae3c1${Str.repeat(30)("0")}`;
const topSquash = `a60de48ccf${Str.repeat(30)("0")}`;
// The lower layer's PR title differs from its one commit's subject, so a linted
// header shows which message was predicted: GitHub's default takes the subject.
const LOWER_TITLE = "docs(stack): the lower layer pull request";
const LOWER_SUBJECT = "docs(stack): lower commit subject";
const TOP_TITLE = "docs(stack): the top layer";

const layer = (number: number, position: number, headRef: string, headSha: string) =>
  YeetStackLayer.make({ number, position, headRef, headSha });
const lowerLayer = layer(LOWER, 1, LOWER_REF, lowerHead);
const topLayer = layer(TOP, 2, TOP_REF, topHead);
const group = YeetStackMergeScope.cases.Group.make({
  stackNumber: STACK,
  trunk: TRUNK,
  lower: lowerLayer,
  top: topLayer,
});
const belowTop = YeetStackMergeScope.cases.BelowTop.make({ stackNumber: STACK, upper: topLayer });

const plan = (prNumber: number, scope: YeetStackMergeScope, flags: { alone?: boolean; relaxed?: boolean } = {}) =>
  decideYeetStackGate(
    YeetStackGateInput.make({ prNumber, scope, alone: flags.alone ?? false, relaxed: flags.relaxed ?? false })
  );

const pullRecord = (overrides: Partial<Parameters<typeof GithubPullRequestRecord.make>[0]> = {}) =>
  GithubPullRequestRecord.make({
    number: LOWER,
    nodeId: "PR_lower",
    title: LOWER_TITLE,
    body: "",
    state: "closed",
    draft: false,
    merged: true,
    mergeableState: O.none(),
    headRef: LOWER_REF,
    headSha: lowerHead,
    baseRef: TRUNK,
    baseSha: trunkSha,
    htmlUrl: `https://github.com/beep-effect/beep-effect/pull/${LOWER}`,
    author: "kriegcloud",
    labels: [],
    createdAt: DateTime.makeUnsafe("2026-11-13T00:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-11-13T00:00:00Z"),
    mergeCommitSha: O.some(lowerSquash),
    ...overrides,
  });

describe("yeet merge-gate stack layout", () => {
  it("gates a single pull request as before and refuses an unknown or too deep stack", () => {
    expect(plan(7, YeetStackMergeScope.cases.Single.make({}))._tag).toBe("Single");
    const unknown = plan(
      TOP,
      YeetStackMergeScope.cases.Unknown.make({ stackNumber: STACK, detail: "stack #3159 does not list #3158" })
    );
    expect(unknown).toMatchObject({ _tag: "Refused", reason: "stack-unknown" });
    if (YeetStackGatePlan.guards.Refused(unknown)) expect(unknown.detail).toContain("stack #3159 does not list #3158");
    const deep = plan(TOP, YeetStackMergeScope.cases.TooDeep.make({ stackNumber: STACK, openLayers: 3 }));
    expect(deep).toMatchObject({
      _tag: "Refused",
      reason: "stack-too-deep",
      detail: "stack #3159 has 3 open layers; one merge lands 2 at most",
    });
  });

  it("holds a layer below an open layer unless --alone lands it by itself", () => {
    expect(plan(LOWER, belowTop)).toMatchObject({
      _tag: "Refused",
      reason: "stack-below-top",
      detail:
        "#3157 has open layer #3158 above it in stack #3159; merge from the top with `bun run beep yeet merge-gate 3158 <sha>`, or pass --alone to land this layer by itself (GitHub then force-pushes #3158 onto the trunk)",
    });
    expect(plan(LOWER, belowTop, { alone: true })._tag).toBe("Single");
    expect(plan(LOWER, belowTop, { alone: true, relaxed: true })._tag).toBe("Single");
  });

  it("gates the top of a group strictly and refuses --relaxed on it", () => {
    expect(plan(TOP, group)).toEqual(group);
    expect(plan(TOP, group, { alone: true })).toEqual(group);
    expect(plan(TOP, group, { relaxed: true })).toMatchObject({
      _tag: "Refused",
      reason: "stack-relaxed",
      detail:
        "--relaxed on #3158 would merge #3157 with it in stack #3159; bypass reaches only the lowest layer; land the stack bottom-up with --alone, or wait for green",
    });
  });

  it("the ungated merge paths refuse every scope but a single pull request", () => {
    assertNone(yeetStackUngatedRefusal(YeetStackMergeScope.cases.Single.make({}), 7));
    assertSome(
      yeetStackUngatedRefusal(group, TOP),
      "#3158 is the top of stack #3159: this merge would also merge #3157; use `bun run beep yeet merge-gate 3158 <sha>`, which gates every layer"
    );
    assertSome(
      yeetStackUngatedRefusal(belowTop, LOWER),
      "#3157 has open layer #3158 above it in stack #3159; merge from the top with `bun run beep yeet merge-gate 3158 <sha>`, or land this layer by itself with `bun run beep yeet merge-gate 3157 <sha> --alone`"
    );
    assertSome(
      yeetStackUngatedRefusal(YeetStackMergeScope.cases.TooDeep.make({ stackNumber: STACK, openLayers: 3 }), TOP),
      "stack #3159 has 3 open layers; one merge lands 2 at most"
    );
    assertSome(
      yeetStackUngatedRefusal(YeetStackMergeScope.cases.Unknown.make({ stackNumber: STACK, detail: "gone" }), TOP),
      "gone; the gate never merges a stacked pull request whose merge scope is unknown"
    );
  });

  it("reads the lower layer's own squash commit back, and fails loudly when it did not land", () => {
    deepStrictEqual(yeetStackLowerMergeCommit(lowerLayer, pullRecord()), Result.succeed(lowerSquash));
    deepStrictEqual(
      yeetStackLowerMergeCommit(lowerLayer, pullRecord({ mergeCommitSha: O.none() })),
      Result.fail("#3157 reads merged but GitHub reports no merge commit for it")
    );
    deepStrictEqual(
      yeetStackLowerMergeCommit(lowerLayer, pullRecord({ state: "open", merged: false, mergeCommitSha: O.none() })),
      Result.fail("#3157 reads state open, merged=false, after the stack merge")
    );
  });

  it("warns when the lower layer merged at a head the gate never read", () => {
    assertNone(yeetStackLowerHeadDrift(lowerLayer, pullRecord()));
    assertSome(
      yeetStackLowerHeadDrift(lowerLayer, pullRecord({ headSha: movedLowerHead })),
      "#3157 merged at 3333333333, not the gated head 1111111111: a push landed on #3157 after the gate read it, and merged ungated"
    );
  });

  it("renders one merged line per layer, lower first, each with its own squash commit", () => {
    const merged = MergeGateMerged.make({
      prNumber: TOP,
      mergeSha: topSquash,
      commitTitle: `${TOP_TITLE} (#${TOP})`,
      bypassRequested: false,
      layers: [
        YeetStackMergedLayer.make({
          stackNumber: STACK,
          position: 1,
          prNumber: LOWER,
          mergeSha: lowerSquash,
          commitTitle: `${LOWER_SUBJECT} (#${LOWER})`,
        }),
        YeetStackMergedLayer.make({
          stackNumber: STACK,
          position: 2,
          prNumber: TOP,
          mergeSha: topSquash,
          commitTitle: `${TOP_TITLE} (#${TOP})`,
        }),
      ],
    });
    expect(renderMergeGateMergedLines(merged)).toEqual([
      `MERGED #3157 -> 1f562ae3c1 "${LOWER_SUBJECT} (#3157)" via merge-async (stack #3159, layer 1)`,
      `MERGED #3158 -> a60de48ccf "${TOP_TITLE} (#3158)" via merge-async (stack #3159, layer 2)`,
    ]);
    const { layers: _layers, ...single } = merged;
    expect(renderMergeGateMergedLines(MergeGateMerged.make(single))).toEqual([
      `MERGED #3158 -> a60de48ccf "${TOP_TITLE} (#3158)" via merge-async`,
    ]);
  });
});

// --- A recorded GitHub holding stack #3159 ----------------------------------

interface StackScenario {
  /** The 1-based commitlint run that fails (the top's read lints first, the lower layer's second). */
  readonly commitlintFailsOn?: number;
  /** What `compare/<lower head>...<top head>` answers. */
  readonly contains?: "yes" | "no" | "unreadable";
  /** How the lower layer reads back after the merge request on the top. */
  readonly lowerAfterMerge?: "merged" | "open" | "moved";
  /** The lower layer is a draft: its own gate holds. */
  readonly lowerDraft?: boolean;
  /** The stack read fails. */
  readonly stackUnreadable?: boolean;
}

const stackRef = (position: number) => ({
  id: 9,
  number: STACK,
  position,
  size: 2,
  base: { ref: TRUNK, sha: trunkSha },
});

const lowerPullPayload = (scenario: StackScenario, merged: boolean) =>
  restPullRequest({
    number: LOWER,
    node_id: "PR_lower",
    title: LOWER_TITLE,
    draft: scenario.lowerDraft === true,
    head: { ref: LOWER_REF, sha: merged && scenario.lowerAfterMerge === "moved" ? movedLowerHead : lowerHead },
    base: { ref: TRUNK, sha: trunkSha },
    html_url: `https://github.com/beep-effect/beep-effect/pull/${LOWER}`,
    stack: stackRef(1),
    ...(merged && scenario.lowerAfterMerge !== "open"
      ? { state: "closed", merged: true, merged_at: "2026-11-13T01:00:00Z", merge_commit_sha: lowerSquash }
      : { merge_commit_sha: "test-merge-commit-of-an-open-pull" }),
  });

const topPullPayload = restPullRequest({
  number: TOP,
  node_id: "PR_top",
  title: TOP_TITLE,
  head: { ref: TOP_REF, sha: topHead },
  base: { ref: LOWER_REF, sha: lowerHead },
  html_url: `https://github.com/beep-effect/beep-effect/pull/${TOP}`,
  stack: stackRef(2),
});

const stackLayerPayload = (number: number, ref: string, sha: string) => ({
  number,
  state: "open",
  draft: false,
  merged_at: null,
  head: { ref, sha },
  base: { ref: TRUNK },
});

const stackPayload = {
  number: STACK,
  open: true,
  base: { ref: TRUNK },
  created_at: "2026-11-13T00:30:00Z",
  pull_requests: [stackLayerPayload(LOWER, LOWER_REF, lowerHead), stackLayerPayload(TOP, TOP_REF, topHead)],
};

const commits = (subject: string, body: string) => [{ commit: { message: `${subject}\n\n${body}` } }];

const noThreads = encodeJson({
  data: { repository: { pullRequest: { author: { login: "kriegcloud" }, reviewThreads: { nodes: [] } } } },
});

const mergedResponse: GithubAnswer = {
  body: { status: "merged", details: { message: "Pull request was merged.", sha: topSquash } },
};

// Every REST read either merge path makes, by method and path; anything else is a 404.
const stackRoutes =
  (scenario: StackScenario, mergeSent: MutableRef.MutableRef<boolean>) =>
  (call: GithubCall): GithubAnswer | undefined => {
    if (O.isSome(call.graphql)) return legacyGhAnswer({ call, exitCode: 0, output: noThreads });
    if (call.method === "PUT" && Str.endsWith("/merge-async")(call.path)) {
      MutableRef.set(mergeSent, true);
      return mergedResponse;
    }
    const merged = MutableRef.get(mergeSent);
    const containment = scenario.contains ?? "yes";
    const table: Readonly<Record<string, GithubAnswer>> = {
      [`{repo}/pulls/${LOWER}`]: { body: lowerPullPayload(scenario, merged) },
      [`{repo}/pulls/${TOP}`]: { body: topPullPayload },
      [`{repo}/stacks/${STACK}`]:
        scenario.stackUnreadable === true ? { status: 502, body: { message: "Bad Gateway" } } : { body: stackPayload },
      [`{repo}/pulls/${LOWER}/commits`]: { body: commits(LOWER_SUBJECT, "Why the lower layer.") },
      [`{repo}/pulls/${TOP}/commits`]: { body: commits(TOP_TITLE, "The top layer.") },
      [`{repo}/pulls/${LOWER}/files`]: { body: [] },
      [`{repo}/pulls/${TOP}/files`]: { body: [] },
      [`{repo}/commits/${lowerHead}/check-runs`]: { body: checkRunsFixture },
      [`{repo}/commits/${topHead}/check-runs`]: { body: checkRunsFixture },
      [`{repo}/commits/${lowerHead}/check-suites`]: { body: checkSuitesFixture },
      [`{repo}/commits/${topHead}/check-suites`]: { body: checkSuitesFixture },
      [`{repo}/issues/${LOWER}/timeline`]: { body: timelineFixture },
      [`{repo}/issues/${TOP}/timeline`]: { body: timelineFixture },
      [`{repo}/rules/branches/${TRUNK}`]: { body: rulesFixture },
      [`{repo}/rules/branches/${LOWER_REF}`]: { body: [] },
      [`{repo}/compare/${lowerHead}...${topHead}`]:
        containment === "unreadable"
          ? { status: 502, body: { message: "Bad Gateway" } }
          : { body: { status: "ahead", behind_by: containment === "yes" ? 0 : 1 } },
      "{repo}": {
        body: { squash_merge_commit_title: "COMMIT_OR_PR_TITLE", squash_merge_commit_message: "COMMIT_MESSAGES" },
      },
    };
    return call.method === "GET" ? table[call.path] : undefined;
  };

// The reviewer gate and `yeet gh` speak through the raw transport; the same table answers them.
const transportAnswer =
  (routes: (call: GithubCall) => GithubAnswer | undefined) =>
  (call: GithubFetchCall): unknown => {
    // A 4xx the client never retries: the suite's clock is a TestClock, so a retry would never fire.
    if (call.url.pathname === "/graphql") return reply(400)({ message: "no GraphQL in this suite" });
    const answer = routes({
      body: call.body,
      graphql: O.none(),
      method: call.method,
      path: Str.replace("/repos/beep-effect/beep-effect", "{repo}")(decodeURIComponent(call.url.pathname)),
      query: call.url.searchParams,
    });
    return answer === undefined
      ? reply(404)({ message: "Not Found" })
      : (answer.status ?? 200) === 200
        ? answer.body
        : reply(answer.status ?? 200)(answer.body);
  };

const commitlintPass = { stdout: "✔   found 0 problems, 0 warnings", exit: 0 };
const commitlintFail = {
  stdout: "✖   header must not be longer than 100 characters [header-max-length]\n✖   found 1 problems, 0 warnings",
  exit: 1,
};

const stackSpawner = (scenario: StackScenario, prView: unknown) => {
  const commitlintRuns = MutableRef.make(0);
  return ScriptedSpawner.make((command, args) => {
    const line = A.join(args, " ");
    if (command === "bunx") {
      return MutableRef.incrementAndGet(commitlintRuns) === scenario.commitlintFailsOn
        ? commitlintFail
        : commitlintPass;
    }
    if (command === "gh" && line === "auth token") return { stdout: "gho_fixture\n" };
    if (command === "gh" && Str.startsWith("pr view")(line)) return { stdout: encodeJson(prView) };
    if (command === "gh" && Str.startsWith("api repos/{owner}/{repo}/rules/branches/")(line)) {
      return { stdout: encodeJson(Str.endsWith(`/${TRUNK}`)(line) ? rulesFixture : []) };
    }
    return { stderr: `unexpected command: ${command} ${line}`, exit: 1 };
  });
};

// The merge gate consults a workstation merge-reservation helper when the host has
// activated reservations; the suite always reads the sentinel as absent.
const withoutHostMergeReservation = Effect.map(FileSystem.FileSystem, (fs) =>
  FileSystem.FileSystem.of({
    ...fs,
    exists: Effect.fn("withoutHostMergeReservation.exists")(function* (path: string) {
      const found = yield* fs.exists(path);
      return found && !Str.endsWith("/merge-reservations/active")(path);
    }),
  })
);

const context = RepoRunContext.make({
  base: "origin/main",
  branch: TOP_REF,
  cwd: ".",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

// The recorded #1459 window: the later of its ready flip and first check suite, and a
// clock a minute past twenty minutes after it.
const readyAtIso = timelineFixture[0]?.created_at ?? "2026-10-06T08:00:52Z";
const pushedAtIso =
  A.sort(
    A.map(checkSuitesFixture.check_suites, (suite) => suite.created_at),
    Str.Order
  )[0] ?? readyAtIso;
const windowClosed = DateTime.add(DateTime.makeUnsafe(pushedAtIso > readyAtIso ? pushedAtIso : readyAtIso), {
  minutes: 21,
});

interface StackRecording {
  /** The lines this scenario printed to stderr. */
  readonly errorLines: Effect.Effect<ReadonlyArray<string>>;
  /** Every call the kit's client made. */
  readonly github: ReadonlyArray<GithubCall>;
  /** The lines this scenario logged. */
  readonly logLines: Effect.Effect<ReadonlyArray<string>>;
  /** Every spawn, as `<command> <args>`. */
  readonly spawns: () => ReadonlyArray<string>;
  /** Every call the raw transport served (reviewer gate, `yeet gh`). */
  readonly transport: ReadonlyArray<GithubFetchCall>;
}

const linesSince = (before: ReadonlyArray<unknown>) =>
  Effect.map(
    (lines: ReadonlyArray<unknown>): ReadonlyArray<string> =>
      A.map(A.drop(lines, A.length(before)), (line) => `${line}`)
  );

const withStack = Effect.fn("withStack")(function* <A, E, R>(
  scenario: StackScenario,
  use: (recording: StackRecording) => Effect.Effect<A, E, R>,
  prView: unknown = {}
) {
  yield* windowClosed.pipe(DateTime.toEpochMillis, TestClock.setTime);
  // The suite shares one console; each scenario reads only the lines it printed.
  const logsBefore = yield* TestConsole.logLines;
  const errorsBefore = yield* TestConsole.errorLines;
  const routes = stackRoutes(scenario, MutableRef.make(false));
  const github = recordedGithub(routes);
  const transport = githubFetch(transportAnswer(routes));
  const spawner = stackSpawner(scenario, prView);
  const recording: StackRecording = {
    github: github.calls,
    transport: transport.calls,
    spawns: () => A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " ")),
    logLines: TestConsole.logLines.pipe(linesSince(logsBefore)),
    errorLines: TestConsole.errorLines.pipe(linesSince(errorsBefore)),
  };
  return yield* use(recording).pipe(
    github.provide,
    Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
    Effect.provideServiceEffect(Git, Git.make),
    Effect.provideServiceEffect(FileSystem.FileSystem, withoutHostMergeReservation),
    provideSpawner(spawner)
  );
});

const gate = (
  prNumber: number,
  wantSha: string,
  flags: { relaxed?: boolean; dryRun?: boolean; alone?: boolean } = {}
) =>
  runMergeGate(
    context,
    MergeGateRunOptions.make({
      prNumber,
      wantSha,
      tolerate: [],
      forceWindow: false,
      relaxed: flags.relaxed ?? false,
      dryRun: flags.dryRun ?? false,
      alone: flags.alone ?? false,
    })
  );

const puts = (recording: StackRecording) => A.filter(recording.github, (call) => call.method === "PUT");

const reads = (recording: StackRecording, path: string) =>
  A.filter(recording.github, (call) => call.method === "GET" && call.path === path);

const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet merge-gate on a two-layer stack",
  (it) => {
    it.effect("merges both layers with one strict request on the top and reports each layer's own commit", () =>
      withStack({}, (recording) =>
        Effect.gen(function* () {
          const decision = yield* gate(TOP, topHead);
          expect(decision).toMatchObject({ _tag: "merge", prNumber: TOP, headSha: topHead });
          const sent = puts(recording);
          expect(A.map(sent, (call) => call.path)).toEqual([`{repo}/pulls/${TOP}/merge-async`]);
          expect(sent[0]?.body).toEqual({
            merge_action: "direct_merge",
            merge_method: "squash",
            sha: topHead,
            bypass_rules: false,
            commit_title: `${TOP_TITLE} (#${TOP})`,
            commit_message: "The top layer.",
          });
          // Both layers were gated against the trunk's ruleset, never the parent branch's.
          const rules = A.filter(recording.spawns(), Str.includes("/rules/branches/"));
          expect(rules).toEqual([
            `gh api repos/{owner}/{repo}/rules/branches/${TRUNK}`,
            `gh api repos/{owner}/{repo}/rules/branches/${TRUNK}`,
          ]);
          // The reviewer gate ran on both heads, the lower layer first.
          expect(
            A.filter(
              A.map(recording.transport, (call) => call.url.pathname),
              (path) => Str.endsWith(`/pulls/${LOWER}`)(path) || Str.endsWith(`/pulls/${TOP}`)(path)
            )
          ).toEqual([`/repos/beep-effect/beep-effect/pulls/${LOWER}`, `/repos/beep-effect/beep-effect/pulls/${TOP}`]);
          // The lower layer was read for its gate and once more after the merge.
          expect(reads(recording, `{repo}/pulls/${LOWER}`)).toHaveLength(2);
          // B2 ran for each merged layer.
          expect(reads(recording, `{repo}/pulls/${LOWER}/files`)).toHaveLength(1);
          expect(reads(recording, `{repo}/pulls/${TOP}/files`)).toHaveLength(1);
          const logLines = yield* recording.logLines;
          expect(logLines).toContain(
            `[yeet] squash-commitlint #${LOWER} (GitHub's default, stack #${STACK} layer 1): pass (header "${LOWER_SUBJECT} (#${LOWER})")`
          );
          const merged = A.filter(logLines, (line) => Str.startsWith("[yeet] MERGED")(`${line}`));
          expect(merged).toEqual([
            `[yeet] MERGED #${LOWER} -> 1f562ae3c1 "${LOWER_SUBJECT} (#${LOWER})" via merge-async (stack #${STACK}, layer 1)`,
            `[yeet] MERGED #${TOP} -> a60de48ccf "${TOP_TITLE} (#${TOP})" via merge-async (stack #${STACK}, layer 2)`,
          ]);
          const errorLines = yield* recording.errorLines;
          expect(errorLines).toEqual([]);
        })
      )
    );

    it.effect("--dry-run prints both layers' verdicts and sends nothing", () =>
      withStack({}, (recording) =>
        Effect.gen(function* () {
          const decision = yield* gate(TOP, topHead, { dryRun: true });
          expect(decision._tag).toBe("merge");
          expect(puts(recording)).toEqual([]);
          const logLines = yield* recording.logLines;
          expect(A.filter(logLines, (line) => Str.includes("GATE-MET")(`${line}`))).toHaveLength(2);
          expect(logLines).toContain(
            `[yeet] dry run: would squash-merge stack #${STACK} with one request on #${TOP}: #${LOWER} as "${LOWER_SUBJECT} (#${LOWER})" (GitHub's default) and #${TOP} as "${TOP_TITLE} (#${TOP})"`
          );
        })
      )
    );

    it.effect("the lower layer's hold wins over the top's and names the lower pull request", () =>
      withStack({ lowerDraft: true }, (recording) =>
        Effect.gen(function* () {
          const error = yield* gate(TOP, "0000000000").pipe(Effect.flip);
          expect(error.message).toBe(`#${LOWER} HOLD draft: still draft; the owner flips ready at content-final`);
          expect(puts(recording)).toEqual([]);
        })
      )
    );

    it.effect("GitHub's default squash message for the lower layer holds on squash-commitlint", () =>
      withStack({ commitlintFailsOn: 2 }, (recording) =>
        Effect.gen(function* () {
          const error = yield* gate(TOP, topHead).pipe(Effect.flip);
          expect(error.message).toMatch(new RegExp(`^#${LOWER} HOLD squash-commitlint: header-max-length`, "u"));
          expect(puts(recording)).toEqual([]);
        })
      )
    );

    it.effect("--relaxed on a group holds before the lower layer is read", () =>
      withStack({}, (recording) =>
        Effect.gen(function* () {
          const error = yield* gate(TOP, topHead, { relaxed: true }).pipe(Effect.flip);
          expect(error.message).toMatch(new RegExp(`^#${TOP} HOLD stack-relaxed: `, "u"));
          expect(reads(recording, `{repo}/pulls/${LOWER}`)).toEqual([]);
          expect(puts(recording)).toEqual([]);
        })
      )
    );

    it.effect("a top that does not contain the lower head holds as stack-out-of-date", () =>
      withStack({ contains: "no" }, (recording) =>
        Effect.gen(function* () {
          const error = yield* gate(TOP, topHead).pipe(Effect.flip);
          expect(error.message).toBe(
            `#${TOP} HOLD stack-out-of-date: #${TOP} does not contain #${LOWER}'s head 1111111111; merge origin/${LOWER_REF} into the top lane and push`
          );
          expect(puts(recording)).toEqual([]);
        })
      )
    );

    it.effect("an unreadable containment or stack holds as stack-unknown, never as a single merge", () =>
      Effect.gen(function* () {
        const containment = yield* withStack({ contains: "unreadable" }, (recording) =>
          gate(TOP, topHead).pipe(
            Effect.flip,
            Effect.map((error) => [error.message, A.length(puts(recording))] as const)
          )
        );
        expect(containment[0]).toMatch(new RegExp(`^#${TOP} HOLD stack-unknown: could not read whether`, "u"));
        expect(containment[1]).toBe(0);
        const stack = yield* withStack({ stackUnreadable: true }, (recording) =>
          gate(TOP, topHead).pipe(
            Effect.flip,
            Effect.map((error) => [error.message, A.length(puts(recording))] as const)
          )
        );
        expect(stack[0]).toMatch(
          new RegExp(`^#${TOP} HOLD stack-unknown: stack #${STACK} unreadable for #${TOP}`, "u")
        );
        expect(stack[1]).toBe(0);
      })
    );

    it.effect("a lower layer that does not read merged after the request fails loudly as merge-unsettled", () =>
      withStack({ lowerAfterMerge: "open" }, (recording) =>
        Effect.gen(function* () {
          const error = yield* gate(TOP, topHead).pipe(Effect.flip);
          expect(error.message).toBe(
            `#${LOWER} HOLD merge-unsettled: #${TOP} merged as a60de48ccf through stack #${STACK}, but #${LOWER} reads state open, merged=false, after the stack merge; check stack #${STACK} by hand before anything else merges`
          );
          expect(puts(recording)).toHaveLength(1);
        })
      )
    );

    it.effect("a lower layer that merged at another head prints a loud warning naming both", () =>
      withStack({ lowerAfterMerge: "moved" }, (recording) =>
        Effect.gen(function* () {
          yield* gate(TOP, topHead);
          const errorLines = yield* recording.errorLines;
          expect(errorLines).toEqual([
            `[yeet] WARNING: #${LOWER} merged at 3333333333, not the gated head 1111111111: a push landed on #${LOWER} after the gate read it, and merged ungated`,
          ]);
        })
      )
    );

    it.effect("a layer below an open layer holds unless --alone, which merges it as a single pull request", () =>
      Effect.gen(function* () {
        const held = yield* withStack({}, (recording) =>
          gate(LOWER, lowerHead).pipe(
            Effect.flip,
            Effect.map((error) => [error.message, A.length(puts(recording))] as const)
          )
        );
        expect(held[0]).toMatch(new RegExp(`^#${LOWER} HOLD stack-below-top: #${LOWER} has open layer #${TOP}`, "u"));
        expect(held[1]).toBe(0);
        const alone = yield* withStack({}, (recording) =>
          gate(LOWER, lowerHead, { alone: true }).pipe(Effect.map(() => puts(recording)))
        );
        expect(A.map(alone, (call) => call.path)).toEqual([`{repo}/pulls/${LOWER}/merge-async`]);
        // A layer merged alone sends the message the gate pinned and linted for it.
        expect(alone[0]?.body).toMatchObject({ commit_title: `${LOWER_TITLE} (#${LOWER})`, bypass_rules: false });
      })
    );

    it.effect("yeet merge refuses the top of a group before the reviewer gate or any merge", () =>
      withStack(
        {},
        (recording) =>
          Effect.gen(function* () {
            const error = yield* mergePr(context).pipe(Effect.flip);
            expect(error.message).toBe(
              `yeet merge refuses #${TOP}: #${TOP} is the top of stack #${STACK}: this merge would also merge #${LOWER}; use \`bun run beep yeet merge-gate ${TOP} <sha>\`, which gates every layer`
            );
            expect(puts(recording)).toEqual([]);
            expect(recording.transport).toEqual([]);
          }),
        { number: TOP, headRefName: TOP_REF, state: "OPEN", headRefOid: topHead }
      )
    );

    it.effect("yeet gh merge refuses the top of a group with exit 1 before its hold or any merge", () =>
      withStack({}, (recording) =>
        Effect.gen(function* () {
          const error = yield* runYeetGhMerge({
            tokenRef: O.none(),
            number: TOP,
            sha: topHead,
            tolerate: [],
            forceWindow: false,
            dryRun: false,
            noWait: true,
          }).pipe(
            Effect.flip,
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
            )
          );
          expect(error.exitCode).toBe(1);
          expect(error.message).toContain(`[gh] not merging #${TOP}: #${TOP} is the top of stack #${STACK}`);
          // The gate read the trunk's ruleset, and nothing was merged.
          expect(
            A.some(
              recording.transport,
              (call) => call.url.pathname === "/repos/beep-effect/beep-effect/rules/branches/main"
            )
          ).toBe(true);
          expect(A.some(recording.transport, (call) => call.method === "PUT")).toBe(false);
        })
      )
    );
  }
);
