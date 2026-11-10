import {
  GITHUB_LEDGER_TIMER_CALENDAR,
  GithubLedgerTimerOptions,
  githubCommand,
  githubLedgerCommand,
  renderGithubLedgerTimerUnits,
  renderGithubSampleOutcome,
} from "@beep/repo-cli/commands/Github";
import { GithubIdentityLabel, SampleOutcome } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Str from "effect/String";

describe("github ledger command", () => {
  it("registers the ledger group under github with every subcommand", () => {
    const groups = A.flatMap(githubCommand.subcommands, (group) => group.commands);
    expect(A.map(groups, (command) => command.name)).toContain("ledger");
    expect(
      A.map(
        A.flatMap(githubLedgerCommand.subcommands, (group) => group.commands),
        (command) => command.name
      )
    ).toStrictEqual(["sample", "calibrate", "report", "show", "install-timer", "uninstall-timer"]);
  });

  it("renders a 5-minute persistent timer whose service carries no secret or environment", () => {
    const [service, timer] = renderGithubLedgerTimerUnits(
      GithubLedgerTimerOptions.make({ repoRoot: "/clones/beep", bunPath: "/opt/bun dir/bun" })
    );
    expect(service?.fileName).toBe("beep-github-ledger-sample.service");
    expect(service?.text).toContain("WorkingDirectory=/clones/beep\n");
    expect(service?.text).toContain('ExecStart="/opt/bun dir/bun" run beep github ledger sample --timer\n');
    expect(Str.includes("Environment")(service?.text ?? "")).toBe(false);
    expect(timer?.text).toContain(`OnCalendar=${GITHUB_LEDGER_TIMER_CALENDAR}\n`);
    expect(timer?.text).toContain("Persistent=true\n");
    expect(timer?.text).toContain("WantedBy=timers.target\n");
  });

  it("renders one line per sample outcome without detail beyond the step", () => {
    const alice = GithubIdentityLabel.make("user:alice");
    expect(
      A.map(
        [
          SampleOutcome.cases.Sampled.make({ identity: alice, at: DateTime.makeUnsafe(0), selfCost: "confirmed-free" }),
          SampleOutcome.cases.Skipped.make({ identity: alice, reason: "lease-held" }),
          SampleOutcome.cases.Failed.make({ entry: "OpRef", identity: O.none(), detail: "identity op-read-failed" }),
        ],
        renderGithubSampleOutcome
      )
    ).toStrictEqual([
      "sampled user:alice (confirmed-free)",
      "skipped user:alice (lease-held)",
      "failed OpRef: identity op-read-failed",
    ]);
  });
});
