// `yeet publish --stack-on` and `yeet open --stack-on` (goals/yeet-async-merge-and-stacks,
// slice C): resolving the layer before anything is committed, and linking it once
// its pull request exists. GitHub answers with the bodies the slice C P0 probes
// observed on 2026-11-13 (research/stack-p0-probes-2026-11.md), served to the
// real `@beep/github` client through a recorded `fetch`; git is scripted.
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import {
  defaultYeetRunOptions,
  linkYeetStackLayer,
  RepoRunContext,
  resolveYeetPublishStackLayer,
  resolveYeetStackPublish,
  TurboPlanSnapshot,
  YeetStackPublishDecision,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { githubCallLine, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const PARENT = 3157;
const CHILD = 3158;
const STACK = 3159;
const PARENT_HEAD = Str.repeat(40)("a");
const CHILD_HEAD = Str.repeat(40)("b");
const MAIN = Str.repeat(40)("c");

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "probe/stack-c-h",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
});

const stackRef = (position: number) => ({
  id: 3479922,
  number: STACK,
  position,
  size: 2,
  base: { ref: "main", sha: null },
});

const parentBody = (overrides: Readonly<Record<string, unknown>> = {}) =>
  restPullRequest({
    number: PARENT,
    head: { ref: "probe/stack-c-g", sha: PARENT_HEAD },
    base: { ref: "main", sha: MAIN },
    ...overrides,
  });

const childBody = (overrides: Readonly<Record<string, unknown>> = {}) =>
  restPullRequest({
    number: CHILD,
    head: { ref: "probe/stack-c-h", sha: CHILD_HEAD },
    base: { ref: "probe/stack-c-g", sha: PARENT_HEAD },
    ...overrides,
  });

const layerBody = (number: number, ref: string, sha: string) => ({
  number,
  state: "open",
  draft: true,
  merged_at: null,
  head: { ref, sha },
  base: { ref: number === PARENT ? "main" : "probe/stack-c-g" },
});

// The 201 body of `POST stacks` and of `GET stacks/{n}`.
const stackBody = {
  id: 3479922,
  number: STACK,
  node_id: "PRS_kw",
  base: { ref: "main" },
  open: true,
  created_at: "2026-11-13T00:51:08Z",
  pull_requests: [layerBody(PARENT, "probe/stack-c-g", PARENT_HEAD), layerBody(CHILD, "probe/stack-c-h", CHILD_HEAD)],
};

const rules: GithubAnswer = {
  body: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "Lint" }] } }],
};

const lintOnMain = (conclusion: string): GithubAnswer => ({
  body: { total_count: 1, check_runs: [{ id: 1, name: "Lint", status: "completed", conclusion }] },
});

interface Fixture {
  readonly builtOnParent?: boolean;
  readonly own?: GithubAnswer;
  readonly parent?: GithubAnswer;
  readonly trunkCheck?: string;
}

// Every read the resolve makes, by path; anything else is a 404.
const readTable = (fixture: Fixture): Readonly<Record<string, GithubAnswer>> => ({
  "{repo}/pulls": fixture.own ?? { body: [] },
  [`{repo}/pulls/${PARENT}`]: fixture.parent ?? { body: parentBody() },
  "{repo}": { body: { default_branch: "main" } },
  "{repo}/rules/branches/main": rules,
  [`{repo}/commits/${MAIN}/check-runs`]: lintOnMain(fixture.trunkCheck ?? "success"),
  [`{repo}/stacks/${STACK}`]: { body: stackBody },
});

const routes =
  (fixture: Fixture) =>
  (call: GithubCall): GithubAnswer | undefined =>
    call.method === "GET" ? readTable(fixture)[call.path] : undefined;

const gitSpawner = (builtOnParent: boolean) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    if (Str.includes("remote get-url --push origin")(line)) {
      return { exit: 0, stdout: "git@github.com:beep-effect/beep-effect.git\n" };
    }
    if (Str.includes("merge-base --is-ancestor")(line)) return { exit: builtOnParent ? 0 : 1 };
    if (Str.includes("rev-list")(line)) return { exit: 0, stdout: `${MAIN}\n` };
    if (Str.includes("fetch")(line)) return { exit: 0 };
    return { exit: 1, stdout: `unscripted: ${line}` };
  });

const resolve = (stackOn: O.Option<number>, fixture: Fixture = {}) => {
  const github = recordedGithub(routes(fixture));
  const spawner = gitSpawner(fixture.builtOnParent ?? true);
  const run = resolveYeetStackPublish(context, stackOn).pipe(
    github.provide,
    Effect.provideServiceEffect(Git, Git.make),
    provideSpawner(spawner)
  );
  const lines = () => A.map(github.calls, githubCallLine);
  const gitLines = () => A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "));
  return { run, lines, gitLines };
};

const layer = (stackNumber: O.Option<number>) =>
  YeetStackPublishDecision.cases.Layer.make({
    parentNumber: PARENT,
    parentHeadRef: "probe/stack-c-g",
    parentHeadSha: PARENT_HEAD,
    trunk: "main",
    stackNumber,
    parentMoved: false,
  });

describe("resolveYeetStackPublish without --stack-on", () => {
  it.effect("publishes on the trunk when the branch has no pull request, reading nothing else", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.none());
      const resolved = yield* fixture.run;
      assertNone(resolved);
      expect(fixture.lines()).toEqual(["GET {repo}/pulls"]);
    })
  );

  it.effect("publishes on the trunk when the branch's pull request is not stacked", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.none(), { own: { body: [childBody({ base: { ref: "main", sha: MAIN } })] } });
      const resolved = yield* fixture.run;
      assertNone(resolved);
      expect(fixture.lines()).toEqual(["GET {repo}/pulls"]);
    })
  );

  it.effect("finds the parent of a stacked layer from its stack and keeps the link", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.none(), {
        own: { body: [childBody({ stack: stackRef(2) })] },
        parent: { body: parentBody({ stack: stackRef(1) }) },
      });
      const resolved = yield* fixture.run;
      assertSome(resolved, layer(O.some(STACK)));
      // An existing layer's stack is already open: the trunk's health is not read.
      expect(fixture.lines()).toEqual([
        "GET {repo}/pulls",
        `GET {repo}/stacks/${STACK}`,
        `GET {repo}/pulls/${PARENT}`,
        "GET {repo}",
      ]);
    })
  );

  it.effect("publishes on the trunk when the inference read fails", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.none(), { own: { status: 500, body: { message: "Server Error" } } });
      const resolved = yield* fixture.run;
      assertNone(resolved);
      expect(fixture.lines()).toEqual(["GET {repo}/pulls"]);
    })
  );
});

describe("resolveYeetStackPublish with --stack-on", () => {
  it.effect("opens a new layer over a green trunk after fetching the parent's branch", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.some(PARENT));
      const resolved = yield* fixture.run;
      assertSome(resolved, layer(O.none()));
      expect(fixture.lines()).toEqual([
        "GET {repo}/pulls",
        `GET {repo}/pulls/${PARENT}`,
        "GET {repo}",
        "GET {repo}/rules/branches/main",
        `GET {repo}/commits/${MAIN}/check-runs`,
      ]);
      expect(
        A.some(fixture.gitLines(), Str.includes("refs/heads/probe/stack-c-g:refs/remotes/origin/probe/stack-c-g"))
      ).toBe(true);
      expect(A.some(fixture.gitLines(), Str.includes(`merge-base --is-ancestor ${PARENT_HEAD} HEAD`))).toBe(true);
    })
  );

  it.effect("refuses over a red trunk", () =>
    Effect.gen(function* () {
      const error = yield* resolve(O.some(PARENT), { trunkCheck: "failure" }).run.pipe(Effect.flip);
      expect(error.message).toBe(
        `yeet publish --stack-on refused (trunk-red): main's required checks are red at ${Str.slice(0, 10)(MAIN)} (Lint); open a stack only on a green trunk`
      );
    })
  );

  it.effect("refuses a merged parent", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.some(PARENT), {
        parent: { body: parentBody({ state: "closed", merged: true, merged_at: "2026-11-13T00:42:20Z" }) },
      });
      const error = yield* fixture.run.pipe(Effect.flip);
      expect(error.message).toBe(
        `yeet publish --stack-on refused (parent-not-open): #${PARENT} is merged; publish on main without --stack-on`
      );
    })
  );

  it.effect("refuses a branch that does not contain the parent's head", () =>
    Effect.gen(function* () {
      const error = yield* resolve(O.some(PARENT), { builtOnParent: false }).run.pipe(Effect.flip);
      expect(error.message).toContain("--stack-on refused (not-built-on-parent)");
      expect(error.message).toContain("merge origin/probe/stack-c-g into this branch first");
    })
  );

  it.effect("fails when the branch's own pull request cannot be read", () =>
    Effect.gen(function* () {
      const fixture = resolve(O.some(PARENT), { own: { status: 500, body: { message: "Server Error" } } });
      const error = yield* fixture.run.pipe(Effect.flip);
      expect(error.message).toContain("failed (");
      expect(fixture.lines()).toEqual(["GET {repo}/pulls"]);
    })
  );
});

it.layer(NodeCrypto.layer)("resolveYeetPublishStackLayer", (it) => {
  it.effect("reads nothing for a --no-pr trunk publish", () =>
    Effect.gen(function* () {
      const spawner = gitSpawner(true);
      const resolved = yield* resolveYeetPublishStackLayer(context, defaultYeetRunOptions({ pr: false })).pipe(
        Effect.provideServiceEffect(Git, Git.make),
        provideSpawner(spawner)
      );
      assertNone(resolved);
      expect(spawner.spawns).toHaveLength(0);
    })
  );

  it.effect("resolves --stack-on through the gh login", () =>
    Effect.gen(function* () {
      const github = recordedGithub(routes({}));
      const resolved = yield* resolveYeetPublishStackLayer(
        context,
        defaultYeetRunOptions({ stackOn: O.some(PARENT) })
      ).pipe(github.provide, Effect.provideServiceEffect(Git, Git.make), provideSpawner(gitSpawner(true)));
      assertSome(resolved, layer(O.none()));
    })
  );
});

describe("linkYeetStackLayer", () => {
  it.effect("links the layer onto its parent, parent first", () =>
    Effect.gen(function* () {
      const github = recordedGithub((call) =>
        call.method === "POST" && call.path === "{repo}/stacks" ? { status: 201, body: stackBody } : undefined
      );
      const stack = yield* linkYeetStackLayer(PARENT, CHILD).pipe(github.provide);
      expect(stack.number).toBe(STACK);
      deepStrictEqual(
        A.map(github.calls, (call) => [githubCallLine(call), call.body]),
        [["POST {repo}/stacks", { pull_requests: [PARENT, CHILD] }]]
      );
    })
  );

  it.effect("fails with GitHub's sentence and the repair hint when GitHub refuses the link", () =>
    Effect.gen(function* () {
      const sentence = `Pull requests #${PARENT}, #${CHILD} are already part of a stack`;
      const github = recordedGithub(() => ({ status: 422, body: { message: sentence, status: "422" } }));
      const error = yield* linkYeetStackLayer(PARENT, CHILD).pipe(github.provide, Effect.flip);
      expect(error.message).toBe(
        `yeet could not link #${PARENT} and #${CHILD} into a stack: GitHub answered "${sentence}". Pull request #${CHILD} is open; run the same command again to retry the link.`
      );
    })
  );
});
