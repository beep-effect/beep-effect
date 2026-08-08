import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { LintPolicySubcommand } from "@beep/repo-cli/test/Quality";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Order, pipe } from "effect";

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

describe("commands/Lint fast-path allowlist binding", () => {
  // bin-main.ts routes `beep lint <sub>` to the full command tree only when
  // <sub> is in the LintPolicySubcommand domain; a registered subcommand
  // missing from the domain is silently swallowed by the turbo lint aggregate
  // (the judge-rubric incident, 2026-08-08). This binds the two surfaces.
  it("LintPolicySubcommand exactly matches the subcommands registered on lintCommand", () => {
    const registered = pipe(
      lintCommand.subcommands,
      A.flatMap((group) => group.commands),
      A.map((command) => command.name)
    );
    expect(sortedNames(LintPolicySubcommand.literals)).toEqual(sortedNames(registered));
  });
});
