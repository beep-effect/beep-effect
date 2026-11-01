/**
 * The CLI's implementations of the Palantiri source ports, and the telemetry
 * layer a parcel read exports through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { layerLocalLgtmServer, ServerObservabilityConfig } from "@beep/observability/server";
import {
  AccountHeadroomInput,
  AccountHeadroomSource,
  AccountHeadroomSpec,
  AccountsReportInputJson,
  AdmissionSlotsInput,
  HostMemoryInput,
  HostPressureInput,
  HostPressureSource,
  InboxRowInput,
  LaneCheckoutInput,
  LaneRedsInput,
  LaneRedsSource,
  LedgerRowInput,
  PressureFile,
  PressureResource,
  PressureSourceInput,
  ProofJobInput,
  SessionCursor,
  SessionCursorJson,
  SinceLastCheckInput,
  SinceLastCheckSource,
  SourceFailed,
} from "@beep/palantiri";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { admissionStatus, MemoryStats } from "../../internal/repo-run/QualityScheduler.ts";
import { resolveWorkstationStateDir } from "../../internal/state/WorkstationState.ts";
import { AccountsStatusReportJson } from "../Accounts/Accounts.schemas.ts";
import { AccountsUsage, layerAccountsUsageLive, loadAccountsReport } from "../Accounts/AccountsUsage.service.ts";
import { openSessionRows } from "../Session/Session.schemas.ts";
import { layerSessionLedgerLive, SessionLedger, sessionCheckoutFacts } from "../Session/SessionLedger.service.ts";
import { loadYeetInboxView } from "../Yeet/internal/InboxView.ts";
import { ProofJobLauncher } from "../Yeet/internal/ProofJobLauncher.ts";
import type { ParcelId, SessionKey } from "@beep/palantiri";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as HttpClient from "effect/http/HttpClient";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { AccountsStatusReport } from "../Accounts/Accounts.schemas.ts";
import type { SessionLedgerError } from "../Session/Session.errors.ts";
import type { SessionCheckoutFacts } from "../Session/SessionLedger.service.ts";
import type { YeetInboxRow } from "../Yeet/internal/Inbox.ts";
import type { YeetInboxEntry } from "../Yeet/internal/InboxView.ts";
import type { ProofJobRecord } from "../Yeet/internal/ProofJob.ts";

const SNAPSHOT_FILE = "account-headroom.json";

/**
 * Resolve the Palantiri state directory: `BEEP_PALANTIRI_STATE_ROOT`, else
 * `$XDG_STATE_HOME/beep/palantiri`, else `$HOME/.local/state/beep/palantiri`.
 *
 * **Example** (Build the lookup effect)
 *
 * ```ts
 * import { palantiriStateDir } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(palantiriStateDir)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const palantiriStateDir = resolveWorkstationStateDir({
  override: "BEEP_PALANTIRI_STATE_ROOT",
  store: "palantiri",
});

/**
 * Write a file only its owner can read: the directory is created (or
 * narrowed to) `0700`, the text goes to a uniquely named `0600` temporary
 * file beside the target, and a rename puts it in place.
 *
 * **Details**
 *
 * A reader sees the old file or the new one, never a torn write; a failed
 * write removes its temporary file.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { writePrivateFile } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writePrivateFile("/state/palantiri/hot.json", "{}"))) // true
 * ```
 *
 * @param file - Absolute path of the file to replace.
 * @param text - The file's new contents.
 * @returns An effect that writes the file.
 * @category utilities
 * @since 0.0.0
 */
export const writePrivateFile = Effect.fn("PalantiriSource.writePrivateFile")(function* (file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.dirname(file);
  yield* fs.makeDirectory(dir, { recursive: true, mode: 0o700 });
  yield* fs.chmod(dir, 0o700);
  const temporary = `${file}.${yield* Random.nextIntBetween(0, 2_147_483_647)}.tmp`;
  yield* Effect.gen(function* () {
    yield* fs.writeFileString(temporary, text, { mode: 0o600 });
    yield* fs.chmod(temporary, 0o600);
    yield* fs.rename(temporary, file);
  }).pipe(Effect.onError(() => fs.remove(temporary).pipe(Effect.ignore)));
});

const sourceFailed = (detail: string) => SourceFailed.make({ parcel: AccountHeadroomSpec.id, detail });

const isWithinBound = (now: DateTime.Utc) => (report: AccountsStatusReport) =>
  !Duration.isGreaterThan(DateTime.distance(report.generatedAt, now), AccountHeadroomSpec.freshnessBound);

/**
 * Build the account-headroom source over the accounts poller, with a snapshot
 * file in front of it.
 *
 * **Details**
 *
 * A live poll takes up to 20 seconds per account, so each read first looks
 * for `account-headroom.json` in the Palantiri state directory
 * (`BEEP_PALANTIRI_STATE_ROOT`, else `$XDG_STATE_HOME/beep/palantiri`, else
 * `$HOME/.local/state/beep/palantiri`). A snapshot younger than the parcel's
 * 5-minute bound is served as-is; otherwise every account is polled, the
 * previous snapshot's readings stand in for accounts whose poll failed, and
 * the new report replaces the file. When the live poll itself fails, the
 * stale snapshot is served, so the parcel reads `Unknown{stale}` instead of
 * `Unknown{unreachable}`. Each read also lists the configured providers
 * (stored logins and collector snapshot files) as the parcel's expected
 * providers. The file holds the full accounts report,
 * labels included, and stays on this machine; the parcel itself never
 * carries a label. A failed snapshot write is logged and the live report is
 * still served.
 *
 * **Example** (Build the source effect)
 *
 * ```ts
 * import { makeAccountHeadroomSourceLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeAccountHeadroomSourceLive)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeAccountHeadroomSourceLive = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const usage = yield* AccountsUsage;

  // The snapshot carries account labels, so the directory is owner-only and
  // the file is written owner-read/write before it is renamed into place.
  const writeSnapshot = (file: string, text: string) =>
    writePrivateFile(file, text).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path)
    );

  // The providers this host is configured for: every stored login and every
  // collector snapshot file. A failed listing is `None`, so the parcel reports
  // unknown attribution instead of treating it as "no providers expected".
  const expectedProviders = Effect.all([usage.accounts, usage.snapshots], { concurrency: 2 }).pipe(
    Effect.map(([accounts, snapshots]) =>
      A.dedupe(
        A.appendAll(
          A.map(accounts, (account) => account.provider),
          A.map(snapshots, (snapshot) => snapshot.account.provider)
        )
      )
    ),
    Effect.option
  );

  const snapshot = Effect.gen(function* () {
    const dir = yield* palantiriStateDir;
    const file = path.join(dir, SNAPSHOT_FILE);
    const previous = yield* fs
      .readFileString(file)
      .pipe(Effect.map(AccountsStatusReportJson.decodeOption), Effect.orElseSucceed(O.none));
    const now = yield* DateTime.now;
    const report = yield* O.match(O.filter(previous, isWithinBound(now)), {
      onSome: Effect.succeed,
      onNone: () =>
        loadAccountsReport(previous).pipe(
          Effect.tap((live) =>
            AccountsStatusReportJson.encode(live).pipe(
              Effect.flatMap((text) => writeSnapshot(file, text)),
              Effect.catchCause((cause) =>
                Effect.logWarning("[palantiri] could not write the account-headroom snapshot", cause)
              )
            )
          ),
          // A failed live poll serves the stale snapshot; its age makes the
          // parcel Unknown{stale}.
          Effect.catchTag("AccountsError", (error) =>
            O.match(previous, {
              onNone: () => Effect.fail(error),
              onSome: (stale) =>
                Effect.logWarning("[palantiri] live accounts poll failed; serving the stale snapshot").pipe(
                  Effect.as(stale)
                ),
            })
          )
        ),
    });
    const text = yield* AccountsStatusReportJson.encode(report);
    return AccountHeadroomInput.make({
      report: yield* S.decodeEffect(AccountsReportInputJson)(text),
      expectedProviders: yield* expectedProviders,
    });
  }).pipe(
    Effect.catchTags({
      AccountsError: (error) => Effect.fail(sourceFailed(`accounts report unavailable (${error.reason})`)),
      SchemaError: () => Effect.fail(sourceFailed("accounts report did not decode")),
      ConfigError: () => Effect.fail(sourceFailed("state directory could not be resolved")),
    }),
    Effect.provideService(AccountsUsage, usage),
    Effect.withSpan("PalantiriSource.accountHeadroom")
  );

  return AccountHeadroomSource.of({ snapshot });
});

/**
 * The live account-headroom source: the accounts poller behind a snapshot
 * file. See {@link makeAccountHeadroomSourceLive}.
 *
 * **Details**
 *
 * A poller that cannot start becomes a source whose every read fails, so the
 * parcel is served as `Unknown{unreachable}` instead of the command failing.
 *
 * **Example** (Provide the live source)
 *
 * ```ts
 * import { layerAccountHeadroomSourceLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerAccountHeadroomSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerAccountHeadroomSourceLive = Layer.effect(AccountHeadroomSource, makeAccountHeadroomSourceLive).pipe(
  Layer.provide(layerAccountsUsageLive),
  Layer.catchTag(["AccountsError", "ConfigError"], () =>
    Layer.succeed(AccountHeadroomSource, {
      snapshot: Effect.fail(sourceFailed("accounts poller could not start")),
    })
  )
);

/**
 * OTLP export for a Palantiri host, on only when an endpoint is given.
 *
 * **Details**
 *
 * Built on the shared server observability layer. Spans and metrics leave on
 * an interval or when the layer's scope closes, so a short CLI run is flushed
 * by the command's scope finalizer (bounded by a 3 second shutdown timeout)
 * and a long-lived host exports on the interval. With no endpoint, nothing is
 * exported.
 *
 * **Example** (Export nothing)
 *
 * ```ts
 * import { layerPalantiriTelemetryFor } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * console.log(Layer.isLayer(layerPalantiriTelemetryFor("beep-cli", O.none()))) // true
 * ```
 *
 * @param serviceName - The `service.name` the host reports as.
 * @param endpoint - The OTLP base URL; `None` or an empty string exports nothing.
 * @returns An OTLP span and metric exporter for that endpoint, or an empty layer.
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriTelemetryFor: {
  (endpoint: O.Option<string>): (serviceName: string) => Layer.Layer<never, never, HttpClient.HttpClient>;
  (serviceName: string, endpoint: O.Option<string>): Layer.Layer<never, never, HttpClient.HttpClient>;
} = dual(
  2,
  (serviceName: string, endpoint: O.Option<string>): Layer.Layer<never, never, HttpClient.HttpClient> =>
    O.match(O.filter(endpoint, Str.isNonEmpty), {
      onNone: () => Layer.empty,
      onSome: (otlpBaseUrl) =>
        layerLocalLgtmServer(
          ServerObservabilityConfig.make({
            serviceName,
            serviceVersion: "0.0.0",
            environment: "workstation",
            minLogLevel: "Info",
            otlpBaseUrl,
            otlpEnabled: true,
            otlpResourceAttributes: {},
            devtoolsEnabled: false,
            devtoolsUrl: "ws://localhost:34437",
            prometheusPrefix: "beep",
          })
        ),
    })
);

const optionalEndpoint = (name: string) => Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none));

/**
 * OTLP export for a `beep palantiri` CLI read, on only when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set. See {@link layerPalantiriTelemetryFor}.
 *
 * **Example** (Build the telemetry layer)
 *
 * ```ts
 * import { layerPalantiriTelemetry } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPalantiriTelemetry)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriTelemetry = Layer.unwrap(
  Effect.map(optionalEndpoint("OTEL_EXPORTER_OTLP_ENDPOINT"), (endpoint) =>
    layerPalantiriTelemetryFor("beep-cli", endpoint)
  )
);

/**
 * OTLP export for the `beep palantiri mcp` host: the `--otlp-endpoint` flag,
 * else `BEEP_PALANTIRI_OTLP_ENDPOINT`, else nothing.
 *
 * **Details**
 *
 * Claude Code strips `OTEL_*` from the environment of an MCP server it
 * launches, so the host never reads `OTEL_EXPORTER_OTLP_ENDPOINT`; it carries
 * its own setting under a name the harness leaves alone.
 *
 * **Example** (Use the flag's endpoint)
 *
 * ```ts
 * import { layerPalantiriMcpTelemetry } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * console.log(Layer.isLayer(layerPalantiriMcpTelemetry(O.some("http://127.0.0.1:4318")))) // true
 * ```
 *
 * @param flag - The `--otlp-endpoint` flag's value, if given.
 * @returns An exporter reporting as `beep-palantiri-mcp`, or an empty layer when no endpoint is set.
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriMcpTelemetry = (flag: O.Option<string>): Layer.Layer<never, never, HttpClient.HttpClient> =>
  Layer.unwrap(
    Effect.map(
      O.match(O.filter(flag, Str.isNonEmpty), {
        onSome: Effect.succeedSome,
        onNone: () => optionalEndpoint("BEEP_PALANTIRI_OTLP_ENDPOINT"),
      }),
      (endpoint) => layerPalantiriTelemetryFor("beep-palantiri-mcp", endpoint)
    )
  );

const failedFor = (parcel: ParcelId) => (detail: string) => SourceFailed.make({ parcel, detail });

const instant = (text: string): O.Option<DateTime.Utc> => O.map(DateTime.make(text), DateTime.toUtc);

const rowSummary: (row: YeetInboxRow) => string = Match.type<YeetInboxRow>().pipe(
  Match.discriminatorsExhaustive("kind")({
    "check-failed": (row) => `${row.capsule.lane} ${Str.toLowerCase(row.capsule.state)}`,
    "sibling-collision": (row) => `${row.capsule.contendedPaths.length} paths contended with a sibling checkout`,
    "review-thread": () => "unresolved review thread",
    "base-drift": (row) => `behind ${row.capsule.base}`,
    "base-conflict": (row) => `conflicts with ${row.capsule.base}`,
    "pr-comment": () => "pull request comment awaiting a reply",
    "local-shard-failed": (row) => `local shard ${row.capsule.shard} exited ${row.capsule.exitCode}`,
    "pr-merge-ready": () => "pull request is merge-ready",
    "proof-job-finished": (row) =>
      `proof job on ${row.capsule.branch} ${O.getOrElse(
        O.orElse(O.fromNullishOr(row.capsule.terminationReason), () => O.fromNullishOr(row.capsule.verdictOutcome)),
        () => row.capsule.phase
      )}`,
  })
);

const rowPrNumber: (row: YeetInboxRow) => O.Option<number> = Match.type<YeetInboxRow>().pipe(
  Match.discriminatorsExhaustive("kind")({
    "check-failed": (row) => O.some(row.capsule.prNumber),
    "sibling-collision": () => O.none(),
    "review-thread": (row) => O.some(row.capsule.prNumber),
    "base-drift": (row) => O.some(row.capsule.prNumber),
    "base-conflict": (row) => O.some(row.capsule.prNumber),
    "pr-comment": (row) => O.some(row.capsule.prNumber),
    "local-shard-failed": () => O.none(),
    "pr-merge-ready": (row) => O.some(row.capsule.prNumber),
    "proof-job-finished": () => O.none(),
  })
);

// A check failure carries its own observation time; every other row is
// observed when it was appended.
const rowObservedAt = (row: YeetInboxRow): O.Option<DateTime.Utc> =>
  row.kind === "check-failed" ? O.orElse(instant(row.capsule.observedAt), () => instant(row.ts)) : instant(row.ts);

/**
 * One inbox entry as a parcel reads it: kind, tier, pull request, a summary
 * built from the row's structured fields only, observation time, ack and
 * liveness.
 *
 * **Details**
 *
 * The summary never quotes a comment excerpt, an author, a link or a path, so
 * the parcel cannot leak an address through it.
 *
 * **Example** (Reference the mapper)
 *
 * ```ts
 * import { inboxRowInput } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(typeof inboxRowInput) // "function"
 * ```
 *
 * @param entry - One joined inbox entry.
 * @returns The parcel's view of the row.
 * @category mapping
 * @since 0.0.0
 */
export const inboxRowInput = (entry: YeetInboxEntry): InboxRowInput =>
  InboxRowInput.make({
    kind: entry.row.kind,
    severity: entry.row.severity,
    prNumber: rowPrNumber(entry.row),
    summary: rowSummary(entry.row),
    observedAt: rowObservedAt(entry.row),
    acked: entry.ack.acked,
    superseded: entry.liveness === "superseded",
  });

const isSettled = (record: ProofJobRecord): boolean => record.phase === "finished" || record.phase === "terminated";

/**
 * A settled proof job as the lane-reds parcel reads it, or `None` for a job
 * still running, cancelled before a verdict, or with an unreadable submit
 * time.
 *
 * **Details**
 *
 * A job failed when it recorded a failure verdict or terminated without one
 * for any reason but a cancel. A job cancelled before its verdict is `None`,
 * so it can never be a branch's newest job and clear an earlier failure.
 *
 * **Example** (Reference the mapper)
 *
 * ```ts
 * import { proofJobInput } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(typeof proofJobInput) // "function"
 * ```
 *
 * @param record - One proof job record.
 * @returns The parcel's view of the job.
 * @category mapping
 * @since 0.0.0
 */
export const proofJobInput = (record: ProofJobRecord): O.Option<ProofJobInput> => {
  const verdictFailed = O.exists(record.outcome, (outcome) => outcome.verdictOutcome === "failure");
  const died = O.filter(record.terminationReason, (reason) => reason !== "cancelled");
  // A job cancelled before it reached a verdict says nothing about the branch,
  // so it is no input at all: it must not become the branch's newest job and
  // clear an earlier failure that nothing has superseded.
  const cancelledWithoutVerdict =
    O.exists(record.terminationReason, (reason) => reason === "cancelled") && O.isNone(record.outcome);
  return isSettled(record) && !cancelledWithoutVerdict
    ? O.map(instant(record.submittedAt), (submittedAt) =>
        ProofJobInput.make({
          branch: record.request.branch,
          prNumber: record.prNumber,
          failed: verdictFailed || O.isSome(died),
          reason: O.getOrElse(
            O.orElse(died, () => O.map(record.outcome, (outcome) => outcome.verdictOutcome)),
            () => record.phase
          ),
          submittedAt,
          endedAt: O.flatMap(
            O.orElse(
              O.map(record.outcome, (outcome) => outcome.endedAt),
              () => O.map(record.systemd, (systemd) => systemd.finalizedAt)
            ),
            instant
          ),
        })
      )
    : O.none();
};

/**
 * What a checkout source needs to know about the current checkout: its
 * repository, path, lane and branch. The live sources probe them with git.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckoutFactsProbe = Effect.Effect<
  SessionCheckoutFacts,
  SessionLedgerError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Path.Path | Digest.Digest
>;

const laneRedsFailed = failedFor("lane-reds");

/**
 * Build the lane-reds source: the current checkout plus every checkout the
 * session ledger lists as live for this repository.
 *
 * **Details**
 *
 * Each checkout is read through the same inbox view `beep yeet inbox` uses
 * and the proof-job launcher's record listing. A ledger checkout that no
 * longer exists (a retired lane) is skipped; an unreadable ledger leaves just
 * the current checkout. A checkout is named by its lane, never its path.
 *
 * **Example** (Build the source effect)
 *
 * ```ts
 * import { makeLaneRedsSource } from "@beep/repo-cli/test/Palantiri"
 * import { sessionCheckoutFacts } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeLaneRedsSource(sessionCheckoutFacts("/repo")))) // true
 * ```
 *
 * @param facts - Git probe for the current checkout's repository, path, lane and branch.
 * @returns A lane-reds port reading every live checkout's inbox and proof jobs.
 * @category constructors
 * @since 0.0.0
 */
export const makeLaneRedsSource = Effect.fnUntraced(function* (facts: CheckoutFactsProbe) {
  const context = yield* Effect.context<
    | Digest.Digest
    | SecureRandom.SecureRandom
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | SessionLedger
  >();
  const fs = yield* FileSystem.FileSystem;
  const ledger = yield* SessionLedger;

  const readCheckout = Effect.fnUntraced(function* (checkout: string, lane: string, branch: string) {
    const view = yield* loadYeetInboxView(checkout);
    const launcher = yield* ProofJobLauncher.make(checkout);
    const jobs = yield* launcher.list.pipe(Effect.option);
    return LaneCheckoutInput.make({
      lane,
      branch: O.some(branch),
      inboxReadable: !view.unreadable,
      skippedLines: view.skippedLines,
      rows: A.map(view.entries, inboxRowInput),
      jobs: O.map(jobs, (records) => A.getSomes(A.map(records, proofJobInput))),
    });
  });

  const snapshot = Effect.gen(function* () {
    const current = yield* facts.pipe(
      Effect.mapError(() => laneRedsFailed("the current checkout could not be probed"))
    );
    const others = yield* ledger
      .list(current.repository)
      .pipe(Effect.map(openSessionRows), Effect.orElseSucceed(A.empty));
    const checkouts = A.dedupeWith(
      A.prepend(
        A.map(others, (row) => ({ checkout: row.checkout, lane: row.lane, branch: row.branch })),
        { checkout: current.checkout, lane: current.lane, branch: current.branch }
      ),
      (a, b) => a.checkout === b.checkout
    );
    const live = yield* Effect.filter(checkouts, (entry) =>
      fs.exists(entry.checkout).pipe(Effect.orElseSucceed(() => false))
    );
    return LaneRedsInput.make({
      checkouts: yield* Effect.forEach(live, (entry) => readCheckout(entry.checkout, entry.lane, entry.branch), {
        concurrency: 4,
      }),
    });
  }).pipe(Effect.provide(context), Effect.withSpan("PalantiriSource.laneReds"));

  return LaneRedsSource.of({ snapshot });
});

/**
 * The live lane-reds source over this process's checkout and the session
 * ledger. See {@link makeLaneRedsSource}.
 *
 * **Example** (Provide the live source)
 *
 * ```ts
 * import { layerLaneRedsSourceLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerLaneRedsSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerLaneRedsSourceLive = Layer.effect(
  LaneRedsSource,
  Effect.suspend(() => makeLaneRedsSource(sessionCheckoutFacts(process.cwd())))
).pipe(
  Layer.provide(layerSessionLedgerLive),
  Layer.catchCause(() =>
    Layer.succeed(LaneRedsSource, { snapshot: Effect.fail(laneRedsFailed("the session ledger could not open")) })
  )
);

/**
 * Machine-wide admission occupancy from the same snapshot
 * `beep quality status` prints, or `None` when the admission state cannot be
 * read.
 *
 * **Example** (Build the reading effect)
 *
 * ```ts
 * import { liveAdmissionSlots } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(liveAdmissionSlots)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const liveAdmissionSlots = admissionStatus().pipe(
  Effect.map((snapshot) =>
    AdmissionSlotsInput.make({
      capacityTokens: snapshot.capacityTokens,
      activeTokens: snapshot.activeTokens,
      queued: snapshot.tickets.length,
      dead: snapshot.dead.length,
      hardFloorEngaged: snapshot.hardFloorEngaged,
    })
  ),
  Effect.option
);

/**
 * Where the host-pressure source reads from: the proc filesystem root
 * (`/proc` on a live host) and the admission occupancy reading.
 *
 * @category models
 * @since 0.0.0
 */
export type HostPressureReaders<R> = {
  readonly procRoot: string;
  readonly admission: Effect.Effect<O.Option<AdmissionSlotsInput>, never, R>;
};

/**
 * Build the host-pressure source.
 *
 * **Details**
 *
 * Reads `<procRoot>/pressure/{cpu,memory,io}` as text (the library parses
 * it), memory through the admission scheduler's `MemoryStats` reader of
 * `/proc/meminfo`, and the given admission occupancy. A host without
 * `<procRoot>/pressure` (a kernel without pressure stall information, a
 * non-Linux host, a container, a vendor cloud VM) reports `Missing`, and the
 * parcel reads `Unknown{unreachable}`.
 *
 * **Example** (Build the source effect)
 *
 * ```ts
 * import { liveAdmissionSlots, makeHostPressureSource } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeHostPressureSource({ procRoot: "/proc", admission: liveAdmissionSlots }))) // true
 * ```
 *
 * @param readers - The proc filesystem root and the admission occupancy reading.
 * @returns A host-pressure port that reads fresh on every snapshot.
 * @category constructors
 * @since 0.0.0
 */
export const makeHostPressureSource = Effect.fnUntraced(function* <R>(readers: HostPressureReaders<R>) {
  const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | MemoryStats | R>();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stats = yield* MemoryStats;
  const pressureDir = path.join(readers.procRoot, "pressure");

  const pressure = Effect.gen(function* () {
    const present = yield* fs.exists(pressureDir).pipe(Effect.orElseSucceed(() => false));
    if (!present) {
      return PressureSourceInput.cases.Missing.make({
        detail: "no /proc/pressure on this host (non-Linux, container, vendor cloud VM, or a kernel without PSI)",
      });
    }
    const files = yield* Effect.forEach(PressureResource.literals, (resource) =>
      fs.readFileString(path.join(pressureDir, resource)).pipe(
        Effect.map((text) => PressureFile.make({ resource, text })),
        Effect.option
      )
    );
    return PressureSourceInput.cases.Read.make({ files: A.getSomes(files) });
  });

  const snapshot = Effect.gen(function* () {
    const readAt = yield* DateTime.now;
    const [read, availableGib, totalGib, slots] = yield* Effect.all(
      [pressure, stats.availableGib, stats.totalGib, readers.admission],
      { concurrency: 4 }
    );
    return HostPressureInput.make({
      readAt,
      pressure: read,
      memory: O.some(HostMemoryInput.make({ availableGib, totalGib })),
      admission: slots,
    });
  }).pipe(Effect.provide(context), Effect.withSpan("PalantiriSource.hostPressure"));

  return HostPressureSource.of({ snapshot });
});

/**
 * The live host-pressure source over `/proc`. See
 * {@link makeHostPressureSource}.
 *
 * **Example** (Provide the live source)
 *
 * ```ts
 * import { layerHostPressureSourceLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerHostPressureSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerHostPressureSourceLive = Layer.effect(
  HostPressureSource,
  makeHostPressureSource({ procRoot: "/proc", admission: liveAdmissionSlots })
);

const sinceLastCheckFailed = failedFor("since-last-check");

/**
 * Build the since-last-check source: per-session read cursors next to the
 * session ledger, the repository's ledger rows, and the current checkout's
 * inbox.
 *
 * **Details**
 *
 * A cursor lives at `cursors/<host>__<owner>__<name>/<session>.json` under
 * the Palantiri state directory (`BEEP_PALANTIRI_STATE_ROOT`, else
 * `$XDG_STATE_HOME/beep/palantiri`, else `$HOME/.local/state/beep/palantiri`).
 * A missing or corrupt cursor reads as `None` (the first check). `advance`
 * writes a uniquely named temporary file beside the cursor and renames it
 * over the cursor, so a reader sees the old cursor or the new one, never a
 * torn write.
 *
 * **Example** (Build the source effect)
 *
 * ```ts
 * import { makeSinceLastCheckSource } from "@beep/repo-cli/test/Palantiri"
 * import { sessionCheckoutFacts } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSinceLastCheckSource(sessionCheckoutFacts("/repo")))) // true
 * ```
 *
 * @param facts - Git probe for the current checkout's repository, path, lane and branch.
 * @returns A since-last-check port with per-session cursor reads and atomic writes.
 * @category constructors
 * @since 0.0.0
 */
export const makeSinceLastCheckSource = Effect.fnUntraced(function* (facts: CheckoutFactsProbe) {
  const context = yield* Effect.context<
    | Digest.Digest
    | SecureRandom.SecureRandom
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  >();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledger = yield* SessionLedger;

  const probe = facts.pipe(
    Effect.mapError(() => sinceLastCheckFailed("the current checkout could not be probed")),
    Effect.provide(context)
  );

  const cursorFile = Effect.fnUntraced(function* (current: SessionCheckoutFacts, session: SessionKey) {
    const dir = yield* palantiriStateDir.pipe(
      Effect.mapError(() => sinceLastCheckFailed("state directory could not be resolved"))
    );
    const { host, owner, name } = current.repository;
    return path.join(dir, "cursors", `${host}__${owner}__${name}`, `${session}.json`);
  });

  const read = Effect.fn("PalantiriSource.readSinceLastCheck")(function* (session: SessionKey) {
    const current = yield* probe;
    const file = yield* cursorFile(current, session);
    const cursor = yield* fs.readFileString(file).pipe(
      Effect.flatMap(S.decodeEffect(SessionCursorJson)),
      Effect.map((stored) => stored.checkedAt),
      Effect.option
    );
    const rows = yield* ledger
      .list(current.repository)
      .pipe(Effect.mapError(() => sinceLastCheckFailed("the session ledger could not be read")));
    const view = yield* loadYeetInboxView(current.checkout).pipe(Effect.provide(context));
    return SinceLastCheckInput.make({
      cursor,
      lane: current.lane,
      ledger: A.map(rows, (row) =>
        LedgerRowInput.make({
          lane: row.lane,
          branch: row.branch,
          state: row.state,
          pr: row.pr,
          next: row.next,
          summary: row.summary,
          recordedAt: row.recordedAt,
          ownSession: O.contains(row.sessionId, session),
        })
      ),
      inbox: A.map(view.entries, inboxRowInput),
      inboxReadable: !view.unreadable,
    });
  });

  const advance = Effect.fn("PalantiriSource.advanceSinceLastCheck")(function* (session: SessionKey, at: DateTime.Utc) {
    const current = yield* probe;
    const file = yield* cursorFile(current, session);
    const text = yield* S.encodeEffect(SessionCursorJson)(
      SessionCursor.make({ schemaVersion: "palantiri-cursor/v1", checkedAt: at })
    ).pipe(Effect.mapError(() => sinceLastCheckFailed("the cursor did not encode")));
    const temporary = `${file}.${yield* Random.nextIntBetween(0, 2_147_483_647)}.tmp`;
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(path.dirname(file), { recursive: true });
      yield* fs.writeFileString(temporary, text);
      yield* fs.rename(temporary, file);
    }).pipe(
      Effect.onError(() => fs.remove(temporary).pipe(Effect.ignore)),
      Effect.mapError(() => sinceLastCheckFailed("the cursor could not be written"))
    );
  });

  return SinceLastCheckSource.of({ read, advance });
});

/**
 * The live since-last-check source over this process's checkout and the
 * session ledger. See {@link makeSinceLastCheckSource}.
 *
 * **Example** (Provide the live source)
 *
 * ```ts
 * import { layerSinceLastCheckSourceLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerSinceLastCheckSourceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerSinceLastCheckSourceLive = Layer.effect(
  SinceLastCheckSource,
  Effect.suspend(() => makeSinceLastCheckSource(sessionCheckoutFacts(process.cwd())))
).pipe(
  Layer.provide(layerSessionLedgerLive),
  Layer.catchCause(() =>
    Layer.succeed(SinceLastCheckSource, {
      read: Effect.fn("PalantiriSource.sinceLastCheckUnavailable")(() =>
        Effect.fail(sinceLastCheckFailed("the session ledger could not open"))
      ),
      advance: Effect.fn("PalantiriSource.sinceLastCheckUnavailable")(() =>
        Effect.fail(sinceLastCheckFailed("the session ledger could not open"))
      ),
    })
  )
);

/**
 * Every live Palantiri source port: account headroom, lane reds, host
 * pressure and since-last-check.
 *
 * **Example** (Provide every live source)
 *
 * ```ts
 * import { layerPalantiriSourcesLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPalantiriSourcesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriSourcesLive = Layer.mergeAll(
  layerAccountHeadroomSourceLive,
  layerLaneRedsSourceLive,
  layerHostPressureSourceLive,
  layerSinceLastCheckSourceLive
);
