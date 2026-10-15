/**
 * The bootstrapper run: install Claude Desktop if missing, let the lawyer
 * sign in, hand Claude the practice gateway, then open a new chat with the
 * onboarding message. Each step probes its real state first and is skipped
 * when already satisfied, so a rerun picks up where the last one stopped. It
 * stops at the first failed step and always writes its report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import {
  ClaudeDesktopInstaller,
  ClaudeInstall,
  GatewayInstallState,
  newChatLink,
  ONBOARDING_FIRST_MESSAGE,
  OPEN_CLAUDE_LINK,
  SetupReport,
  SignInState,
  StepDone,
  StepFailed,
  StepOutcome,
  StepSkipped,
} from "./Setup.models.ts";
import {
  ClaudeState,
  ClaudeStatePollSchedule,
  GatewayBundle,
  InstallerDownload,
  InstallWaitSchedule,
  Lawyer,
  SetupHost,
} from "./Setup.services.ts";
import type { SetupFailure } from "./Setup.errors.ts";
import type { SetupStep } from "./Setup.models.ts";

/**
 * File name of the run report inside the bootstrapper's state folder.
 *
 * **Example** (Read the report name)
 *
 * ```ts
 * import { REPORT_FILE } from "@/Setup.program"
 *
 * console.log(REPORT_FILE) // "last-run.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPORT_FILE = "last-run.json";

const failedAs =
  (step: SetupStep) =>
  <R>(effect: Effect.Effect<StepOutcome, SetupFailure, R>): Effect.Effect<StepOutcome, never, R> =>
    Effect.catchTag(effect, "SetupFailure", (failure) =>
      Effect.succeed(StepFailed.make({ step, detail: failure.message }))
    );

const installClaude = Effect.gen(function* () {
  const host = yield* SetupHost;
  const lawyer = yield* Lawyer;
  const download = yield* InstallerDownload;
  const path = yield* Path.Path;
  const step = "claude-desktop" as const;

  if ((yield* host.claudeInstall) !== ClaudeInstall.Enum.missing) {
    return StepSkipped.make({ step, detail: "Claude Desktop is already installed." });
  }
  yield* lawyer.tell("Installing Claude. This takes a minute or two.");
  const installer = path.join(yield* host.stateDir, `Claude-Setup-${ClaudeDesktopInstaller.version}.exe`);
  yield* download.fetch(ClaudeDesktopInstaller, installer);
  const exitCode = yield* host.runInstaller(installer, ClaudeDesktopInstaller.silentArgs);
  const schedule = yield* InstallWaitSchedule;
  const install = yield* host.claudeInstall.pipe(
    Effect.repeat({ schedule, until: (found) => found !== ClaudeInstall.Enum.missing })
  );
  return install === ClaudeInstall.Enum.missing
    ? StepFailed.make({
        step,
        detail: `Claude did not finish installing (installer exit code ${exitCode}). Install it from claude.com/download, then run this setup again.`,
      })
    : StepDone.make({ step, detail: `Claude Desktop ${ClaudeDesktopInstaller.version} is installed.` });
}).pipe(failedAs("claude-desktop"));

// Watch a probe until it is satisfied while Enter stays a manual override; if the
// watch times out, ask the lawyer. True when the probe saw it, false when the
// lawyer confirmed it.
const watchUntil = Effect.fnUntraced(function* <A>(
  probe: Effect.Effect<A>,
  satisfied: (state: A) => boolean,
  timedOut: string
) {
  const lawyer = yield* Lawyer;
  const schedule = yield* ClaudeStatePollSchedule;
  const watched = probe.pipe(
    Effect.repeat({ schedule, until: satisfied }),
    Effect.map((state) => (satisfied(state) ? ("detected" as const) : ("timed-out" as const)))
  );
  // race keeps watching when the console cannot read Enter; the loser is interrupted.
  const result = yield* Effect.race(watched, Effect.as(lawyer.awaitEnter, "confirmed" as const));
  return yield* Match.value(result).pipe(
    Match.when("detected", () => Effect.succeed(true)),
    Match.when("confirmed", () => Effect.succeed(false)),
    Match.when("timed-out", () => Effect.as(lawyer.waitFor(timedOut), false)),
    Match.exhaustive
  );
});

// Watch the gateway probe until Claude lists the bundled version. Enter only asks
// for an immediate check: the step never trusts Enter (or a keypress left in the
// console buffer) over Claude's registry. True when Claude lists the bundled
// version, false when the watch timed out without it.
const watchForGateway = Effect.fnUntraced(function* (probe: Effect.Effect<GatewayInstallState>, notYet: string) {
  const lawyer = yield* Lawyer;
  const schedule = yield* ClaudeStatePollSchedule;
  const watched = probe.pipe(Effect.repeat({ schedule, until: GatewayInstallState.is.current }));
  const checkOnEnter = lawyer.awaitEnter.pipe(
    Effect.andThen(probe),
    Effect.tap((state) => (GatewayInstallState.is.current(state) ? Effect.void : lawyer.tell(notYet))),
    Effect.repeat({ until: GatewayInstallState.is.current })
  );
  // race takes the first success: the Enter loop succeeds only on a current check,
  // so a timed-out watch wins otherwise, and a console that cannot read Enter
  // leaves the watch running. The loser is interrupted.
  return GatewayInstallState.is.current(yield* Effect.race(watched, checkOnEnter));
});

const signIn = Effect.gen(function* () {
  const host = yield* SetupHost;
  const lawyer = yield* Lawyer;
  const claude = yield* ClaudeState;
  const step = "claude-sign-in" as const;
  const confirmed = StepDone.make({ step, detail: "Claude opened; the lawyer confirmed they are signed in." });
  const ask = "When you can see Claude's message box, come back to this window.";
  const state = yield* claude.signIn;
  if (SignInState.is["signed-in"](state)) {
    return StepSkipped.make({ step, detail: "Claude is already signed in." });
  }
  yield* host.openLink(OPEN_CLAUDE_LINK);
  const opening = "Claude is opening. Sign in with your Claude account there.";
  if (SignInState.is.unknown(state)) {
    yield* lawyer.waitFor(`${opening} ${ask}`);
    return confirmed;
  }
  yield* lawyer.tell(
    `\n${opening}\nThis window carries on by itself once you are signed in. If it does not, press Enter once you can see Claude's message box.`
  );
  return (yield* watchUntil(claude.signIn, SignInState.is["signed-in"], `Setup could not see the sign-in yet. ${ask}`))
    ? StepDone.make({ step, detail: "Claude opened and reported the sign-in." })
    : confirmed;
}).pipe(failedAs("claude-sign-in"));

const installGateway = Effect.gen(function* () {
  const host = yield* SetupHost;
  const lawyer = yield* Lawyer;
  const claude = yield* ClaudeState;
  const bundle = yield* GatewayBundle;
  const step = "gateway-extension" as const;
  const probe = claude.gateway(bundle.version);
  const state = yield* probe;
  if (GatewayInstallState.is.current(state)) {
    return StepSkipped.make({ step, detail: "Claude already has this version of the Practice Gateway." });
  }
  const file = yield* bundle.materialize(yield* host.stateDir);
  const action = GatewayInstallState.is.outdated(state) ? "Update" : "Install";
  yield* lawyer.tell(
    [
      "",
      `Claude will now show the Beep Practice Gateway. Click ${action} and confirm.`,
      "Claude will warn that this extension can access your computer and is not verified by Anthropic. That is expected for this firm tool.",
      `If Claude does not show it, open Claude's Settings, choose Extensions, and drag this file onto that page: ${file}`,
    ].join("\n")
  );
  yield* host.open(file);
  const back = "When Claude lists the Beep Practice Gateway as enabled, come back to this window.";
  if (GatewayInstallState.is.unknown(state)) {
    // Claude's registry cannot be read, so the lawyer's word is the only signal.
    yield* lawyer.waitFor(back);
    return StepDone.make({ step, detail: "The gateway was handed to Claude; the lawyer confirmed the install." });
  }
  const wanted = O.match(bundle.version, { onNone: () => "", onSome: (version) => ` ${version}` });
  const dragInstruction = `open Claude's Settings, choose Extensions, and drag this file onto that page: ${file}`;
  yield* lawyer.tell(
    "This window carries on by itself once Claude has it. If it does not, press Enter once Claude lists it as enabled."
  );
  return (yield* watchForGateway(
    probe,
    `Claude does not list the Beep Practice Gateway${wanted} yet. Click ${action} in Claude, or ${dragInstruction}`
  ))
    ? StepDone.make({ step, detail: "Claude lists the gateway at the bundled version." })
    : StepFailed.make({
        step,
        detail: `Claude still does not list the Beep Practice Gateway${wanted}. Open Claude's Settings, choose Extensions, drag this file onto that page, then run this setup again: ${file}`,
      });
}).pipe(failedAs("gateway-extension"));

const handOff = Effect.gen(function* () {
  const host = yield* SetupHost;
  const lawyer = yield* Lawyer;
  const copied = yield* host.copyToClipboard(ONBOARDING_FIRST_MESSAGE).pipe(
    Effect.as(true),
    Effect.catchTag("SetupFailure", (failure) =>
      Effect.logWarning("The onboarding message could not be copied.", failure).pipe(Effect.as(false))
    )
  );
  yield* host.openLink(newChatLink(ONBOARDING_FIRST_MESSAGE));
  const paste = copied
    ? "If the message is not already in the box, paste it (Ctrl+V) and press Send."
    : `If the message is not already in the box, type it and press Send: ${ONBOARDING_FIRST_MESSAGE}`;
  yield* lawyer.tell(
    [
      "",
      "Claude is opening a new chat with your first message.",
      "Use the Chat tab at the top of Claude (not Code or Cowork).",
      paste,
      "Claude will take you through the rest.",
    ].join("\n")
  );
  return StepDone.make({
    step: "onboarding-handoff",
    detail: copied
      ? "Claude opened a new chat with the onboarding message, which is also on the clipboard."
      : "Claude opened a new chat with the onboarding message; the clipboard copy failed.",
  });
}).pipe(failedAs("onboarding-handoff"));

const runUntilFailure = <R>(
  pending: ReadonlyArray<Effect.Effect<StepOutcome, never, R>>,
  done: ReadonlyArray<StepOutcome>
): Effect.Effect<ReadonlyArray<StepOutcome>, never, R> =>
  A.matchLeft(pending, {
    onEmpty: () => Effect.succeed(done),
    onNonEmpty: (head, tail) =>
      Effect.flatMap(head, (outcome) =>
        StepOutcome.guards.failed(outcome)
          ? Effect.succeed(A.append(done, outcome))
          : runUntilFailure(tail, A.append(done, outcome))
      ),
  });

const encodeReport = S.encodeEffect(S.fromJsonString(SetupReport, { space: 2 }));

const writeReport = Effect.fnUntraced(function* (report: SetupReport) {
  const host = yield* SetupHost;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(yield* host.stateDir, REPORT_FILE);
  yield* fs.writeFileString(file, `${yield* encodeReport(report)}\n`);
});

/**
 * Run every bootstrapper step in order, stopping at the first failure, and
 * write the report to the state folder.
 *
 * **Details**
 *
 * The bootstrapper stays dumb (SPEC): it installs, opens and waits; the
 * onboarding agent inside Claude does everything else. Steps probe Claude's
 * own state rather than the last report, so a rerun skips what is done. The
 * console stays open until the lawyer presses Enter, on success and on
 * failure. A report that cannot be written is logged, never fatal.
 *
 * **Example** (Run with fakes)
 *
 * ```ts
 * import { runSetup } from "@/Setup.program"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runSetup))
 * ```
 *
 * @category programs
 * @since 0.0.0
 */
export const runSetup = Effect.gen(function* () {
  const lawyer = yield* Lawyer;
  yield* lawyer.tell("Setting up this computer for your practice.");
  const steps: ReadonlyArray<
    Effect.Effect<StepOutcome, never, SetupHost | Lawyer | ClaudeState | InstallerDownload | GatewayBundle | Path.Path>
  > = [installClaude, signIn, installGateway, handOff];
  const outcomes = yield* runUntilFailure(steps, []);
  // runUntilFailure stops only at a failure, so no failure means every step ran.
  const failure = A.findFirst(outcomes, StepOutcome.guards.failed);
  const complete = O.isNone(failure);
  const report = SetupReport.make({ outcomes, complete, finishedAt: yield* DateTime.now });
  yield* writeReport(report).pipe(
    Effect.catchCause((cause) => Effect.logWarning("The setup report could not be written.", cause))
  );
  // The console closes when the program exits, so hold it until the lawyer has read the last line.
  yield* O.match(failure, {
    onNone: () =>
      lawyer.tell("\nPress Enter to close this window.").pipe(Effect.andThen(Effect.ignore(lawyer.awaitEnter))),
    onSome: (failed) => Effect.ignore(lawyer.waitFor(`Setup stopped: ${failed.detail}`)),
  });
  return report;
}).pipe(Effect.withSpan("PracticeSetup.run"));
