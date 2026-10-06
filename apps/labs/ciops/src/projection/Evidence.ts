/**
 * Frozen S7 replay-evidence program: argv mode decoding and the write-gated
 * replay run shared by the `evidence:s7` / `evidence:s7:write` scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { Console, DateTime, Effect, FileSystem, HashMap } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Eq from "effect/Equal";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeAdmissionPolicyParams } from "./AboxPolicy.ts";
import {
  buildLiveReplayReport,
  decodeAdmissionJournal,
  FirstChoiceAgreement,
  LiveReplayReport,
  ReplayOptions,
  ReplayTerminalTag,
  ReplayWindow,
  ReplayWindowError,
  renderReplayEvidence,
  replayAdmissionJournal,
  requireReplayMatch,
} from "./Replay.ts";
import { PolicyDecodeError } from "./Schemas.ts";
import type { AttributedMismatch, ReplayReport, ReplaySkippedRow } from "./Replay.ts";
import type { AdmissionPolicyParams, ReplayMismatchError } from "./Schemas.ts";

const $I = $CiopsId.create("projection/Evidence");

/**
 * Run mode of the replay-evidence script.
 *
 * `check` recomputes and validates the replay without touching the committed
 * record; `write` regenerates the frozen evidence file and is opt-in only.
 *
 * **Example** (Recognize the write mode)
 *
 * ```ts
 * import { EvidenceMode } from "@/projection/Evidence"
 *
 * console.log(EvidenceMode.is.write("write")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceMode = LiteralKit(["check", "write"]).pipe(
  $I.annoteSchema("EvidenceMode", {
    description: "Replay-evidence run mode: read-only check (default) or opt-in regeneration.",
  })
);

/**
 * Decoded run mode accepted by {@link EvidenceMode}.
 *
 * @see {@link EvidenceMode} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type EvidenceMode = typeof EvidenceMode.Type;

/**
 * Repo-relative inputs and output of one replay-evidence run.
 *
 * **Example** (Describe the frozen S6 packet)
 *
 * ```ts
 * import { EvidencePaths } from "@/projection/Evidence"
 *
 * const paths = EvidencePaths.make({
 *   abox: "graphs/abox.ttl",
 *   journal: "snapshot/raw/journal.ndjson",
 *   evidence: "research/s7-replay-evidence.md"
 * })
 * console.log(paths.evidence) // "research/s7-replay-evidence.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidencePaths extends S.Class<EvidencePaths>($I`EvidencePaths`)(
  {
    abox: S.String,
    journal: S.String,
    evidence: S.String,
  },
  $I.annote("EvidencePaths", {
    description: "Policy A-Box, admission journal and evidence report paths for one replay run.",
  })
) {}

const conflictingModes = PolicyDecodeError.make({
  message:
    "`--check` and `--write` are mutually exclusive; regenerate the frozen evidence with `bun run evidence:s7:write`.",
});

/**
 * Decodes the script argv into an {@link EvidenceMode}.
 *
 * **Details**
 *
 * The absence of `--write` is the read-only `check` mode, so a bare
 * `bun run evidence:s7` can never rewrite the dated record. Passing both
 * flags is a typed failure rather than a silent precedence choice.
 *
 * **Example** (Default to check mode)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeEvidenceMode } from "@/projection/Evidence"
 *
 * console.log(Effect.runSync(decodeEvidenceMode(["bun", "script.ts"]))) // "check"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeEvidenceMode = Effect.fn("Evidence.decodeEvidenceMode")(function* (
  argv: ReadonlyArray<string>
): Effect.fn.Return<EvidenceMode, PolicyDecodeError> {
  const write = A.contains(argv, "--write");
  if (write && A.contains(argv, "--check")) {
    return yield* conflictingModes;
  }
  return write ? EvidenceMode.Enum.write : EvidenceMode.Enum.check;
});

const ioFailure = (operation: string, path: string) =>
  PolicyDecodeError.make({ message: `Failed to ${operation} repo-relative artifact "${path}".` });

const readArtifact = Effect.fn("Evidence.readArtifact")(function* (
  path: string
): Effect.fn.Return<string, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(Effect.mapError(() => ioFailure("read", path)));
});

const writeEvidence = Effect.fn("Evidence.writeEvidence")(function* (
  path: string,
  content: string
): Effect.fn.Return<void, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, content).pipe(Effect.mapError(() => ioFailure("write", path)));
});

const utf8 = new TextEncoder();

const sha256Bytes = Effect.fn("Evidence.sha256Bytes")(function* (
  bytes: Uint8Array
): Effect.fn.Return<string, PolicyDecodeError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", bytes)
    .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: "Failed to digest a replay artifact." })));
  return Hex.encode(digest);
});

const sha256 = (content: string) => sha256Bytes(utf8.encode(content));

/**
 * Outcome of one replay-evidence run: the validated report and its rendering.
 *
 * **Example** (Describe a passing check run)
 *
 * ```ts
 * import { EvidenceRun } from "@/projection/Evidence"
 *
 * const run = EvidenceRun.make({ mode: "check", rendered: "# S7 replay evidence\n\nPASS" })
 * console.log(run.mode) // "check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceRun extends S.Class<EvidenceRun>($I`EvidenceRun`)(
  {
    mode: EvidenceMode,
    rendered: S.String,
  },
  $I.annote("EvidenceRun", {
    description: "Mode and rendered Markdown of a replay-evidence run that passed the differential replay.",
  })
) {}

/**
 * Replays the frozen journal against the policy A-Box and, only in `write`
 * mode and only after the replay matched, regenerates the evidence file.
 *
 * **Details**
 *
 * `requireReplayMatch` runs before any write, so a diverging replay can never
 * overwrite a good committed record. The rendering is computed first and
 * printed when the replay diverges, so the FAIL table (expected versus
 * projected nonces) stays available for diagnosis. `check` mode never touches
 * the file system beyond reading its inputs.
 *
 * **Example** (Validate without writing)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EvidencePaths, generateReplayEvidence } from "@/projection/Evidence"
 *
 * const program = generateReplayEvidence("check", EvidencePaths.make({
 *   abox: "graphs/abox.ttl",
 *   journal: "snapshot/raw/journal.ndjson",
 *   evidence: "research/s7-replay-evidence.md"
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const generateReplayEvidence = Effect.fn("Evidence.generateReplayEvidence")(function* (
  mode: EvidenceMode,
  paths: EvidencePaths
): Effect.fn.Return<
  EvidenceRun,
  PolicyDecodeError | ReplayMismatchError | ReplayWindowError,
  FileSystem.FileSystem | Crypto.Crypto
> {
  const artifacts = yield* Effect.all(
    { abox: readArtifact(paths.abox), journal: readArtifact(paths.journal) },
    { concurrency: 2 }
  );
  const policy = yield* decodeAdmissionPolicyParams(artifacts.abox);
  const events = yield* decodeAdmissionJournal(artifacts.journal);
  const policyDigest = yield* sha256(artifacts.abox);
  const journalDigest = yield* sha256(artifacts.journal);
  const replayed: ReplayReport = yield* replayAdmissionJournal(policy, events, policyDigest, journalDigest);
  const rendered = renderReplayEvidence(replayed, journalDigest);
  // A diverging replay fails typed before any write; its FAIL table is printed
  // first so the expected/projected nonces remain diagnosable from the run.
  const report = yield* requireReplayMatch(replayed).pipe(Effect.tapError(() => Console.log(rendered)));
  if (EvidenceMode.is.write(mode)) {
    yield* writeEvidence(paths.evidence, rendered);
  }
  return EvidenceRun.make({ mode, rendered: renderReplayEvidence(report, journalDigest) });
});

/**
 * Inputs and output of one live replay-evidence run.
 *
 * **Details**
 *
 * Every member but `repoRoot` is repo-relative; reads and writes join it
 * under `repoRoot`. `abox`, `goldenJournal`, `journal` and `manifest` are
 * rendered verbatim into the evidence; `evidence` is never rendered.
 *
 * **Example** (Describe the run4-fleet canonical pin)
 *
 * ```ts
 * import { LiveEvidencePaths } from "@/projection/Evidence"
 *
 * const paths = LiveEvidencePaths.make({
 *   repoRoot: "../../..",
 *   abox: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
 *   goldenJournal: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
 *   journal: "pin/admission/canonical/journal.ndjson",
 *   manifest: "pin/MANIFEST.yaml",
 *   evidence: "goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md"
 * })
 * console.log(paths.repoRoot) // "../../.."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveEvidencePaths extends S.Class<LiveEvidencePaths>($I`LiveEvidencePaths`)(
  {
    repoRoot: S.String,
    abox: S.String,
    goldenJournal: S.String,
    journal: S.String,
    manifest: S.String,
    evidence: S.String,
  },
  $I.annote("LiveEvidencePaths", {
    description: "Repo root, repo-relative pinned inputs and the evidence path of one live replay run.",
  })
) {}

/**
 * Typed outcome of one live replay-evidence run, before rendering.
 *
 * **Example** (Read the golden agreement)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FirstChoiceAgreement } from "@/projection/Replay"
 *
 * const golden = FirstChoiceAgreement.make({ agreed: S.Natural.make(41), total: S.Natural.make(41) })
 * console.log(golden.total) // 41
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveEvidenceSummary extends S.Class<LiveEvidenceSummary>($I`LiveEvidenceSummary`)(
  {
    live: LiveReplayReport,
    golden: FirstChoiceAgreement,
    goldenJournalSha256: S.String,
    policySha256: S.String,
  },
  $I.annote("LiveEvidenceSummary", {
    description: "Live replay report beside the golden agreement recomputed in the same run.",
  })
) {}

/**
 * Outcome of one live replay-evidence run: the summary and its rendering.
 *
 * **Example** (Recognize a check run)
 *
 * ```ts
 * import { EvidenceMode } from "@/projection/Evidence"
 *
 * console.log(EvidenceMode.is.check("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiveEvidenceRun extends S.Class<LiveEvidenceRun>($I`LiveEvidenceRun`)(
  { mode: EvidenceMode, rendered: S.String, summary: LiveEvidenceSummary },
  $I.annote("LiveEvidenceRun", {
    description: "Mode, typed summary and rendered Markdown of one live replay-evidence run.",
  })
) {}

const pinDisagreement = (member: string, expected: string, actual: string) =>
  ReplayWindowError.make({
    message: `Replay window member ${member} expected ${expected}, found ${actual}.`,
    member,
    expected,
    actual,
  });

const requirePinFact = (member: string, expected: string, actual: O.Option<string>) =>
  O.exists(actual, Eq.equals(expected))
    ? Effect.void
    : Effect.fail(
        pinDisagreement(
          member,
          expected,
          O.getOrElse(actual, () => "<absent>")
        )
      );

const repoPath = (paths: LiveEvidencePaths, repoRelative: string): string => `${paths.repoRoot}/${repoRelative}`;

const readBytes = Effect.fn("Evidence.readBytes")(function* (
  path: string
): Effect.fn.Return<Uint8Array, PolicyDecodeError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFile(path).pipe(Effect.mapError(() => ioFailure("read", path)));
});

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

const decodeUtf8 = (bytes: Uint8Array, path: string) =>
  Effect.try({ try: () => utf8Strict.decode(bytes), catch: () => ioFailure("decode UTF-8 of", path) });

const topLevelKey = /^[a-z_]+:/;

const indentOf = (line: string): number => Str.length(line) - Str.length(Str.trimStart(line));

// Lines after a top-level `key:` up to the next top-level key (YAML lists sit at column 0).
const topLevelBlock = (lines: ReadonlyArray<string>, key: string): ReadonlyArray<string> =>
  O.match(A.findFirstIndex(lines, Eq.equals(`${key}:`)), {
    onNone: A.empty<string>,
    onSome: (index) => A.takeWhile(A.drop(lines, index + 1), (line) => !topLevelKey.test(line)),
  });

// Lines after the first `header` line that are indented deeper than it.
const nestedBlock = (lines: ReadonlyArray<string>, header: string): ReadonlyArray<string> =>
  O.match(A.findFirstIndex(lines, Eq.equals(header)), {
    onNone: A.empty<string>,
    onSome: (index) => A.takeWhile(A.drop(lines, index + 1), (line) => indentOf(line) > indentOf(header)),
  });

const scalarMember = /^ {4}([a-z0-9_-]+): '?([^']*)'?$/;

// Scalar members at indent 4; folded continuation lines (indent 6) never match.
const scalarMembers = (lines: ReadonlyArray<string>, prefix: string): ReadonlyArray<readonly [string, string]> =>
  A.getSomes(
    A.map(lines, (line) =>
      O.map(O.fromNullishOr(scalarMember.exec(line)), (match): readonly [string, string] => [
        `${prefix}${match[1]}`,
        match[2] ?? "",
      ])
    )
  );

/**
 * Reads the pin-manifest members the live replay window is asserted against.
 *
 * **Details**
 *
 * A minimal line-based read of the known-shape `run4-fleet` manifest, with no
 * YAML dependency: the first `admission_roots` item's `label` and its
 * `window` scalars, and the top-level `loss_population.chain_counts`
 * scalars. Keys are dotted member paths such as
 * `admission_roots[0].window.first_retained_row_instant`.
 *
 * **Example** (Read a window member)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { readManifestWindowMembers } from "@/projection/Evidence"
 *
 * const manifest = [
 *   "admission_roots:",
 *   "- label: canonical",
 *   "  window:",
 *   "    released_only_chains: 3",
 *   "loss_population:",
 *   "  chain_counts:",
 *   "    pre-v3: 3"
 * ].join("\n")
 * const members = readManifestWindowMembers(manifest)
 * console.log(HashMap.get(members, "loss_population.chain_counts.pre-v3")) // Option.some("3")
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const readManifestWindowMembers = (manifest: string): HashMap.HashMap<string, string> => {
  const lines = Str.split(manifest, "\n");
  const roots = topLevelBlock(lines, "admission_roots");
  const firstRoot = A.takeWhile(A.drop(roots, 1), (line) => !Str.startsWith("- ")(line));
  const label = O.map(A.head(roots), Str.replace(/^- label: /, ""));
  return HashMap.fromIterable([
    ...O.match(label, { onNone: A.empty, onSome: (value) => [["admission_roots[0].label", value] as const] }),
    ...scalarMembers(nestedBlock(firstRoot, "  window:"), "admission_roots[0].window."),
    ...scalarMembers(
      nestedBlock(topLevelBlock(lines, "loss_population"), "  chain_counts:"),
      "loss_population.chain_counts."
    ),
  ]);
};

const run4FleetPin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";

/**
 * Inputs and output of the `run4-fleet` canonical live replay, from the lab.
 *
 * **Details**
 *
 * `repoRoot` is relative to `apps/labs/ciops`, the working directory of the
 * lab's scripts and tests. The evidence script and the end-to-end test both
 * read this one constant, so a drifted path fails the lab's tests.
 *
 * **Example** (Point a scratch run at another evidence file)
 *
 * ```ts
 * import { LiveEvidencePaths, run4FleetLiveEvidencePaths } from "@/projection/Evidence"
 *
 * const scratch = LiveEvidencePaths.make({ ...run4FleetLiveEvidencePaths, evidence: "scratch/evidence.md" })
 * console.log(scratch.journal === run4FleetLiveEvidencePaths.journal) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const run4FleetLiveEvidencePaths: LiveEvidencePaths = LiveEvidencePaths.make({
  repoRoot: "../../..",
  abox: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl",
  goldenJournal: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson",
  journal: `${run4FleetPin}/admission/canonical/journal.ndjson`,
  manifest: `${run4FleetPin}/MANIFEST.yaml`,
  evidence: "goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md",
});

/**
 * Typed retained-window constants of the `run4-fleet` canonical journal pin.
 *
 * **Details**
 *
 * Taken from the pinned bytes (P2 Ruling 9). A live run asserts both digests
 * against the files, and the instants and pre-v3 count against the manifest's
 * `admission_roots[0].window` and `loss_population.chain_counts.pre-v3`, before
 * replay; the replay window guard then re-checks them against the rows.
 *
 * **Example** (Read the pinned pre-v3 count)
 *
 * ```ts
 * import { run4FleetCanonicalWindow } from "@/projection/Evidence"
 *
 * console.log(run4FleetCanonicalWindow.preV3Chains) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const run4FleetCanonicalWindow: ReplayWindow = ReplayWindow.make({
  firstRetainedInstant: DateTime.makeUnsafe("2026-10-01T09:32:09.602Z"),
  lastRetainedInstant: DateTime.makeUnsafe("2026-10-06T01:51:50.495Z"),
  preV3Chains: S.Natural.make(3),
  journalSha256: Sha256Hex.make("b691253cee4b7859dea4b3b40f339dfd7c68c6cbdfc0326e594230a6aac5df6d"),
  manifestSha256: Sha256Hex.make("7d22f37b879ce6e43d6dc41c5c388ea53f837e07abf1c2ad4e5a21cfeda5be6c"),
});

const expectedManifestMembers = (window: ReplayWindow): ReadonlyArray<readonly [string, string]> => [
  ["admission_roots[0].label", "canonical"],
  ["admission_roots[0].window.first_retained_row_instant", DateTime.formatIso(window.firstRetainedInstant)],
  ["admission_roots[0].window.last_retained_row_instant", DateTime.formatIso(window.lastRetainedInstant)],
  ["admission_roots[0].window.released_only_chains", `${window.preV3Chains}`],
  ["loss_population.chain_counts.pre-v3", `${window.preV3Chains}`],
];

const memberDisagreement =
  (members: HashMap.HashMap<string, string>) =>
  ([member, expected]: readonly [string, string]): O.Option<ReplayWindowError> => {
    const actual = HashMap.get(members, member);
    return O.exists(actual, Eq.equals(expected))
      ? O.none()
      : O.some(
          pinDisagreement(
            member,
            expected,
            O.getOrElse(actual, () => "<absent>")
          )
        );
  };

/**
 * Compares every manifest window member with a replay window.
 *
 * **Details**
 *
 * Returns one {@link ReplayWindowError} per disagreeing or absent member, in
 * fixed member order (`label`, the two instants, `released_only_chains`,
 * `loss_population.chain_counts.pre-v3`), and an empty array when all five
 * agree. The live evidence run fails with the first.
 *
 * **Example** (Find a drifted pre-v3 count)
 *
 * ```ts
 * import { manifestWindowDisagreements, run4FleetCanonicalWindow } from "@/projection/Evidence"
 *
 * declare const manifest: string
 *
 * const drifted = manifestWindowDisagreements(manifest, run4FleetCanonicalWindow)
 * console.log(drifted.map((error) => error.member))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const manifestWindowDisagreements: {
  (manifest: string, window: ReplayWindow): ReadonlyArray<ReplayWindowError>;
  (window: ReplayWindow): (manifest: string) => ReadonlyArray<ReplayWindowError>;
} = dual(
  2,
  (manifest: string, window: ReplayWindow): ReadonlyArray<ReplayWindowError> =>
    A.getSomes(A.map(expectedManifestMembers(window), memberDisagreement(readManifestWindowMembers(manifest))))
);

const checkManifestWindow = (manifest: string, window: ReplayWindow) =>
  O.match(A.head(manifestWindowDisagreements(manifest, window)), {
    onNone: () => Effect.void,
    onSome: Effect.fail,
  });

const replayGoldenAgreement = Effect.fnUntraced(function* (
  policy: AdmissionPolicyParams,
  policyDigest: string,
  path: string
): Effect.fn.Return<
  readonly [string, FirstChoiceAgreement],
  PolicyDecodeError | ReplayMismatchError | ReplayWindowError,
  FileSystem.FileSystem | Crypto.Crypto
> {
  const source = yield* readArtifact(path);
  const journalDigest = yield* sha256(source);
  const events = yield* decodeAdmissionJournal(source);
  const report = yield* replayAdmissionJournal(policy, events, policyDigest, journalDigest).pipe(
    Effect.flatMap(requireReplayMatch)
  );
  const agreed = A.countBy(report.verdicts, (verdict) => Eq.equals(verdict.outcome, "pass"));
  return [
    journalDigest,
    FirstChoiceAgreement.make({ agreed: S.Natural.make(agreed), total: S.Natural.make(A.length(report.verdicts)) }),
  ];
});

const replayLivePin = Effect.fnUntraced(function* (
  policy: AdmissionPolicyParams,
  policyDigest: string,
  paths: LiveEvidencePaths,
  window: ReplayWindow
): Effect.fn.Return<LiveReplayReport, PolicyDecodeError | ReplayWindowError, FileSystem.FileSystem | Crypto.Crypto> {
  const journalPath = repoPath(paths, paths.journal);
  const manifestPath = repoPath(paths, paths.manifest);
  const journalBytes = yield* readBytes(journalPath);
  const manifestBytes = yield* readBytes(manifestPath);
  const journalDigest = yield* sha256Bytes(journalBytes);
  yield* requirePinFact("journalSha256", window.journalSha256, O.some(journalDigest));
  yield* requirePinFact("manifestSha256", window.manifestSha256, O.some(yield* sha256Bytes(manifestBytes)));
  yield* checkManifestWindow(yield* decodeUtf8(manifestBytes, manifestPath), window);
  const events = yield* decodeAdmissionJournal(yield* decodeUtf8(journalBytes, journalPath));
  const options = ReplayOptions.make({ window: O.some(window) });
  // The bytes' own digest feeds the replay, so its window guard re-checks the pin.
  const report = yield* replayAdmissionJournal(policy, events, policyDigest, journalDigest, options);
  return buildLiveReplayReport(events, report, window);
});

const settleLiveEvidence = Effect.fnUntraced(function* (
  mode: EvidenceMode,
  path: string,
  rendered: string
): Effect.fn.Return<void, PolicyDecodeError, FileSystem.FileSystem> {
  if (EvidenceMode.is.write(mode)) {
    return yield* writeEvidence(path, rendered);
  }
  const committed = yield* readArtifact(path);
  if (!Eq.equals(committed, rendered)) {
    return yield* PolicyDecodeError.make({
      message: `Live replay evidence "${path}" differs from the recomputed render; regenerate it with \`bun run evidence:s7-live:write\`.`,
    });
  }
});

const cell = (value: string): string => `\`${value}\``;

const pinnedInputSection = (summary: LiveEvidenceSummary, paths: LiveEvidencePaths): ReadonlyArray<string> => {
  const { report, window } = summary.live;
  const skipped = A.length(report.skippedRows);
  const neutral = report.eventCount - report.admittedCount - report.releasedCount - skipped;
  return [
    "## Pinned input",
    "",
    `- Journal: ${cell(paths.journal)}`,
    `- Journal SHA-256: ${cell(window.journalSha256)} (typed constant, asserted against the bytes before replay)`,
    `- Manifest: ${cell(paths.manifest)}`,
    `- Manifest SHA-256: ${cell(window.manifestSha256)} (typed constant, asserted against the bytes)`,
    `- Retained window (canonical root): ${cell(DateTime.formatIso(window.firstRetainedInstant))} to ${cell(DateTime.formatIso(window.lastRetainedInstant))}, asserted against \`admission_roots[0].window\` and against the journal's first and last row instants`,
    `- Pre-v3 chains: ${window.preV3Chains}, asserted against \`admission_roots[0].window.released_only_chains\` and \`loss_population.chain_counts.pre-v3\` (that member name counts the pre-v3 class, chains with no retained enqueue, not release-only chains)`,
    `- Policy A-Box: ${cell(paths.abox)} (SHA-256 ${cell(summary.policySha256)})`,
    `- Events: ${report.eventCount} (${report.admittedCount} admitted, ${report.releasedCount} released or lease-evicted, ${skipped} skipped terminal row(s), ${neutral} ledger-neutral)`,
  ];
};

const agreementCell = (agreement: FirstChoiceAgreement): string => `${agreement.agreed} of ${agreement.total}`;

const agreementSection = (summary: LiveEvidenceSummary, paths: LiveEvidencePaths): ReadonlyArray<string> => [
  "## First-choice agreement",
  "",
  "The unit is one `admission-admitted` row: the projection's first prescribed admission at that grant instant against the recorded grant, as in the frozen golden report. The golden row is recomputed in this run and must pass; the live row is reported, never gated.",
  "",
  "| Corpus | Journal | Journal SHA-256 | First-choice agreement | Disagreements |",
  "| --- | --- | --- | ---: | ---: |",
  `| Frozen golden (S6) | ${cell(paths.goldenJournal)} | ${cell(summary.goldenJournalSha256)} | ${agreementCell(summary.golden)} | ${summary.golden.total - summary.golden.agreed} |`,
  `| run4-fleet canonical | ${cell(paths.journal)} | ${cell(summary.live.window.journalSha256)} | ${agreementCell(summary.live.agreement)} | ${A.length(summary.live.attributedMismatches)} |`,
];

const disagreementRow = ({ attribution, mismatch, sharedCheckoutRoot }: AttributedMismatch): string =>
  `| ${mismatch.eventIndex} | ${mismatch.admittedAtMillis} | ${cell(mismatch.expectedNonce)} | ${cell(mismatch.projectedNonce)} | ${mismatch.pendingCount} | ${mismatch.activeTokenTotal} / ${mismatch.capacityMaxTokens} | ${cell(attribution)} | ${O.match(sharedCheckoutRoot, { onNone: () => "none", onSome: cell })} |`;

const disagreementSection = (live: LiveReplayReport): ReadonlyArray<string> => [
  "## Disagreements",
  "",
  ...A.match(live.attributedMismatches, {
    onEmpty: () => ["None."],
    onNonEmpty: (mismatches) => [
      "| Event index | Instant ms | Recorded nonce | Projected nonce | Pending | Active / cap | Attribution | Shared checkout |",
      "| ---: | ---: | --- | --- | ---: | ---: | --- | --- |",
      ...A.map(mismatches, disagreementRow),
    ],
  }),
  "",
  "`same-checkout-active-lease`: the projected head's checkout (`checkoutRoot`, joined by nonce over the pinned rows) already held an active grant. Since #929 the deployed scheduler skips such a request; admission v1 does not model that skip, so the engine is unchanged and the disagreement is reported with this diagnostic attribution (contract §8.3, §3.4 delta). `unattributed`: no such join.",
];

const skippedRowLine = (row: ReplaySkippedRow): string =>
  `| ${row.eventIndex} | ${cell(row.tag)} | ${cell(row.nonce)} | ${row.terminalAtMillis} |`;

const censorshipSection = (live: LiveReplayReport): ReadonlyArray<string> => {
  const { report } = live;
  const censored = A.filter(report.verdicts, (verdict) => verdict.ledgerCensored);
  const preWindowGrants = A.dedupe(A.map(report.skippedRows, (row) => row.nonce));
  const skippedReleases = A.filter(report.skippedRows, (row) => ReplayTerminalTag.is["admission-released"](row.tag));
  const skippedEvictions = A.length(report.skippedRows) - A.length(skippedReleases);
  return [
    "## Window censorship",
    "",
    `- Skipped terminal rows: ${A.length(report.skippedRows)}. Each releases a grant whose admission precedes the retained window; replay skips it in place, so event indexes and episode ids are unchanged.`,
    ...A.match(report.skippedRows, {
      onEmpty: A.empty<string>,
      onNonEmpty: (rows) => [
        "",
        "| Event index | Tag | Nonce | Instant ms |",
        "| ---: | --- | --- | ---: |",
        ...A.map(rows, skippedRowLine),
        "",
      ],
    }),
    `- Grants active before the window's first retained row: ${A.length(preWindowGrants)}${A.match(preWindowGrants, { onEmpty: () => "", onNonEmpty: (nonces) => ` (${A.join(A.map(nonces, cell), ", ")})` })}. Their charges are invisible to the replayed ledger until their skipped terminal rows.`,
    `- Ledger-censored verdicts: ${A.length(censored)}${A.match(censored, {
      onEmpty: () => "",
      onNonEmpty: (verdicts) =>
        ` (events ${A.join(
          A.map(verdicts, (verdict) => `${verdict.eventIndex}`),
          ", "
        )})`,
    })}: verdicts before the last skipped terminal row, whose replayed ledger lacked those grants.`,
    `- Pre-v3 chains: ${live.window.preV3Chains} = ${live.enqueueLessAdmissions} enqueue-less admitted chain(s) replayed + ${A.length(A.dedupe(A.map(skippedReleases, (row) => row.nonce)))} release-only chain(s) whose release was skipped, classified as the pin manifest's \`classify_chain\` does. Skipped lease evictions: ${skippedEvictions}; each closes a lease-evicted chain, outside the pre-v3 class.`,
    `- Pending-set censorship: replay rebuilds the pending set from admitted rows only, so the ${live.withdrawnRows} withdrawn and ${live.ticketEvictedRows} ticket-evicted request row(s) never compete; agreement is over requests that were eventually admitted.`,
  ];
};

const custodySection = (live: LiveReplayReport): ReadonlyArray<string> => [
  "## Custody",
  "",
  "| Custody | Rows |",
  "| --- | ---: |",
  `| live | ${live.custody.live} |`,
  `| surrogate | ${live.custody.surrogate} |`,
  `| redacted | ${live.custody.redacted} |`,
  "",
  "`live` rows carry a deployed `pid`, `surrogate` rows a run-3 Ruling 11 `ownerRef`, `redacted` rows neither (P2 Ruling 8).",
];

const cq009Section = (live: LiveReplayReport): ReadonlyArray<string> => [
  "## CQ-009",
  "",
  live.cq009.preCutRows === 0
    ? `CQ-009 — temporally out of scope: 0 of ${live.cq009.totalRows} pinned rows precede #929 (graduation Ruling 9).`
    : `CQ-009 — ${live.cq009.preCutRows} of ${live.cq009.totalRows} pinned rows precede #929; only those rows fall in CQ-009's temporal scope, and this lab does not evaluate them (graduation Ruling 9).`,
  "",
  "This is a scope statement, never a pass or a failure.",
];

/**
 * Renders the deterministic live replay evidence for one summary.
 *
 * **Details**
 *
 * Every value comes from typed members; instants print as manifest-style ISO
 * strings or raw milliseconds, never through a locale, and every list keeps
 * replay or literal order, so equal summaries render equal bytes.
 *
 * **Example** (Render from a summary)
 *
 * ```ts
 * import { renderLiveReplayEvidence } from "@/projection/Evidence"
 * import type { LiveEvidencePaths, LiveEvidenceSummary } from "@/projection/Evidence"
 *
 * declare const summary: LiveEvidenceSummary
 * declare const paths: LiveEvidencePaths
 *
 * console.log(renderLiveReplayEvidence(summary, paths).startsWith("# S7 Live")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderLiveReplayEvidence: {
  (summary: LiveEvidenceSummary, paths: LiveEvidencePaths): string;
  (paths: LiveEvidencePaths): (summary: LiveEvidenceSummary) => string;
} = dual(
  2,
  (summary: LiveEvidenceSummary, paths: LiveEvidencePaths): string =>
    `${A.join(
      [
        "# S7 Live Differential Replay Evidence",
        "",
        "> GENERATED by `apps/labs/ciops/scripts/generate-live-replay-evidence.ts`; do not hand-edit. From `apps/labs/ciops`, `bun run evidence:s7-live` checks these bytes and `bun run evidence:s7-live:write` re-renders them.",
        "",
        'Authority: `goals/ciops-ontology-pipeline/research/decisions.md`, "2026-10-06 — P2 design sitting", Rulings 8 and 9, and the S7 contract §8.3 (§5 live evidence). The frozen `explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md` is never re-rendered; its agreement is recomputed below in the same run.',
        "",
        ...pinnedInputSection(summary, paths),
        "",
        ...agreementSection(summary, paths),
        "",
        ...disagreementSection(summary.live),
        "",
        ...censorshipSection(summary.live),
        "",
        ...custodySection(summary.live),
        "",
        ...cq009Section(summary.live),
      ],
      "\n"
    )}\n`
);

/**
 * Replays the pinned live journal under its retained window beside the frozen
 * golden, then checks (default) or writes the rendered live evidence.
 *
 * **Details**
 *
 * Before replay, the live journal's and manifest's SHA-256 must equal the
 * window's typed constants, and the manifest's `admission_roots[0].window`
 * and `loss_population.chain_counts.pre-v3` members must equal the window.
 * The golden replay must still match (`requireReplayMatch`); the live replay
 * never gates on agreement. `check` compares the committed evidence bytes
 * with the render and fails typed on drift; only `write` rewrites the file.
 *
 * **Example** (Build a check run)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { generateLiveReplayEvidence } from "@/projection/Evidence"
 * import type { LiveEvidencePaths } from "@/projection/Evidence"
 * import type { ReplayWindow } from "@/projection/Replay"
 *
 * declare const paths: LiveEvidencePaths
 * declare const window: ReplayWindow
 *
 * console.log(Effect.isEffect(generateLiveReplayEvidence("check", paths, window))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const generateLiveReplayEvidence = Effect.fn("Evidence.generateLiveReplayEvidence")(function* (
  mode: EvidenceMode,
  paths: LiveEvidencePaths,
  window: ReplayWindow
): Effect.fn.Return<
  LiveEvidenceRun,
  PolicyDecodeError | ReplayMismatchError | ReplayWindowError,
  FileSystem.FileSystem | Crypto.Crypto
> {
  const abox = yield* readArtifact(repoPath(paths, paths.abox));
  const policy = yield* decodeAdmissionPolicyParams(abox);
  const policySha256 = yield* sha256(abox);
  const [goldenJournalSha256, golden] = yield* replayGoldenAgreement(
    policy,
    policySha256,
    repoPath(paths, paths.goldenJournal)
  );
  const live = yield* replayLivePin(policy, policySha256, paths, window);
  const summary = LiveEvidenceSummary.make({ live, golden, goldenJournalSha256, policySha256 });
  const rendered = renderLiveReplayEvidence(summary, paths);
  yield* settleLiveEvidence(mode, repoPath(paths, paths.evidence), rendered);
  return LiveEvidenceRun.make({ mode, rendered, summary });
});
