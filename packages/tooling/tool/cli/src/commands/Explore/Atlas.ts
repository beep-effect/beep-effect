/**
 * Deterministic exploration Atlas and README status projections.
 *
 * **Details**
 *
 * Exploration state is normalized to the D3 pair (`furthestStage` and
 * `resumeStage`). An opted-in packet derives that pair and its status from the
 * packet event fold. Until the ratified fleet stream migration lifts the
 * opt-in freeze, a packet without `ops/events/` uses its manifest stage and
 * status as an explicit adoption snapshot; both D3 stages equal that legacy
 * stage. The Atlas and README status region are then pure projections of the
 * normalized state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { Console, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { PacketSlug } from "../Goals/PacketCore/PacketCore.schemas.ts";
import { PacketEventStore, PacketStreamLocator } from "../Goals/PacketCore/PacketEventStore.ts";
import { foldPacketEvents } from "../Goals/PacketCore/PacketFold.ts";

const $I = $RepoCliId.create("commands/Explore/Atlas");

/**
 * Path of the local generated exploration projection.
 *
 * **Example** (Locate the generated Atlas)
 *
 * ```ts
 * import { EXPLORATION_ATLAS_PATH } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(EXPLORATION_ATLAS_PATH) // "explorations/ATLAS.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EXPLORATION_ATLAS_PATH = "explorations/ATLAS.md" as const;

/**
 * Stable exploration lifecycle statuses rendered by the Atlas.
 *
 * **Example** (Recognize an active exploration)
 *
 * ```ts
 * import { ExplorationStatus } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(ExplorationStatus.is.active("active")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExplorationStatus = LiteralKit(["active", "parked", "graduated", "killed"]).pipe(
  $I.annoteSchema("ExplorationStatus", { description: "Exploration lifecycle status rendered in the Atlas." })
);

/**
 * Decoded exploration lifecycle status.
 *
 * @see {@link ExplorationStatus} for the runtime schema and membership helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ExplorationStatus = typeof ExplorationStatus.Type;

/**
 * Stable exploration stages rendered by the Atlas.
 *
 * **Example** (Recognize the shape stage)
 *
 * ```ts
 * import { ExplorationStage } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(ExplorationStage.is.shape("shape")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExplorationStage = LiteralKit(["capture", "research", "align", "shape", "decompose", "graduate"]).pipe(
  $I.annoteSchema("ExplorationStage", { description: "One stage in the exploration fuzzy-front-end lifecycle." })
);

/**
 * Decoded exploration stage.
 *
 * @see {@link ExplorationStage} for the runtime schema and membership helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ExplorationStage = typeof ExplorationStage.Type;

/**
 * Authority used to normalize one exploration into D3 state.
 *
 * **Details**
 *
 * `manifest-adoption` is the ratified transitional boundary for packets that
 * cannot opt into streams before the fleet repair applier exists. Once a
 * packet carries `ops/events/`, `event-stream` is mandatory and no manifest
 * fallback is allowed.
 *
 * **Example** (Recognize event-stream authority)
 *
 * ```ts
 * import { ExplorationProjectionAuthority } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(ExplorationProjectionAuthority.is["event-stream"]("event-stream")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExplorationProjectionAuthority = LiteralKit(["event-stream", "manifest-adoption"]).pipe(
  $I.annoteSchema("ExplorationProjectionAuthority", {
    description: "Authority used to normalize an exploration into D3 projection state.",
  })
);

/**
 * Decoded exploration projection authority.
 *
 * @see {@link ExplorationProjectionAuthority} for the runtime schema and membership helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ExplorationProjectionAuthority = typeof ExplorationProjectionAuthority.Type;

class ExplorationManifestEntry extends S.Class<ExplorationManifestEntry>($I`ExplorationManifestEntry`)(
  {
    slug: PacketSlug,
    title: S.NonEmptyString,
    status: ExplorationStatus,
    stage: ExplorationStage,
    updated: S.NonEmptyString,
  },
  $I.annote("ExplorationManifestEntry", {
    description: "Manifest adoption fields and navigation metadata consumed by the exploration projector.",
  })
) {}

class ExplorationManifest extends S.Class<ExplorationManifest>($I`ExplorationManifest`)(
  {
    schemaVersion: S.Literal("exploration-manifest/v1"),
    exploration: ExplorationManifestEntry,
  },
  $I.annote("ExplorationManifest", {
    description: "Minimal exploration manifest contract consumed by the Atlas and README projector.",
  })
) {}

/**
 * D3 state consumed by every exploration projection.
 *
 * **Example** (Describe an adoption snapshot)
 *
 * ```ts
 * import { ExplorationProjectionState } from "@beep/repo-cli/commands/Explore"
 *
 * const state = ExplorationProjectionState.make({
 *   authority: "manifest-adoption",
 *   status: "active",
 *   furthestStage: "shape",
 *   resumeStage: "shape",
 * })
 * console.log(state.resumeStage) // "shape"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplorationProjectionState extends S.Class<ExplorationProjectionState>($I`ExplorationProjectionState`)(
  {
    authority: ExplorationProjectionAuthority,
    status: ExplorationStatus,
    furthestStage: ExplorationStage,
    resumeStage: ExplorationStage,
  },
  $I.annote("ExplorationProjectionState", {
    description: "Normalized D3 exploration state derived from a stream or an explicit manifest adoption snapshot.",
  })
) {}

/**
 * One normalized row in the generated exploration Atlas.
 *
 * **Example** (Validate an Atlas row)
 *
 * ```ts
 * import { ExplorationAtlasRow } from "@beep/repo-cli/commands/Explore"
 * import * as S from "effect/Schema"
 *
 * const row = {
 *   slug: "cache-posture",
 *   title: "Cache posture",
 *   status: "active",
 *   furthestStage: "shape",
 *   resumeStage: "research",
 *   authority: "event-stream",
 *   updated: "2026-08-27",
 * }
 * console.log(S.is(ExplorationAtlasRow)(row)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplorationAtlasRow extends S.Class<ExplorationAtlasRow>($I`ExplorationAtlasRow`)(
  {
    slug: PacketSlug,
    title: S.String,
    status: ExplorationStatus,
    furthestStage: ExplorationStage,
    resumeStage: ExplorationStage,
    authority: ExplorationProjectionAuthority,
    updated: S.String,
  },
  $I.annote("ExplorationAtlasRow", {
    description: "One deterministic Atlas navigation row derived from normalized D3 exploration state.",
  })
) {}

class ExplorationReadmeProjection extends S.Class<ExplorationReadmeProjection>($I`ExplorationReadmeProjection`)(
  { path: S.String, existing: S.String, projected: S.String },
  $I.annote("ExplorationReadmeProjection", {
    description: "Existing and deterministic projected bytes for one exploration README.",
  })
) {}

class ExplorationProjectionIssue extends S.Class<ExplorationProjectionIssue>($I`ExplorationProjectionIssue`)(
  { slug: S.String, path: S.String, detail: S.String },
  $I.annote("ExplorationProjectionIssue", {
    description: "Fail-closed reason one exploration cannot be projected from its declared authority.",
  })
) {}

/**
 * Complete deterministic exploration projection plan.
 *
 * **Details**
 *
 * The plan keeps current and projected README bytes separate so `--check`
 * can report drift without writing and `--write` can apply only fully
 * derivable output.
 *
 * **Example** (Construct an empty projection plan)
 *
 * ```ts
 * import { ExplorationProjection } from "@beep/repo-cli/commands/Explore"
 *
 * const projection = ExplorationProjection.make({ root: ".", atlasContent: "", readmes: [], issues: [] })
 * console.log(projection.issues.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExplorationProjection extends S.Class<ExplorationProjection>($I`ExplorationProjection`)(
  {
    root: S.String,
    atlasContent: S.String,
    readmes: S.Array(ExplorationReadmeProjection),
    issues: S.Array(ExplorationProjectionIssue),
  },
  $I.annote("ExplorationProjection", {
    description: "Whole Atlas and README projection plan plus fail-closed derivation issues.",
  })
) {}

const rowOrder = Order.mapInput(Order.String, (row: ExplorationAtlasRow) => row.slug);
const readmeOrder = Order.mapInput(Order.String, (readme: ExplorationReadmeProjection) => readme.path);
const issueOrder = Order.combine(
  Order.mapInput(Order.String, (issue: ExplorationProjectionIssue) => issue.slug),
  Order.combine(
    Order.mapInput(Order.String, (issue: ExplorationProjectionIssue) => issue.path),
    Order.mapInput(Order.String, (issue: ExplorationProjectionIssue) => issue.detail)
  )
);
const decodeManifest = S.decodeUnknownEffect(ExplorationManifest);
const isExplorationStage = S.is(ExplorationStage);
const isExplorationStatus = S.is(ExplorationStatus);
const GENERATED_STATUS_BEGIN = "<!-- BEGIN GENERATED: EXPLORATION STATUS -->";
const GENERATED_STATUS_END = "<!-- END GENERATED: EXPLORATION STATUS -->";

const projectionIssue = (slug: string, path: string, detail: string): ExplorationProjectionIssue =>
  ExplorationProjectionIssue.make({ slug, path, detail });

const renderReadmeStatus = (state: ExplorationProjectionState): ReadonlyArray<string> => [
  GENERATED_STATUS_BEGIN,
  `Stage: \`${state.resumeStage}\``,
  `Status: \`${state.status}\``,
  GENERATED_STATUS_END,
];

const isStatusField = (line: string): boolean => Str.startsWith("Stage: `")(line) || Str.startsWith("Status: `")(line);

const STATUS_FIELD_PREFIX = "Status: `";

const authoredStatusNote = (line: string): O.Option<string> => {
  if (!Str.startsWith(STATUS_FIELD_PREFIX)(line)) return O.none();
  const closingBacktick = pipe(line, Str.slice(STATUS_FIELD_PREFIX.length), Str.indexOf("`"));
  return pipe(
    closingBacktick,
    O.map((index) =>
      pipe(line, Str.slice(STATUS_FIELD_PREFIX.length + index + 1), Str.trim, Str.replace(/^[\s—·:-]+/, ""))
    ),
    O.filter(Str.isNonEmpty),
    O.map((note) => `Status note: ${note}`)
  );
};

const generatedMarkerCountsAreValid = (lines: ReadonlyArray<string>): boolean => {
  const beginCount = A.length(A.filter(lines, (line) => line === GENERATED_STATUS_BEGIN));
  const endCount = A.length(A.filter(lines, (line) => line === GENERATED_STATUS_END));
  if (beginCount === 0 && endCount === 0) return true;
  if (beginCount !== 1 || endCount !== 1) return false;
  const begin = A.findFirstIndex(lines, (line) => line === GENERATED_STATUS_BEGIN);
  const end = A.findFirstIndex(lines, (line) => line === GENERATED_STATUS_END);
  return O.isSome(begin) && O.isSome(end) && begin.value < end.value;
};

// fallow-ignore-next-line complexity -- this pass tracks generated markers while preserving authored status prose
const projectReadmeStatus = (content: string, state: ExplorationProjectionState): O.Option<string> => {
  const lines = Str.split(/\r?\n/)(content);
  const headingIndex = A.findFirstIndex(lines, (line) => line === "## Status");
  if (O.isNone(headingIndex)) return O.none();
  const sectionTail = A.drop(lines, headingIndex.value + 1);
  const relativeEnd = A.findFirstIndex(sectionTail, (line) => Str.startsWith("## ")(line));
  const sectionEnd = pipe(
    relativeEnd,
    O.match({ onNone: () => A.length(lines), onSome: (index) => headingIndex.value + 1 + index })
  );
  const section = A.take(A.drop(lines, headingIndex.value + 1), sectionEnd - headingIndex.value - 1);
  if (!generatedMarkerCountsAreValid(section)) return O.none();

  let insideGenerated = false;
  let authored = A.empty<string>();
  for (const line of section) {
    if (line === GENERATED_STATUS_BEGIN) {
      insideGenerated = true;
      continue;
    }
    if (line === GENERATED_STATUS_END) {
      insideGenerated = false;
      continue;
    }
    if (!insideGenerated && isStatusField(line)) {
      const note = authoredStatusNote(line);
      if (O.isSome(note)) authored = A.append(authored, note.value);
      continue;
    }
    if (!insideGenerated) authored = A.append(authored, line);
  }

  const authoredWithoutLeadingBlanks = A.dropWhile(authored, Str.isEmpty);
  const before = A.take(lines, headingIndex.value + 1);
  const after = A.drop(lines, sectionEnd);
  return O.some(
    A.join(
      A.appendAll(A.appendAll(before, ["", ...renderReadmeStatus(state), "", ...authoredWithoutLeadingBlanks]), after),
      "\n"
    )
  );
};

/**
 * Render the complete doctrine-free exploration Atlas.
 *
 * **Example** (Render an empty Atlas)
 *
 * ```ts
 * import { renderExplorationAtlas } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(renderExplorationAtlas([], []).startsWith("# Exploration Atlas")) // true
 * ```
 *
 * @param rows - Rows derived from normalized D3 state.
 * @param invalid - Slugs whose state was not derivable.
 * @returns Complete Markdown projection.
 * @category formatting
 * @since 0.0.0
 */
export const renderExplorationAtlas: {
  (invalid: ReadonlyArray<string>): (rows: ReadonlyArray<ExplorationAtlasRow>) => string;
  (rows: ReadonlyArray<ExplorationAtlasRow>, invalid: ReadonlyArray<string>): string;
} = dual(2, (rows: ReadonlyArray<ExplorationAtlasRow>, invalid: ReadonlyArray<string>): string => {
  const ordered = A.sort(rows, rowOrder);
  let lines = [
    "# Exploration Atlas",
    "",
    "Generated by `bun run beep explore atlas --write`; this local file is not tracked GitHub truth.",
    "State is the D3 event fold after stream opt-in, or the explicit manifest adoption snapshot before opt-in.",
    "Navigation only; edit packet events/manifests and authored packet prose, never this projection.",
    "",
    `${A.length(ordered) + A.length(invalid)} exploration packets.`,
  ];
  for (const status of ExplorationStatus.Options) {
    const statusRows = A.filter(ordered, (row) => row.status === status);
    if (A.isReadonlyArrayEmpty(statusRows)) continue;
    lines = A.appendAll(lines, [
      "",
      `## ${Str.capitalize(status)} (${A.length(statusRows)})`,
      "",
      "| Exploration | Resume stage | Furthest stage | Authority | Updated |",
      "| --- | --- | --- | --- | --- |",
      ...A.map(
        statusRows,
        (row) =>
          `| [${row.title}](./${row.slug}/README.md) | ${row.resumeStage} | ${row.furthestStage} | ${row.authority} | ${row.updated} |`
      ),
    ]);
  }
  if (A.isReadonlyArrayNonEmpty(invalid)) {
    lines = A.appendAll(lines, [
      "",
      `## Underivable packets (${A.length(invalid)})`,
      "",
      ...A.map(A.sort(invalid, Order.String), (slug) => `- \`${slug}\``),
    ]);
  }
  return A.join(A.append(lines, ""), "\n");
});

// fallow-ignore-next-line complexity -- every stream defect must stay in one validation ledger before projection
const stateFromStream = Effect.fn("Explore.stateFromStream")(function* (
  slug: PacketSlug,
  packetPath: string,
  manifest: ExplorationManifestEntry
) {
  const store = yield* PacketEventStore;
  const listing = yield* store.list(PacketStreamLocator.make({ packet: slug, root: "explorations", packetPath }));
  const derived = foldPacketEvents({ packet: slug, root: "explorations", events: listing.events });
  const status = pipe(O.fromUndefinedOr(derived.status), O.filter(isExplorationStatus));
  const furthestStage = pipe(O.fromUndefinedOr(derived.furthestStage), O.filter(isExplorationStage));
  const resumeStage = pipe(O.fromUndefinedOr(derived.resumeStage), O.filter(isExplorationStage));
  let issues = A.empty<string>();
  if (A.isReadonlyArrayNonEmpty(listing.issues)) {
    issues = A.append(issues, `event stream has ${A.length(listing.issues)} unreadable or invalid event(s)`);
  }
  if (A.isReadonlyArrayNonEmpty(derived.issues)) {
    issues = A.append(issues, `event fold has ${A.length(derived.issues)} chain issue(s)`);
  }
  if (A.isReadonlyArrayNonEmpty(derived.forks)) {
    issues = A.append(issues, `event fold has ${A.length(derived.forks)} fork(s)`);
  }
  if (O.isNone(status)) {
    issues = A.append(issues, "event fold has no valid exploration status");
  }
  if (O.isNone(furthestStage)) {
    issues = A.append(issues, "event fold has no valid furthestStage");
  }
  if (O.isNone(resumeStage)) {
    issues = A.append(issues, "event fold has no valid resumeStage");
  }
  if (A.isReadonlyArrayNonEmpty(issues) || O.isNone(status) || O.isNone(furthestStage) || O.isNone(resumeStage)) {
    return { issues, state: O.none<ExplorationProjectionState>() };
  }

  const state = ExplorationProjectionState.make({
    authority: "event-stream",
    status: status.value,
    furthestStage: furthestStage.value,
    resumeStage: resumeStage.value,
  });
  if (manifest.status !== state.status) {
    issues = A.append(
      issues,
      `manifest status ${manifest.status} disagrees with stream-derived status ${state.status}`
    );
  }
  if (manifest.stage !== state.resumeStage) {
    issues = A.append(
      issues,
      `manifest legacy stage ${manifest.stage} disagrees with stream-derived resumeStage ${state.resumeStage}`
    );
  }
  return { issues, state: A.isReadonlyArrayNonEmpty(issues) ? O.none<ExplorationProjectionState>() : O.some(state) };
});

const stateFromManifestAdoption = (manifest: ExplorationManifestEntry): ExplorationProjectionState =>
  ExplorationProjectionState.make({
    authority: "manifest-adoption",
    status: manifest.status,
    furthestStage: manifest.stage,
    resumeStage: manifest.stage,
  });

/**
 * Build the Atlas and README projection plan for every exploration packet.
 *
 * **Details**
 *
 * Invalid manifests, malformed streams, forks, missing D3 values, and
 * unlocatable README status regions become explicit issues. Callers must not
 * write a plan carrying any issue.
 *
 * **Example** (Build the projection program)
 *
 * ```ts
 * import { buildExplorationProjection } from "@beep/repo-cli/commands/Explore"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(buildExplorationProjection("."))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
// fallow-ignore-next-line complexity -- each packet is read, validated, and projected as one ordered transaction
export const buildExplorationProjection = Effect.fn("Explore.buildExplorationProjection")(function* (
  repoRoot?: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* PacketEventStore;
  const root = repoRoot ?? (yield* findRepoRoot());
  const explorationsRoot = path.join(root, "explorations");
  const entries = pipe(
    yield* fs.readDirectory(explorationsRoot),
    A.filter((entry) => !Str.startsWith("_")(entry)),
    A.sort(Order.String)
  );
  let rows = A.empty<ExplorationAtlasRow>();
  let invalid = A.empty<string>();
  let issues = A.empty<ExplorationProjectionIssue>();
  let readmes = A.empty<ExplorationReadmeProjection>();

  for (const slug of entries) {
    const packetPath = path.join(explorationsRoot, slug);
    const stat = yield* fs.stat(packetPath).pipe(Effect.option);
    if (!O.exists(stat, (value) => value.type === "Directory")) continue;
    const manifestPath = path.join(packetPath, "ops", "manifest.json");
    const manifest = yield* fs
      .readFileString(manifestPath)
      .pipe(
        Effect.flatMap(UnknownFromJsonString.decodeUnknownEffect),
        Effect.flatMap(decodeManifest),
        Effect.asSome,
        Effect.orElseSucceed(O.none<ExplorationManifest>)
      );
    if (O.isNone(manifest)) {
      invalid = A.append(invalid, slug);
      issues = A.append(issues, projectionIssue(slug, manifestPath, "manifest is missing or invalid"));
      continue;
    }
    if (manifest.value.exploration.slug !== slug) {
      invalid = A.append(invalid, slug);
      issues = A.append(
        issues,
        projectionIssue(
          slug,
          manifestPath,
          `manifest slug is ${manifest.value.exploration.slug}, not directory ${slug}`
        )
      );
      continue;
    }

    const hasStream = yield* store.hasStream(packetPath);
    const stateResult = hasStream
      ? yield* stateFromStream(manifest.value.exploration.slug, packetPath, manifest.value.exploration)
      : { issues: A.empty<string>(), state: O.some(stateFromManifestAdoption(manifest.value.exploration)) };
    if (A.isReadonlyArrayNonEmpty(stateResult.issues) || O.isNone(stateResult.state)) {
      invalid = A.append(invalid, slug);
      for (const detail of stateResult.issues) {
        issues = A.append(issues, projectionIssue(slug, path.join(packetPath, "ops", "events"), detail));
      }
      continue;
    }

    const state = stateResult.state.value;
    rows = A.append(
      rows,
      ExplorationAtlasRow.make({
        slug: manifest.value.exploration.slug,
        title: manifest.value.exploration.title,
        status: state.status,
        furthestStage: state.furthestStage,
        resumeStage: state.resumeStage,
        authority: state.authority,
        updated: manifest.value.exploration.updated,
      })
    );

    const readmePath = path.join(packetPath, "README.md");
    const existing = yield* fs.readFileString(readmePath).pipe(Effect.option);
    if (O.isNone(existing)) {
      issues = A.append(issues, projectionIssue(slug, readmePath, "README.md is missing"));
      continue;
    }
    const projected = projectReadmeStatus(existing.value, state);
    if (O.isNone(projected)) {
      issues = A.append(
        issues,
        projectionIssue(slug, readmePath, "README Status section is missing or has malformed generated markers")
      );
      continue;
    }
    readmes = A.append(
      readmes,
      ExplorationReadmeProjection.make({ path: readmePath, existing: existing.value, projected: projected.value })
    );
  }

  const orderedRows = A.sort(rows, rowOrder);
  const orderedInvalid = A.sort(invalid, Order.String);
  return ExplorationProjection.make({
    root,
    atlasContent: renderExplorationAtlas(orderedRows, orderedInvalid),
    readmes: A.sort(readmes, readmeOrder),
    issues: A.sort(issues, issueOrder),
  });
});

/**
 * Build only the generated Atlas bytes.
 *
 * **Example** (Build the projection program)
 *
 * ```ts
 * import { buildExplorationAtlasContent } from "@beep/repo-cli/commands/Explore"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(buildExplorationAtlasContent("."))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const buildExplorationAtlasContent = Effect.fn("Explore.buildExplorationAtlasContent")(function* (
  repoRoot?: string
) {
  return (yield* buildExplorationProjection(repoRoot)).atlasContent;
});

/**
 * Return every local projection path whose bytes drift from a plan.
 *
 * **Details**
 *
 * An absent Atlas is valid because it is ignored and generated on read. A
 * present Atlas must match wholesale; extra prose is therefore reported as
 * drift instead of becoming an untracked doctrine surface.
 *
 * **Example** (Detect authored Atlas content)
 *
 * ```ts
 * import { explorationProjectionDriftPaths, ExplorationProjection } from "@beep/repo-cli/commands/Explore"
 * import * as Option from "effect/Option"
 *
 * const plan = ExplorationProjection.make({ root: ".", atlasContent: "generated", readmes: [], issues: [] })
 * console.log(explorationProjectionDriftPaths(plan, Option.some("generated\nextra")))
 * // ["explorations/ATLAS.md"]
 * ```
 *
 * @param projection - Fully rendered projection plan.
 * @param localAtlas - Current local Atlas bytes, or None when the ignored file is absent.
 * @returns Paths that drift from generated bytes.
 * @category validation
 * @since 0.0.0
 */
export const explorationProjectionDriftPaths: {
  (localAtlas: O.Option<string>): (projection: ExplorationProjection) => ReadonlyArray<string>;
  (projection: ExplorationProjection, localAtlas: O.Option<string>): ReadonlyArray<string>;
} = dual(2, (projection: ExplorationProjection, localAtlas: O.Option<string>): ReadonlyArray<string> => {
  let paths = A.empty<string>();
  if (O.exists(localAtlas, (content) => content !== projection.atlasContent)) {
    paths = A.append(paths, EXPLORATION_ATLAS_PATH);
  }
  for (const readme of A.sort(projection.readmes, readmeOrder)) {
    if (readme.existing !== readme.projected) paths = A.append(paths, readme.path);
  }
  return A.sort(paths, Order.String);
});

const projectionIssueLines = (projection: ExplorationProjection): ReadonlyArray<string> =>
  A.map(A.sort(projection.issues, issueOrder), (issue) => `${issue.path}: ${issue.detail}`);

const refuseIssues = (projection: ExplorationProjection) =>
  failWithReportedExit(
    `explore atlas: ${A.length(projection.issues)} underivable projection input(s):\n${A.join(
      projectionIssueLines(projection),
      "\n"
    )}`
  );

/**
 * Write the local Atlas and every deterministic README status region.
 *
 * **Details**
 *
 * The write refuses the whole plan when any packet is underivable, so no
 * partial fleet projection can masquerade as current state.
 *
 * **Example** (Build the write program)
 *
 * ```ts
 * import { writeExplorationAtlas } from "@beep/repo-cli/commands/Explore"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(writeExplorationAtlas())) // true
 * ```
 *
 * @param repoRoot - Optional repository root override for callers that already resolved it.
 * @returns The deterministic Atlas bytes after every changed projection is written.
 * @category use-cases
 * @since 0.0.0
 */
export const writeExplorationAtlas = Effect.fn("Explore.writeExplorationAtlas")(function* (repoRoot?: string) {
  const path = yield* Path.Path;
  const projection = yield* buildExplorationProjection(repoRoot);
  if (A.isReadonlyArrayNonEmpty(projection.issues)) return yield* refuseIssues(projection);
  yield* writeContainedFileString(
    projection.root,
    path.join(projection.root, EXPLORATION_ATLAS_PATH),
    projection.atlasContent
  );
  for (const readme of projection.readmes) {
    if (readme.existing === readme.projected) continue;
    yield* writeContainedFileString(projection.root, readme.path, readme.projected);
  }
  return projection.atlasContent;
});

const writeFlag = Flag.boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Write the local Atlas and generated README status regions")
);
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Fail on underivable state or Atlas/README projection drift")
);

/**
 * `beep explore atlas` projection command.
 *
 * **Example** (Reference the Atlas command)
 *
 * ```ts
 * import { exploreAtlasCommand } from "@beep/repo-cli/commands/Explore"
 *
 * console.log(exploreAtlasCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const exploreAtlasCommand = Command.make(
  "atlas",
  { check: checkFlag, write: writeFlag },
  Effect.fn(function* ({ check, write }) {
    if (check && write) return yield* failWithReportedExit("explore atlas: --check and --write are exclusive");
    if (write) {
      yield* writeExplorationAtlas();
      yield* Console.log(`[explore:atlas] wrote ${EXPLORATION_ATLAS_PATH} and README status projections.`);
      return;
    }

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const projection = yield* buildExplorationProjection();
    if (check) {
      if (A.isReadonlyArrayNonEmpty(projection.issues)) return yield* refuseIssues(projection);
      const local = yield* fs.readFileString(path.join(projection.root, EXPLORATION_ATLAS_PATH)).pipe(Effect.option);
      const drift = explorationProjectionDriftPaths(projection, local);
      if (A.isReadonlyArrayNonEmpty(drift)) {
        return yield* failWithReportedExit(
          `explore atlas: ${A.length(drift)} generated projection(s) drift; run \`bun run beep explore atlas --write\`:\n${A.join(
            drift,
            "\n"
          )}`
        );
      }
      yield* Console.log("[explore:atlas] OK: D3 Atlas and README projections are current.");
      return;
    }
    yield* Console.log(projection.atlasContent);
  })
).pipe(Command.withDescription("Generate the exploration Atlas and README status regions from D3 state"));
