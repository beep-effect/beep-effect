/**
 * Roadmap-reference inventory and enforcement command.
 *
 * Verifies that goal and exploration links in `docs/ROADMAP.md` resolve to
 * existing files or directories. Goal phase snapshots are compared with the
 * linked packet manifest when phase data is available, but drift is advisory.
 *
 * Link extraction rides the shared knowledge link parser (`knowledgeDocumentLines`
 * + `knowledgeLinkDestinations`), so what counts as a link — and which lines are
 * prose — is decided in one place; only the roadmap-specific concerns (the
 * goals/explorations domain filter, trailing phase snapshots, reference-style
 * definitions, soft-wrapped link labels merged back onto their opening line)
 * live here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { LiteralKit } from "@beep/schema";
import { A, thunkEmptyStr } from "@beep/utils";
import { Console, Effect, FileSystem, flow, HashSet, Number as N, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { makePolicyFindingLogger } from "../../internal/cli/PolicyFindingLogger.ts";
import { EXPLORATION_ATLAS_PATH } from "../Explore/Atlas.ts";
import { decodeGoalManifest, GoalPhaseStatus } from "../Goals/Goals.schemas.ts";
import { goalManifestPhases, parseGoalManifestText } from "../Goals/Inventory.ts";
import { PORTFOLIO_INDEX_PATH } from "../Goals/PortfolioIndex.ts";
import { knowledgeDocumentLines, knowledgeLinkDestinations } from "../Knowledge/Knowledge.refs.ts";
import type { KnowledgeDocumentLine, KnowledgeLinkDestination } from "../Knowledge/Knowledge.refs.ts";

const $I = $RepoCliId.create("commands/Lint/RoadmapRefs");

const ROADMAP_PATH = "docs/ROADMAP.md";
const ROADMAP_TARGET_PATTERN = /^(?:\.\.\/|\.\/)(?:goals|explorations)\//;
const ROADMAP_LINK_DEFINITION_PATTERN = /^\s*\[[^\]]+\]:\s+((?:\.\.\/|\.\/)(?:goals|explorations)\/\S+)\s*$/;
const PHASE_SNAPSHOT_PATTERN = /^\s*\((\d+)\/(\d+)\)/;
const DERIVED_PROJECTION_PATHS = HashSet.make(EXPLORATION_ATLAS_PATH, PORTFOLIO_INDEX_PATH);

class RoadmapReference extends S.Class<RoadmapReference>($I`RoadmapReference`)(
  {
    target: S.String,
    phaseDone: S.optionalKey(S.Finite),
    phaseTotal: S.optionalKey(S.Finite),
  },
  $I.annote("RoadmapReference", {
    description: "One goal or exploration Markdown link parsed from the repository roadmap.",
  })
) {}

const RoadmapPolicySeverity = LiteralKit(["warning", "error"]).pipe(
  $I.annoteSchema("RoadmapPolicySeverity", {
    description: "Severity emitted by roadmap-reference lint findings.",
  })
);

class RoadmapPolicyFinding extends S.Class<RoadmapPolicyFinding>($I`RoadmapPolicyFinding`)(
  {
    category: S.Literal("roadmap-policy"),
    ruleId: S.Literal("roadmap-ref"),
    severity: RoadmapPolicySeverity,
    target: S.String,
    file: S.String,
    message: S.String,
    remediation: S.String,
  },
  $I.annote("RoadmapPolicyFinding", {
    description: "Machine-readable roadmap-reference lint finding consumed by repository quality tooling.",
  })
) {}

const encodePolicyFinding = S.encodeUnknownEffect(RoadmapPolicyFinding);

const { log: logPolicyFinding } = makePolicyFindingLogger({
  issuePrefix: "[roadmap:issue] ",
  encode: encodePolicyFinding,
  renderSummary: (finding: RoadmapPolicyFinding) =>
    `- ${finding.target} :: ${finding.file} [${finding.severity}] ${finding.message}`,
});

const phaseSnapshotIn = (text: string): O.Option<readonly [number, number]> => {
  const match = PHASE_SNAPSHOT_PATTERN.exec(text);
  if (match === null) {
    return O.none();
  }
  return pipe(
    O.all([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2])]),
    O.flatMap(([done, total]) => O.all([N.parse(done), N.parse(total)]))
  );
};

/**
 * The phase snapshot paired to one link: on the same line after the closing paren, or opening the
 * next prose line when the link closes its own line — the live roadmap wraps long entries that way.
 *
 * @param afterLink - The rest of the link's line, from just past the closing paren.
 * @param nextLine - The document line after the link's, when one exists.
 * @returns The parsed `(done/total)` counts, or none when no snapshot trails the link.
 */
const phaseSnapshotNear = (
  afterLink: string,
  nextLine: O.Option<KnowledgeDocumentLine>
): O.Option<readonly [number, number]> =>
  Str.isNonEmpty(Str.trim(afterLink))
    ? phaseSnapshotIn(afterLink)
    : O.flatMap(nextLine, (line) => (line.prose ? phaseSnapshotIn(line.text) : O.none()));

const definitionReference = (lineText: string): O.Option<RoadmapReference> => {
  const definition = ROADMAP_LINK_DEFINITION_PATTERN.exec(lineText);
  return definition !== null && P.isString(definition[1])
    ? O.some(RoadmapReference.make({ target: definition[1] }))
    : O.none();
};

// A prose line whose final link label never closes: its `](destination)` sits on a following
// soft-wrapped line, so per-line matching alone cannot see the link.
const UNCLOSED_LINK_LABEL_PATTERN = /\[[^\]]*$/;

type RoadmapLineUnit = {
  readonly text: string;
  readonly lastLineNumber: number;
};

const wrappedUnitFrom = (
  lines: ReadonlyArray<KnowledgeDocumentLine>,
  start: KnowledgeDocumentLine
): RoadmapLineUnit => {
  let text = start.text;
  let lastLineNumber = start.number;
  // `number` is 1-based, so indexing the 0-based array with it lands on the following line.
  let next = A.get(lines, lastLineNumber);
  while (UNCLOSED_LINK_LABEL_PATTERN.test(text) && O.isSome(next) && next.value.prose) {
    text = `${text} ${Str.trimStart(next.value.text)}`;
    lastLineNumber = next.value.number;
    next = A.get(lines, lastLineNumber);
  }
  return { text, lastLineNumber };
};

// Continuation lines are consumed into their opening line's unit so a complete link sitting on a
// continuation is matched exactly once.
const roadmapLineUnits = (lines: ReadonlyArray<KnowledgeDocumentLine>): ReadonlyArray<RoadmapLineUnit> => {
  let units = A.empty<RoadmapLineUnit>();
  let consumedThrough = 0;
  for (const line of lines) {
    if (!line.prose || line.number <= consumedThrough) {
      continue;
    }
    const unit = wrappedUnitFrom(lines, line);
    units = A.append(units, unit);
    consumedThrough = unit.lastLineNumber;
  }
  return units;
};

const linkReference = (
  lines: ReadonlyArray<KnowledgeDocumentLine>,
  unit: RoadmapLineUnit,
  link: KnowledgeLinkDestination
): O.Option<RoadmapReference> => {
  if (!ROADMAP_TARGET_PATTERN.test(link.destination)) {
    return O.none();
  }
  // `lastLineNumber` is 1-based, so indexing the 0-based array with it lands on the next line.
  const phaseSnapshot = phaseSnapshotNear(Str.slice(link.end)(unit.text), A.get(lines, unit.lastLineNumber));
  return O.some(
    RoadmapReference.make({
      target: link.destination,
      ...pipe(
        phaseSnapshot,
        O.map(([done, total]) => ({ phaseDone: done, phaseTotal: total })),
        O.getOrElse(() => ({}))
      ),
    })
  );
};

const unitReferences =
  (lines: ReadonlyArray<KnowledgeDocumentLine>) =>
  (unit: RoadmapLineUnit): ReadonlyArray<RoadmapReference> =>
    O.match(definitionReference(unit.text), {
      onSome: A.of,
      onNone: () => A.getSomes(A.map(knowledgeLinkDestinations(unit.text), (link) => linkReference(lines, unit, link))),
    });

const parseRoadmapReferences = (raw: string): ReadonlyArray<RoadmapReference> => {
  const lines = knowledgeDocumentLines(raw);
  return A.flatMap(roadmapLineUnits(lines), unitReferences(lines));
};

const targetPath: (target: string) => string = flow(Str.split(/[?#]/), A.head, O.getOrElse(thunkEmptyStr));

const makeFinding = (
  severity: "warning" | "error",
  target: string,
  message: string,
  remediation: string
): RoadmapPolicyFinding =>
  RoadmapPolicyFinding.make({
    category: "roadmap-policy",
    ruleId: "roadmap-ref",
    severity,
    target,
    file: ROADMAP_PATH,
    message,
    remediation,
  });

const isGoalPhaseSnapshot = (reference: RoadmapReference): boolean =>
  reference.phaseDone !== undefined &&
  reference.phaseTotal !== undefined &&
  (Str.startsWith("../goals/")(reference.target) || Str.startsWith("./goals/")(reference.target));

const readManifestPhaseCounts = Effect.fn("RoadmapRefs.readManifestPhaseCounts")(function* (
  reference: RoadmapReference,
  roadmapPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const goalPath = pipe(targetPath(reference.target), Str.split("/"), A.take(3), A.join("/"));
  const manifestPath = path.join(path.dirname(roadmapPath), goalPath, "ops", "manifest.json");
  const manifestText = yield* fs.readFileString(manifestPath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
  const parsedManifest = O.flatMap(manifestText, parseGoalManifestText);
  if (O.isNone(parsedManifest)) {
    return O.none<{ readonly done: number; readonly total: number }>();
  }
  const manifest = yield* decodeGoalManifest(parsedManifest.value).pipe(Effect.asSome, Effect.orElseSucceed(O.none));
  if (O.isNone(manifest) || manifest.value.phases === undefined) {
    return O.none<{ readonly done: number; readonly total: number }>();
  }
  const phases = goalManifestPhases(manifest.value);
  return O.some({
    done: A.length(A.filter(phases, (phase) => GoalPhaseStatus.is.complete(phase.status))),
    total: A.length(phases),
  });
});

const phaseSnapshotFinding = Effect.fn("RoadmapRefs.phaseSnapshotFinding")(function* (
  reference: RoadmapReference,
  roadmapPath: string,
  resolvedTarget: string
) {
  if (!isGoalPhaseSnapshot(reference)) {
    return O.none<RoadmapPolicyFinding>();
  }

  const counts = yield* readManifestPhaseCounts(reference, roadmapPath);
  if (O.isNone(counts)) {
    return O.none<RoadmapPolicyFinding>();
  }

  const { done, total } = counts.value;
  const matches =
    reference.phaseDone !== undefined &&
    reference.phaseTotal !== undefined &&
    N.Equivalence(reference.phaseDone, done) &&
    N.Equivalence(reference.phaseTotal, total);
  if (matches) {
    return O.none<RoadmapPolicyFinding>();
  }

  return O.some(
    makeFinding(
      "warning",
      reference.target,
      `Roadmap phase snapshot (${reference.phaseDone}/${reference.phaseTotal}) disagrees with manifest phases (${done}/${total}).`,
      `Update the phase snapshot adjacent to the link for ${resolvedTarget}.`
    )
  );
});

/**
 * Verifies roadmap packet links exist and reports goal phase-count drift.
 *
 * **Example** (Verify Effect lint runner)
 *
 * ```ts
 * import { runRoadmapRefsLint } from "@beep/repo-cli/commands/Lint/RoadmapRefs"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runRoadmapRefsLint))
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const runRoadmapRefsLint = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const roadmapPath = path.join(repoRoot, ROADMAP_PATH);
  const raw = yield* fs.readFileString(roadmapPath);
  const blocking = A.empty<RoadmapPolicyFinding>();
  const advisories = A.empty<RoadmapPolicyFinding>();

  for (const reference of parseRoadmapReferences(raw)) {
    const resolvedTarget = path.resolve(path.dirname(roadmapPath), targetPath(reference.target));
    const repoPath = path.relative(repoRoot, resolvedTarget);
    const isDerivedProjection = HashSet.has(DERIVED_PROJECTION_PATHS, repoPath);
    if (!(yield* fs.exists(resolvedTarget)) && !isDerivedProjection) {
      blocking.push(
        makeFinding(
          "error",
          reference.target,
          `Roadmap link target does not exist: ${resolvedTarget}.`,
          "Restore the referenced packet path or update the roadmap link to an existing target."
        )
      );
      continue;
    }

    const advisory = yield* phaseSnapshotFinding(reference, roadmapPath, resolvedTarget);
    if (O.isSome(advisory)) {
      advisories.push(advisory.value);
    }
  }

  yield* Console.log(`[roadmap] blocking_findings=${A.length(blocking)}`);
  yield* Console.log(`[roadmap] advisory_findings=${A.length(advisories)}`);

  if (A.isReadonlyArrayNonEmpty(advisories)) {
    yield* Console.error("[roadmap] advisories (non-fatal):");
    for (const finding of advisories) {
      yield* logPolicyFinding(finding);
    }
  }

  if (A.isReadonlyArrayNonEmpty(blocking)) {
    yield* Console.error("[roadmap] blocking findings:");
    for (const finding of blocking) {
      yield* logPolicyFinding(finding);
    }
    return yield* failWithReportedExit("roadmap: referenced goal or exploration target is missing.");
  }
});

/**
 * `bun run beep lint roadmap-refs` — enforce roadmap packet links.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { lintRoadmapRefsCommand } from "@beep/repo-cli/commands/Lint/RoadmapRefs"
 *
 * console.log(lintRoadmapRefsCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const lintRoadmapRefsCommand = Command.make("roadmap-refs", {}, runRoadmapRefsLint).pipe(
  Command.withDescription("Verify roadmap goal and exploration links resolve to existing targets")
);
