import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  ciGovernanceCommands,
  decideHeavyAdmission,
  desktopEnvironmentApproved,
  GithubPolicyClient,
  GithubPolicyClientLive,
  HeavyAdmissionEvent,
  HeldRun,
  heldGroupRunIds,
  prSizeLabelDiff,
  reviewerAppIntegrationMatches,
  SettingsEnvironment,
  setupActionSavesNoCache,
  workflowPolicyDiagnostics,
} from "@beep/repo-cli/commands/Ci";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as TestConsole from "effect/testing/TestConsole";
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { GithubFetchCall } from "./support/GithubFetch.ts";

const writer = (environment: string, token = "${{ github.event_name == 'push' && secrets.TURBO_TOKEN || '' }}") =>
  `on: push\njobs:\n  writer:\n    environment: "${environment}"\n    steps:\n      - uses: ./.github/actions/setup-monorepo-ci\n        with:\n          turbo-token: "${token}"\n`;
describe("CI governance policy", () => {
  it.effect("requires a writer environment and trusted caller expression", () =>
    Effect.gen(function* () {
      expect(
        yield* workflowPolicyDiagnostics(
          "fixture.yml",
          writer("${{ github.event_name == 'push' && 'turbo-cache-write' || null }}")
        )
      ).toEqual([]);
      expect(yield* workflowPolicyDiagnostics("fixture.yml", writer(""))).toContain(
        "writer: write token requires the trusted Turbo writer environment"
      );
      expect(
        yield* workflowPolicyDiagnostics("fixture.yml", writer("turbo-cache-write", "${{ secrets.TURBO_TOKEN }}"))
      ).toContain("writer: writer input must stay guarded in the caller workflow");
    })
  );
  it.effect("rejects an unguarded step environment writer token", () =>
    Effect.gen(function* () {
      const text =
        'on: push\njobs:\n  writer:\n    environment: turbo-cache-write\n    steps:\n      - run: bun run check\n        env:\n          TURBO_TOKEN: "${{ secrets.TURBO_TOKEN }}"\n';
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toContain(
        "writer: writer input must stay guarded in the caller workflow"
      );
    })
  );
  it.effect("rejects a matrix writer without the Turbo-only condition", () =>
    Effect.gen(function* () {
      const text = `${writer("${{ github.event_name == 'push' && 'turbo-cache-write' || null }}")}    strategy:\n      matrix:\n        include:\n          - uses_turbo: 'false'\n`;
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toContain(
        "writer: write token requires the trusted Turbo writer environment"
      );
    })
  );
  it.effect("rejects unbounded artifacts and cancelled main pushes", () =>
    Effect.gen(function* () {
      const text =
        "on:\n  push:\n    branches: [main]\nconcurrency:\n  group: main\n  cancel-in-progress: true\njobs:\n  upload:\n    steps:\n      - uses: actions/upload-artifact@abc\n        with:\n          path: output\n";
      expect(yield* workflowPolicyDiagnostics("fixture.yml", text)).toEqual([
        "upload: artifact retention-days missing",
        "main pushes must not be cancelled by workflow concurrency",
      ]);
    })
  );
  it.effect("fails on malformed YAML rather than reporting clean", () =>
    Effect.gen(function* () {
      expect(yield* workflowPolicyDiagnostics("bad.yml", "jobs: [").pipe(Effect.isFailure)).toBe(true);
    })
  );
  it.effect("rejects a setup action that saves an Actions cache", () =>
    Effect.gen(function* () {
      const action = (uses: string) =>
        `runs:\n  using: composite\n  steps:\n    - run: bun install\n    - uses: ${uses}\n`;
      expect(yield* setupActionSavesNoCache(action("actions/cache/restore@55cc8345"))).toBe(true);
      expect(yield* setupActionSavesNoCache(action("actions/cache/save@55cc8345"))).toBe(false);
      expect(yield* setupActionSavesNoCache(action("actions/cache@55cc8345"))).toBe(false);
      expect(yield* setupActionSavesNoCache("runs:\n  steps: []\n")).toBe(true);
      expect(yield* setupActionSavesNoCache("inputs: {}\n").pipe(Effect.isFailure)).toBe(true);
    })
  );
  it.effect("keeps exactly one size label and preserves unrelated labels", () =>
    Effect.sync(() => {
      expect(prSizeLabelDiff(25, ["size/S", "size/L", "bug"])).toEqual({
        label: "size/L",
        remove: ["size/S"],
        add: false,
      });
      expect(prSizeLabelDiff(3, [])).toEqual({ label: "size/S", remove: [], add: true });
      expect(A.map([10, 11, 20, 21, 50, 51], (count) => prSizeLabelDiff(count, []).label)).toEqual([
        "size/S",
        "size/M",
        "size/M",
        "size/L",
        "size/L",
        "size/XL",
      ]);
    })
  );
  it.effect("requires a nonempty reviewer rule", () =>
    Effect.sync(() => {
      expect(desktopEnvironmentApproved(SettingsEnvironment.make({ protection_rules: [] }))).toBe(false);
      expect(
        desktopEnvironmentApproved(
          SettingsEnvironment.make({ protection_rules: [{ type: "required_reviewers", reviewers: [] }] })
        )
      ).toBe(false);
      expect(
        desktopEnvironmentApproved(
          SettingsEnvironment.make({
            protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }] }],
          })
        )
      ).toBe(true);
    })
  );
  it("accepts an absent reviewer context and requires a present one to be pinned to the expected GitHub App", () => {
    const pinned = { context: "beep-reviewer", integration_id: 5321138 };
    expect(reviewerAppIntegrationMatches([pinned])).toBe(true);
    expect(reviewerAppIntegrationMatches([])).toBe(true);
    expect(reviewerAppIntegrationMatches([{ context: "beep-reviewer" }])).toBe(false);
    expect(reviewerAppIntegrationMatches([{ context: "beep-reviewer", integration_id: null }])).toBe(false);
    expect(reviewerAppIntegrationMatches([{ context: "beep-reviewer", integration_id: 1 }])).toBe(false);
    expect(reviewerAppIntegrationMatches([pinned, pinned])).toBe(false);
    expect(reviewerAppIntegrationMatches([{ context: "Security", integration_id: 5321138 }])).toBe(true);
  });
  it.effect("detects the old waiting main run and pending successor", () =>
    Effect.sync(() => {
      const old = { id: 1, status: "waiting", created_at: "2026-10-09T12:00:00Z", head_branch: "main" };
      const next = { id: 2, status: "pending", created_at: "2026-10-09T13:00:00Z", head_branch: "main" };
      const now = 1791554400000;
      expect(heldGroupRunIds([HeldRun.make(old), HeldRun.make(next)], now)).toEqual([1]);
      expect(heldGroupRunIds([HeldRun.make(next)], now)).toEqual([]);
      expect(heldGroupRunIds([HeldRun.make({ ...old, status: "completed" }), HeldRun.make(next)], now)).toEqual([]);
      expect(heldGroupRunIds([HeldRun.make(old), HeldRun.make(next)], 1791547200000)).toEqual([]);
    })
  );
  it.effect("holds forks even when docs-only until distinctly approved", () =>
    Effect.sync(() => {
      const fork = HeavyAdmissionEvent.make({
        eventName: "pull_request",
        headRepository: "external/fork",
        baseRepository: "beep-effect/beep-effect",
        labels: ["ready-for-heavy"],
        changedPaths: ["docs/a.md"],
      });
      expect(decideHeavyAdmission(fork).verdict).toBe("hold");
      expect(
        decideHeavyAdmission(HeavyAdmissionEvent.make({ ...fork, labels: ["ready-for-heavy", "ready-for-heavy-fork"] }))
          .verdict
      ).toBe("run");
      expect(
        decideHeavyAdmission(HeavyAdmissionEvent.make({ ...fork, headRepository: "beep-effect/beep-effect" })).verdict
      ).toBe("run");
    })
  );
});

// The live governance client reads its token through `gh auth token` and calls GitHub through the
// `@beep/github` transport; both are faked, so no test reaches the network.
const ghAuthToken = ScriptedSpawner.make((command, args) =>
  A.join([command, ...args], " ") === "gh auth token"
    ? { stdout: "gho_fixture\n" }
    : { exit: 1, stderr: "the governance client spawns only gh auth token" }
);
const callKey = (call: GithubFetchCall) => `${call.method} ${call.path}`;
const withFakeGithub =
  (respond: (call: GithubFetchCall) => unknown) =>
  <A, E, R>(program: (calls: ReadonlyArray<GithubFetchCall>) => Effect.Effect<A, E, R>) => {
    const api = githubFetch(respond);
    return program(api.calls).pipe(
      Effect.provideService(GithubTransportFetch, O.some(api.fetch)),
      provideSpawner(ghAuthToken),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
      )
    );
  };
const REPO = "/repos/beep-effect/beep-effect";
const governanceAnswers = (call: GithubFetchCall): unknown => {
  const key = callKey(call);
  if (key === `GET ${REPO}/environments/professional-desktop-release`)
    return { protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User" }] }] };
  if (key === `GET ${REPO}/actions/workflows/check.yml/runs?branch=main&event=push&per_page=100`)
    return {
      total_count: 1,
      workflow_runs: [{ id: 5, status: "completed", created_at: "2026-10-01T00:00:00Z", head_branch: "main" }],
    };
  if (key === `GET ${REPO}/pulls/7`) return { changed_files: 3 };
  if (key === `GET ${REPO}/issues/7/labels?per_page=100`) return [{ name: "size/L" }];
  if (key === `GET ${REPO}/rulesets/10240248`)
    return {
      id: 10240248,
      name: "main",
      enforcement: "active",
      rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "Drifted" }] } }],
    };
  if (call.method === "DELETE" || call.method === "POST") return [];
  return reply(404)({ message: "Not Found" });
};
const runGovernance = Command.runWith(Command.make("ci").pipe(Command.withSubcommands(ciGovernanceCommands)), {
  version: "0.0.0",
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "governance over the live GitHub client",
  (it) => {
    it.effect("reads, writes, and reports an unreadable endpoint as unknown state", () =>
      withFakeGithub(governanceAnswers)((calls) =>
        Effect.gen(function* () {
          const context = yield* Layer.build(GithubPolicyClientLive);
          const client = Context.get(context, GithubPolicyClient);
          expect(yield* client.read("repos/{owner}/{repo}/pulls/7")).toEqual({ changed_files: 3 });
          yield* client.write("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
            issue_number: 7,
            labels: ["size/S"],
          });
          const missing = yield* client.read("repos/{owner}/{repo}/environments/unknown").pipe(
            Effect.as("read"),
            Effect.catchTag("CiCommandError", (error) => Effect.succeed(error.message))
          );
          expect(missing).toBe("GitHub policy request failed (HTTP 404); state is unknown.");
          expect(A.map(calls, callKey)).toEqual([
            `GET ${REPO}/pulls/7`,
            `POST ${REPO}/issues/7/labels`,
            `GET ${REPO}/environments/unknown`,
          ]);
          expect(calls[1]?.body).toEqual({ labels: ["size/S"] });
        })
      )
    );

    it.effect("checks settings, the held group and PR size labels through the commands", () =>
      withFakeGithub(governanceAnswers)((calls) =>
        Effect.gen(function* () {
          yield* runGovernance(["settings", "--check"]);
          yield* runGovernance(["held-group"]);
          yield* runGovernance(["pr-size", "7"]);
          const logs = A.map(yield* TestConsole.logLines, String);
          expect(logs).toContain("settings: desktop release reviewer protection present");
          expect(logs).toContain("held-group: clean");
          expect(logs).toContain("Changed files: 3; label: size/S");
          expect(A.map(calls, callKey)).toContain(`DELETE ${REPO}/issues/7/labels/size%2FL`);
          expect(A.map(calls, callKey)).toContain(`POST ${REPO}/issues/7/labels`);
        })
      )
    );

    it.effect("refuses ruleset drift and a missing mode", () =>
      withFakeGithub(governanceAnswers)(() =>
        Effect.gen(function* () {
          const drift = yield* runGovernance(["ruleset", "--check"]).pipe(Effect.flip);
          expect(String(drift)).toContain("Ruleset drift");
          const mode = yield* runGovernance(["ruleset"]).pipe(Effect.flip);
          expect(String(mode)).toContain("Use --capture or --check.");
        })
      )
    );
  }
);
