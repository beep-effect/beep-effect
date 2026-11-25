/**
 * The reader of one hosted job's feed artifact: the `task-outcomes-*` zip
 * holding its `task-outcomes/v1` or `v2` record and, for v2, the gate records
 * and raw logs the record indexes (decision `report-carrier`).
 *
 * **Details**
 *
 * The main-feed lookup and `beep ci failures` both download a job's artifact
 * through `GitHubClient` and read it here. Only JSON entries up to 1 MiB
 * inflate, 8 MiB in all, each counted at the larger of its compressed and
 * declared sizes: an archive declaring more is refused before an entry past
 * the limit inflates, and so is a stored entry whose two sizes differ. A raw
 * log never inflates: only its size is read, from the zip's directory, so a
 * job's agent console can name it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateRecord, GateRecordFromJson } from "@beep/gate-report/GateRecord";
import { Count, Text } from "@beep/gate-report/Scalars";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { GATES_DIR, RepoRelativeDir } from "@beep/repo-gate-record/GatePaths";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableRef from "effect/MutableRef";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { unzipSync } from "fflate";
import { CiCommandError } from "./Ci.errors.ts";
import { AnyTaskOutcomeRecord, GateFeedEntry } from "./CiTaskOutcomes.ts";
import type { UnzipFileInfo } from "fflate";

const $I = $RepoCliId.create("commands/Ci/CiFeedArtifact");

/**
 * The largest feed artifact a reader downloads: 64 MiB, since a v2 artifact
 * also carries the job's raw gate logs.
 *
 * **Example** (Check an artifact's size)
 *
 * ```ts
 * import { FEED_ARTIFACT_BYTES_MAX } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(12 <= FEED_ARTIFACT_BYTES_MAX) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FEED_ARTIFACT_BYTES_MAX = 64 * 1024 * 1024;

const ENTRY_INFLATE_BYTES_MAX = 1024 * 1024;
const ARCHIVE_INFLATE_BYTES_MAX = 8 * ENTRY_INFLATE_BYTES_MAX;

const extractedBytes = (file: UnzipFileInfo): number => Num.max(file.size, file.originalSize);

const storedSizeMismatch = (file: UnzipFileInfo): boolean => file.compression === 0 && file.size !== file.originalSize;

const inflatableJson = (file: UnzipFileInfo): boolean =>
  Str.endsWith(".json")(file.name) && extractedBytes(file) <= ENTRY_INFLATE_BYTES_MAX;

/**
 * One artifact of a workflow run, as `GET /actions/runs/{run_id}/artifacts`
 * lists it.
 *
 * **Example** (A listed artifact)
 *
 * ```ts
 * import { FeedArtifactRef } from "@beep/repo-cli/commands/Ci"
 *
 * const ref = FeedArtifactRef.make({ id: 1, name: "task-outcomes-9-1-labs-single", expired: false, size_in_bytes: 12 })
 * console.log(ref.name) // "task-outcomes-9-1-labs-single"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedArtifactRef extends S.Opaque<FeedArtifactRef, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Int,
    name: Text,
    expired: S.Boolean,
    size_in_bytes: Count,
  }).pipe(
    $I.annoteSchema("FeedArtifactRef", {
      description: "One workflow run artifact as the REST artifact listing returns it.",
    })
  )
) {}

/**
 * **Example** (An empty page)
 *
 * ```ts
 * import { FeedArtifactPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FeedArtifactPage.make({ total_count: 0, artifacts: [] }).artifacts.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedArtifactPage extends S.Opaque<FeedArtifactPage, { readonly brand: unique symbol }>()(
  S.Struct({ total_count: Count, artifacts: S.Array(FeedArtifactRef) }).pipe(
    $I.annoteSchema("FeedArtifactPage", { description: "One page of a workflow run's artifact listing." })
  )
) {}

/**
 * One gate record read out of a feed artifact: its feed entry, the decoded
 * `gate-report/v1` record and its raw log's size when the artifact holds it.
 *
 * **Example** (A report with no log)
 *
 * ```ts
 * import { GateRecord } from "@beep/gate-report/GateRecord"
 * import { GateReport, Totals } from "@beep/gate-report/GateReport"
 * import { FeedReport, GateFeedEntry } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * })
 * const entry = GateFeedEntry.make({ gate: "test", subject: "@beep/glob", record: "a/report.json", log: "a/report.log" })
 * const found = FeedReport.make({ entry, record: GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report }), logBytes: O.none() })
 * console.log(found.entry.gate) // "test"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedReport extends S.Opaque<FeedReport, { readonly brand: unique symbol }>()(
  S.Struct({
    entry: GateFeedEntry,
    record: GateRecord,
    logBytes: S.OptionFromOptionalKey(Count),
  }).pipe(
    $I.annoteSchema("FeedReport", {
      description: "A gate record read out of a feed artifact, with its feed entry and its raw log's size.",
    })
  )
) {}

/**
 * A feed artifact read: its name, its task-outcome record, the gate records
 * it carries, and the indexed records it did not hold readably.
 *
 * **Details**
 *
 * A v1 record indexes no gate record, so its `reports` are empty. A v2 entry
 * whose record is missing from the zip, over 1 MiB, or not a
 * `gate-report/v1` record is listed in `unreadable` by its record path.
 *
 * **Example** (A v1 artifact)
 *
 * ```ts
 * import { FeedArtifact, TaskOutcomeRecord } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const artifact = FeedArtifact.make({
 *   name: "task-outcomes-9-1-labs-single",
 *   record: TaskOutcomeRecord.make({ schemaVersion: "task-outcomes/v1", job: "Labs", runId: O.none(), runAttempt: O.none(), tasks: [] }),
 *   reports: [],
 *   unreadable: [],
 * })
 * console.log(artifact.record.job) // "Labs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedArtifact extends S.Opaque<FeedArtifact, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Text,
    record: AnyTaskOutcomeRecord,
    reports: S.Array(FeedReport),
    unreadable: S.Array(RepoRelativeDir),
  }).pipe(
    $I.annoteSchema("FeedArtifact", {
      description: "A feed artifact read: its task-outcome record, its gate records and the unreadable ones.",
    })
  )
) {}

const decodeTaskOutcomeRecord = S.decodeUnknownOption(S.fromJsonString(AnyTaskOutcomeRecord));
const decodeGateRecord = S.decodeUnknownOption(GateRecordFromJson);

const isGateFile = (file: string): boolean =>
  Str.startsWith(`${GATES_DIR}/`)(file) || pipe(file, Str.includes(`/${GATES_DIR}/`));

const byName = Order.mapInput(Order.String, ([file]: readonly [string, Uint8Array]) => file);

const utf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const readReport =
  (entries: Readonly<Record<string, Uint8Array>>, sizes: MutableHashMap.MutableHashMap<string, number>) =>
  (entry: GateFeedEntry): O.Option<FeedReport> =>
    pipe(
      R.get(entries, entry.record),
      O.flatMap((bytes) => decodeGateRecord(utf8(bytes))),
      O.map((record) => FeedReport.make({ entry, record, logBytes: MutableHashMap.get(sizes, entry.log) }))
    );

/**
 * Read a feed artifact's zip.
 *
 * **Details**
 *
 * The task-outcome record is the first JSON entry, by name, outside every
 * `.beep/gates/` directory that decodes as one. A v2 record's `reports` are
 * kept when `wanted` holds their gate; each kept entry's record is decoded,
 * and its log's size is read from the zip's directory, never inflated.
 *
 * **Example** (Read an empty zip)
 *
 * ```ts
 * import { readFeedArchive } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readFeedArchive(new Uint8Array(), "task-outcomes-9-1-labs-single", () => true))) // true
 * ```
 *
 * @param bytes - The zip as downloaded.
 * @param name - The artifact's name.
 * @param wanted - Which gates' reports to read.
 * @returns The artifact read, or a `CiCommandError` for a zip with no record.
 * @category use-cases
 * @since 0.0.0
 */
export const readFeedArchive = Effect.fn("CiFeedArtifact.readFeedArchive")(function* (
  bytes: ArrayBuffer | Uint8Array,
  name: string,
  wanted: (gate: string) => boolean
) {
  const sizes = MutableHashMap.empty<string, number>();
  const inflated = MutableRef.make(0);
  const mismatched = MutableRef.make(O.none<string>());
  const entries = yield* Effect.try({
    try: () =>
      unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
        filter: (file) => {
          MutableHashMap.set(sizes, file.name, file.originalSize);
          const stored = storedSizeMismatch(file);
          MutableRef.update(mismatched, (first) => (stored ? O.orElseSome(first, () => file.name) : first));
          const accepted =
            !stored &&
            inflatableJson(file) &&
            MutableRef.get(inflated) + extractedBytes(file) <= ARCHIVE_INFLATE_BYTES_MAX;
          MutableRef.update(inflated, (total) => total + (inflatableJson(file) ? extractedBytes(file) : 0));
          return accepted;
        },
      }),
    catch: CiCommandError.new(`Artifact ${name} is not a zip archive.`),
  });
  const storedEntry = MutableRef.get(mismatched);
  if (O.isSome(storedEntry)) {
    return yield* CiCommandError.make({
      message: `Artifact ${name} stores entry ${storedEntry.value} uncompressed with a size that differs from its declared original size; it was not read.`,
    });
  }
  if (MutableRef.get(inflated) > ARCHIVE_INFLATE_BYTES_MAX) {
    return yield* CiCommandError.make({
      message: `Artifact ${name} declares more than ${ARCHIVE_INFLATE_BYTES_MAX} bytes of JSON entries; none past the limit was inflated.`,
    });
  }
  const record = yield* Effect.fromOption(
    pipe(
      A.sort(R.toEntries(entries), byName),
      A.filter(([file]) => !isGateFile(file)),
      A.findFirst(([, content]) => decodeTaskOutcomeRecord(utf8(content)))
    ),
    () => CiCommandError.make({ message: `Artifact ${name} holds no task-outcome record.` })
  );
  const indexed = AnyTaskOutcomeRecord.match(record, {
    "task-outcomes/v1": () => A.empty<GateFeedEntry>(),
    "task-outcomes/v2": (v2) => A.filter(v2.reports, (entry) => wanted(entry.gate)),
  });
  const read = A.map(indexed, (entry) => ({ entry, report: readReport(entries, sizes)(entry) }));
  return FeedArtifact.make({
    name,
    record,
    reports: A.getSomes(A.map(read, ({ report }) => report)),
    unreadable: A.map(
      A.filter(read, ({ report }) => O.isNone(report)),
      ({ entry }) => entry.record
    ),
  });
});

/**
 * Download one feed artifact through `GitHubClient` and read it.
 *
 * **Details**
 *
 * One request: `GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip`.
 * An expired artifact, or one over {@link FEED_ARTIFACT_BYTES_MAX}, is refused
 * before any request.
 *
 * **Example** (Build the download)
 *
 * ```ts
 * import { downloadFeedArtifact, FeedArtifactRef } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const ref = FeedArtifactRef.make({ id: 1, name: "task-outcomes-9-1-labs-single", expired: false, size_in_bytes: 12 })
 * console.log(Effect.isEffect(downloadFeedArtifact(ref, () => true))) // true
 * ```
 *
 * @param artifact - The listed artifact.
 * @param wanted - Which gates' reports to read.
 * @returns The artifact read.
 * @category use-cases
 * @since 0.0.0
 */
export const downloadFeedArtifact = Effect.fn("CiFeedArtifact.downloadFeedArtifact")(function* (
  artifact: FeedArtifactRef,
  wanted: (gate: string) => boolean
) {
  if (artifact.expired || artifact.size_in_bytes > FEED_ARTIFACT_BYTES_MAX) {
    return yield* CiCommandError.make({
      message: `Artifact ${artifact.name} is expired or over ${FEED_ARTIFACT_BYTES_MAX} bytes.`,
    });
  }
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  const bytes = yield* client
    .requestDecoded(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip",
      { owner, repo, artifact_id: artifact.id },
      S.instanceOf(ArrayBuffer)
    )
    .pipe(CiCommandError.mapError(`Failed to download artifact ${artifact.name}.`));
  return yield* readFeedArchive(bytes, artifact.name, wanted);
});
