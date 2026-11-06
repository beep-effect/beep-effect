/**
 * Archive execution services: mirror packets into a local archive checkout
 * (`ArchiveStore`), tombstone them on `main` (`TombstoneWriter`), and point
 * inbound links at the archive (`InboundLinkRewriter`).
 *
 * **Details**
 *
 * Every service reads its checkout paths from {@link ArchiveWorkspace}. The
 * archive checkout is a local git clone; nothing here pushes to a remote. The
 * GitHub `<owner>/<repo>` reference is used only for URLs and
 * `ArchiveRecord.repo`. `TombstoneWriter` runs only after `ArchiveStore.verify`
 * has matched every mirrored tree hash.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { writeContainedFileString } from "@beep/repo-cli-kit/cli/FsGuards";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli-kit/cli/Jsonc";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import { ExplorationManifest } from "../Explore/Atlas.ts";
import { knowledgeLinkDestinations } from "../Knowledge/Knowledge.refs.ts";
import { decodeReflectionFrontmatterText, reflectionFileNameIsArtifact } from "../Lint/ReflectionArtifact.ts";
import { ArchiveIndexRow, ArchiveRecord, TombstoneKeep } from "./Archive.schemas.ts";
import { ArchiveError } from "./Goals.errors.ts";
import { decodeGoalManifest, renderGoalCloseoutRecord, renderGoalProposedCloseout } from "./Goals.schemas.ts";
import { parseGoalManifestText, readmeMissionLine } from "./Inventory.ts";
import { GoalManifestFormatter } from "./Manifest.service.ts";
import { biomeManifestFormatter } from "./Manifest.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type {
  ArchivePlan,
  ArchivePlanEntry,
  ArchiveReceipt,
  ArchiveReceiptEntry,
  ArchiveRepoRef,
  InboundLink,
} from "./Archive.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/ArchiveExecution.service");

/**
 * Archive-root file listing every archived packet.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ARCHIVE_INDEX_FILE = "ARCHIVE-INDEX.md";

const ARCHIVE_README_FILE = "README.md";
const INDEX_ROW = /^\| (goals|explorations) \| ([a-z0-9-]+) \| ([a-z0-9-]+) \| ([0-9a-f]{40}) \| ([0-9a-f]{40}) \|$/;
const LINE_BREAK = /\r?\n/;

const decodeIndexRow = S.decodeUnknownOption(ArchiveIndexRow);
const encodeRecord = S.encodeUnknownEffect(ArchiveRecord);
const decodeExplorationManifest = S.decodeUnknownOption(ExplorationManifest);

/**
 * Checkout paths and archive identity for one archive run.
 *
 * **Example** (Describe a workspace)
 *
 * ```ts
 * import type { ArchiveWorkspaceShape } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const workspace: ArchiveWorkspaceShape = {
 *   repoRoot: "/repo",
 *   archiveDir: "/repo/.repos/goals-archive",
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   kindLabel: "goals",
 * }
 * console.log(workspace.kindLabel) // "goals"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ArchiveWorkspaceShape {
  readonly archiveDir: string;
  readonly kindLabel: string;
  readonly repo: ArchiveRepoRef;
  readonly repoRoot: string;
}

/**
 * The checkouts and archive identity an archive run operates on.
 *
 * **Example** (Provide a workspace)
 *
 * ```ts
 * import { ArchiveWorkspace } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.provideService(Effect.map(ArchiveWorkspace, (w) => w.repoRoot), ArchiveWorkspace, {
 *   repoRoot: "/repo",
 *   archiveDir: "/archive",
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   kindLabel: "goals",
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ArchiveWorkspace extends Context.Service<ArchiveWorkspace, ArchiveWorkspaceShape>()(
  $I`ArchiveWorkspace`
) {}

/**
 * One packet's archive-side verification result.
 *
 * **Example** (Construct a verdict)
 *
 * ```ts
 * import { ArchiveVerification } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const verdict = ArchiveVerification.make({
 *   root: "goals",
 *   slug: "demo",
 *   archiveTreeHash: "a".repeat(40),
 *   verified: true,
 * })
 * console.log(verdict.verified) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveVerification extends S.Class<ArchiveVerification, { readonly brand: unique symbol }>(
  $I`ArchiveVerification`
)(
  {
    root: S.Literals(["goals", "explorations"]),
    slug: S.String,
    archiveTreeHash: S.String,
    verified: S.Boolean,
  },
  $I.annote("ArchiveVerification", {
    description: "The archive commit's tree hash for one mirrored packet and whether it equals the plan's local hash.",
  })
) {}

/**
 * Service contract of the archive repository checkout.
 *
 * **Example** (Describe a push)
 *
 * ```ts
 * import type { ArchiveStoreShape } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const pushPlan = (store: ArchiveStoreShape) => store.push
 * console.log(typeof pushPlan) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ArchiveStoreShape {
  readonly push: (plan: ArchivePlan) => Effect.Effect<{ readonly commit: string }, ArchiveError>;
  readonly verify: (
    plan: ArchivePlan,
    commit: string
  ) => Effect.Effect<ReadonlyArray<ArchiveVerification>, ArchiveError>;
}

/**
 * Mirrors packets into the local archive checkout and verifies their tree hashes.
 *
 * **Example** (Request the store)
 *
 * ```ts
 * import { ArchiveStore } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* ArchiveStore }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ArchiveStore extends Context.Service<ArchiveStore, ArchiveStoreShape>()($I`ArchiveStore`) {}

/**
 * Service contract of the tombstone writer.
 *
 * **Example** (Describe an apply)
 *
 * ```ts
 * import type { TombstoneWriterShape } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const apply = (writer: TombstoneWriterShape) => writer.apply
 * console.log(typeof apply) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface TombstoneWriterShape {
  readonly apply: (plan: ArchivePlan, receipt: ArchiveReceipt) => Effect.Effect<void, ArchiveError>;
}

/**
 * Replaces archived packets on `main` with tombstones: deletes the moved
 * files, regenerates `README.md` as a stub and writes the manifest `archive` block.
 *
 * **Example** (Request the writer)
 *
 * ```ts
 * import { TombstoneWriter } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* TombstoneWriter }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TombstoneWriter extends Context.Service<TombstoneWriter, TombstoneWriterShape>()($I`TombstoneWriter`) {}

/**
 * Service contract of the inbound link rewriter.
 *
 * **Example** (Describe a rewrite)
 *
 * ```ts
 * import type { InboundLinkRewriterShape } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const rewrite = (rewriter: InboundLinkRewriterShape) => rewriter.rewrite([])
 * console.log(typeof rewrite) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface InboundLinkRewriterShape {
  readonly rewrite: (links: ReadonlyArray<InboundLink>) => Effect.Effect<number, ArchiveError>;
}

/**
 * Rewrites inbound links into archived files to their archive blob URLs, line-exact.
 *
 * **Example** (Request the rewriter)
 *
 * ```ts
 * import { InboundLinkRewriter } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* InboundLinkRewriter }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InboundLinkRewriter extends Context.Service<InboundLinkRewriter, InboundLinkRewriterShape>()(
  $I`InboundLinkRewriter`
) {}

const packetPath = (entry: ArchivePlanEntry): string => `${entry.root}/${entry.slug}`;

const gitAdapter = (
  cwd: string,
  reason: "archive-git-failed" | "archive-push-failed"
): GitCommandErrorAdapter<ArchiveError> => ({
  onSpawnFailure: (commandLine) => (cause) =>
    ArchiveError.new(reason, null, cwd, `spawn ${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    ArchiveError.new(reason, null, cwd, `${commandLine} exited with ${exitCode}`),
  onTruncated: O.none(),
});

const fsFailure =
  (reason: "archive-push-failed" | "tombstone-conflict" | "archive-read-failed", slug: string | null, target: string) =>
  (error: { readonly message: string }): ArchiveError =>
    ArchiveError.new(reason, slug, target, error.message);

/**
 * Archive commit message for a plan.
 *
 * **Example** (Name a goals batch)
 *
 * ```ts
 * import { archiveCommitMessage } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * console.log(archiveCommitMessage({ kindLabel: "goals", count: 3, sourceCommit: "c".repeat(40) }))
 * // "archive(goals): 3 packets from cccccccccccccccccccccccccccccccccccccccc"
 * ```
 *
 * @param input - The `--kind` value, the packet count and the main commit the trees came from.
 * @returns The commit subject.
 * @category formatting
 * @since 0.0.0
 */
export const archiveCommitMessage = (input: {
  readonly kindLabel: string;
  readonly count: number;
  readonly sourceCommit: string;
}): string => `archive(${input.kindLabel}): ${input.count} packets from ${input.sourceCommit}`;

/**
 * Parse the rows of an `ARCHIVE-INDEX.md` table; lines that are not rows are ignored.
 *
 * **Example** (Read one row)
 *
 * ```ts
 * import { parseArchiveIndexRows } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const line = `| goals | demo | completed-retained | ${"a".repeat(40)} | ${"c".repeat(40)} |`
 * console.log(parseArchiveIndexRows(`# Index\n\n${line}\n`).length) // 1
 * ```
 *
 * @param text - Index file text.
 * @returns The decoded rows in file order.
 * @category parsing
 * @since 0.0.0
 */
export const parseArchiveIndexRows = (text: string): ReadonlyArray<ArchiveIndexRow> =>
  A.getSomes(
    A.map(Str.split(text, LINE_BREAK), (line) =>
      pipe(
        Str.match(INDEX_ROW)(line),
        O.flatMap((match) =>
          decodeIndexRow({
            root: match[1],
            slug: match[2],
            status: match[3],
            archiveCommit: match[4],
            sourceCommit: match[5],
          })
        )
      )
    )
  );

const indexRowOrder: Order.Order<ArchiveIndexRow> = Order.combine(
  Order.mapInput(Order.String, (row: ArchiveIndexRow) => row.root),
  Order.mapInput(Order.String, (row: ArchiveIndexRow) => row.slug)
);

/**
 * Render `ARCHIVE-INDEX.md` from its rows, sorted by kind then slug.
 *
 * **Example** (Render an empty index)
 *
 * ```ts
 * import { renderArchiveIndex } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * console.log(renderArchiveIndex([]).startsWith("# Archive index")) // true
 * ```
 *
 * @param rows - Every archived packet.
 * @returns The index Markdown.
 * @category formatting
 * @since 0.0.0
 */
export const renderArchiveIndex = (rows: ReadonlyArray<ArchiveIndexRow>): string =>
  A.join(
    [
      "# Archive index",
      "",
      "Generated by `bun run beep goals archive --write`; never edit by hand.",
      "",
      "| Kind | Slug | Status | Archived commit | Source commit |",
      "| --- | --- | --- | --- | --- |",
      ...A.map(
        A.sort(rows, indexRowOrder),
        (row) => `| ${row.root} | ${row.slug} | ${row.status} | ${row.archiveCommit} | ${row.sourceCommit} |`
      ),
      "",
    ],
    "\n"
  );

const ARCHIVE_README = A.join(
  [
    "# beep-effect goals archive",
    "",
    "This repository is a projection written only by `bun run beep goals archive --write` in",
    "beep-effect. Each directory mirrors a terminal goal or exploration packet exactly as it",
    "stood on `main` at the source commit listed in `ARCHIVE-INDEX.md`. Do not edit it by hand.",
    "",
  ],
  "\n"
);

const mirrorEntry = Effect.fnUntraced(function* (workspace: ArchiveWorkspaceShape, entry: ArchivePlanEntry) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(workspace.archiveDir, packetPath(entry));
  yield* fs
    .remove(target, { recursive: true, force: true })
    .pipe(Effect.mapError(fsFailure("archive-push-failed", entry.slug, target)));
  const files = A.sort(A.appendAll(entry.keep, entry.remove), Order.String);
  yield* Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const destination = path.join(workspace.archiveDir, file);
        yield* fs.makeDirectory(path.dirname(destination), { recursive: true });
        yield* fs.copyFile(path.join(workspace.repoRoot, file), destination);
      }).pipe(Effect.mapError(fsFailure("archive-push-failed", entry.slug, file))),
    { discard: true, concurrency: 8 }
  );
});

const pushPlan = Effect.fn("ArchiveStore.push")(function* (plan: ArchivePlan) {
  const workspace = yield* ArchiveWorkspace;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const adapter = gitAdapter(workspace.archiveDir, "archive-push-failed");
  const isCheckout = yield* fs.exists(path.join(workspace.archiveDir, ".git")).pipe(Effect.orElseSucceed(() => false));
  if (!isCheckout) {
    return yield* ArchiveError.new(
      "archive-push-failed",
      null,
      workspace.archiveDir,
      "archive checkout is missing or not a git repository; clone the archive repo there first"
    );
  }
  yield* Effect.forEach(plan.entries, (entry) => mirrorEntry(workspace, entry), { discard: true });
  const readmePath = path.join(workspace.archiveDir, ARCHIVE_README_FILE);
  const hasReadme = yield* fs.exists(readmePath).pipe(Effect.orElseSucceed(() => false));
  if (!hasReadme) {
    yield* fs
      .writeFileString(readmePath, ARCHIVE_README)
      .pipe(Effect.mapError(fsFailure("archive-push-failed", null, readmePath)));
  }
  yield* runGitOutput(
    workspace.archiveDir,
    ["add", "--", ARCHIVE_README_FILE, ...A.map(plan.entries, packetPath)],
    adapter
  );
  yield* runGitOutput(
    workspace.archiveDir,
    [
      "commit",
      "-q",
      "-m",
      archiveCommitMessage({
        kindLabel: workspace.kindLabel,
        count: A.length(plan.entries),
        sourceCommit: plan.sourceCommit,
      }),
    ],
    adapter
  );
  const commit = yield* runGitOutput(workspace.archiveDir, ["rev-parse", "HEAD"], adapter);

  // The index names the archive commit, so it lands in a follow-up commit that leaves every packet tree unchanged.
  const indexPath = path.join(workspace.archiveDir, ARCHIVE_INDEX_FILE);
  const existing = yield* fs.readFileString(indexPath).pipe(Effect.orElseSucceed(() => ""));
  const replaced = HashSet.fromIterable(A.map(plan.entries, packetPath));
  const kept = A.filter(parseArchiveIndexRows(existing), (row) => !HashSet.has(replaced, `${row.root}/${row.slug}`));
  const added = A.map(plan.entries, (entry) =>
    ArchiveIndexRow.make({
      root: entry.root,
      slug: entry.slug,
      status: entry.status,
      archiveCommit: commit,
      sourceCommit: plan.sourceCommit,
    })
  );
  yield* fs
    .writeFileString(indexPath, renderArchiveIndex(A.appendAll(kept, added)))
    .pipe(Effect.mapError(fsFailure("archive-push-failed", null, indexPath)));
  yield* runGitOutput(workspace.archiveDir, ["add", "--", ARCHIVE_INDEX_FILE], adapter);
  yield* runGitOutput(
    workspace.archiveDir,
    ["commit", "-q", "-m", `archive(index): ${A.length(plan.entries)} packets from ${plan.sourceCommit}`],
    adapter
  );
  return { commit };
});

const verifyPlan = Effect.fn("ArchiveStore.verify")(function* (plan: ArchivePlan, commit: string) {
  const workspace = yield* ArchiveWorkspace;
  const adapter = gitAdapter(workspace.archiveDir, "archive-git-failed");
  return yield* Effect.forEach(plan.entries, (entry) =>
    Effect.map(runGitOutput(workspace.archiveDir, ["rev-parse", `${commit}:${packetPath(entry)}`], adapter), (hash) =>
      ArchiveVerification.make({
        root: entry.root,
        slug: entry.slug,
        archiveTreeHash: hash,
        verified: hash === entry.localTreeHash,
      })
    )
  );
});

type ArchiveServices =
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom;

const captureContext = Effect.context<ArchiveServices | ArchiveWorkspace>();

/**
 * Build the local-checkout {@link ArchiveStore} over the current
 * {@link ArchiveWorkspace} and platform services.
 *
 * **Example** (Build the store effect)
 *
 * ```ts
 * import { makeArchiveStore } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeArchiveStore)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeArchiveStore = Effect.map(captureContext, (context) =>
  ArchiveStore.of({
    push: flow(pushPlan, Effect.provide(context)),
    verify: flow(verifyPlan, Effect.provide(context)),
  })
);

/**
 * Local-checkout {@link ArchiveStore}: copies each packet's tracked files into
 * the archive checkout, commits with the checkout's git identity, refreshes
 * `ARCHIVE-INDEX.md`, and compares `git rev-parse <commit>:<path>` with the plan.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { ArchiveStoreLive } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ArchiveStoreLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchiveStoreLive = Layer.effect(ArchiveStore, makeArchiveStore);

/**
 * Inputs of a tombstone README stub.
 *
 * **Example** (Construct stub inputs)
 *
 * ```ts
 * import { TombstoneStub } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const stub = TombstoneStub.make({
 *   root: "goals",
 *   title: "Demo",
 *   status: "completed-retained",
 *   stage: null,
 *   mission: null,
 *   closeout: null,
 *   provides: [],
 *   headlineFinding: null,
 *   archiveUrl: "https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/demo",
 *   archivedAt: "2026-11-06T00:00:00.000Z",
 * })
 * console.log(stub.title) // "Demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TombstoneStub extends S.Class<TombstoneStub, { readonly brand: unique symbol }>($I`TombstoneStub`)(
  {
    root: S.Literals(["goals", "explorations"]),
    title: S.String,
    status: S.String,
    stage: S.NullOr(S.String),
    mission: S.NullOr(S.String),
    closeout: S.NullOr(S.String),
    provides: S.Array(S.String),
    headlineFinding: S.NullOr(S.String),
    archiveUrl: S.String,
    archivedAt: S.String,
  },
  $I.annote("TombstoneStub", {
    description: "Manifest-derived inputs of a tombstoned packet's generated README stub.",
  })
) {}

const nullableLine = (value: string | null, fallback: string): string => value ?? fallback;

/**
 * Render a tombstoned packet's README stub.
 *
 * **Details**
 *
 * Goal stubs keep the `Lifecycle:` line the doctor reads; exploration stubs
 * keep the generated status region the Atlas projector rewrites.
 *
 * **Example** (Render a goal stub)
 *
 * ```ts
 * import { renderTombstoneReadme, TombstoneStub } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 *
 * const text = renderTombstoneReadme(
 *   TombstoneStub.make({
 *     root: "goals",
 *     title: "Demo",
 *     status: "completed-retained",
 *     stage: null,
 *     mission: "Ship it.",
 *     closeout: null,
 *     provides: ["demo-capability"],
 *     headlineFinding: null,
 *     archiveUrl: "https://github.com/beep-effect/beep-effect-goals-archive/tree/main/goals/demo",
 *     archivedAt: "2026-11-06T00:00:00.000Z",
 *   })
 * )
 * console.log(text.includes("Lifecycle: `completed-retained`")) // true
 * ```
 *
 * @param stub - Stub inputs.
 * @returns The README Markdown.
 * @category formatting
 * @since 0.0.0
 */
export const renderTombstoneReadme = (stub: TombstoneStub): string => {
  const archivedOn = Str.slice(0, 10)(stub.archivedAt);
  const statusBlock =
    stub.root === "goals"
      ? [`Lifecycle: \`${stub.status}\``]
      : [
          "<!-- BEGIN GENERATED: EXPLORATION STATUS -->",
          `Stage: \`${nullableLine(stub.stage, "graduate")}\``,
          `Status: \`${stub.status}\``,
          "<!-- END GENERATED: EXPLORATION STATUS -->",
        ];
  const kept = A.map(
    A.filter(TombstoneKeep[stub.root], (pattern) => pattern !== "README.md"),
    (pattern) => `- \`${Str.replace("/**", "/")(pattern)}\``
  );
  const goalSections =
    stub.root === "goals"
      ? [
          "",
          "## Mission",
          "",
          nullableLine(stub.mission, "No mission recorded."),
          "",
          "## Closeout",
          "",
          nullableLine(stub.closeout, "No closeout record."),
          "",
          "## Provides",
          "",
          ...(A.isReadonlyArrayEmpty(stub.provides) ? ["None."] : A.map(stub.provides, (slug) => `- \`${slug}\``)),
          "",
          "## Headline finding",
          "",
          nullableLine(stub.headlineFinding, "No reflection findings recorded."),
        ]
      : A.empty<string>();
  return A.join(
    [
      `# ${stub.title}`,
      "",
      "## Status",
      "",
      ...statusBlock,
      "",
      `Archived on ${archivedOn}. The full packet lives at <${stub.archiveUrl}>. This README is a`,
      "tombstone stub generated by `bun run beep goals archive --write`; do not edit it by hand.",
      ...goalSections,
      "",
      "## Kept on main",
      "",
      ...kept,
      "",
    ],
    "\n"
  );
};

const headlineFinding = Effect.fnUntraced(function* (absolutePacket: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(absolutePacket, "history", "reflections");
  const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(A.empty<string>));
  const newest = A.head(A.reverse(A.sort(A.filter(entries, reflectionFileNameIsArtifact), Order.String)));
  if (O.isNone(newest)) return null;
  const raw = yield* fs.readFileString(path.join(dir, newest.value)).pipe(Effect.orElseSucceed(() => ""));
  const frontmatter = yield* decodeReflectionFrontmatterText(raw);
  return pipe(
    frontmatter,
    O.flatMap((value) => A.head(value.findings)),
    O.map((finding) => finding.instruction),
    O.getOrNull
  );
});

const stubFor = Effect.fnUntraced(function* (
  workspace: ArchiveWorkspaceShape,
  entry: ArchivePlanEntry,
  manifestValue: unknown,
  readmeText: string,
  record: ArchiveRecord
) {
  const path = yield* Path.Path;
  const absolute = path.join(workspace.repoRoot, packetPath(entry));
  const archiveUrl = `https://github.com/${workspace.repo}/tree/main/${packetPath(entry)}`;
  if (entry.root === "goals") {
    const manifest = yield* decodeGoalManifest(manifestValue).pipe(
      Effect.mapError((error) => ArchiveError.new("tombstone-conflict", entry.slug, packetPath(entry), error.message))
    );
    const finding = yield* headlineFinding(absolute);
    return TombstoneStub.make({
      root: "goals",
      title: manifest.initiative.title ?? entry.slug,
      status: manifest.initiative.status,
      stage: null,
      mission: pipe(
        O.fromNullishOr(manifest.mission),
        O.orElse(() => readmeMissionLine(readmeText)),
        O.getOrNull
      ),
      closeout: pipe(
        O.map(O.fromUndefinedOr(manifest.closeout), renderGoalCloseoutRecord),
        O.orElse(() => O.map(O.fromUndefinedOr(manifest.proposedCloseout), renderGoalProposedCloseout)),
        O.getOrNull
      ),
      provides: A.map(manifest.provides, (capability) => `${capability}`),
      headlineFinding: finding,
      archiveUrl,
      archivedAt: record.archivedAt,
    });
  }
  const exploration = yield* Effect.fromOption(decodeExplorationManifest(manifestValue)).pipe(
    Effect.mapError(() =>
      ArchiveError.new("tombstone-conflict", entry.slug, packetPath(entry), "exploration manifest does not decode")
    )
  );
  return TombstoneStub.make({
    root: "explorations",
    title: exploration.exploration.title,
    status: exploration.exploration.status,
    stage: exploration.exploration.stage,
    mission: null,
    closeout: null,
    provides: [],
    headlineFinding: null,
    archiveUrl,
    archivedAt: record.archivedAt,
  });
});

const tombstoneEntry = Effect.fnUntraced(function* (
  workspace: ArchiveWorkspaceShape,
  entry: ArchivePlanEntry,
  record: ArchiveRecord
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const relative = packetPath(entry);
  const manifestFile = `${relative}/ops/manifest.json`;
  const readmeFile = `${relative}/README.md`;
  const manifestText = yield* fs
    .readFileString(path.join(workspace.repoRoot, manifestFile))
    .pipe(Effect.mapError(fsFailure("archive-read-failed", entry.slug, manifestFile)));
  const readmeText = yield* fs
    .readFileString(path.join(workspace.repoRoot, readmeFile))
    .pipe(Effect.orElseSucceed(() => ""));
  const manifestValue = yield* Effect.fromOption(parseGoalManifestText(manifestText)).pipe(
    Effect.mapError(() =>
      ArchiveError.new("tombstone-conflict", entry.slug, manifestFile, "manifest is not a JSON object")
    )
  );
  const stub = yield* stubFor(workspace, entry, manifestValue, readmeText, record);
  const encodedRecord = yield* encodeRecord(record).pipe(Effect.orDie);
  const archivePath = entry.root === "goals" ? ["archive"] : ["exploration", "archive"];
  const nextManifest = applyJsoncModification(
    JsoncModification.make({ content: manifestText, path: archivePath, value: encodedRecord })
  );
  yield* Effect.forEach(
    entry.remove,
    (file) =>
      fs
        .remove(path.join(workspace.repoRoot, file), { force: true })
        .pipe(Effect.mapError(fsFailure("tombstone-conflict", entry.slug, file))),
    { discard: true }
  );
  yield* writeContainedFileString(workspace.repoRoot, readmeFile, renderTombstoneReadme(stub)).pipe(
    Effect.mapError(fsFailure("tombstone-conflict", entry.slug, readmeFile))
  );
  yield* writeContainedFileString(workspace.repoRoot, manifestFile, nextManifest).pipe(
    Effect.mapError(fsFailure("tombstone-conflict", entry.slug, manifestFile))
  );
  return manifestFile;
});

const applyTombstones = Effect.fn("TombstoneWriter.apply")(function* (plan: ArchivePlan, receipt: ArchiveReceipt) {
  const workspace = yield* ArchiveWorkspace;
  const records = HashMap.fromIterable(
    A.map(receipt.entries, (entry): readonly [string, ArchiveReceiptEntry] => [`${entry.root}/${entry.slug}`, entry])
  );
  const manifests = yield* Effect.forEach(plan.entries, (entry) =>
    Effect.flatMap(
      Effect.fromOption(HashMap.get(records, packetPath(entry))).pipe(
        Effect.mapError(() =>
          ArchiveError.new("tombstone-conflict", entry.slug, packetPath(entry), "receipt has no record for this packet")
        )
      ),
      (receiptEntry) =>
        receiptEntry.verified
          ? tombstoneEntry(workspace, entry, receiptEntry.record)
          : Effect.fail(
              ArchiveError.new(
                "archive-verify-mismatch",
                entry.slug,
                packetPath(entry),
                "receipt entry is not verified"
              )
            )
    )
  );
  const formatter = yield* Effect.serviceOption(GoalManifestFormatter);
  yield* O.getOrElse(formatter, () => biomeManifestFormatter)
    .format(workspace.repoRoot, manifests)
    .pipe(
      Effect.mapError((error) =>
        ArchiveError.new("tombstone-conflict", null, workspace.repoRoot, `manifest format failed: ${error.message}`)
      )
    );
});

/**
 * Build the working-tree {@link TombstoneWriter} over the current {@link ArchiveWorkspace}.
 *
 * **Example** (Build the writer effect)
 *
 * ```ts
 * import { makeTombstoneWriter } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeTombstoneWriter)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeTombstoneWriter = Effect.map(captureContext, (context) =>
  TombstoneWriter.of({ apply: flow(applyTombstones, Effect.provide(context)) })
);

/**
 * Working-tree {@link TombstoneWriter}: deletes each verified entry's `remove`
 * files, writes the README stub and the manifest `archive` block, then formats
 * the rewritten manifests (Biome unless a `GoalManifestFormatter` is provided).
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { TombstoneWriterLive } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(TombstoneWriterLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TombstoneWriterLive = Layer.effect(TombstoneWriter, makeTombstoneWriter);

// One link's line, rewritten at the parsed column of its destination; `None` when the line no longer
// carries that destination (the file changed after the plan was computed).
const rewriteLine = (lines: ReadonlyArray<string>, link: InboundLink): O.Option<ReadonlyArray<string>> =>
  pipe(
    A.get(lines, link.line - 1),
    O.flatMap((line) =>
      O.map(
        A.findFirst(knowledgeLinkDestinations(line), (candidate) => candidate.destination === link.destination),
        (match) => {
          const start = match.column - 1;
          return `${Str.slice(0, start)(line)}${link.rewrittenTo}${Str.slice(start + Str.length(link.destination))(line)}`;
        }
      )
    ),
    O.flatMap((next) => A.replace(lines, link.line - 1, next))
  );

/**
 * Rewrite the inbound links of one document's text, line-exact, by replacing
 * each link destination at its parsed column.
 *
 * **Example** (Rewrite one link)
 *
 * ```ts
 * import { InboundLink } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import { rewriteLinksInText } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Result from "effect/Result"
 *
 * const link = InboundLink.make({ file: "a.md", line: 1, destination: "x.md", rewrittenTo: "https://e/x.md" })
 * console.log(Result.getOrThrow(rewriteLinksInText("see [x](x.md)", [link]))) // "see [x](https://e/x.md)"
 * ```
 *
 * @param text - Document text.
 * @param links - The document's inbound links.
 * @returns The rewritten text, or the first link that no longer matches its line.
 * @category formatting
 * @since 0.0.0
 */
export const rewriteLinksInText: {
  (text: string, links: ReadonlyArray<InboundLink>): Result.Result<string, InboundLink>;
  (links: ReadonlyArray<InboundLink>): (text: string) => Result.Result<string, InboundLink>;
} = dual(2, (text: string, links: ReadonlyArray<InboundLink>): Result.Result<string, InboundLink> => {
  const initial: Result.Result<ReadonlyArray<string>, InboundLink> = Result.succeed(Str.split(text, "\n"));
  return Result.map(
    A.reduce(links, initial, (acc, link) =>
      Result.flatMap(acc, (lines) =>
        O.match(rewriteLine(lines, link), {
          onNone: (): Result.Result<ReadonlyArray<string>, InboundLink> => Result.fail(link),
          onSome: Result.succeed,
        })
      )
    ),
    (lines) => A.join(lines, "\n")
  );
});

const rewriteFile = Effect.fnUntraced(function* (
  workspace: ArchiveWorkspaceShape,
  file: string,
  links: ReadonlyArray<InboundLink>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs
    .readFileString(path.join(workspace.repoRoot, file))
    .pipe(Effect.mapError(fsFailure("archive-read-failed", null, file)));
  const next = yield* Effect.fromResult(rewriteLinksInText(text, links)).pipe(
    Effect.mapError((link) =>
      ArchiveError.new(
        "tombstone-conflict",
        null,
        file,
        `line ${link.line} no longer links ${link.destination}; recompute the plan`
      )
    )
  );
  yield* writeContainedFileString(workspace.repoRoot, file, next).pipe(
    Effect.mapError(fsFailure("tombstone-conflict", null, file))
  );
});

const rewriteLinks = Effect.fn("InboundLinkRewriter.rewrite")(function* (links: ReadonlyArray<InboundLink>) {
  const workspace = yield* ArchiveWorkspace;
  const byFile = A.groupBy(links, (link) => link.file);
  const files = A.sort(
    R.toEntries(byFile),
    Order.mapInput(Order.String, ([file]: readonly [string, ReadonlyArray<InboundLink>]) => file)
  );
  yield* Effect.forEach(files, ([file, fileLinks]) => rewriteFile(workspace, file, fileLinks), { discard: true });
  return A.length(links);
});

/**
 * Build the working-tree {@link InboundLinkRewriter} over the current {@link ArchiveWorkspace}.
 *
 * **Example** (Build the rewriter effect)
 *
 * ```ts
 * import { makeInboundLinkRewriter } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeInboundLinkRewriter)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInboundLinkRewriter = Effect.map(captureContext, (context) =>
  InboundLinkRewriter.of({ rewrite: flow(rewriteLinks, Effect.provide(context)) })
);

/**
 * Working-tree {@link InboundLinkRewriter}: rewrites each link destination in
 * place at its parsed column and refuses a line that no longer carries it.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { InboundLinkRewriterLive } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(InboundLinkRewriterLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const InboundLinkRewriterLive = Layer.effect(InboundLinkRewriter, makeInboundLinkRewriter);

/**
 * Every archive execution service over the local working tree and archive checkout.
 *
 * **Example** (Build the combined layer)
 *
 * ```ts
 * import { ArchiveExecutionLive } from "@beep/repo-cli/commands/Goals/ArchiveExecution.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ArchiveExecutionLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchiveExecutionLive = Layer.mergeAll(ArchiveStoreLive, TombstoneWriterLive, InboundLinkRewriterLive);
