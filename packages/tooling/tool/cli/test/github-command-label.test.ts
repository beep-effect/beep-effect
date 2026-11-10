import { loadDispatchTarget, makeRootCommand, resolveDispatchTarget } from "@beep/repo-cli/test/Dispatch";
import { commandLabelOf } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";

const leaf = (name: string) => Command.make(name);
const group = (name: string, children: ReadonlyArray<Command.Command.Any>) =>
  Command.make(name).pipe(Command.withSubcommands(children));

const root = group("beep", [
  group("yeet", [leaf("monitor"), group("job", [leaf("wait")])]),
  group("goals", [leaf("set-status")]),
  group("worktree", [leaf("remove")]),
]);

describe("commandLabelOf", () => {
  it("walks only known command names", () => {
    expect(commandLabelOf(root, ["yeet", "monitor", "--until-ready"])).toBe("yeet monitor");
    expect(commandLabelOf(root, ["yeet", "job", "wait", "6f00"])).toBe("yeet job wait");
    expect(commandLabelOf(root, ["goals", "set-status", "github-budget-ledger"])).toBe("goals set-status");
    expect(commandLabelOf(root, ["worktree", "remove", "some-lane", "--archive"])).toBe("worktree remove");
    expect(commandLabelOf(root, ["--log-level", "debug", "yeet", "monitor"])).toBe("yeet monitor");
    expect(commandLabelOf(root, [])).toBe("beep");
    expect(commandLabelOf(root, ["not-a-command"])).toBe("beep");
    expect(commandLabelOf(["yeet", "monitor"])(root)).toBe("yeet monitor");
  });

  it.effect("labels against the real dispatch root", () =>
    Effect.gen(function* () {
      const argv = ["yeet", "monitor", "--until-ready"];
      const commands = yield* loadDispatchTarget(resolveDispatchTarget(argv));
      const real = makeRootCommand(commands);
      expect(commandLabelOf(real, argv)).toBe("yeet monitor");
      // A group that was not imported is a stub with no children.
      expect(commandLabelOf(real, ["goals", "set-status", "slug"])).toBe("goals");
    })
  );
});
