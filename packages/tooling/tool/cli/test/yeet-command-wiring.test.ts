import { yeetCommand, yeetMonitorCommandRoute } from "@beep/repo-cli/commands/Yeet";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
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
        ["monitor", "--plan", "--state-root", "/tmp/yeet-command-wiring-state"],
        ["repair", "--plan"],
        ["pre-push-hook", "--plan"],
      ],
      (args) => runYeetCommand(args),
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
