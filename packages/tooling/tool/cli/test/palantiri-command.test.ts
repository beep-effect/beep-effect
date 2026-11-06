import { Git } from "@beep/git/Git";
import {
  AccountHeadroomInput,
  AccountHeadroomSource,
  AccountsReportInputJson,
  AccountsWindowRemaining,
  HostPressureSource,
  LaneRedsSource,
  ParcelEnvelope,
  ParcelItem,
  ParcelsReadSpan,
  reduceAccountHeadroom,
  SinceLastCheckSource,
  SourceFailed,
} from "@beep/palantiri";
import {
  AccountRef,
  AccountsError,
  AccountsStatusReport,
  AccountsStatusReportJson,
  AccountsUsage,
  AccountUsage,
  AccountUsageOutcome,
  groupAccounts,
  loadAccountsReport,
  rankAccounts,
  SignedInLogin,
  UsageWindow,
} from "@beep/repo-cli/test/Accounts";
import {
  layerPalantiriRuntime,
  makeAccountHeadroomSourceCached,
  makeAccountHeadroomSourceLive,
  palantiriCommand,
  printParcel,
  stageAccountHeadroomReport,
} from "@beep/repo-cli/test/Palantiri";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Metric from "effect/Metric";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";

const decodeParcelEnvelopeJson = S.decodeEffect(S.fromJsonString(ParcelEnvelope));
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACEPARENT = `00-${TRACE_ID}-00f067aa0ca902c7-01`;

const account = (provider: string, label: string) =>
  AccountRef.make({ provider, label, source: `/auth/${provider}-${label}.json` });

const okUsage = (ref: AccountRef, usedPercent: number) =>
  AccountUsage.make({
    account: ref,
    outcome: AccountUsageOutcome.cases.Ok.make({
      identity: O.some(ref.label),
      plan: O.some("max"),
      windows: [UsageWindow.make({ kind: "weekly", scope: O.none(), usedPercent, resetsAt: O.none() })],
      credits: [],
      limitResets: O.none(),
      asOf: O.none(),
    }),
  });

const stubAccountsUsage = (polls: Ref.Ref<number>) =>
  AccountsUsage.of({
    accounts: Effect.succeed([account("claude", "me@example.com"), account("codex", "work@example.com")]),
    poll: Effect.fn("AccountsUsage.poll")(function* (ref) {
      yield* Ref.update(polls, (count) => count + 1);
      return okUsage(ref, 25);
    }),
    signedIn: Effect.succeed([]),
    snapshots: Effect.succeed([]),
  });

// The CLI's own report, encoded and decoded by the library's input schema, so
// a drift between `accounts-status/v2` and the parcel input fails here.
const reportSource = Effect.gen(function* () {
  const polls = yield* Ref.make(0);
  const report = yield* loadAccountsReport(O.none()).pipe(
    Effect.provideService(AccountsUsage, stubAccountsUsage(polls))
  );
  const text = yield* AccountsStatusReportJson.encode(report);
  return AccountHeadroomInput.make({
    report: yield* S.decodeEffect(AccountsReportInputJson)(text),
    expectedProviders: O.some(["claude", "codex"]),
  });
}).pipe(Effect.orDie);

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(
          output,
          A.map(values, (value) => `${value}`)
        );
      },
    })
  );
  return A.join(output, "\n");
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

// Parcels never serve files, so file-response support gets a no-op filesystem.
const noFiles = Layer.mergeAll(FileSystem.layerNoop({}), Path.layer);

// The ports this file does not exercise, failing if read.
const offline = (parcel: "lane-reds" | "host-pressure" | "since-last-check") =>
  Effect.fail(SourceFailed.make({ parcel, detail: "not wired in this test" }));

const otherSources = Layer.mergeAll(
  Layer.succeed(LaneRedsSource, { snapshot: offline("lane-reds") }),
  Layer.succeed(HostPressureSource, { snapshot: offline("host-pressure") }),
  Layer.succeed(SinceLastCheckSource, {
    read: Effect.fn("SinceLastCheckSource.stub.read")(() => offline("since-last-check")),
    advance: Effect.fn("SinceLastCheckSource.stub.advance")(() => offline("since-last-check")),
  })
);

const spans = MutableHashMap.empty<string, Tracer.NativeSpan>();
const recordingTracer = Tracer.make({
  span(options) {
    const span = new Tracer.NativeSpan(options);
    MutableHashMap.set(spans, options.name, span);
    return span;
  },
});

const stubRuntime = layerPalantiriRuntime(
  Layer.merge(otherSources, Layer.effect(AccountHeadroomSource, Effect.succeed({ snapshot: reportSource }))),
  Layer.succeed(Tracer.Tracer, recordingTracer)
).pipe(Layer.provide(noFiles));

describe("printParcel over a stub source", () => {
  it.layer(stubRuntime, { timeout: "30 seconds" })((it) => {
    it.effect("prints the envelope as JSON, nested under TRACEPARENT, and sets the gauge", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("account-headroom", true)).pipe(withEnv({ TRACEPARENT }));
        const envelope = yield* decodeParcelEnvelopeJson(json);
        expect(envelope.parcel).toBe("account-headroom");
        expect(envelope.freshness._tag).toBe("Fresh");
        expect(
          A.map(A.filter(envelope.items, ParcelItem.guards.AccountHeadroom), (item) => [item.provider, item.account])
        ).toEqual([
          ["claude", 1],
          ["codex", 1],
        ]);
        expect(pipe(json, Str.includes("@"))).toBe(false);
        assertSome(
          O.map(MutableHashMap.get(spans, ParcelsReadSpan.name), (span) => span.traceId),
          TRACE_ID
        );
        const snapshot1 = yield* Metric.snapshot;
        const gauges = A.filter(snapshot1, (metric) => metric.id === AccountsWindowRemaining.name);
        expect(A.map(gauges, (metric) => metric.attributes?.["beep.provider"])).toContain("openai");
        const text = yield* captureOutput(printParcel("account-headroom", false)).pipe(withEnv({}));
        expect(text).toContain("account-headroom: 2 of 2 accounts fresh");
        expect(text).toContain("claude #1  ok  weekly 75% left");
      })
    );
  });
});

const failingRuntime = layerPalantiriRuntime(
  Layer.merge(
    otherSources,
    Layer.succeed(AccountHeadroomSource, {
      snapshot: Effect.fail(SourceFailed.make({ parcel: "account-headroom", detail: "offline" })),
    })
  ),
  Layer.empty
).pipe(Layer.provide(noFiles));

describe("printParcel over a failing source", () => {
  it.layer(failingRuntime, { timeout: "30 seconds" })((it) => {
    it.effect("serves Unknown{unreachable}", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("account-headroom", true)).pipe(withEnv({}));
        const envelope = yield* decodeParcelEnvelopeJson(json);
        expect(envelope.freshness._tag === "Unknown" ? envelope.freshness.reason : "fresh").toBe("unreachable");
      })
    );
  });
});

describe("beep palantiri parcel account-headroom", () => {
  it("is registered under palantiri parcel, beside the parcels listing and the MCP host", () => {
    const parcel = A.flatMap(palantiriCommand.subcommands, (group) => group.commands);
    expect(A.map(parcel, (command) => command.name)).toEqual(["parcel", "parcels", "mcp"]);
  });

  it.layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("runs the live command over a collector snapshot", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-command-test-" });
        const snapshots = path.join(root, "snapshots");
        yield* fs.makeDirectory(snapshots);
        const now = yield* DateTime.now;
        yield* fs.writeFileString(
          path.join(snapshots, "cursor.json"),
          `{"schemaVersion":"accounts-snapshot/v1","provider":"cursor","label":"me@example.com","capturedAt":"${DateTime.formatIso(now)}","plan":null,"windows":[{"kind":"cycle","scope":null,"usedPercent":14,"resetsAt":null}]}`
        );
        const json = yield* captureOutput(
          Command.runWith(palantiriCommand, { version: "0.0.0" })(["parcel", "account-headroom", "--json"])
        ).pipe(
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make(() => Effect.die("no network in this test"))
          ),
          Effect.provideService(
            MemoryStats,
            MemoryStats.of({ availableGib: Effect.succeed(40), totalGib: Effect.succeed(64) })
          ),
          withEnv({
            BEEP_ACCOUNTS_AUTH_DIR: path.join(root, "auth"),
            BEEP_ACCOUNTS_SNAPSHOT_DIR: snapshots,
            BEEP_PALANTIRI_STATE_ROOT: path.join(root, "palantiri"),
            HOME: root,
          })
        );
        const envelope = yield* decodeParcelEnvelopeJson(json);
        expect(
          A.map(A.filter(envelope.items, ParcelItem.guards.AccountHeadroom), (item) => [
            item.provider,
            item.account,
            item.state,
          ])
        ).toEqual([["cursor", 1, "ok"]]);
        expect(pipe(json, Str.includes("@"))).toBe(false);
      })
    );

    it.effect("reads cached fresh/stale reports without polling and preserves provider attribution", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-cached-test-" });
        const file = `${root}/account-headroom.json`;
        const polls = yield* Ref.make(0);
        const usage = stubAccountsUsage(polls);
        const report = yield* loadAccountsReport(O.none()).pipe(Effect.provideService(AccountsUsage, usage));
        const source = yield* makeAccountHeadroomSourceCached.pipe(
          Effect.provideService(AccountsUsage, {
            ...usage,
            poll: () => Effect.die("cached source must not start provider polling"),
          })
        );
        const read = source.snapshot.pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        // Missing and corrupt cache cannot trigger a refresh or create a file.
        const missing = yield* Effect.exit(read);
        const unavailable = Cause.fail(
          SourceFailed.make({ parcel: "account-headroom", detail: "cached accounts report unavailable" })
        );
        assertTrue(missing._tag === "Failure");
        assertExitFailure(missing, Cause.annotate(unavailable, Cause.annotations(missing.cause)));
        const exists = yield* fs.exists(file);
        expect(exists).toBe(false);
        yield* fs.writeFileString(file, "invalid");
        const corrupt = yield* Effect.exit(read);
        assertTrue(corrupt._tag === "Failure");
        assertExitFailure(corrupt, Cause.annotate(unavailable, Cause.annotations(corrupt.cause)));
        yield* AccountsStatusReportJson.encode(report).pipe(Effect.flatMap((text) => fs.writeFileString(file, text)));
        const fresh = yield* read;
        const now = yield* DateTime.now;
        expect(reduceAccountHeadroom(fresh, now, 20).freshness._tag).toBe("Fresh");
        const aged = AccountsStatusReport.make({
          ...report,
          generatedAt: DateTime.subtract(report.generatedAt, { minutes: 6 }),
        });
        const agedText = yield* AccountsStatusReportJson.encode(aged);
        yield* fs.writeFileString(file, agedText);
        const stale = yield* read;
        expect(stale.report.generatedAt).toEqual(aged.generatedAt);
        const freshness = reduceAccountHeadroom(stale, now, 20).freshness;
        expect(freshness._tag === "Unknown" ? freshness.reason : "fresh").toBe("stale");
        const unchanged = yield* fs.readFileString(file);
        expect(unchanged).toBe(agedText);
        const freshText = yield* AccountsStatusReportJson.encode(report);
        yield* fs.writeFileString(file, freshText);
        const unknown = yield* makeAccountHeadroomSourceCached.pipe(
          Effect.provideService(AccountsUsage, {
            ...usage,
            accounts: Effect.fail(AccountsError.make({ reason: "io", message: "fixture unavailable" })),
          })
        );
        const unattributed = yield* unknown.snapshot.pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        assertNone(unattributed.expectedProviders);
        const gap = reduceAccountHeadroom(unattributed, now, 20).freshness;
        expect(gap._tag === "Unknown" ? gap.reason : "fresh").toBe("attribution-incomplete");
        const added = yield* makeAccountHeadroomSourceCached.pipe(
          Effect.provideService(AccountsUsage, {
            ...usage,
            accounts: Effect.succeed([account("claude", "first"), account("codex", "second"), account("junie", "new")]),
          })
        );
        const input = yield* added.snapshot.pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        const missingProvider = reduceAccountHeadroom(input, now, 20).freshness;
        expect(missingProvider._tag === "Unknown" ? missingProvider.reason : "fresh").toBe("attribution-incomplete");
        const count = yield* Ref.get(polls);
        expect(count).toBe(2);
      })
    );

    it.effect("stages retained failures privately without mutating raw reports or hiding rejected logins", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-stage-test-" });
        const file = `${root}/account-headroom.json`;
        const now = yield* DateTime.now;
        const oldAt = DateTime.subtract(now, { minutes: 6 });
        const ref = account("claude", "fixture");
        const before = AccountsStatusReport.make({
          generatedAt: oldAt,
          groups: groupAccounts(rankAccounts([okUsage(ref, 25)], oldAt), []),
        });
        yield* AccountsStatusReportJson.encode(before).pipe(Effect.flatMap((text) => fs.writeFileString(file, text)));
        const failed = AccountUsage.make({
          account: ref,
          outcome: AccountUsageOutcome.cases.Failed.make({ detail: "offline" }),
        });
        const raw = AccountsStatusReport.make({
          generatedAt: now,
          groups: groupAccounts(rankAccounts([failed], now), [SignedInLogin.make(ref)]),
        });
        const original = yield* AccountsStatusReportJson.encode(raw);
        const stage = stageAccountHeadroomReport(raw).pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        yield* stage;
        yield* stage; // Repeated retention must keep the original asOf.
        const kept = yield* fs.readFileString(file).pipe(Effect.flatMap(AccountsStatusReportJson.decode));
        const outcomes = A.flatMap(kept.groups, (group) => A.map(group.rows, (row) => row.usage.outcome));
        expect(A.map(outcomes, (outcome) => outcome._tag)).toEqual(["Ok"]);
        expect(A.flatMap(kept.groups, (group) => A.map(group.rows, (row) => row.signedIn))).toEqual([true]);
        A.forEach(outcomes, (outcome) => {
          if (outcome._tag === "Ok") assertSome(outcome.asOf, oldAt);
        });
        const unchanged = yield* AccountsStatusReportJson.encode(raw);
        expect(unchanged).toBe(original);
        expect(((yield* fs.stat(file)).mode & 0o777).toString(8)).toBe("600");
        expect(((yield* fs.stat(root)).mode & 0o777).toString(8)).toBe("700");
        const rejected = AccountUsage.make({
          account: ref,
          outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "revoked" }),
        });
        yield* stageAccountHeadroomReport(
          AccountsStatusReport.make({ generatedAt: now, groups: groupAccounts(rankAccounts([rejected], now), []) })
        ).pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        const revoked = yield* fs.readFileString(file).pipe(Effect.flatMap(AccountsStatusReportJson.decode));
        expect(A.flatMap(revoked.groups, (group) => A.map(group.rows, (row) => row.usage.outcome._tag))).toEqual([
          "NeedsLogin",
        ]);
        // A file in place of the state directory makes staging fail harmlessly.
        // Warnings must not pollute the raw JSON document on stdout.
        let warningToStderr = O.none<boolean>();
        const logger = Logger.make(({ fiber }) => {
          warningToStderr = O.some(fiber.getRef(Logger.LogToStderr));
        });
        const logContext = yield* Layer.build(Logger.layer([logger]));
        yield* stageAccountHeadroomReport(raw).pipe(
          withEnv({ BEEP_PALANTIRI_STATE_ROOT: file }),
          Effect.provideContext(logContext)
        );
        assertSome(warningToStderr, true);
      })
    );

    it.effect("writes a snapshot, serves it while fresh, and polls again once it is stale", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-snapshot-test-" });
        const file = path.join(root, "account-headroom.json");
        const polls = yield* Ref.make(0);
        const source = yield* makeAccountHeadroomSourceLive.pipe(
          Effect.provideService(AccountsUsage, stubAccountsUsage(polls))
        );
        const read = source.snapshot.pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        const first = yield* read;
        const got = yield* Ref.get(polls);
        expect(got).toBe(2);
        const exists2 = yield* fs.exists(file);
        expect(exists2).toBe(true);
        // Account labels stay private to the owner.
        expect(((yield* fs.stat(file)).mode & 0o777).toString(8)).toBe("600");
        expect(((yield* fs.stat(root)).mode & 0o777).toString(8)).toBe("700");
        const cached = yield* read;
        const got3 = yield* Ref.get(polls);
        expect(got3).toBe(2);
        expect(cached.report.generatedAt).toEqual(first.report.generatedAt);
        assertSome(first.expectedProviders, ["claude", "codex"]);
        // Age the snapshot past the five-minute bound.
        const written = yield* fs.readFileString(file).pipe(Effect.flatMap(AccountsStatusReportJson.decode));
        const aged = AccountsStatusReport.make({
          ...written,
          generatedAt: DateTime.subtract(written.generatedAt, { minutes: 6 }),
        });
        yield* AccountsStatusReportJson.encode(aged).pipe(Effect.flatMap((text) => fs.writeFileString(file, text)));
        yield* read;
        const got4 = yield* Ref.get(polls);
        expect(got4).toBe(4);
        // A live poll that fails serves the stale snapshot instead.
        yield* AccountsStatusReportJson.encode(aged).pipe(Effect.flatMap((text) => fs.writeFileString(file, text)));
        const offline = yield* makeAccountHeadroomSourceLive.pipe(
          Effect.provideService(
            AccountsUsage,
            AccountsUsage.of({
              ...stubAccountsUsage(polls),
              accounts: Effect.fail(AccountsError.make({ reason: "io", message: "auth directory unreadable" })),
            })
          )
        );
        const served = yield* offline.snapshot.pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: root }));
        expect(served.report.generatedAt).toEqual(aged.generatedAt);
        // The provider listing failed too, so attribution is unknown rather than empty.
        assertNone(served.expectedProviders);
        const now5 = yield* DateTime.now;
        const parcel = reduceAccountHeadroom(served, now5, 20);
        expect(parcel.freshness._tag === "Unknown" ? parcel.freshness.reason : "fresh").toBe("stale");
      })
    );
  });
});

describe("accounts report to parcel input", () => {
  it.effect.prop(
    "every accounts-status/v2 report decodes as the parcel input with the same rows",
    [Arbitrary.schema(AccountsStatusReport)],
    Effect.fnUntraced(function* ([report]) {
      const text = yield* AccountsStatusReportJson.encode(report);
      const input = yield* S.decodeEffect(AccountsReportInputJson)(text);
      expect(A.flatMap(input.groups, (group) => group.rows).length).toBe(
        A.flatMap(report.groups, (group) => group.rows).length
      );
    }),
    { arbitrary: fcRuns(24) }
  );
});
