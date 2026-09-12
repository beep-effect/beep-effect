import { yeetCommand, yeetMonitorCommandRoute } from "@beep/repo-cli/commands/Yeet";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import {
  buildYeetRunPlanWithMode,
  RepoRunContext,
  TurboPlanSnapshot,
  YeetRunPlanModeOptions,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Command } from "effect/unstable/cli";

const runYeetCommand = Command.runWith(yeetCommand, { version: "0.0.0" });

const commandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) }))
);

/**
 * Every subcommand name registered under `beep yeet`, flattened across the
 * subcommand groups the CLI builder produces.
 */
const subcommandNames: ReadonlyArray<string> = A.flatMap(yeetCommand.subcommands, (group) =>
  A.map(group.commands, (command) => command.name)
);

const findSubcommand = (name: string) =>
  A.findFirst(
    A.flatMap(yeetCommand.subcommands, (group) => group.commands),
    (command) => command.name === name
  );

describe("yeet merge-loop command wiring", () => {
  it.effect("dispatches the top-level publish and repair planners", () =>
    Effect.forEach(
      [
        ["--plan"],
        ["--plan", "--state-root", "/tmp/yeet-command-wiring-state"],
        ["monitor", "--plan", "--state-root", "/tmp/yeet-command-wiring-state"],
        ["repair", "--plan"],
        ["pre-push-hook", "--plan"],
      ],
      // Hosted runners check out a detached HEAD, where publish/monitor refuse with a
      // PR-branch-only guard after dispatch; this test proves dispatch, not the guard.
      //
      // Known residual: how far past the guard each route runs still depends on
      // the checkout, so a workstation feature branch executes more of
      // `Handler`/`Planner` here than a detached hosted HEAD does. The rows that
      // difference can mint are the #1068 class. The publish plan — the one row
      // it actually minted — is pinned deterministically by the
      // "yeet publish plan wiring" block below; closing the rest needs a temp
      // repository on a fixed branch plus a Turbo snapshot seam for
      // `hydrateYeetRunContext`, which is its own change.
      (args) => runYeetCommand(args).pipe(Effect.catchTag("YeetCommandError", () => Effect.void)),
      { discard: true }
    ).pipe(provideScopedLayer(commandTestLayer))
  );

  it.each(["sweep", "merge", "reply"])("registers the %s subcommand", (name) => {
    expect(subcommandNames).toContain(name);
  });

  it.each(["sweep", "merge", "reply"])("describes the %s subcommand in help output", (name) => {
    const command = findSubcommand(name);
    expect(command._tag).toBe("Some");
    expect(command._tag === "Some" ? command.value.description : undefined).toEqual(expect.any(String));
  });

  it("keeps the pre-existing subcommands registered", () => {
    expect(subcommandNames).toEqual(
      expect.arrayContaining(["verify", "repair", "publish", "monitor", "closeout", "status", "resume"])
    );
  });
});

describe("yeet publish plan wiring", () => {
  // Dispatching `yeet --plan` against the live checkout only reaches the publish
  // planner when the checkout happens to sit on a feature branch: on `main` and
  // on the detached HEAD hosted runners check out, the PR-branch-only guard
  // refuses first. That made one plan step executable locally and unreachable
  // hosted, and the row minted from the local measurement turned `main` red.
  // Planning from a fixed context reaches it on every checkout.
  const planContext = RepoRunContext.make({
    base: "origin/main",
    branch: "feat/yeet-command-wiring",
    cwd: "/repo",
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: "/repo",
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
  });
  const publishPlanArgs = (options: { readonly amend: boolean; readonly noEdit: boolean }): ReadonlyArray<string> =>
    pipe(
      buildYeetRunPlanWithMode(
        planContext,
        O.none(),
        YeetRunPlanModeOptions.make({
          amend: options.amend,
          fast: false,
          mode: "publish",
          monitor: false,
          noEdit: options.noEdit,
          pushOnly: false,
          startPrEarly: false,
          tier: "full",
        })
      ).steps,
      A.findFirst((step) => step.id === "commit:01-git-commit"),
      O.map((step) => step.args),
      O.getOrElse(() => A.empty<string>())
    );

  it("plans the commit step with the required-message placeholder", () => {
    expect(publishPlanArgs({ amend: false, noEdit: false })).toEqual([
      "commit",
      "-m",
      "<required-conventional-commit-message>",
    ]);
  });

  it("plans the amended commit step with the same placeholder", () => {
    expect(publishPlanArgs({ amend: true, noEdit: false })).toEqual([
      "commit",
      "--amend",
      "-m",
      "<required-conventional-commit-message>",
    ]);
    expect(publishPlanArgs({ amend: true, noEdit: true })).toEqual(["commit", "--amend", "--no-edit"]);
  });
});

describe("yeet monitor command routing", () => {
  it.each([
    [true, true, true, false, "classic"],
    [false, true, false, false, "invalid-until-event"],
    [false, true, true, true, "invalid-until-event"],
    [false, false, true, false, "merge-loop"],
    [false, true, false, true, "watch"],
    [false, false, false, false, "classic"],
  ] as const)(
    "routes plan=%s untilEvent=%s untilMerged=%s watch=%s to %s",
    (plan, untilEvent, untilMerged, watch, route) => {
      expect(yeetMonitorCommandRoute({ plan, untilEvent, untilMerged, watch })).toBe(route);
    }
  );

  it.effect("rejects --until-event before hydrating a monitor when --watch is absent", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(runYeetCommand(["monitor", "--until-event"]));

      expect(exit._tag).toBe("Failure");
      expect(String(exit)).toContain("requires --watch");
    }).pipe(provideScopedLayer(commandTestLayer))
  );
});

describe("yeet inbox command wiring", () => {
  it("registers the inbox subcommand with its list, ack, and append children", () => {
    expect(subcommandNames).toContain("inbox");

    const inbox = findSubcommand("inbox");
    expect(inbox._tag).toBe("Some");
    const children =
      inbox._tag === "Some"
        ? A.flatMap(inbox.value.subcommands, (group) => A.map(group.commands, (command) => command.name))
        : [];
    expect(children).toEqual(expect.arrayContaining(["list", "ack", "append"]));
  });
});
