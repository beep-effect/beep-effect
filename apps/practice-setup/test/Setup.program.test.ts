import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { embeddedEntrySource } from "@/build";
import { SetupFailure } from "@/Setup.errors";
import {
  ClaudeDesktopInstaller,
  GATEWAY_EXTENSION_ID,
  gatewayInstallStateOf,
  newChatLink,
  ONBOARDING_FIRST_MESSAGE,
  OPEN_CLAUDE_LINK,
  PinnedInstaller,
  SetupReport,
  signInStateOf,
} from "@/Setup.models";
import { REPORT_FILE, runSetup } from "@/Setup.program";
import {
  appxListsClaude,
  ClaudeState,
  ClaudeStatePollSchedule,
  GatewayBundle,
  InstallerDownload,
  InstallWaitSchedule,
  Lawyer,
  SetupHost,
} from "@/Setup.services";
import type { ClaudeInstall, GatewayInstallState, SignInState, StepOutcome } from "@/Setup.models";

const STATE_DIR = "/state";
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const BUNDLE = "/state/practice-gateway.mcpb";
const BUNDLE_VERSION = "0.1.0";

interface Script {
  /** waitFor fails on the call with this index (0-based). */
  readonly cancelAt?: number;
  readonly clipboardFails?: boolean;
  readonly downloadFails?: boolean;
  /** Enter pressed while the sign-in is watched; the watched sign-in probe then never answers. */
  readonly enterOverride?: boolean;
  /** Gateway states the probe answers, in order; the last one repeats. */
  readonly gateway?: A.NonEmptyReadonlyArray<GatewayInstallState>;
  /** Enter presses while the gateway is watched, each asking for a check. */
  readonly gatewayEnters?: number;
  /** Install kinds `claudeInstall` answers, in order; the last one repeats. */
  readonly installs: A.NonEmptyReadonlyArray<ClaudeInstall>;
  /** Sign-in states the probe answers, in order; the last one repeats. */
  readonly signIn?: A.NonEmptyReadonlyArray<SignInState>;
}

// Answers the scripted values in order, repeating the last one; with `hangAfterFirst`
// only the first call answers, so a watch can only end by Enter.
const scripted = <A>(values: A.NonEmptyReadonlyArray<A>, hangAfterFirst = false) =>
  Effect.map(Ref.make(0), (calls) =>
    Ref.getAndUpdate(calls, (n) => n + 1).pipe(
      Effect.flatMap((n) =>
        hangAfterFirst && n > 0
          ? Effect.never
          : Effect.succeed(O.getOrElse(A.get(values, n), () => A.lastNonEmpty(values)))
      )
    )
  );

const harness = Effect.fnUntraced(function* (script: Script) {
  // One ordered log of what the lawyer saw and what was opened or copied.
  const events = yield* Ref.make<ReadonlyArray<string>>([]);
  const installersRun = yield* Ref.make<ReadonlyArray<string>>([]);
  const downloads = yield* Ref.make<ReadonlyArray<string>>([]);
  const expectedVersions = yield* Ref.make<ReadonlyArray<O.Option<string>>>([]);
  const handedOff = yield* Ref.make(false);
  const waits = yield* Ref.make(0);
  const enters = yield* Ref.make((script.enterOverride === true ? 1 : 0) + (script.gatewayEnters ?? 0));
  const log = (event: string) => Ref.update(events, A.append(event));

  const installProbe = yield* scripted(script.installs);
  const hang = script.enterOverride === true;
  const signInProbe = yield* scripted<SignInState>(script.signIn ?? ["signed-in"], hang);
  const gatewayProbe = yield* scripted<GatewayInstallState>(script.gateway ?? ["current"]);

  const host = SetupHost.of({
    claudeInstall: installProbe,
    runInstaller: Effect.fn("FakeHost.runInstaller")(function* (path) {
      yield* Ref.update(installersRun, A.append(path));
      return 0;
    }),
    open: Effect.fn("FakeHost.open")(function* (target) {
      yield* log(`open:${target}`);
    }),
    openLink: Effect.fn("FakeHost.openLink")(function* (link) {
      yield* log(`link:${link}`);
    }),
    copyToClipboard: Effect.fn("FakeHost.copyToClipboard")(function* (text) {
      yield* Ref.set(handedOff, true);
      if (script.clipboardFails === true) {
        return yield* SetupFailure.make({ message: "The message could not be copied to the clipboard." });
      }
      yield* log(`clipboard:${text}`);
    }),
    stateDir: Effect.succeed(STATE_DIR),
  });
  const claude = ClaudeState.of({
    signIn: signInProbe,
    gateway: Effect.fn("FakeClaude.gateway")(function* (expected) {
      yield* Ref.update(expectedVersions, A.append(expected));
      // Yield like a real file read, so a watch and an Enter check interleave.
      yield* Effect.yieldNow;
      return yield* gatewayProbe;
    }),
  });
  const download = InstallerDownload.of({
    fetch: Effect.fn("FakeDownload.fetch")(function* (_installer, destination) {
      if (script.downloadFails === true) {
        return yield* SetupFailure.make({ message: "The Claude installer could not be downloaded." });
      }
      yield* Ref.update(downloads, A.append(destination));
    }),
  });
  const lawyer = Lawyer.of({
    tell: Effect.fn("FakeLawyer.tell")(function* (text) {
      yield* log(`said:${text}`);
    }),
    waitFor: Effect.fn("FakeLawyer.waitFor")(function* (text) {
      yield* log(`asked:${text}`);
      if ((yield* Ref.getAndUpdate(waits, (n) => n + 1)) === script.cancelAt) {
        return yield* SetupFailure.make({ message: "Setup was stopped before it finished." });
      }
    }),
    // Enter arrives at the final hold, or during a watch while scripted presses remain; otherwise never.
    awaitEnter: Effect.gen(function* () {
      const pressed =
        (yield* Ref.get(handedOff)) || (yield* Ref.modify(enters, (n) => (n > 0 ? [true, n - 1] : [false, 0])));
      if (pressed) {
        yield* log("enter");
        return;
      }
      return yield* Effect.never;
    }),
  });
  const bundle = GatewayBundle.of({
    version: O.some(BUNDLE_VERSION),
    materialize: Effect.fn("FakeBundle.materialize")(function* () {
      yield* log("materialize");
      return BUNDLE;
    }),
  });

  const report = yield* runSetup.pipe(
    Effect.provideService(SetupHost, host),
    Effect.provideService(ClaudeState, claude),
    Effect.provideService(InstallerDownload, download),
    Effect.provideService(Lawyer, lawyer),
    Effect.provideService(GatewayBundle, bundle),
    Effect.provideService(InstallWaitSchedule, Schedule.recurs(2)),
    Effect.provideService(ClaudeStatePollSchedule, Schedule.recurs(2))
  );
  const fs = yield* FileSystem.FileSystem;
  const written = yield* fs.readFileString(`${STATE_DIR}/${REPORT_FILE}`);
  const all = yield* Ref.get(events);
  return {
    report,
    written: yield* S.decodeEffect(S.fromJsonString(SetupReport))(written),
    events: all,
    opened: A.filter(all, (event) => Str.startsWith("open:")(event) || Str.startsWith("link:")(event)),
    said: pipe(
      all,
      A.filter((event) => Str.startsWith("said:")(event) || Str.startsWith("asked:")(event)),
      A.map(Str.replace(/^(said|asked):/, ""))
    ),
    asked: A.filter(all, Str.startsWith("asked:")),
    expectedVersions: yield* Ref.get(expectedVersions),
    installersRun: yield* Ref.get(installersRun),
    downloads: yield* Ref.get(downloads),
  };
});

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);

const run = Effect.fn("run")(function* (script: Script) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(STATE_DIR, { recursive: true });
  return yield* harness(script);
});

const steps = (report: SetupReport): ReadonlyArray<string> =>
  A.map(report.outcomes, (outcome: StepOutcome) => `${outcome.step}:${outcome.outcome}`);

const details = (report: SetupReport): ReadonlyArray<string> =>
  A.map(report.outcomes, (outcome: StepOutcome) => outcome.detail);

const saidAny = (said: ReadonlyArray<string>, fragment: string): boolean =>
  A.some(said, (line) => Str.includes(fragment)(line));

const HANDOFF_LINK = `link:${newChatLink(ONBOARDING_FIRST_MESSAGE)}`;

it.layer(Platform, { timeout: "5 seconds" })("runSetup", (it) => {
  it.effect("watches Claude until the sign-in and the gateway show up, then hands off and holds", () =>
    Effect.gen(function* () {
      const result = yield* run({
        installs: ["per-user"],
        signIn: ["signed-out", "signed-out", "signed-in"],
        gateway: ["missing", "missing", "current"],
      });
      expect(steps(result.report)).toEqual([
        "claude-desktop:skipped",
        "claude-sign-in:done",
        "gateway-extension:done",
        "onboarding-handoff:done",
      ]);
      expect(details(result.report)[1]).toBe("Claude opened and reported the sign-in.");
      expect(details(result.report)[2]).toBe("Claude lists the gateway at the bundled version.");
      expect(result.report.complete).toBe(true);
      expect(result.opened).toEqual([`link:${OPEN_CLAUDE_LINK}`, `open:${BUNDLE}`, HANDOFF_LINK]);
      expect(result.asked).toEqual([]);
      expect(result.expectedVersions).toEqual(A.replicate(O.some(BUNDLE_VERSION), 3));
      expect(result.downloads).toEqual([]);
      expect(steps(result.written)).toEqual(steps(result.report));
      // The console holds after the hand-off until the lawyer presses Enter.
      expect(A.takeRight(result.events, 2)).toEqual(["said:\nPress Enter to close this window.", "enter"]);
    })
  );

  it.effect("warns about Claude's trust prompt before opening the gateway", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], gateway: ["missing", "current"] });
      const warned = A.findFirstIndex(result.events, (event) =>
        Str.includes("can access your computer and is not verified by Anthropic")(event)
      );
      const opened = A.findFirstIndex(result.events, (event) => event === `open:${BUNDLE}`);
      expect(O.getOrThrow(warned)).toBeLessThan(O.getOrThrow(opened));
      expect(saidAny(result.said, "That is expected for this firm tool.")).toBe(true);
      expect(saidAny(result.said, "Click Install and confirm.")).toBe(true);
    })
  );

  it.effect("skips sign-in and gateway on a rerun where both are already satisfied", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], signIn: ["signed-in"], gateway: ["current"] });
      expect(steps(result.report)).toEqual([
        "claude-desktop:skipped",
        "claude-sign-in:skipped",
        "gateway-extension:skipped",
        "onboarding-handoff:done",
      ]);
      expect(result.opened).toEqual([HANDOFF_LINK]);
      expect(A.contains(result.events, "materialize")).toBe(false);
    })
  );

  it.effect("opens the bundle again as an update when Claude lists another gateway version", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], gateway: ["outdated", "outdated", "current"] });
      expect(steps(result.report)[2]).toBe("gateway-extension:done");
      expect(result.opened).toEqual([`open:${BUNDLE}`, HANDOFF_LINK]);
      expect(saidAny(result.said, "Click Update and confirm.")).toBe(true);
    })
  );

  it.effect("asks the lawyer when Claude's files cannot tell", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], signIn: ["unknown"], gateway: ["unknown"] });
      expect(steps(result.report)).toEqual([
        "claude-desktop:skipped",
        "claude-sign-in:done",
        "gateway-extension:done",
        "onboarding-handoff:done",
      ]);
      expect(details(result.report)[1]).toBe("Claude opened; the lawyer confirmed they are signed in.");
      expect(details(result.report)[2]).toBe("The gateway was handed to Claude; the lawyer confirmed the install.");
      expect(result.asked).toHaveLength(2);
    })
  );

  it.effect("asks the lawyer once the watch times out without seeing the sign-in", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], signIn: ["signed-out"] });
      expect(steps(result.report)[1]).toBe("claude-sign-in:done");
      expect(details(result.report)[1]).toBe("Claude opened; the lawyer confirmed they are signed in.");
      expect(result.asked).toHaveLength(1);
      expect(saidAny(result.said, "Setup could not see the sign-in yet.")).toBe(true);
    })
  );

  it.effect("takes Enter as a manual override for the sign-in, never for the gateway", () =>
    Effect.gen(function* () {
      const result = yield* run({
        installs: ["per-user"],
        signIn: ["signed-out"],
        gateway: ["missing"],
        enterOverride: true,
      });
      expect(steps(result.report)).toEqual([
        "claude-desktop:skipped",
        "claude-sign-in:done",
        "gateway-extension:failed",
      ]);
      expect(details(result.report)[1]).toBe("Claude opened; the lawyer confirmed they are signed in.");
      expect(details(result.report)[2]).toBe(
        `Claude still does not list the Beep Practice Gateway ${BUNDLE_VERSION}. Open Claude's Settings, choose Extensions, drag this file onto that page, then run this setup again: ${BUNDLE}`
      );
      expect(result.opened).toEqual([`link:${OPEN_CLAUDE_LINK}`, `open:${BUNDLE}`]);
      expect(result.asked).toEqual([`asked:Setup stopped: ${details(result.report)[2]}`]);
    })
  );

  it.effect("keeps watching when Enter is pressed while Claude still lists the old gateway", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], gateway: ["outdated"], gatewayEnters: 1 });
      expect(steps(result.report)).toEqual([
        "claude-desktop:skipped",
        "claude-sign-in:skipped",
        "gateway-extension:failed",
      ]);
      expect(result.report.complete).toBe(false);
      expect(
        saidAny(
          result.said,
          `Claude does not list the Beep Practice Gateway ${BUNDLE_VERSION} yet. Click Update in Claude, or open Claude's Settings, choose Extensions, and drag this file onto that page: ${BUNDLE}`
        )
      ).toBe(true);
      expect(details(result.report)[2]).toBe(
        `Claude still does not list the Beep Practice Gateway ${BUNDLE_VERSION}. Open Claude's Settings, choose Extensions, drag this file onto that page, then run this setup again: ${BUNDLE}`
      );
      // The hand-off never opens on a stale gateway.
      expect(result.opened).toEqual([`open:${BUNDLE}`]);
    })
  );

  it.effect("puts the first message on the clipboard and points the lawyer at the Chat tab", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"] });
      const clipboard = A.findFirstIndex(result.events, (event) => event === `clipboard:${ONBOARDING_FIRST_MESSAGE}`);
      const link = A.findFirstIndex(result.events, (event) => event === HANDOFF_LINK);
      expect(O.getOrThrow(clipboard)).toBeLessThan(O.getOrThrow(link));
      expect(saidAny(result.said, "If the message is not already in the box, paste it (Ctrl+V) and press Send.")).toBe(
        true
      );
      expect(saidAny(result.said, "Use the Chat tab")).toBe(true);
    })
  );

  it.effect("still hands off when the clipboard copy fails, asking the lawyer to type the message", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], clipboardFails: true });
      expect(steps(result.report)[3]).toBe("onboarding-handoff:done");
      expect(details(result.report)[3]).toContain("the clipboard copy failed");
      expect(saidAny(result.said, `type it and press Send: ${ONBOARDING_FIRST_MESSAGE}`)).toBe(true);
      expect(result.report.complete).toBe(true);
    })
  );

  it.effect("downloads and runs the pinned installer when Claude is missing", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["missing", "missing", "per-user"] });
      const installer = `${STATE_DIR}/Claude-Setup-${ClaudeDesktopInstaller.version}.exe`;
      expect(result.downloads).toEqual([installer]);
      expect(result.installersRun).toEqual([installer]);
      expect(steps(result.report)[0]).toBe("claude-desktop:done");
      expect(result.report.complete).toBe(true);
    })
  );

  it.effect("accepts an administrator's MSIX install as installed", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["msix"] });
      expect(steps(result.report)[0]).toBe("claude-desktop:skipped");
    })
  );

  it.effect("stops before opening anything when the download fails", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["missing"], downloadFails: true });
      expect(steps(result.report)).toEqual(["claude-desktop:failed"]);
      expect(result.report.complete).toBe(false);
      expect(result.installersRun).toEqual([]);
      expect(result.opened).toEqual([]);
      expect(A.some(result.said, (line) => line.startsWith("Setup stopped: The Claude installer"))).toBe(true);
      expect(saidAny(result.said, "Press Enter to close this window.")).toBe(false);
    })
  );

  it.effect("fails the install step when Claude never appears", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["missing"] });
      expect(steps(result.report)).toEqual(["claude-desktop:failed"]);
      expect(details(result.report)[0]).toContain("installer exit code 0");
    })
  );

  it.effect("stops at sign-in when the lawyer cancels and never opens the gateway", () =>
    Effect.gen(function* () {
      const result = yield* run({ installs: ["per-user"], signIn: ["unknown"], cancelAt: 0 });
      expect(steps(result.report)).toEqual(["claude-desktop:skipped", "claude-sign-in:failed"]);
      expect(result.opened).toEqual([`link:${OPEN_CLAUDE_LINK}`]);
    })
  );
});

const APPDATA_CLAUDE = "/appdata/Claude";
const MSIX_CLAUDE = "/local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude";

const hostWith = (install: ClaudeInstall) =>
  Layer.succeed(
    SetupHost,
    SetupHost.of({
      claudeInstall: Effect.succeed(install),
      runInstaller: Effect.fn("ProbeHost.runInstaller")(function* () {
        return 0;
      }),
      open: Effect.fn("ProbeHost.open")(function* () {}),
      openLink: Effect.fn("ProbeHost.openLink")(function* () {}),
      copyToClipboard: Effect.fn("ProbeHost.copyToClipboard")(function* () {}),
      stateDir: Effect.succeed(STATE_DIR),
    })
  );

// The live probes over a fresh in-memory disk, with the given files written first.
const probe = Effect.fnUntraced(function* <A>(
  use: (claude: ClaudeState["Service"]) => Effect.Effect<A>,
  options: {
    readonly files?: ReadonlyArray<readonly [string, string]>;
    readonly install?: ClaudeInstall;
    readonly env?: Record<string, string>;
  } = {}
) {
  const context = yield* Layer.build(
    ClaudeState.layer.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          hostWith(options.install ?? "per-user"),
          MemoryFileSystem.layer,
          BunPath.layer,
          ConfigProvider.layer(
            ConfigProvider.fromUnknown(options.env ?? { APPDATA: "/appdata", LOCALAPPDATA: "/local" })
          )
        )
      )
    )
  );
  const fs = Context.get(context, FileSystem.FileSystem);
  yield* Effect.forEach(options.files ?? [], ([file, text]) =>
    fs
      .makeDirectory(Str.slice(0, Str.lastIndexOf("/")(file).pipe(O.getOrElse(() => 0)))(file), { recursive: true })
      .pipe(Effect.andThen(fs.writeFileString(file, text)))
  );
  // Probes read Config when they run, so they run inside the built context.
  return yield* use(Context.get(context, ClaudeState)).pipe(Effect.provideContext(context));
});

const registry = (version: string) =>
  `{"extensions":{"other":1,"${GATEWAY_EXTENSION_ID}":{"id":"${GATEWAY_EXTENSION_ID}","version":"${version}","hash":"ab"}}}`;

describe("ClaudeState probes", () => {
  it.effect("reads signed-out before Claude has written its config", () =>
    Effect.gen(function* () {
      expect(yield* probe((claude) => claude.signIn)).toBe("signed-out");
    })
  );

  it.effect("reads signed-in once config.json carries an account id, ignoring other fields", () =>
    Effect.gen(function* () {
      const files = [[`${APPDATA_CLAUDE}/config.json`, '{"locale":"en-US","lastKnownAccountUuid":"x"}']] as const;
      expect(yield* probe((claude) => claude.signIn, { files })).toBe("signed-in");
    })
  );

  it.effect("reads signed-out while the account id is absent or empty", () =>
    Effect.gen(function* () {
      const empty = [[`${APPDATA_CLAUDE}/config.json`, '{"lastKnownAccountUuid":""}']] as const;
      const absent = [[`${APPDATA_CLAUDE}/config.json`, '{"locale":"en-US"}']] as const;
      expect(yield* probe((claude) => claude.signIn, { files: empty })).toBe("signed-out");
      expect(yield* probe((claude) => claude.signIn, { files: absent })).toBe("signed-out");
    })
  );

  it.effect("cannot tell from an undecodable config", () =>
    Effect.gen(function* () {
      const garbage = [[`${APPDATA_CLAUDE}/config.json`, "{not json"]] as const;
      const wrongType = [[`${APPDATA_CLAUDE}/config.json`, '{"lastKnownAccountUuid":42}']] as const;
      expect(yield* probe((claude) => claude.signIn, { files: garbage })).toBe("unknown");
      expect(yield* probe((claude) => claude.signIn, { files: wrongType })).toBe("unknown");
    })
  );

  it.effect("cannot tell when the account has no APPDATA folder", () =>
    Effect.gen(function* () {
      expect(yield* probe((claude) => claude.signIn, { env: {} })).toBe("unknown");
      expect(yield* probe((claude) => claude.gateway(O.none()), { env: {} })).toBe("unknown");
    })
  );

  it.effect("reads the MSIX install's virtualized data folder", () =>
    Effect.gen(function* () {
      const files = [
        [`${MSIX_CLAUDE}/config.json`, '{"lastKnownAccountUuid":"x"}'],
        [`${MSIX_CLAUDE}/extensions-installations.json`, registry(BUNDLE_VERSION)],
      ] as const;
      expect(yield* probe((claude) => claude.signIn, { files, install: "msix" })).toBe("signed-in");
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)), { files, install: "msix" })).toBe(
        "current"
      );
      expect(yield* probe((claude) => claude.signIn, { files })).toBe("signed-out");
    })
  );

  it.effect("reads the gateway as missing, current or outdated from the registry", () =>
    Effect.gen(function* () {
      const file = `${APPDATA_CLAUDE}/extensions-installations.json`;
      const listed = [[file, registry(BUNDLE_VERSION)]] as const;
      const other = [[file, '{"extensions":{"other":{"version":"1"}}}']] as const;
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)))).toBe("missing");
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)), { files: other })).toBe("missing");
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)), { files: listed })).toBe("current");
      expect(yield* probe((claude) => claude.gateway(O.some("0.2.0")), { files: listed })).toBe("outdated");
      expect(yield* probe((claude) => claude.gateway(O.none()), { files: listed })).toBe("current");
    })
  );

  it.effect("cannot tell from an undecodable registry or gateway entry", () =>
    Effect.gen(function* () {
      const file = `${APPDATA_CLAUDE}/extensions-installations.json`;
      const garbage = [[file, "[]"]] as const;
      const badEntry = [[file, `{"extensions":{"${GATEWAY_EXTENSION_ID}":{"version":1}}}`]] as const;
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)), { files: garbage })).toBe("unknown");
      expect(yield* probe((claude) => claude.gateway(O.some(BUNDLE_VERSION)), { files: badEntry })).toBe("unknown");
    })
  );
});

// Serves the URL's last path segment as the body, so each test picks its bytes.
const Serving = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request, url) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, new Response(Str.slice(1)(url.pathname))))
  )
);

const DownloadLayer = InstallerDownload.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(Serving, BunCrypto.layer, MemoryFileSystem.layer))
);

const pinned = (body: string) =>
  PinnedInstaller.make({ version: "1", url: `https://example.test/${body}`, sha256: ABC_SHA256, silentArgs: [] });

it.layer(DownloadLayer, { timeout: "5 seconds" })("InstallerDownload", (it) => {
  it.effect("writes an installer whose SHA-256 matches the pin", () =>
    Effect.gen(function* () {
      const download = yield* InstallerDownload;
      const fs = yield* FileSystem.FileSystem;
      yield* download.fetch(pinned("abc"), "/match.exe");
      expect(yield* fs.readFileString("/match.exe")).toBe("abc");
    })
  );

  it.effect("refuses and never writes an installer with another SHA-256", () =>
    Effect.gen(function* () {
      const download = yield* InstallerDownload;
      const fs = yield* FileSystem.FileSystem;
      const error = yield* Effect.flip(download.fetch(pinned("xyz"), "/mismatch.exe"));
      expect(error.message).toBe(
        "The downloaded Claude installer did not match its expected fingerprint, so it was not run."
      );
      expect(yield* fs.exists("/mismatch.exe")).toBe(false);
    })
  );
});

describe("bootstrapper helpers", () => {
  it("finds the Claude package family in Get-AppxPackage output", () => {
    expect(appxListsClaude("Claude_pzs8sxrjxfjjc\r\n")).toBe(true);
    expect(appxListsClaude("Other_123\r\n")).toBe(false);
  });

  it("decides sign-in and gateway states from file text", () => {
    expect(signInStateOf('{"lastKnownAccountUuid":"a"}')).toBe("signed-in");
    expect(signInStateOf("null")).toBe("unknown");
    expect(gatewayInstallStateOf(registry("1"), O.some("1"))).toBe("current");
    expect(gatewayInstallStateOf(O.some("2"))(registry("1"))).toBe("outdated");
    expect(gatewayInstallStateOf("{}", O.none())).toBe("unknown");
  });

  it("URL-encodes the onboarding message into a claude:// link", () => {
    expect(newChatLink("Set up & go?")).toBe("claude://claude.ai/new?q=Set%20up%20%26%20go%3F");
  });

  it("embeds the bundle through a static file import and stamps its version", () => {
    const source = embeddedEntrySource("../../src", "0.1.0");
    expect(source).toContain('import bundle from "./practice-gateway.mcpb" with { type: "file" };');
    expect(source).toContain('import { main } from "../../src/bin.ts";');
    expect(source).toContain('import { EmbeddedGateway } from "../../src/Setup.models.ts";');
    expect(source).toContain('main(O.some(EmbeddedGateway.make({ bundle, version: "0.1.0" })));');
  });

  it("pins a lower-case SHA-256 for the Claude installer", () => {
    expect(ClaudeDesktopInstaller.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(ClaudeDesktopInstaller.url).toContain(ClaudeDesktopInstaller.version);
  });
});
