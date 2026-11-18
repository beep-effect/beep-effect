/**
 * `beep goals set-status` — the single writer for goal-packet status.
 *
 * Per-slug mode atomically updates the manifest (`initiative.status`,
 * `lifecycle` when present, `initiative.updated`), rewrites the README
 * `Lifecycle:` line, and regenerates `goals/INDEX.md` in one operation,
 * refusing with typed errors on unknown slugs/statuses or READMEs without a
 * recognizable status line. Packets that opted into event sourcing (an
 * `ops/events/` directory exists) additionally flow the transition through
 * the guarded packet-core writer: `--preview` prints the fold-backed
 * transition plan without writing, and a real write appends the CAS events
 * (seeding a genesis event on the first transition) and regenerates the
 * derived `ops/trace.json` projection before the manifest edit — refusing
 * before any manifest edit on a moved tip, fork, or integrity issue (an
 * interrupted multi-event append leaves only valid chain events behind, never
 * a projection or manifest change). `--migrate` runs the
 * mechanical census-locked migration over every packet (dry-run by default,
 * `--write` to apply).
 *
 * `completed-retained` binds the goal's final PR in the same write: it sets
 * `closeout`, marks the final in `completionGate.pullRequests` (demoting any
 * other final to `supporting`) and deletes a legacy `proposedCloseout` key.
 * The final is, in order: the legacy proposal's own final, read from the raw
 * manifest JSON; `--final-pr <n>` (an open PR, or a merged one only with
 * `--adopt-merged`); the checked-out branch's open PR from `gh pr view`. A
 * non-grandfathered packet with no final is refused ("publish first, then
 * rerun"); a grandfathered one flips status only. Reopening a committed
 * closeout as `active` or `paused` deletes the record and demotes its final
 * to `supporting`. Any write that keeps or reopens a committed closeout, or
 * flips a grandfathered gate, also deletes a stale `proposedCloseout` key; a
 * stale proposal naming another final than the committed closeout is refused.
 * Verification is hosted and later: `goals completion refresh` reads the
 * merged final, so this writer never reads a receipt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli-kit/cli/Jsonc";
import { optionalProp } from "@beep/repo-cli-kit/cli/OptionRecord";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, pipe, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { GoalFinalPullRequestState, goalFinalPullRequestResolver } from "./FinalPullRequest.ts";
import {
  GoalManifestInvalidError,
  GoalPacketNotFoundError,
  GoalReadmeStatusLineError,
  GoalStatusInputError,
} from "./Goals.errors.ts";
import {
  decodeGoalManifest,
  GoalCloseoutRecord,
  GoalPhaseStatus,
  GoalPullRequestRole,
  GoalStatus,
  isGoalStatus,
} from "./Goals.schemas.ts";
import {
  goalManifestPhases,
  isJsonRecord,
  listGoalPackets,
  parseGoalManifestText,
  rewriteReadmeLifecycleToken,
} from "./Inventory.ts";
import { planGoalPacketMigration } from "./Migration.ts";
import { PacketStreamError } from "./PacketCore/PacketCore.errors.ts";
import { isPacketSlug, isPacketStage } from "./PacketCore/PacketCore.schemas.ts";
import { PacketEventStore, PacketStreamLocator } from "./PacketCore/PacketEventStore.ts";
import {
  PacketCoreLive,
  PacketTransitionRequest,
  PacketTransitionWriter,
} from "./PacketCore/PacketTransitionWriter.ts";
import { PORTFOLIO_INDEX_PATH, writePortfolioIndex } from "./PortfolioIndex.ts";
import type { GoalFinalPullRequestResolverShape } from "./FinalPullRequest.ts";
import type { GoalCompletionGate, GoalManifest, GoalPhase, GoalPullRequestRef } from "./Goals.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";
import type { GoalPacketMigration } from "./Migration.ts";
import type { PacketStage } from "./PacketCore/PacketCore.schemas.ts";
import type { PacketTransitionPlan } from "./PacketCore/PacketTransitionWriter.ts";

const STATUS_DOMAIN = A.join(GoalStatus.literals, " | ");

const applyMigrationPlan = Effect.fn("Goals.applyMigrationPlan")(function* (
  record: GoalPacketRecord,
  plan: GoalPacketMigration,
  write: boolean
) {
  for (const edit of plan.edits) {
    yield* Console.log(`[goals:migrate] ${plan.slug}: ${edit}`);
  }
  if (write && plan.manifestText !== undefined) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.dirname(record.manifestPath), { recursive: true });
    yield* fs.writeFileString(record.manifestPath, plan.manifestText);
  }
  if (write && plan.readmeText !== undefined) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(record.readmePath, plan.readmeText);
  }
});

type GoalsMigrationCounts = {
  readonly backfills: number;
  readonly changedManifests: number;
  readonly changedReadmes: number;
  readonly parked: number;
};

const emptyGoalsMigrationCounts: GoalsMigrationCounts = {
  backfills: 0,
  changedManifests: 0,
  changedReadmes: 0,
  parked: 0,
};

const addGoalsMigrationCounts = (left: GoalsMigrationCounts, right: GoalsMigrationCounts): GoalsMigrationCounts => ({
  backfills: left.backfills + right.backfills,
  changedManifests: left.changedManifests + right.changedManifests,
  changedReadmes: left.changedReadmes + right.changedReadmes,
  parked: left.parked + right.parked,
});

const processGoalMigration = Effect.fn("Goals.processGoalMigration")(function* (
  record: GoalPacketRecord,
  write: boolean
) {
  const plan = planGoalPacketMigration(record);
  if (plan.parked !== undefined) {
    yield* Console.error(`[goals:migrate] PARKED ${plan.slug}: ${plan.parked}`);
    return { ...emptyGoalsMigrationCounts, parked: 1 };
  }

  yield* applyMigrationPlan(record, plan, write);
  return {
    backfills: plan.manifestText !== undefined && plan.isBackfill === true ? 1 : 0,
    changedManifests: plan.manifestText !== undefined && plan.isBackfill !== true ? 1 : 0,
    changedReadmes: plan.readmeText === undefined ? 0 : 1,
    parked: 0,
  };
});

const runGoalsMigration = Effect.fn("Goals.runGoalsMigration")(function* (options: { readonly write: boolean }) {
  const records = yield* listGoalPackets();
  let counts = emptyGoalsMigrationCounts;
  for (const record of records) {
    const processGoalMigration1 = yield* processGoalMigration(record, options.write);
    counts = addGoalsMigrationCounts(counts, processGoalMigration1);
  }

  const mode = options.write ? "applied" : "planned (dry-run; rerun with --write to apply)";
  yield* Console.log(
    `[goals:migrate] ${mode}: ${counts.changedManifests} manifest edit(s), ${counts.backfills} backfill(s), ${counts.changedReadmes} README edit(s), ${counts.parked} parked.`
  );
});

const stageTokenOf = (phase: GoalPhase, index: number): PacketStage => {
  const id = phase.id;
  return id !== undefined && isPacketStage(id) ? id : `phase-${index + 1}`;
};

/**
 * Map a goal manifest's phases onto a genesis stage/ordinal pair.
 *
 * **Details**
 *
 * The packet-core fold is stage-vocabulary-agnostic; the goals writers own
 * mapping manifest phases onto a genesis stage/ordinal pair (D3). The chosen
 * position is the last in-progress phase, else the last complete phase, else
 * the first declared phase.
 *
 * **Example** (A manifest without phases has no position)
 *
 * ```ts
 * import { GoalManifest, goalStagePosition } from "@beep/repo-cli/test/Goals"
 * import * as O from "effect/Option"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 * })
 * console.log(O.isNone(goalStagePosition(manifest))) // true
 * ```
 *
 * @param manifest - Decoded goal manifest.
 * @returns The genesis stage/ordinal pair, or `None` without phases.
 * @category utilities
 * @since 0.0.0
 */
export const goalStagePosition = (
  manifest: GoalManifest
): O.Option<{ readonly stage: PacketStage; readonly ordinal: number }> => {
  const phases = goalManifestPhases(manifest);
  let inProgress = O.none<number>();
  let complete = O.none<number>();
  let index = 0;
  for (const phase of phases) {
    if (GoalPhaseStatus.is["in-progress"](phase.status)) {
      inProgress = O.some(index);
    }
    if (GoalPhaseStatus.is.complete(phase.status)) {
      complete = O.some(index);
    }
    index += 1;
  }
  const chosen = pipe(
    inProgress,
    O.orElse(() => complete),
    O.orElse(() => (A.isReadonlyArrayNonEmpty(phases) ? O.some(0) : O.none<number>()))
  );
  return pipe(
    chosen,
    O.flatMap((position) =>
      pipe(
        A.get(phases, position),
        O.map((phase) => ({ stage: stageTokenOf(phase, position), ordinal: position }))
      )
    )
  );
};

const shortTip: (id: string) => string = Str.slice(0, 12);

/**
 * Render one planned packet event as an operator preview line.
 *
 * **Example** (Render a drafted status-set event)
 *
 * ```ts
 * import { PacketEvent, previewEventLine } from "@beep/repo-cli/test/Goals"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 1,
 *   expectedRevision: 0,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "packet-created", status: "active" },
 * })
 * console.log(previewEventLine(event)) // "would append 1 packet-created: genesis status=active"
 * ```
 *
 * @param event - Drafted event from a guarded-writer plan.
 * @returns One human-readable preview line.
 * @category utilities
 * @since 0.0.0
 */
export const previewEventLine = (event: PacketTransitionPlan["events"][number]): string => {
  const body = event.body;
  if (body.type === "status-set") {
    return `would append ${event.seq} status-set: ${body.previous} -> ${body.status}`;
  }
  if (body.type === "packet-created") {
    const stage = body.stage === undefined ? "" : ` stage=${body.stage}@${body.ordinal}`;
    return `would append ${event.seq} packet-created: genesis status=${body.status}${stage}`;
  }
  if (body.type === "risk-tier-overridden") {
    const previous = body.previous === undefined ? "none" : body.previous;
    return `would append ${event.seq} risk-tier-overridden: ${previous} -> ${body.tier} (${body.reason})`;
  }
  return `would append ${event.seq} stage-entered: ${body.stage}@${body.ordinal}`;
};

const printTransitionPreview = Effect.fn("Goals.printTransitionPreview")(function* (
  slug: string,
  status: GoalStatus,
  previous: string,
  plan: O.Option<PacketTransitionPlan>
) {
  yield* Console.log(`[goals:set-status] preview ${slug}: ${previous} -> ${status}`);
  if (O.isNone(plan)) {
    yield* Console.log(
      "[goals:set-status] stream: none (a packet opts in by creating ops/events/); a write edits the manifest, README Lifecycle line, and goals/INDEX.md."
    );
    yield* Console.log("[goals:set-status] preview only — nothing written.");
    return;
  }
  const transition = plan.value;
  const tipText = pipe(
    O.fromUndefinedOr(transition.currentTip),
    O.match({ onNone: () => "empty", onSome: (tip) => `${tip.seq}@${shortTip(tip.id)}` })
  );
  yield* Console.log(`[goals:set-status] stream: revision ${transition.currentRevision}, tip ${tipText}`);
  if (transition.disposition === "skipped") {
    yield* Console.log(
      `[goals:set-status] outcome: skipped; stream already derives status ${status}, so no event or trace write is planned.`
    );
    yield* Console.log("[goals:set-status] preview only — nothing written.");
    return;
  }
  for (const event of transition.events) {
    yield* Console.log(`[goals:set-status] ${previewEventLine(event)}`);
  }
  const derived = O.fromUndefinedOr(transition.derivedAfter);
  if (O.isSome(derived)) {
    yield* Console.log(
      `[goals:set-status] derived after: revision=${derived.value.revision} status=${derived.value.status ?? "—"} furthest=${derived.value.furthestStage ?? "—"} resume=${derived.value.resumeStage ?? "—"}`
    );
  }
  yield* Console.log(`[goals:set-status] trace: ${transition.tracePath} (regenerated on write)`);
  yield* Console.log("[goals:set-status] preview only — nothing written.");
});

/**
 * Load and decode one goal packet's manifest surfaces by slug.
 *
 * **Details**
 *
 * Shared front door for the guarded goals writers: resolves the packet
 * record, requires a parseable manifest, and decodes it as
 * {@link GoalManifest}, failing with the same typed errors every writer
 * reports. README surfaces are not touched here — `set-status` layers its
 * README lifecycle-line handling on top.
 *
 * **Example** (Reference the loader)
 *
 * ```ts
 * import { loadGoalPacketManifest } from "@beep/repo-cli/test/Goals"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(loadGoalPacketManifest("some-goal"))) // true
 * ```
 *
 * @param slug - Goal packet directory name under `goals/`.
 * @returns The packet record, raw manifest text/object, and decoded manifest.
 * @category utilities
 * @since 0.0.0
 */
export const loadGoalPacketManifest = Effect.fn("Goals.loadGoalPacketManifest")(function* (slug: string) {
  const records = yield* listGoalPackets();
  const record = yield* pipe(
    A.findFirst(records, (candidate) => candidate.slug === slug),
    Effect.fromOption(() => GoalPacketNotFoundError.new(slug, `No goal packet directory "goals/${slug}".`))
  );

  const manifestText = record.manifestText;
  if (manifestText === undefined) {
    return yield* GoalPacketNotFoundError.new(
      slug,
      `"${record.manifestPath}" is missing; backfill it (see \`bun run beep goals set-status --migrate\`) before running a goals writer.`
    );
  }
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed)) {
    return yield* GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not parse as JSON.`);
  }
  const decoded = yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((issue) =>
      GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not decode as GoalManifest: ${issue.message}`)
    )
  );
  const manifest: Readonly<Record<string, unknown>> = isJsonRecord(parsed.value) ? parsed.value : {};
  return { record, manifestText, manifest, decoded };
});

const loadPacketSurfaces = Effect.fn("Goals.loadPacketSurfaces")(function* (slug: string, status: GoalStatus) {
  const { decoded, manifest, manifestText, record } = yield* loadGoalPacketManifest(slug);

  const readmeText = record.readmeText;
  if (readmeText === undefined) {
    return yield* GoalReadmeStatusLineError.new(
      slug,
      `"${record.readmePath}" is missing; every packet needs a README status line.`
    );
  }
  const rewrittenReadme = rewriteReadmeLifecycleToken(readmeText, status);
  if (O.isNone(rewrittenReadme)) {
    return yield* GoalReadmeStatusLineError.new(
      slug,
      `"${record.readmePath}" has no recognizable "Lifecycle:" status line; add one under "## Status" (see goals/_template/README.md) and rerun.`
    );
  }

  return { record, manifestText, manifest, decoded, rewrittenReadme: rewrittenReadme.value };
});

const planStreamTransition = Effect.fn("Goals.planStreamTransition")(function* (
  slug: string,
  status: GoalStatus,
  decoded: GoalManifest,
  record: GoalPacketRecord,
  at: string
) {
  const store = yield* PacketEventStore;
  const writer = yield* PacketTransitionWriter;
  const streamPresent = yield* store.hasStream(record.packetPath);
  if (!streamPresent) {
    return O.none<PacketTransitionPlan>();
  }
  if (!isPacketSlug(slug)) {
    return yield* PacketStreamError.new(
      slug,
      `directory name "${slug}" is not a valid packet slug for an event stream.`
    );
  }
  const position = goalStagePosition(decoded);
  const request = PacketTransitionRequest.make({
    locator: PacketStreamLocator.make({ packet: slug, root: "goals", packetPath: record.packetPath }),
    status,
    previousStatus: decoded.initiative.status,
    ...optionalProp(
      "genesisStage",
      O.map(position, (value) => value.stage)
    ),
    ...optionalProp(
      "genesisOrdinal",
      O.map(position, (value) => value.ordinal)
    ),
    actor: "operator",
    at,
  });
  const plan1 = yield* writer.plan(request);
  return O.some(plan1);
});

type ManifestEdit = { readonly path: ReadonlyArray<string>; readonly value: unknown };

type CloseoutTransition = { readonly edits: ReadonlyArray<ManifestEdit>; readonly note: string };

// What the operator asked the bind writer for: `--final-pr <n>` and `--adopt-merged`.
type CloseoutRequest = { readonly finalPullRequest: O.Option<number>; readonly adoptMerged: boolean };

type BoundFinal = { readonly number: number; readonly source: string };

type PullRequestRefJson = { readonly number: number; readonly role: GoalPullRequestRole };

const PUBLISH_FIRST = "publish first (`bun run beep yeet open` or `bun run beep yeet publish`), then rerun";

const DELETE_PROPOSAL: ManifestEdit = { path: ["proposedCloseout"], value: undefined };

// A stale proposedCloseout beside a committed closeout, or on a grandfathered
// gate, binds nothing; the write deletes it so doctor's raw-key guard clears.
const deletingStaleProposal = (
  manifest: Readonly<Record<string, unknown>>,
  transition: O.Option<CloseoutTransition>
): O.Option<CloseoutTransition> =>
  R.has(manifest, "proposedCloseout")
    ? O.some(
        O.match(transition, {
          onNone: (): CloseoutTransition => ({ edits: [DELETE_PROPOSAL], note: "deletes the stale proposedCloseout." }),
          onSome: (value): CloseoutTransition => ({
            edits: A.append(value.edits, DELETE_PROPOSAL),
            note: `${value.note} Also deletes the stale proposedCloseout.`,
          }),
        })
      )
    : transition;

// A legacy proposal has the committed record's shape. It is read from the raw
// JSON, so the bind still finds it once the schema stops modelling the key.
const decodeLegacyProposal = S.decodeUnknownOption(GoalCloseoutRecord);

const legacyProposal = Effect.fn("Goals.legacyProposal")(function* (
  slug: string,
  manifest: Readonly<Record<string, unknown>>
) {
  const raw = R.get(manifest, "proposedCloseout");
  if (O.isNone(raw)) return O.none<GoalCloseoutRecord>();
  const proposal = decodeLegacyProposal(raw.value);
  if (O.isNone(proposal)) {
    return yield* GoalManifestInvalidError.new(
      slug,
      'proposedCloseout is not { "status": "completed-retained", "finalPullRequest": <n> }; fix or delete it and rerun.'
    );
  }
  return proposal;
});

// `number` takes `role` at its first position (appended when absent), later
// duplicates of it go, and any other final is demoted to supporting.
const placePullRequestRef = (
  refs: ReadonlyArray<GoalPullRequestRef>,
  number: number,
  role: GoalPullRequestRole
): ReadonlyArray<PullRequestRefJson> => {
  const placed = A.map(
    refs,
    (ref): PullRequestRefJson =>
      ref.number === number
        ? { number, role }
        : { number: ref.number, role: GoalPullRequestRole.is.final(ref.role) ? "supporting" : ref.role }
  );
  return O.match(
    A.findFirstIndex(placed, (ref) => ref.number === number),
    {
      onNone: () => A.append(placed, { number, role }),
      onSome: (first) => A.filter(placed, (ref, index) => ref.number !== number || index === first),
    }
  );
};

const otherDeclaredFinals = (gate: GoalCompletionGate, number: number): ReadonlyArray<GoalPullRequestRef> =>
  A.filter(gate.pullRequests ?? [], (ref) => GoalPullRequestRole.is.final(ref.role) && ref.number !== number);

// An open PR never displaces a declared final that already merged: that merged
// PR is the goal's real final, and binding it is an explicit --adopt-merged.
const refuseMergedDeclaredFinal = Effect.fn("Goals.refuseMergedDeclaredFinal")(function* (
  resolver: GoalFinalPullRequestResolverShape,
  root: string,
  gate: GoalCompletionGate,
  number: number
) {
  for (const declared of otherDeclaredFinals(gate, number)) {
    const candidate = yield* resolver.byNumber(root, declared.number);
    if (O.isNone(candidate)) {
      return yield* GoalStatusInputError.new(
        `completionGate.pullRequests names #${declared.number} as the final and its state cannot be read; rerun once the GitHub REST read \`GET /repos/{owner}/{repo}/pulls/${declared.number}\` (repository from \`GH_REPO\` or \`origin\`) works.`
      );
    }
    if (GoalFinalPullRequestState.is.MERGED(candidate.value.state)) {
      return yield* GoalStatusInputError.new(
        `completionGate.pullRequests names #${declared.number} as the final and it already merged; bind it with \`--final-pr ${declared.number} --adopt-merged\` instead of #${number}.`
      );
    }
  }
});

const requestedFinal = Effect.fn("Goals.requestedFinal")(function* (
  resolver: GoalFinalPullRequestResolverShape,
  root: string,
  gate: GoalCompletionGate,
  number: number,
  adoptMerged: boolean
) {
  const candidate = yield* resolver.byNumber(root, number);
  if (O.isNone(candidate)) {
    return yield* GoalStatusInputError.new(
      `the GitHub REST read \`GET /repos/{owner}/{repo}/pulls/${number}\` (repository from \`GH_REPO\` or \`origin\`) found no pull request #${number}; check the number and rerun.`
    );
  }
  return yield* GoalFinalPullRequestState.match(candidate.value.state, {
    OPEN: () =>
      refuseMergedDeclaredFinal(resolver, root, gate, number).pipe(
        Effect.as<BoundFinal>({ number, source: `--final-pr ${number}, open` })
      ),
    MERGED: () =>
      adoptMerged
        ? Effect.succeed<BoundFinal>({ number, source: `--final-pr ${number} --adopt-merged, merged` })
        : Effect.fail(
            GoalStatusInputError.new(
              `#${number} already merged; bind a merged PR only with \`--final-pr ${number} --adopt-merged\`.`
            )
          ),
    CLOSED: () =>
      Effect.fail(
        GoalStatusInputError.new(`#${number} was closed without merging and cannot be the final; ${PUBLISH_FIRST}.`)
      ),
  });
});

const branchFinal = Effect.fn("Goals.branchFinal")(function* (
  resolver: GoalFinalPullRequestResolverShape,
  root: string,
  gate: GoalCompletionGate
) {
  const candidate = yield* resolver.forBranch(root);
  if (O.isNone(candidate)) {
    return yield* GoalStatusInputError.new(
      `No pull request was found for the checked-out branch (or \`gh pr view\` failed), so there is no final to bind; ${PUBLISH_FIRST}.`
    );
  }
  const number = candidate.value.number;
  return yield* GoalFinalPullRequestState.match(candidate.value.state, {
    OPEN: () =>
      refuseMergedDeclaredFinal(resolver, root, gate, number).pipe(
        Effect.as<BoundFinal>({ number, source: `the open PR of branch ${candidate.value.headRefName}` })
      ),
    MERGED: () =>
      Effect.fail(
        GoalStatusInputError.new(
          `The branch's PR #${number} already merged; bind it with \`--final-pr ${number} --adopt-merged\`.`
        )
      ),
    CLOSED: () =>
      Effect.fail(GoalStatusInputError.new(`The branch's PR #${number} was closed without merging; ${PUBLISH_FIRST}.`)),
  });
});

// The final, in order: the legacy proposal's own, then --final-pr, then the
// checked-out branch's open PR. Only the last two read GitHub.
const resolveBoundFinal = Effect.fn("Goals.resolveBoundFinal")(function* (
  gate: GoalCompletionGate,
  proposal: O.Option<GoalCloseoutRecord>,
  request: CloseoutRequest
) {
  if (O.isSome(proposal)) {
    const own = proposal.value.finalPullRequest;
    const conflicting = O.filter(request.finalPullRequest, (number) => number !== own);
    if (O.isSome(conflicting)) {
      return yield* GoalStatusInputError.new(
        `proposedCloseout names #${own} as its final, so --final-pr ${conflicting.value} conflicts; drop --final-pr, or delete the proposal first.`
      );
    }
    return { number: own, source: "the legacy proposedCloseout" };
  }
  const resolver = yield* goalFinalPullRequestResolver();
  const root = yield* findRepoRoot().pipe(Effect.orElseSucceed(process.cwd));
  if (O.isSome(request.finalPullRequest)) {
    return yield* requestedFinal(resolver, root, gate, request.finalPullRequest.value, request.adoptMerged);
  }
  return yield* branchFinal(resolver, root, gate);
});

// `completed-retained` binds the final in the status write itself, so the
// writer can no longer produce a completed packet with no closeout record.
// A grandfathered gate carries no record and flips status only.
const bindCloseout = Effect.fn("Goals.bindCloseout")(function* (
  slug: string,
  decoded: GoalManifest,
  manifest: Readonly<Record<string, unknown>>,
  request: CloseoutRequest
) {
  const gate = decoded.completionGate;
  const proposal = yield* legacyProposal(slug, manifest);
  if (gate.grandfathered) {
    if (O.isSome(request.finalPullRequest)) {
      return yield* GoalStatusInputError.new(
        `goals/${slug} is grandfathered and carries no closeout record; drop --final-pr.`
      );
    }
    return deletingStaleProposal(manifest, O.none());
  }
  const final = yield* resolveBoundFinal(gate, proposal, request);
  const effects = A.flatten<ReadonlyArray<ReadonlyArray<string>>>([
    [`sets closeout and marks #${final.number} final in completionGate.pullRequests`],
    A.map(otherDeclaredFinals(gate, final.number), (ref) => `demotes #${ref.number} to supporting`),
    O.isSome(proposal) ? ["deletes proposedCloseout"] : A.empty<string>(),
  ]);
  return O.some<CloseoutTransition>({
    edits: A.flatten<ReadonlyArray<ReadonlyArray<ManifestEdit>>>([
      O.isSome(proposal) ? [{ path: ["proposedCloseout"], value: undefined }] : A.empty<ManifestEdit>(),
      [
        {
          path: ["completionGate", "pullRequests"],
          value: placePullRequestRef(gate.pullRequests ?? [], final.number, "final"),
        },
        { path: ["closeout"], value: { status: "completed-retained", finalPullRequest: final.number } },
      ],
    ]),
    note: `binds #${final.number} as the final PR (${final.source}): ${A.join(effects, ", ")}.`,
  });
});

// Reopening a committed closeout (active or paused) deletes the record and
// keeps its final as a supporting PR; any other status would contradict it.
const reopenCommittedCloseout = Effect.fn("Goals.reopenCommittedCloseout")(function* (
  slug: string,
  status: GoalStatus,
  gate: GoalCompletionGate,
  record: GoalCloseoutRecord,
  request: CloseoutRequest
) {
  if (status === record.status) {
    const rebind = O.filter(request.finalPullRequest, (number) => number !== record.finalPullRequest);
    if (O.isSome(rebind)) {
      return yield* GoalStatusInputError.new(
        `A committed closeout already binds #${record.finalPullRequest}; reopen with \`bun run beep goals set-status ${slug} active\` before binding #${rebind.value}.`
      );
    }
    return O.none<CloseoutTransition>();
  }
  if (status !== "active" && status !== "paused") {
    return yield* GoalStatusInputError.new(
      `A committed closeout via #${record.finalPullRequest} keeps ${record.status} or reopens as active/paused; ${status} is neither.`
    );
  }
  return O.some<CloseoutTransition>({
    edits: [
      { path: ["closeout"], value: undefined },
      {
        path: ["completionGate", "pullRequests"],
        value: placePullRequestRef(gate.pullRequests ?? [], record.finalPullRequest, "supporting"),
      },
    ],
    note: `reopens from #${record.finalPullRequest}: deletes the closeout record and demotes #${record.finalPullRequest} to supporting.`,
  });
});

const closeoutTransition = Effect.fn("Goals.closeoutTransition")(function* (
  slug: string,
  status: GoalStatus,
  decoded: GoalManifest,
  manifest: Readonly<Record<string, unknown>>,
  request: CloseoutRequest
) {
  if (decoded.closeout !== undefined) {
    const record = decoded.closeout;
    const proposal = yield* legacyProposal(slug, manifest);
    const disagreeing = O.filter(
      proposal,
      (value) => status === record.status && value.finalPullRequest !== record.finalPullRequest
    );
    if (O.isSome(disagreeing)) {
      return yield* GoalStatusInputError.new(
        `The committed closeout binds #${record.finalPullRequest} but a stale proposedCloseout names #${disagreeing.value.finalPullRequest}; delete proposedCloseout to keep #${record.finalPullRequest}, or reopen with \`bun run beep goals set-status ${slug} active\` and bind #${disagreeing.value.finalPullRequest}.`
      );
    }
    const transition = yield* reopenCommittedCloseout(slug, status, decoded.completionGate, record, request);
    return deletingStaleProposal(manifest, transition);
  }
  if (status === "completed-retained") return yield* bindCloseout(slug, decoded, manifest, request);
  if (status === "active" || status === "paused" || !R.has(manifest, "proposedCloseout")) {
    return O.none<CloseoutTransition>();
  }
  return yield* GoalStatusInputError.new(
    `A legacy proposedCloseout keeps active/paused until \`set-status ${slug} completed-retained\` binds its final; ${status} is neither.`
  );
});

// One JSONC edit per field keeps comments and key order; a closeout transition
// lands in the same write, and the result must still decode before anything is written.
const rewriteManifestStatus = Effect.fn("Goals.rewriteManifestStatus")(function* (
  slug: string,
  surfaces: { readonly manifestText: string; readonly manifest: Readonly<Record<string, unknown>> },
  status: GoalStatus,
  today: string,
  transition: O.Option<CloseoutTransition>
) {
  const edits: ReadonlyArray<ManifestEdit> = A.flatten<ReadonlyArray<ReadonlyArray<ManifestEdit>>>([
    [{ path: ["initiative", "status"], value: status }],
    R.has(surfaces.manifest, "lifecycle") ? [{ path: ["lifecycle"], value: status }] : A.empty<ManifestEdit>(),
    [{ path: ["initiative", "updated"], value: today }],
    O.match(transition, { onNone: A.empty<ManifestEdit>, onSome: (value) => value.edits }),
  ]);
  const text = A.reduce(edits, surfaces.manifestText, (content, edit) =>
    applyJsoncModification(JsoncModification.make({ content, path: [...edit.path], value: edit.value }))
  );
  yield* pipe(
    parseGoalManifestText(text),
    Effect.fromOption(() => GoalManifestInvalidError.new(slug, "the rewritten manifest does not parse as JSON.")),
    Effect.flatMap((value) => decodeGoalManifest(value)),
    Effect.mapError((issue) =>
      GoalManifestInvalidError.new(slug, `the rewritten manifest would not decode as GoalManifest: ${issue.message}`)
    )
  );
  return text;
});

const reportSetStatusFailure = Effect.fn(function* (error: { readonly message: string }) {
  yield* Console.error(`[goals:set-status] ${error.message}`);
  return yield* failWithReportedExit(`goals set-status: ${error.message}`);
});

const setStatusForSlug = Effect.fn("Goals.setStatusForSlug")(function* (
  slug: string,
  status: GoalStatus,
  preview: boolean,
  request: CloseoutRequest
) {
  const fs = yield* FileSystem.FileSystem;
  const writer = yield* PacketTransitionWriter;
  const { decoded, manifest, manifestText, record, rewrittenReadme } = yield* loadPacketSurfaces(slug, status);
  const transition = yield* closeoutTransition(slug, status, decoded, manifest, request);
  const now = yield* DateTime.now;
  const today = pipe(DateTime.formatIso(now), Str.slice(0, 10));
  const nextManifest = yield* rewriteManifestStatus(slug, { manifestText, manifest }, status, today, transition);
  const plan = yield* planStreamTransition(slug, status, decoded, record, DateTime.formatIso(now));

  if (preview) {
    if (O.isSome(transition)) {
      yield* Console.log(`[goals:set-status] closeout: ${transition.value.note}`);
    }
    return yield* printTransitionPreview(slug, status, decoded.initiative.status, plan);
  }

  if (O.isSome(plan)) {
    const outcome = yield* writer.commit(plan.value);
    if (outcome.disposition === "skipped") {
      yield* Console.log(`[goals:set-status] ${slug}: skipped; stream already derives status ${status}.`);
    } else {
      yield* Console.log(
        `[goals:set-status] ${slug}: appended ${outcome.appended} event(s); regenerated ${outcome.tracePath}.`
      );
    }
  }

  yield* fs.writeFileString(record.manifestPath, nextManifest);
  yield* fs.writeFileString(record.readmePath, rewrittenReadme);
  yield* writePortfolioIndex();
  if (O.isSome(transition)) {
    yield* Console.log(`[goals:set-status] ${slug} closeout: ${transition.value.note}`);
  }
  yield* Console.log(
    `[goals:set-status] ${slug} -> ${status} (manifest, README Lifecycle line, ${PORTFOLIO_INDEX_PATH}).`
  );
});

const slugArgument = Argument.String("slug").pipe(
  Argument.withDescription("Goal packet slug under goals/"),
  Argument.optional
);
const statusArgument = Argument.String("status").pipe(
  Argument.withDescription(`Canonical status: ${STATUS_DOMAIN}`),
  Argument.optional
);
const migrateFlag = Flag.Boolean("migrate").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run the mechanical census-locked status migration over every packet")
);
const migrateWriteFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Apply --migrate edits (default is a dry-run report)")
);
const previewFlag = Flag.Boolean("preview").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the guarded transition plan (fold, events to append, derived state) without writing")
);
const finalPrFlag = Flag.String("final-pr").pipe(
  Flag.withDescription(
    "completed-retained only: bind this PR number as the goal's final (default: a legacy proposal's final, else the checked-out branch's open PR)"
  ),
  Flag.optional
);
const adoptMergedFlag = Flag.Boolean("adopt-merged").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Let --final-pr bind a PR that already merged")
);

type SetStatusInput = {
  readonly migrate: boolean;
  readonly preview: boolean;
  readonly write: boolean;
  readonly slug: O.Option<string>;
  readonly status: O.Option<string>;
  readonly finalPr: O.Option<string>;
  readonly adoptMerged: boolean;
};

const POSITIVE_INTEGER = /^[1-9]\d*$/;

// Flag-shape errors refuse before any packet read or process spawn.
const parseCloseoutRequest = Effect.fn("Goals.parseCloseoutRequest")(function* (input: SetStatusInput) {
  if (input.adoptMerged && O.isNone(input.finalPr)) {
    return yield* GoalStatusInputError.new("--adopt-merged binds the merged PR that --final-pr <n> names; pass both.");
  }
  const finalPullRequest = yield* O.match(input.finalPr, {
    onNone: () => Effect.succeedNone,
    onSome: (raw) =>
      POSITIVE_INTEGER.test(raw)
        ? Effect.succeedSome(Number(raw))
        : Effect.fail(GoalStatusInputError.new(`--final-pr "${raw}" is not a positive integer.`)),
  });
  return { finalPullRequest, adoptMerged: input.adoptMerged } satisfies CloseoutRequest;
});

const runMigrateMode = Effect.fn("Goals.runMigrateMode")(function* (input: SetStatusInput) {
  if (O.isSome(input.slug) || O.isSome(input.status)) {
    return yield* GoalStatusInputError.new("--migrate takes no slug/status arguments; it migrates every packet.");
  }
  if (O.isSome(input.finalPr) || input.adoptMerged) {
    return yield* GoalStatusInputError.new(
      "--migrate binds no final; --final-pr and --adopt-merged apply to one packet's completed-retained transition."
    );
  }
  if (input.preview) {
    return yield* GoalStatusInputError.new(
      "--migrate has its own dry-run default; --preview applies to per-slug transitions."
    );
  }
  return yield* runGoalsMigration({ write: input.write });
});

const runSetStatusProgram = Effect.fn("Goals.runSetStatusProgram")(function* (input: SetStatusInput) {
  if (input.migrate) {
    return yield* runMigrateMode(input);
  }
  const request = yield* parseCloseoutRequest(input);
  if (O.isNone(input.slug) || O.isNone(input.status)) {
    return yield* GoalStatusInputError.new(
      `Usage: beep goals set-status <slug> <status> with status one of ${STATUS_DOMAIN}.`
    );
  }
  if (!isGoalStatus(input.status.value)) {
    return yield* GoalStatusInputError.new(`Unknown status "${input.status.value}"; expected one of ${STATUS_DOMAIN}.`);
  }
  if (O.isSome(request.finalPullRequest) && input.status.value !== "completed-retained") {
    return yield* GoalStatusInputError.new(
      `--final-pr binds the final of a completed-retained closeout; ${input.status.value} takes no final.`
    );
  }
  return yield* setStatusForSlug(input.slug.value, input.status.value, input.preview, request);
});

/**
 * `bun run beep goals set-status` — single writer for goal-packet status.
 *
 * **Example** (Import and log command name)
 *
 * ```ts
 * import { goalsSetStatusCommand } from "@beep/repo-cli/commands/Goals/SetStatus"
 *
 * console.log(goalsSetStatusCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsSetStatusCommand = Command.make(
  "set-status",
  {
    slug: slugArgument,
    status: statusArgument,
    migrate: migrateFlag,
    write: migrateWriteFlag,
    preview: previewFlag,
    finalPr: finalPrFlag,
    adoptMerged: adoptMergedFlag,
  },
  Effect.fn(function* ({ adoptMerged, finalPr, migrate, preview, slug, status, write }) {
    return yield* runSetStatusProgram({ adoptMerged, finalPr, migrate, preview, slug, status, write }).pipe(
      Effect.catchTags({
        GoalStatusInputError: reportSetStatusFailure,
        GoalPacketNotFoundError: reportSetStatusFailure,
        GoalManifestInvalidError: reportSetStatusFailure,
        GoalReadmeStatusLineError: reportSetStatusFailure,
        PacketStreamError: reportSetStatusFailure,
        PacketCasConflictError: reportSetStatusFailure,
      })
    );
  })
).pipe(
  Command.withDescription(
    "Set a packet's canonical status (manifest + README + INDEX), binding the final PR on completed-retained, or run --migrate"
  ),
  Command.provide(PacketCoreLive)
);
