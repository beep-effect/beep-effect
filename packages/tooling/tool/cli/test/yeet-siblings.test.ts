import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  broadcastPacketSiblings,
  PacketSibling,
  PacketSiblingsReport,
  packetSlugsOf,
  RepoRunContext,
  readPacketSiblings,
  renderPacketSiblingsReport,
  renderSiblingBroadcast,
  SiblingBroadcast,
  SiblingsCommandOptions,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { recordedGithub } from "./support/YeetGithub.ts";
import type { GithubCall } from "./support/YeetGithub.ts";

// Three open PRs on the recorded repository: #7 and #8 share the `alpha` packet, #9 touches only
// source. `#7` is the subject (or the PR that just merged); its siblings read is pure REST plus the
// scripted git probe below.
const pull = (number: number, ref: string, sha: string) => ({
  number,
  node_id: `PR_${number}`,
  title: `pr ${number}`,
  body: "",
  state: "open",
  draft: false,
  merged_at: null,
  mergeable_state: "dirty",
  head: { ref, sha },
  base: { ref: "main" },
  html_url: `https://github.com/beep-effect/beep-effect/pull/${number}`,
  user: { login: "octocat" },
  labels: [],
  created_at: "2026-11-04T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
});

const SIBLING_SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const BASE_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MERGE_SHA = "feedfacefeedfacefeedfacefeedfacefeedface";

const files = (...names: ReadonlyArray<string>) => A.map(names, (filename) => ({ filename }));

const routes = (call: GithubCall) => {
  if (call.path === "{repo}/pulls/7/files")
    return { body: files("goals/alpha/SPEC.md", "goals/alpha/ops/manifest.json") };
  if (call.path === "{repo}/pulls/8/files") return { body: files("goals/alpha/PLAN.md", "goals/beta/SPEC.md") };
  if (call.path === "{repo}/pulls/9/files") return { body: files("packages/x/src/a.ts") };
  if (call.path === "{repo}/pulls/11/files") return { body: files("docs/README.md") };
  if (call.path === "{repo}/pulls" && call.query.get("state") === "open") {
    return {
      body: [
        pull(7, "lane/seven", "7777777777777777777777777777777777777777"),
        pull(8, "lane/eight", SIBLING_SHA),
        pull(9, "lane/nine", OTHER_SHA),
      ],
    };
  }
  if (call.path === "{repo}/issues/8/comments" && call.method === "POST") {
    return { body: { id: 1, html_url: "https://github.com/beep-effect/beep-effect/pull/8#issuecomment-1" } };
  }
  return undefined;
};

// git: the base fetch and the pull-ref fetch succeed, rev-parse names the base, and merge-tree
// reports one conflicted packet file for the sibling head.
const scriptedGit = (calls: Array<string>) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    calls.push(line);
    if (command !== "git") return { stdout: "", exit: 127 };
    if (A.contains(args, "merge-tree")) {
      return {
        stdout: `treetreetreetreetreetreetreetreetreetree\ngoals/alpha/PLAN.md\n\nAuto-merging goals/alpha/PLAN.md\nCONFLICT (content): Merge conflict in goals/alpha/PLAN.md\n`,
        exit: 1,
      };
    }
    if (A.contains(args, "rev-parse")) return { stdout: `${BASE_SHA}\n`, exit: 0 };
    return { stdout: "", exit: 0 };
  });

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "lane/seven",
  cwd: ".",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

const sibling = PacketSibling.make({
  prNumber: 2691,
  headRef: "codex/cache-creation-mask-identity",
  headSha: SIBLING_SHA,
  slugs: ["turborepo-cache"],
  probe: "conflict",
  conflicts: ["goals/turborepo-cache/SPEC.md", "goals/turborepo-cache/ops/manifest.json"],
});

describe("packetSlugsOf", () => {
  it("names each packet once, in path order, and ignores files directly under goals/", () => {
    expect(
      packetSlugsOf([
        "goals/alpha/SPEC.md",
        "goals/README.md",
        "goals/beta/ops/manifest.json",
        "goals/alpha/PLAN.md",
        "packages/x/src/a.ts",
        "goalsmith/x.md",
      ])
    ).toEqual(["alpha", "beta"]);
    expect(packetSlugsOf([])).toEqual([]);
  });
});

describe("renderSiblingBroadcast", () => {
  it("names the merged sibling, the slug, the merge-main instruction and the predicted files", () => {
    const body = renderSiblingBroadcast(
      SiblingBroadcast.make({ mergedPr: 2688, mergeSha: MERGE_SHA, baseSha: O.some(BASE_SHA), sibling })
    );
    expect(body).toContain("yeet merge-gate: sibling #2688 merged on `turborepo-cache` (feedfacefe).");
    expect(body).toContain("Merge `origin/main` into this lane now");
    expect(body).toContain("whatever your brief says about acceptance or merge authority");
    expect(body).toContain(
      "`origin/main` at aaaaaaaaaa: `goals/turborepo-cache/SPEC.md`, `goals/turborepo-cache/ops/manifest.json`."
    );
  });

  it("a clean probe still asks for the catch-up merge; an unavailable probe says so", () => {
    const clean = renderSiblingBroadcast(
      SiblingBroadcast.make({
        mergedPr: 1,
        mergeSha: MERGE_SHA,
        baseSha: O.none(),
        sibling: PacketSibling.make({ ...sibling, probe: "clean", conflicts: [] }),
      })
    );
    expect(clean).toContain("No conflicts predicted against the base; the catch-up merge is still due");
    const unavailable = renderSiblingBroadcast(
      SiblingBroadcast.make({
        mergedPr: 1,
        mergeSha: MERGE_SHA,
        baseSha: O.none(),
        sibling: PacketSibling.make({ ...sibling, probe: "unavailable", conflicts: [] }),
      })
    );
    expect(unavailable).toContain("The conflict probe could not run");
  });
});

describe("renderPacketSiblingsReport", () => {
  it("renders the header and one line per sibling", () => {
    const report = PacketSiblingsReport.make({
      prNumber: 2688,
      base: "origin/main",
      baseSha: O.some(BASE_SHA),
      slugs: ["turborepo-cache"],
      siblings: [sibling, PacketSibling.make({ ...sibling, prNumber: 2692, probe: "clean", conflicts: [] })],
    });
    const lines = Str.split(renderPacketSiblingsReport(report), "\n");
    expect(lines[0]).toBe(
      "[yeet] siblings #2688: packets `turborepo-cache`; 2 open sibling PR(s); probed against origin/main at aaaaaaaaaa"
    );
    expect(lines[1]).toContain(
      "#2691 codex/cache-creation-mask-identity (0123456789) shares `turborepo-cache`; conflicts: goals/turborepo-cache/SPEC.md, goals/turborepo-cache/ops/manifest.json"
    );
    expect(lines[2]).toContain("#2692");
    expect(lines[2]).toContain("no conflicts predicted");
    expect(
      renderPacketSiblingsReport(
        PacketSiblingsReport.make({ prNumber: 3, base: "origin/main", baseSha: O.none(), slugs: [], siblings: [] })
      )
    ).toBe("[yeet] siblings #3: touches no goal packet");
  });
});

it.layer(Layer.mergeAll(NodeCrypto.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "packet siblings over a recorded GitHub",
  (it) => {
    it.effect("reads the packet siblings of a PR and probes each against the refreshed base", () =>
      Effect.gen(function* () {
        const gitCalls: Array<string> = [];
        const github = recordedGithub(routes);
        const report = yield* readPacketSiblings(context, 7).pipe(
          github.provide,
          provideSpawner(scriptedGit(gitCalls))
        );
        expect(report.slugs).toEqual(["alpha"]);
        assertSome(report.baseSha, BASE_SHA);
        expect(A.map(report.siblings, (s) => s.prNumber)).toEqual([8]);
        const eight = report.siblings[0];
        expect(eight?.slugs).toEqual(["alpha"]);
        expect(eight?.probe).toBe("conflict");
        expect(eight?.conflicts).toEqual(["goals/alpha/PLAN.md"]);
        // The base was refreshed once, the sibling head fetched as objects only, then probed.
        expect(A.some(gitCalls, Str.includes("refs/heads/main:refs/remotes/origin/main"))).toBe(true);
        expect(gitCalls).toContain("git fetch --quiet --no-tags --no-write-fetch-head origin refs/pull/8/head");
        expect(gitCalls).toContain(`git merge-tree --write-tree --name-only origin/main ${SIBLING_SHA}`);
        // #9 shares nothing, so its head was never fetched; the subject is never its own sibling.
        expect(A.some(gitCalls, Str.includes("refs/pull/9/head"))).toBe(false);
        expect(A.some(gitCalls, Str.includes("refs/pull/7/head"))).toBe(false);
      })
    );

    it.effect("a PR outside every packet reports no siblings without listing open PRs or touching git", () =>
      Effect.gen(function* () {
        const gitCalls: Array<string> = [];
        const github = recordedGithub(routes);
        const report = yield* readPacketSiblings(context, 11).pipe(
          github.provide,
          provideSpawner(scriptedGit(gitCalls))
        );
        expect(report.slugs).toEqual([]);
        expect(report.siblings).toEqual([]);
        assertNone(report.baseSha);
        expect(A.some(github.calls, (call) => call.path === "{repo}/pulls")).toBe(false);
        expect(gitCalls).toEqual([]);
      })
    );

    it.effect("the broadcast comments once on each packet sibling and on nothing else", () =>
      Effect.gen(function* () {
        const gitCalls: Array<string> = [];
        const github = recordedGithub(routes);
        yield* broadcastPacketSiblings(context, 7, MERGE_SHA).pipe(
          github.provide,
          provideSpawner(scriptedGit(gitCalls))
        );
        const comments = A.filter(
          github.calls,
          (call) => call.method === "POST" && Str.includes("/comments")(call.path)
        );
        expect(A.map(comments, (call) => call.path)).toEqual(["{repo}/issues/8/comments"]);
        const body = comments[0]?.body as { readonly body: string };
        expect(body.body).toContain("yeet merge-gate: sibling #7 merged on `alpha` (feedfacefe).");
        expect(body.body).toContain("`goals/alpha/PLAN.md`");
        const logged = yield* TestConsole.logLines;
        expect(A.some(logged, (line) => Str.includes("told 1 of 1 open sibling PR(s) on `alpha`")(String(line)))).toBe(
          true
        );
      })
    );

    it.effect("a clean merge-tree is a clean probe; a failed pull-ref fetch or an unknown exit is unavailable", () =>
      Effect.gen(function* () {
        // Two packet siblings this time: #8 probes clean, #9's pull ref cannot be fetched.
        const twoSiblings = (call: GithubCall) =>
          call.path === "{repo}/pulls/9/files" ? { body: files("goals/alpha/README.md") } : routes(call);
        const github = recordedGithub(twoSiblings);
        const gitCalls: Array<string> = [];
        const git = ScriptedSpawner.make((command, args) => {
          gitCalls.push(A.join([command, ...args], " "));
          if (A.contains(args, "refs/pull/9/head")) return { stdout: "fatal: couldn't find remote ref", exit: 128 };
          if (A.contains(args, "merge-tree")) return { stdout: "treetreetree\n", exit: 0 };
          if (A.contains(args, "rev-parse")) return { stdout: "not a sha", exit: 128 };
          return { stdout: "", exit: 0 };
        });
        const report = yield* readPacketSiblings(context, 7).pipe(github.provide, provideSpawner(git));
        assertNone(report.baseSha);
        expect(A.map(report.siblings, (s) => [s.prNumber, s.probe, s.conflicts])).toEqual([
          [8, "clean", []],
          [9, "unavailable", []],
        ]);
        // The unfetchable head is never probed.
        expect(A.some(gitCalls, Str.includes(`merge-tree --write-tree --name-only origin/main ${OTHER_SHA}`))).toBe(
          false
        );
        const rendered = renderPacketSiblingsReport(report);
        expect(rendered).toContain("probed against origin/main\n");
        expect(rendered).toContain("#8 lane/eight (0123456789) shares `alpha`; no conflicts predicted");
        expect(rendered).toContain("#9 lane/nine (fedcba9876) shares `alpha`; probe unavailable");
      })
    );

    it.effect("a merge-tree exit other than 0 or 1 is an unavailable probe, never clean", () =>
      Effect.gen(function* () {
        const github = recordedGithub(routes);
        const git = ScriptedSpawner.make((_, args) =>
          A.contains(args, "merge-tree")
            ? { stdout: "fatal: not something we can merge", exit: 128 }
            : { stdout: "", exit: 0 }
        );
        const report = yield* readPacketSiblings(context, 7).pipe(github.provide, provideSpawner(git));
        expect(report.siblings[0]?.probe).toBe("unavailable");
      })
    );

    it.effect("one refused comment is a warning; the broadcast still reports what it posted", () =>
      Effect.gen(function* () {
        const refusing = (call: GithubCall) =>
          call.path === "{repo}/issues/8/comments" && call.method === "POST"
            ? { status: 403, body: { message: "Resource not accessible by integration" } }
            : routes(call);
        const github = recordedGithub(refusing);
        const report = yield* broadcastPacketSiblings(context, 7, MERGE_SHA).pipe(
          github.provide,
          provideSpawner(scriptedGit([]))
        );
        expect(A.map(report.siblings, (s) => s.prNumber)).toEqual([8]);
        const errors = yield* TestConsole.errorLines;
        expect(A.some(errors, (line) => Str.includes("a sibling broadcast failed")(String(line)))).toBe(true);
        const logged = yield* TestConsole.logLines;
        expect(A.some(logged, (line) => Str.includes("told 0 of 1 open sibling PR(s)")(String(line)))).toBe(true);
      })
    );

    it.effect("one sibling's files read failing is a warning; the other sibling is still told", () =>
      Effect.gen(function* () {
        // #8 shares the packet; #9's files read answers 502 every time.
        const flaky = (call: GithubCall) =>
          call.path === "{repo}/pulls/9/files" ? { status: 502, body: { message: "Bad Gateway" } } : routes(call);
        const github = recordedGithub(flaky);
        const report = yield* broadcastPacketSiblings(context, 7, MERGE_SHA).pipe(
          github.provide,
          provideSpawner(scriptedGit([]))
        );
        expect(A.map(report.siblings, (s) => s.prNumber)).toEqual([8]);
        const comments = A.filter(
          github.calls,
          (call) => call.method === "POST" && Str.includes("/comments")(call.path)
        );
        expect(A.map(comments, (call) => call.path)).toEqual(["{repo}/issues/8/comments"]);
        const errors = yield* TestConsole.errorLines;
        expect(A.some(errors, (line) => Str.includes("could not read the files of #9")(String(line)))).toBe(true);
      })
    );

    it.effect("a packet PR with no open sibling broadcasts nothing", () =>
      Effect.gen(function* () {
        const lonely = (call: GithubCall) =>
          call.path === "{repo}/pulls"
            ? { body: [pull(7, "lane/seven", "7777777777777777777777777777777777777777")] }
            : routes(call);
        const github = recordedGithub(lonely);
        const report = yield* broadcastPacketSiblings(context, 7, MERGE_SHA).pipe(
          github.provide,
          provideSpawner(scriptedGit([]))
        );
        expect(report.siblings).toEqual([]);
        expect(A.some(github.calls, (call) => call.method === "POST")).toBe(false);
      })
    );
  }
);

describe("SiblingsCommandOptions", () => {
  it("carries the porcelain flags and the PR number", () => {
    const options = SiblingsCommandOptions.make({
      base: "origin/main",
      head: "HEAD",
      packetDir: ".beep/yeet",
      pr: 2691,
    });
    expect(options.pr).toBe(2691);
    expect(options.base).toBe("origin/main");
  });
});
