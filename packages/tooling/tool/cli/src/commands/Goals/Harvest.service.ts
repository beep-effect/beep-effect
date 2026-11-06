/**
 * `HarvestProjector` — collect the harvest provenance ledger from the working
 * tree and write or read it as JSON Lines.
 *
 * **Details**
 *
 * Sources, each row citing its repo-relative file, 1-based line and the HEAD
 * commit it was read at:
 *
 * - `reflection-finding` / `reflection-todo`: `goals/<slug>/history/reflections/*.md`
 *   frontmatter `findings[].instruction` (with category and confidence) and `todos[]`;
 * - `friction-receipt`: every tracked `OPPORTUNITIES.md`, one row per `## `
 *   section (heading plus its `**Prevention:**` line);
 * - `plan-unchecked`: `- [ ]` items in `goals/<slug>/PLAN.md` and `SPEC.md`;
 * - `status-note` / `stop-condition`: goal manifest `statusNote` and `stopConditions[]`;
 * - `decision-file`: `goals/<slug>/decisions/*.md` titles;
 * - `open-question`: exploration manifest `exploration.openQuestions[]`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitOutput, runGitPathList } from "../../internal/repo-run/index.ts";
import { ExplorationStatus } from "../Explore/Atlas.ts";
import { decodeReflectionFrontmatterText, reflectionFileNameIsArtifact } from "../Lint/ReflectionArtifact.ts";
import { parseGoalDecision } from "./Decisions.projection.ts";
import { GOAL_DECISIONS_DIR } from "./Decisions.schemas.ts";
import { HarvestError } from "./Goals.errors.ts";
import { GoalStatus } from "./Goals.schemas.ts";
import {
  HarvestLedger,
  HarvestLedgerHeader,
  HarvestPacketRef,
  HarvestRow,
  HarvestRowDraft,
  HarvestRowId,
} from "./Harvest.schemas.ts";
import { GOALS_DIR, listGoalPackets, parseGoalManifestText, TEMPLATE_SLUG } from "./Inventory.ts";
import { PacketRoot, PacketSlug, PacketStatusToken } from "./PacketCore/PacketCore.schemas.ts";
import { canonicalJsonText, sha256Hex } from "./PacketCore/PacketDigest.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { HarvestSource } from "./Harvest.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Harvest.service");

const EXPLORATIONS_DIR = "explorations";
const LINE_BREAK = /\r\n?|\n/;
const UNCHECKED_ITEM = /^\s*[-*] \[ \] (.+)$/;
const SECTION_HEADING = /^## /;
const PREVENTION_LINE = /^(?:[-*]\s+)?\*\*Prevention\b/;
const INSTRUCTION_KEY = /^\s*(?:-\s+)?instruction:/;
const TODOS_KEY = /^todos:/;
const TOP_LEVEL_LINE = /^\S/;
const LIST_ITEM = /^(\s*)- /;
const DECISION_TITLE_KEY = /^title:/;

const isPacketSlug = S.is(PacketSlug);
const isPacketRoot = S.is(PacketRoot);
const decodeRowId = S.decodeUnknownEffect(HarvestRowId);
const encodeRow = S.encodeUnknownEffect(HarvestRow);
const encodeHeader = S.encodeUnknownEffect(HarvestLedgerHeader);
const decodeHeaderJson = S.decodeUnknownEffect(S.fromJsonString(HarvestLedgerHeader));
const decodeRowJson = S.decodeUnknownEffect(S.fromJsonString(HarvestRow));

const GoalHarvestView = S.Struct({
  initiative: S.optionalKey(S.Struct({ status: S.optionalKey(PacketStatusToken) })),
  statusNote: S.String.pipe(S.NullOr, S.optionalKey),
  stopConditions: S.String.pipe(S.Array, S.NullOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("GoalHarvestView", {
    description: "The goal-manifest fields the harvester reads: initiative status, statusNote, stopConditions.",
  })
);

const ExplorationHarvestView = S.Struct({
  exploration: S.Struct({
    status: S.optionalKey(PacketStatusToken),
    openQuestions: S.String.pipe(S.Array, S.NullOr, S.optionalKey),
  }),
}).pipe(
  $I.annoteSchema("ExplorationHarvestView", {
    description: "The exploration-manifest fields the harvester reads: status and openQuestions.",
  })
);

const decodeGoalView = S.decodeUnknownOption(GoalHarvestView);
const decodeExplorationView = S.decodeUnknownOption(ExplorationHarvestView);

const TERMINAL_GOAL_STATUSES: ReadonlyArray<string> = [
  GoalStatus.Enum["completed-retained"],
  GoalStatus.Enum.superseded,
];
const TERMINAL_EXPLORATION_STATUSES: ReadonlyArray<string> = [
  ExplorationStatus.Enum.graduated,
  ExplorationStatus.Enum.killed,
];

/**
 * Whether a packet status is terminal for its root: goals in
 * `completed-retained` or `superseded`, explorations in `graduated` or `killed`.
 *
 * **Example** (Classify statuses)
 *
 * ```ts
 * import { isTerminalPacketStatus } from "@beep/repo-cli/commands/Goals/Harvest.service"
 *
 * console.log(isTerminalPacketStatus("goals", "superseded")) // true
 * console.log(isTerminalPacketStatus("explorations", "active")) // false
 * ```
 *
 * @param root - Packet root the status belongs to.
 * @param status - Lifecycle status token.
 * @returns Whether the packet is terminal.
 * @category guards
 * @since 0.0.0
 */
export const isTerminalPacketStatus: {
  (root: PacketRoot, status: string): boolean;
  (status: string): (root: PacketRoot) => boolean;
} = dual(2, (root: PacketRoot, status: string): boolean =>
  A.contains(
    PacketRoot.match(root, {
      goals: () => TERMINAL_GOAL_STATUSES,
      explorations: () => TERMINAL_EXPLORATION_STATUSES,
    }),
    status
  )
);

type PacketContext = {
  readonly packet: HarvestPacketRef | null;
  readonly status: string | null;
  readonly terminal: boolean;
  readonly commit: string;
};

const packetContext = (root: PacketRoot, slug: string, status: O.Option<string>, commit: string): PacketContext => ({
  packet: HarvestPacketRef.make({ root, slug }),
  status: O.getOrNull(status),
  terminal: O.exists(status, (value) => isTerminalPacketStatus(root, value)),
  commit,
});

/**
 * Compute a harvest row id: sha-256 of the canonical JSON of the row's
 * packet root, slug, source, file, line and text.
 *
 * **Example** (Build the id effect)
 *
 * ```ts
 * import { harvestRowId } from "@beep/repo-cli/commands/Goals/Harvest.service"
 * import * as Effect from "effect/Effect"
 *
 * const id = harvestRowId({ root: "goals", slug: "demo", source: "plan-unchecked", file: "goals/demo/PLAN.md", line: 3, text: "Ship it" })
 * console.log(Effect.isEffect(id)) // true
 * ```
 *
 * @param input - Identity fields; `root` and `slug` are `null` outside any packet.
 * @returns Effect yielding the 64-character lowercase hex row id.
 * @category encoding
 * @since 0.0.0
 */
export const harvestRowId = Effect.fn("Harvest.harvestRowId")(function* (input: {
  readonly root: PacketRoot | null;
  readonly slug: string | null;
  readonly source: HarvestSource;
  readonly file: string;
  readonly line: number;
  readonly text: string;
}) {
  const hex = yield* sha256Hex(canonicalJsonText(input));
  return yield* decodeRowId(hex).pipe(Effect.orDie);
});

const makeRow = Effect.fnUntraced(function* (context: PacketContext, draft: HarvestRowDraft) {
  const id = yield* harvestRowId({
    root: context.packet === null ? null : context.packet.root,
    slug: context.packet === null ? null : context.packet.slug,
    source: draft.source,
    file: draft.file,
    line: draft.line,
    text: draft.text,
  });
  return HarvestRow.make({
    id,
    packet: context.packet,
    status: context.status,
    terminal: context.terminal,
    source: draft.source,
    file: draft.file,
    line: draft.line,
    commit: context.commit,
    text: draft.text,
    ...(draft.category === undefined ? {} : { category: draft.category }),
    ...(draft.confidence === undefined ? {} : { confidence: draft.confidence }),
  });
});

const splitLines = (text: string): ReadonlyArray<string> => Str.split(text, LINE_BREAK);

// Lines `[start, end)`.
const sliceLines = (lines: ReadonlyArray<string>, start: number, end: number): ReadonlyArray<string> =>
  A.take(A.drop(lines, start), end - start);

// Index of the first line at or after `from` that satisfies the predicate.
const indexFrom = (
  lines: ReadonlyArray<string>,
  from: number,
  predicate: (line: string) => boolean
): O.Option<number> => O.map(A.findFirstIndex(A.drop(lines, from), predicate), (offset) => offset + from);

// Resolves each needle to a 1-based line, scanning forward so repeated values land on distinct lines;
// an unlocatable needle falls back to `fallback` and leaves the cursor in place.
const sequentialLines = (
  lines: ReadonlyArray<string>,
  start: number,
  fallback: number,
  matchers: ReadonlyArray<(line: string) => boolean>
): ReadonlyArray<number> => {
  let cursor = start;
  return A.map(matchers, (matches) =>
    O.match(indexFrom(lines, cursor, matches), {
      onNone: () => fallback,
      onSome: (index) => {
        cursor = index + 1;
        return index + 1;
      },
    })
  );
};

const jsonKeyIndex = (lines: ReadonlyArray<string>, key: string): O.Option<number> =>
  indexFrom(lines, 0, Str.includes(`${canonicalJsonText(key)}:`));

const jsonValueLines = (manifestText: string, key: string, values: ReadonlyArray<string>): ReadonlyArray<number> => {
  const lines = splitLines(manifestText);
  const keyIndex = O.getOrElse(jsonKeyIndex(lines, key), () => 0);
  return sequentialLines(
    lines,
    keyIndex,
    keyIndex + 1,
    A.map(values, (value) => Str.includes(canonicalJsonText(value)))
  );
};

const gitAdapter = (repoRoot: string): GitCommandErrorAdapter<HarvestError> => ({
  onSpawnFailure: (commandLine) => (cause) =>
    HarvestError.new("harvest-git-failed", repoRoot, `spawn ${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    HarvestError.new("harvest-git-failed", repoRoot, `${commandLine} exited with ${exitCode}`),
  onTruncated: O.none(),
});

const readOptionalText = Effect.fnUntraced(function* (absolutePath: string, relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(absolutePath).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeedNone
    ),
    Effect.mapError((error) => HarvestError.new("harvest-read-failed", relativePath, error.message))
  );
});

const readText = Effect.fnUntraced(function* (absolutePath: string, relativePath: string) {
  const text = yield* readOptionalText(absolutePath, relativePath);
  return yield* Effect.fromOption(text).pipe(
    Effect.mapError(() => HarvestError.new("harvest-read-failed", relativePath, "file not found"))
  );
});

const listDirectory = Effect.fnUntraced(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(absolutePath).pipe(Effect.orElseSucceed(A.empty<string>));
  return A.sort(entries, Order.String);
});

const isDirectory = Effect.fnUntraced(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.stat(absolutePath).pipe(Effect.option);
  return O.exists(stat, (value) => value.type === "Directory");
});

/**
 * Extract the unchecked `- [ ]` items of a Markdown document as row drafts.
 *
 * **Example** (Find one unchecked item)
 *
 * ```ts
 * import { uncheckedPlanItems } from "@beep/repo-cli/commands/Goals/Harvest.service"
 *
 * const items = uncheckedPlanItems("goals/demo/PLAN.md", "# Plan\n\n- [x] Done\n- [ ] Ship it\n")
 * console.log(items[0]?.line, items[0]?.text) // 4 "Ship it"
 * ```
 *
 * @param file - Repo-relative path of the document.
 * @param text - Document text.
 * @returns One `plan-unchecked` draft per unchecked item, in document order.
 * @category parsing
 * @since 0.0.0
 */
export const uncheckedPlanItems: {
  (file: string, text: string): ReadonlyArray<HarvestRowDraft>;
  (text: string): (file: string) => ReadonlyArray<HarvestRowDraft>;
} = dual(
  2,
  (file: string, text: string): ReadonlyArray<HarvestRowDraft> =>
    A.filterMap(splitLines(text), (line, index) =>
      pipe(
        Str.match(UNCHECKED_ITEM)(line),
        O.flatMap((match) => O.fromUndefinedOr(match[1])),
        O.map((item) =>
          HarvestRowDraft.make({ source: "plan-unchecked", file, line: index + 1, text: Str.trim(item) })
        ),
        Result.fromOption(() => undefined)
      )
    )
);

/**
 * Extract one friction receipt per `## ` section of an `OPPORTUNITIES.md` ledger.
 *
 * **Details**
 *
 * The row text is the heading line, followed by the section's first
 * `**Prevention…**` line (bulleted or not) when one exists.
 *
 * **Example** (Read one receipt)
 *
 * ```ts
 * import { frictionReceipts } from "@beep/repo-cli/commands/Goals/Harvest.service"
 *
 * const text = "# Ledger\n\n## O1 — Slow\n\n- **Prevention:** cache it\n"
 * const [receipt] = frictionReceipts("goals/demo/research/OPPORTUNITIES.md", text)
 * console.log(receipt?.line, receipt?.text) // 3 "## O1 — Slow\n- **Prevention:** cache it"
 * ```
 *
 * @param file - Repo-relative path of the ledger.
 * @param text - Ledger text.
 * @returns One `friction-receipt` draft per section, in document order.
 * @category parsing
 * @since 0.0.0
 */
export const frictionReceipts: {
  (file: string, text: string): ReadonlyArray<HarvestRowDraft>;
  (text: string): (file: string) => ReadonlyArray<HarvestRowDraft>;
} = dual(2, (file: string, text: string): ReadonlyArray<HarvestRowDraft> => {
  const lines = splitLines(text);
  const headings = A.filterMap(lines, (line, index) =>
    SECTION_HEADING.test(line) ? Result.succeed(index) : Result.fail(undefined)
  );
  return A.map(headings, (start, position) => {
    const end = O.getOrElse(A.get(headings, position + 1), () => A.length(lines));
    const body = A.map(sliceLines(lines, start + 1, end), Str.trim);
    const prevention = A.findFirst(body, (line) => PREVENTION_LINE.test(line));
    const heading = Str.trimEnd(A.getUnsafe(lines, start));
    return HarvestRowDraft.make({
      source: "friction-receipt",
      file,
      line: start + 1,
      text: O.match(prevention, { onNone: () => heading, onSome: (line) => `${heading}\n${line}` }),
    });
  });
});

const reflectionDrafts = Effect.fnUntraced(function* (file: string, raw: string) {
  const frontmatter = yield* decodeReflectionFrontmatterText(raw);
  if (O.isNone(frontmatter)) {
    return yield* HarvestError.new(
      "harvest-parse-failed",
      file,
      "frontmatter does not decode as ReflectionFrontmatter"
    );
  }
  const { findings, todos } = frontmatter.value;
  const lines = splitLines(raw);
  const findingLines = sequentialLines(
    lines,
    0,
    1,
    A.map(findings, () => (line: string) => INSTRUCTION_KEY.test(line))
  );
  const todosIndex = indexFrom(lines, 0, (line) => TODOS_KEY.test(line));
  const todoLines = O.match(todosIndex, {
    onNone: () => A.map(todos, () => 1),
    onSome: (index) => {
      const end = O.getOrElse(
        indexFrom(lines, index + 1, (line) => TOP_LEVEL_LINE.test(line)),
        () => A.length(lines)
      );
      const block = sliceLines(lines, index + 1, end);
      const indent = pipe(
        A.findFirst(block, (line) => LIST_ITEM.test(line)),
        O.flatMap(
          flow(
            Str.match(LIST_ITEM),
            O.flatMap((match) => O.fromUndefinedOr(match[1]))
          )
        ),
        O.getOrElse(() => "")
      );
      return sequentialLines(
        lines,
        index + 1,
        index + 1,
        A.map(todos, () => Str.startsWith(`${indent}- `))
      );
    },
  });
  const findingDrafts = A.map(findings, (finding, position) =>
    HarvestRowDraft.make({
      source: "reflection-finding",
      file,
      line: O.getOrElse(A.get(findingLines, position), () => 1),
      text: finding.instruction,
      category: finding.category,
      confidence: finding.confidence,
    })
  );
  const todoDrafts = A.map(todos, (todo, position) =>
    HarvestRowDraft.make({
      source: "reflection-todo",
      file,
      line: O.getOrElse(A.get(todoLines, position), () => 1),
      text: todo,
    })
  );
  return A.appendAll(findingDrafts, todoDrafts);
});

const decisionDraft = Effect.fnUntraced(function* (file: string, name: string, raw: string) {
  const parsed = yield* parseGoalDecision(name, raw);
  if (Result.isFailure(parsed)) {
    return yield* HarvestError.new("harvest-parse-failed", file, parsed.failure.message);
  }
  const line = O.getOrElse(
    O.map(
      indexFrom(splitLines(raw), 0, (text) => DECISION_TITLE_KEY.test(text)),
      (index) => index + 1
    ),
    () => 1
  );
  return HarvestRowDraft.make({ source: "decision-file", file, line, text: parsed.success.frontmatter.title });
});

const goalPacketRows = Effect.fnUntraced(function* (
  repoRoot: string,
  slug: string,
  manifestText: O.Option<string>,
  commit: string
) {
  const path = yield* Path.Path;
  const relative = `${GOALS_DIR}/${slug}`;
  const absolute = path.join(repoRoot, GOALS_DIR, slug);
  const view = pipe(manifestText, O.flatMap(parseGoalManifestText), O.flatMap(decodeGoalView));
  const status = pipe(
    view,
    O.flatMap((value) => O.fromUndefinedOr(value.initiative)),
    O.flatMap((initiative) => O.fromUndefinedOr(initiative.status))
  );
  const context = packetContext("goals", slug, status, commit);
  const manifestFile = `${relative}/ops/manifest.json`;
  const text = O.getOrElse(manifestText, () => "");

  const statusNote = pipe(
    view,
    O.flatMap((value) => O.fromNullishOr(value.statusNote)),
    O.filter(Str.isNonEmpty)
  );
  const statusNoteDrafts = A.fromOption(
    O.map(statusNote, (note) =>
      HarvestRowDraft.make({
        source: "status-note",
        file: manifestFile,
        line: O.getOrElse(
          O.map(jsonKeyIndex(splitLines(text), "statusNote"), (index) => index + 1),
          () => 1
        ),
        text: note,
      })
    )
  );
  const stopConditions = pipe(
    view,
    O.flatMap((value) => O.fromNullishOr(value.stopConditions)),
    O.getOrElse(A.empty<string>)
  );
  const stopLines = jsonValueLines(text, "stopConditions", stopConditions);
  const stopDrafts = A.map(stopConditions, (condition, position) =>
    HarvestRowDraft.make({
      source: "stop-condition",
      file: manifestFile,
      line: O.getOrElse(A.get(stopLines, position), () => 1),
      text: condition,
    })
  );

  const planDrafts = yield* Effect.forEach(["PLAN.md", "SPEC.md"], (name) =>
    Effect.map(readOptionalText(path.join(absolute, name), `${relative}/${name}`), (content) =>
      O.match(content, {
        onNone: A.empty<HarvestRowDraft>,
        onSome: (value) => uncheckedPlanItems(`${relative}/${name}`, value),
      })
    )
  );

  const decisionEntries = yield* listDirectory(path.join(absolute, GOAL_DECISIONS_DIR));
  const decisionNames = A.filter(decisionEntries, Str.endsWith(".md"));
  const decisionDrafts = yield* Effect.forEach(decisionNames, (name) => {
    const file = `${relative}/${GOAL_DECISIONS_DIR}/${name}`;
    return Effect.flatMap(readText(path.join(absolute, GOAL_DECISIONS_DIR, name), file), (raw) =>
      decisionDraft(file, name, raw)
    );
  });

  const reflectionsDir = path.join(absolute, "history", "reflections");
  const reflectionEntries = yield* listDirectory(reflectionsDir);
  const reflectionNames = A.filter(reflectionEntries, reflectionFileNameIsArtifact);
  const reflectionDraftLists = yield* Effect.forEach(reflectionNames, (name) => {
    const file = `${relative}/history/reflections/${name}`;
    return Effect.flatMap(readText(path.join(reflectionsDir, name), file), (raw) => reflectionDrafts(file, raw));
  });

  const drafts = A.flatten([
    statusNoteDrafts,
    stopDrafts,
    A.flatten(planDrafts),
    decisionDrafts,
    A.flatten(reflectionDraftLists),
  ]);
  return { context, drafts };
});

const explorationPacketRows = Effect.fnUntraced(function* (repoRoot: string, slug: string, commit: string) {
  const path = yield* Path.Path;
  const manifestFile = `${EXPLORATIONS_DIR}/${slug}/ops/manifest.json`;
  const manifestText = yield* readOptionalText(path.join(repoRoot, manifestFile), manifestFile);
  if (O.isNone(manifestText))
    return O.none<{ readonly context: PacketContext; readonly drafts: ReadonlyArray<HarvestRowDraft> }>();
  const view = pipe(manifestText, O.flatMap(parseGoalManifestText), O.flatMap(decodeExplorationView));
  const status = pipe(
    view,
    O.flatMap((value) => O.fromUndefinedOr(value.exploration.status))
  );
  const context = packetContext("explorations", slug, status, commit);
  const questions = pipe(
    view,
    O.flatMap((value) => O.fromNullishOr(value.exploration.openQuestions)),
    O.getOrElse(A.empty<string>)
  );
  const questionLines = jsonValueLines(manifestText.value, "openQuestions", questions);
  const drafts = A.map(questions, (question, position) =>
    HarvestRowDraft.make({
      source: "open-question",
      file: manifestFile,
      line: O.getOrElse(A.get(questionLines, position), () => 1),
      text: question,
    })
  );
  return O.some({ context, drafts });
});

const packetKey = (root: string, slug: string): string => `${root}/${slug}`;

// The packet a tracked ledger path lives in, or `None` outside any packet directory.
const ledgerPacket = (file: string): O.Option<{ readonly root: PacketRoot; readonly slug: string }> => {
  const segments = Str.split(file, "/");
  return pipe(
    O.all({ root: A.get(segments, 0), slug: A.get(segments, 1) }),
    O.filter(({ slug }) => A.length(segments) > 2 && isPacketSlug(slug)),
    O.flatMap(({ root, slug }) => (isPacketRoot(root) ? O.some({ root, slug }) : O.none()))
  );
};

const isTemplateLedger = (file: string): boolean =>
  A.some(Str.split(file, "/"), (segment) => segment === TEMPLATE_SLUG);

const orderRows: Order.Order<HarvestRow> = Order.combineAll([
  Order.mapInput(Order.String, (row: HarvestRow) => row.file),
  Order.mapInput(Order.Number, (row: HarvestRow) => row.line),
  Order.mapInput(Order.String, (row: HarvestRow) => row.source),
  Order.mapInput(Order.String, (row: HarvestRow) => row.id),
]);

const collectLedger = Effect.fn("Harvest.collect")(function* (options: HarvestCollectOptions) {
  const path = yield* Path.Path;
  const repoRoot = options.repoRoot;
  const adapter = gitAdapter(repoRoot);
  const commit = yield* runGitOutput(repoRoot, ["rev-parse", "HEAD"], adapter);
  const wantsGoals = A.contains(options.kinds, "goals");
  const wantsExplorations = A.contains(options.kinds, "explorations");

  const goalRecords = wantsGoals ? yield* listGoalPackets(repoRoot) : A.empty<GoalPacketRecord>();
  const goalPackets = yield* Effect.forEach(
    goalRecords,
    (record) => goalPacketRows(repoRoot, record.slug, O.fromUndefinedOr(record.manifestText), commit),
    { concurrency: 8 }
  );

  const explorationEntries = wantsExplorations
    ? yield* listDirectory(path.join(repoRoot, EXPLORATIONS_DIR))
    : A.empty<string>();
  const explorationSlugs = yield* Effect.filter(
    A.filter(explorationEntries, (entry) => !Str.startsWith("_")(entry) && !Str.startsWith(".")(entry)),
    (slug) => isDirectory(path.join(repoRoot, EXPLORATIONS_DIR, slug))
  );
  const explorationResults = yield* Effect.forEach(
    explorationSlugs,
    (slug) => explorationPacketRows(repoRoot, slug, commit),
    { concurrency: 8 }
  );
  const explorationPackets = A.getSomes(explorationResults);
  const packets = A.appendAll(goalPackets, explorationPackets);
  const contexts = HashMap.fromIterable(
    A.filterMap(packets, ({ context }) =>
      context.packet === null
        ? Result.fail(undefined)
        : Result.succeed([packetKey(context.packet.root, context.packet.slug), context] as const)
    )
  );

  const trackedLedgers = yield* runGitPathList(repoRoot, ["ls-files", "-z", "--", "*OPPORTUNITIES.md"], adapter);
  const ledgerFiles = A.filter(trackedLedgers, (file) => !isTemplateLedger(file));
  const nonPacketContext: PacketContext = { packet: null, status: null, terminal: false, commit };
  const ledgerPackets = A.filterMap(ledgerFiles, (file) =>
    O.match(ledgerPacket(file), {
      // Ledgers outside any packet belong to no kind; only `--kind all` reads them.
      onNone: () =>
        wantsGoals && wantsExplorations ? Result.succeed({ file, context: nonPacketContext }) : Result.fail(undefined),
      onSome: ({ root, slug }) =>
        A.contains(options.kinds, root)
          ? Result.succeed({
              file,
              context: O.getOrElse(HashMap.get(contexts, packetKey(root, slug)), () =>
                packetContext(root, slug, O.none(), commit)
              ),
            })
          : Result.fail(undefined),
    })
  );
  const ledgerDrafts = yield* Effect.forEach(
    ledgerPackets,
    ({ file, context }) =>
      Effect.map(readText(path.join(repoRoot, file), file), (text) => ({
        context,
        drafts: frictionReceipts(file, text),
      })),
    { concurrency: 8 }
  );

  const rows = yield* Effect.forEach(
    A.appendAll(packets, ledgerDrafts),
    ({ context, drafts }) => Effect.forEach(drafts, (draft) => makeRow(context, draft)),
    { concurrency: 8 }
  );
  const sorted = A.sort(A.flatten(rows), orderRows);
  const now = yield* DateTime.now;
  const generatedAt = DateTime.formatIso(now);
  return HarvestLedger.make({
    schemaVersion: "harvest-ledger/v1",
    sourceCommit: commit,
    generatedAt,
    rowCount: A.length(sorted),
    rows: sorted,
  });
});

/**
 * Render a harvest ledger as JSON Lines: the header (ledger metadata without
 * rows) on the first line, then one row per line, each in canonical
 * key-sorted JSON, with a trailing newline.
 *
 * **Example** (Render an empty ledger)
 *
 * ```ts
 * import { HarvestLedger } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 * import { renderHarvestLedger } from "@beep/repo-cli/commands/Goals/Harvest.service"
 * import * as Effect from "effect/Effect"
 *
 * const ledger = HarvestLedger.make({
 *   schemaVersion: "harvest-ledger/v1",
 *   sourceCommit: "b".repeat(40),
 *   generatedAt: "2026-11-06T00:00:00.000Z",
 *   rowCount: 0,
 *   rows: [],
 * })
 * console.log(Effect.isEffect(renderHarvestLedger(ledger))) // true
 * ```
 *
 * @param ledger - Ledger to render.
 * @returns Effect yielding the JSON Lines text.
 * @category encoding
 * @since 0.0.0
 */
export const renderHarvestLedger = Effect.fn("Harvest.renderHarvestLedger")(function* (ledger: HarvestLedger) {
  const header = yield* encodeHeader(
    HarvestLedgerHeader.make({
      schemaVersion: ledger.schemaVersion,
      sourceCommit: ledger.sourceCommit,
      generatedAt: ledger.generatedAt,
      rowCount: ledger.rowCount,
    })
  ).pipe(Effect.orDie);
  const rows = yield* Effect.forEach(ledger.rows, (row) => encodeRow(row).pipe(Effect.orDie));
  return `${A.join(A.map(A.prepend(rows, header), canonicalJsonText), "\n")}\n`;
});

/**
 * Parse JSON Lines ledger text back into a `HarvestLedger`.
 *
 * **Example** (Reject empty text)
 *
 * ```ts
 * import { parseHarvestLedgerText } from "@beep/repo-cli/commands/Goals/Harvest.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(parseHarvestLedgerText("ledger.jsonl", ""))) // true
 * ```
 *
 * @param file - Path reported in parse errors.
 * @param text - Ledger file text.
 * @returns Effect yielding the decoded ledger, or a `harvest-parse-failed` error.
 * @category parsing
 * @since 0.0.0
 */
export const parseHarvestLedgerText = Effect.fn("Harvest.parseHarvestLedgerText")(function* (
  file: string,
  text: string
) {
  const parseFailed = (detail: string) => HarvestError.new("harvest-parse-failed", file, detail);
  const lines = A.filter(splitLines(text), Str.isNonEmpty);
  const [first, ...rest] = lines;
  if (first === undefined) return yield* parseFailed("ledger has no header line");
  const header = yield* decodeHeaderJson(first).pipe(
    Effect.mapError((error) => parseFailed(`header: ${error.message}`))
  );
  const rows = yield* Effect.forEach(rest, (line, index) =>
    decodeRowJson(line).pipe(Effect.mapError((error) => parseFailed(`line ${index + 2}: ${error.message}`)))
  );
  if (header.rowCount !== A.length(rows)) {
    return yield* parseFailed(`header rowCount ${header.rowCount} but ${A.length(rows)} row line(s)`);
  }
  return HarvestLedger.make({ ...header, rows });
});

/**
 * Options for one harvest collection.
 *
 * **Example** (Collect every root)
 *
 * ```ts
 * import type { HarvestCollectOptions } from "@beep/repo-cli/commands/Goals/Harvest.service"
 *
 * const options: HarvestCollectOptions = { kinds: ["goals", "explorations"], repoRoot: "." }
 * console.log(options.kinds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface HarvestCollectOptions {
  readonly kinds: ReadonlyArray<PacketRoot>;
  readonly repoRoot: string;
}

/**
 * Service contract: collect the ledger from a checkout, write it, or read a
 * previously written ledger back.
 *
 * **Example** (Describe a collection)
 *
 * ```ts
 * import type { HarvestProjectorShape } from "@beep/repo-cli/commands/Goals/Harvest.service"
 *
 * const collectAll = (projector: HarvestProjectorShape) =>
 *   projector.collect({ kinds: ["goals", "explorations"], repoRoot: "." })
 * console.log(collectAll.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HarvestProjectorShape {
  readonly collect: (options: HarvestCollectOptions) => Effect.Effect<HarvestLedger, HarvestError>;
  readonly read: (target: string) => Effect.Effect<O.Option<HarvestLedger>, HarvestError>;
  readonly write: (ledger: HarvestLedger, target: string) => Effect.Effect<void, HarvestError>;
}

/**
 * Projects packets and tracked friction ledgers into the harvest provenance ledger.
 *
 * **Example** (Request the projector)
 *
 * ```ts
 * import { HarvestProjector } from "@beep/repo-cli/commands/Goals/Harvest.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* HarvestProjector }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HarvestProjector extends Context.Service<HarvestProjector, HarvestProjectorShape>()(
  $I`HarvestProjector`
) {}

const writeLedger = Effect.fn("Harvest.write")(function* (ledger: HarvestLedger, target: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* renderHarvestLedger(ledger);
  const writeFailed = (error: { readonly message: string }) =>
    HarvestError.new("harvest-write-failed", target, error.message);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(Effect.mapError(writeFailed));
  yield* fs.writeFileString(target, text).pipe(Effect.mapError(writeFailed));
});

const readLedger = Effect.fn("Harvest.read")(function* (target: string) {
  const text = yield* readOptionalText(target, target);
  return yield* O.match(text, {
    onNone: () => Effect.succeedNone,
    onSome: (value) => Effect.asSome(parseHarvestLedgerText(target, value)),
  });
});

const makeLive = Effect.gen(function* () {
  const context = yield* Effect.context<
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | SecureRandom.SecureRandom
    | Digest.Digest
  >();
  return HarvestProjector.of({
    collect: flow(collectLedger, Effect.provide(context)),
    write: flow(writeLedger, Effect.provide(context)),
    read: flow(readLedger, Effect.provide(context)),
  });
});

/**
 * Working-tree {@link HarvestProjector}: reads packets through `FileSystem`
 * and `Path`, asks git for HEAD and the tracked `OPPORTUNITIES.md` list, and
 * writes the ledger in place.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { HarvestProjectorLive } from "@beep/repo-cli/commands/Goals/Harvest.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(HarvestProjectorLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HarvestProjectorLive = Layer.effect(HarvestProjector, makeLive);
