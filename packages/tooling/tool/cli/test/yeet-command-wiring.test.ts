import { yeetCommand } from "@beep/repo-cli/commands/Yeet";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

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
      expect.arrayContaining(["verify", "repair", "publish", "monitor", "closeout", "status"])
    );
  });
});
