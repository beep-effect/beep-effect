/**
 * Completion claims for a goal final: the `redAttribution` and
 * `operatorRuling` blocks of a packet's decision files, read from
 * `origin/main`, the checkout's `HEAD` commit and the working tree.
 *
 * **Details**
 *
 * Only committed files count (`origin/main` or `HEAD`); the working tree only
 * previews what would count once committed. Matching is pure
 * ({@link goalCompletionClaims}): an invalid file never attributes, identical
 * claims collapse to the strongest source, and a context two files attribute
 * differently fails closed as a conflict. The module reads decision files with
 * its own Git and filesystem reads instead of the doctor's packet reader,
 * because `Doctor.ts` imports the completion core that consumes this module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constFalse, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseGoalDecision } from "./Decisions.projection.ts";
import { GOAL_DECISIONS_DIR } from "./Decisions.schemas.ts";
import {
  GoalAttributionConflict,
  GoalClaimSet,
  GoalClaimSource,
  GoalCommittedClaimSource,
  GoalCompletionClaims,
  GoalOperatorRulingClaim,
  GoalRedAttributionClaim,
  goalClaimSourceRank,
} from "./Goals.schemas.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GoalDecision } from "./Decisions.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/RedAttribution");

/**
 * Which decision files a read of completion claims collects.
 *
 * **Details**
 *
 * - `checkout`: `origin/main`, the checkout's `HEAD` commit and its working
 *   tree. `origin/main` and `HEAD` count; the working tree only previews.
 *   `goals completion refresh` and `goals doctor --online` read this scope,
 *   so a PR that adds an attribution verifies inside its own lane (DN-6).
 * - `origin-main`: `origin/main` only. Checks that speak for `main` read this
 *   scope (the `yeet sweep --retire` closeout trigger), because the owning
 *   clone's `HEAD` can be any branch.
 *
 * **Example** (Guard a scope)
 *
 * ```ts
 * import { GoalClaimScope } from "@beep/repo-cli/commands/Goals/RedAttribution"
 * console.log(GoalClaimScope.is["origin-main"]("origin-main")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalClaimScope = LiteralKit(["checkout", "origin-main"]).pipe(
  $I.annoteSchema("GoalClaimScope", {
    description: "Which decision files a completion-claims read collects: the checkout's, or origin/main's only.",
  })
);

/**
 * Which decision files a read of completion claims collects.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalClaimScope = typeof GoalClaimScope.Type;

/**
 * One decision file's text as found in one claim source.
 *
 * **Details**
 *
 * `path` is repo-relative (`goals/<slug>/decisions/<file>`); its last segment
 * must satisfy the decision file-name grammar for the file to attribute.
 *
 * **Example** (Construct a committed decision)
 *
 * ```ts
 * import { GoalSourcedDecision } from "@beep/repo-cli/commands/Goals/RedAttribution"
 *
 * const decision = GoalSourcedDecision.make({
 *   path: "goals/demo/decisions/2026-11-14-final-merged-over-reds.md",
 *   source: "origin-main",
 *   text: "---\ntitle: Final\ndate: 2026-11-14\nreversal: Delete.\n---\n",
 * })
 * console.log(decision.source) // "origin-main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalSourcedDecision extends S.Opaque<GoalSourcedDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    source: GoalClaimSource,
    text: S.String,
  }).pipe(
    $I.annoteSchema("GoalSourcedDecision", {
      description: "One decision file's text as found on origin/main, at HEAD or in the working tree.",
    })
  )
) {}

type ParsedDecision = {
  readonly decision: GoalDecision;
  readonly path: string;
  readonly source: GoalClaimSource;
};

const isCommittedSource = S.is(GoalCommittedClaimSource);

const strongestSourcedDecision: Order.Order<GoalSourcedDecision> = Order.combine(
  Order.mapInput(Order.Number, (decision: GoalSourcedDecision) => goalClaimSourceRank(decision.source)),
  Order.mapInput(Order.String, (decision: GoalSourcedDecision) => decision.path)
);

const strongestClaim: Order.Order<GoalRedAttributionClaim> = Order.combine(
  Order.mapInput(Order.Number, (claim: GoalRedAttributionClaim) => goalClaimSourceRank(claim.source)),
  Order.mapInput(Order.String, (claim: GoalRedAttributionClaim) => claim.decisionFile)
);

const rulingByFileThenSource: Order.Order<GoalOperatorRulingClaim> = Order.combine(
  Order.mapInput(Order.String, (claim: GoalOperatorRulingClaim) => claim.decisionFile),
  Order.mapInput(Order.Number, (claim: GoalOperatorRulingClaim) => goalClaimSourceRank(claim.source))
);

const byContext = Order.mapInput(Order.String, (claim: GoalRedAttributionClaim) => claim.context);

const fileName = (path: string): string => A.lastNonEmpty(Str.split(path, "/"));

const parseSourced = Effect.fn("Goals.RedAttribution.parseSourced")(function* (sourced: GoalSourcedDecision) {
  const parsed = yield* parseGoalDecision(fileName(sourced.path), sourced.text);
  return Result.isSuccess(parsed)
    ? O.some<ParsedDecision>({ decision: parsed.success, path: sourced.path, source: sourced.source })
    : O.none<ParsedDecision>();
});

const redClaims = (parsed: ParsedDecision, finalPullRequest: number): ReadonlyArray<GoalRedAttributionClaim> =>
  pipe(
    O.fromUndefinedOr(parsed.decision.frontmatter.redAttribution),
    O.filter((block) => block.finalPullRequest === finalPullRequest),
    O.match({
      onNone: A.empty<GoalRedAttributionClaim>,
      onSome: (block) =>
        A.map(block.reds, (red) =>
          GoalRedAttributionClaim.make({
            context: red.context,
            attribution: red.attribution,
            fixPullRequest: red.fixPullRequest,
            decisionFile: parsed.path,
            source: parsed.source,
          })
        ),
    })
  );

const claimValue = (claim: GoalRedAttributionClaim): string => `${claim.attribution}#${claim.fixPullRequest}`;

// One context's claims: a single value attributes through its strongest claim; two values fail closed.
const resolveContext = (
  claims: A.NonEmptyReadonlyArray<GoalRedAttributionClaim>
): Result.Result<GoalRedAttributionClaim, GoalAttributionConflict> => {
  const strongest = A.headNonEmpty(A.sort(claims, strongestClaim));
  return A.length(A.dedupe(A.map(claims, claimValue))) === 1
    ? Result.succeed(strongest)
    : Result.fail(
        GoalAttributionConflict.make({
          context: strongest.context,
          decisionFiles: A.sort(A.dedupe(A.map(claims, (claim) => claim.decisionFile)), Order.String),
        })
      );
};

const claimSet = (parsed: ReadonlyArray<ParsedDecision>, finalPullRequest: number): GoalClaimSet => {
  const grouped = A.reduce(
    A.flatMap(parsed, (decision) => redClaims(decision, finalPullRequest)),
    HashMap.empty<string, A.NonEmptyReadonlyArray<GoalRedAttributionClaim>>(),
    (groups, claim) =>
      HashMap.set(
        groups,
        claim.context,
        A.append(O.getOrElse(HashMap.get(groups, claim.context), A.empty<GoalRedAttributionClaim>), claim)
      )
  );
  const [redAttributions, conflicts] = A.partition(HashMap.toValues(grouped), resolveContext);
  const operatorRulings = pipe(
    parsed,
    A.filter((decision) =>
      O.exists(
        O.fromUndefinedOr(decision.decision.frontmatter.operatorRuling),
        (ruling) => ruling.finalPullRequest === finalPullRequest
      )
    ),
    A.map((decision) =>
      GoalOperatorRulingClaim.make({ finalPullRequest, decisionFile: decision.path, source: decision.source })
    ),
    A.sort(rulingByFileThenSource),
    A.dedupeWith((self, that) => self.decisionFile === that.decisionFile)
  );
  return GoalClaimSet.make({
    redAttributions: A.sort(redAttributions, byContext),
    operatorRulings,
    conflicts: A.sort(
      conflicts,
      Order.mapInput(Order.String, (conflict: GoalAttributionConflict) => conflict.context)
    ),
  });
};

/**
 * Matches decision files against one final: committed claims and a preview that adds the working tree.
 *
 * **Details**
 *
 * Deterministic and free of I/O; it is an `Effect` only because decision
 * frontmatter parses through {@link parseGoalDecision}.
 *
 * 1. Each distinct `(path, text)` pair is parsed once, under its strongest
 *    source (`origin-main`, then `head`, then `working-tree`). A file that
 *    does not parse never attributes.
 * 2. `committed` uses `origin-main` and `head` files only; `preview` uses all
 *    three sources.
 * 3. Within each set, reds whose block names `finalPullRequest` are grouped by
 *    `context`. One value per context attributes through its strongest claim;
 *    two different values (two files, or one file that differs between
 *    sources) put the context in `conflicts` and attribute nothing.
 * 4. `operatorRulings` lists every ruling for `finalPullRequest`, one per file.
 *
 * **Example** (Match a committed attribution)
 *
 * ```ts
 * import { GoalSourcedDecision, goalCompletionClaims } from "@beep/repo-cli/commands/Goals/RedAttribution"
 * import * as Effect from "effect/Effect"
 *
 * const text = [
 *   "---",
 *   "title: Final merged over a red",
 *   "date: 2026-11-14",
 *   "reversal: Delete this file.",
 *   "redAttribution:",
 *   "  finalPullRequest: 2966",
 *   "  reds:",
 *   '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }',
 *   "---",
 *   "",
 * ].join("\n")
 * const claims = Effect.runSync(
 *   goalCompletionClaims(
 *     [
 *       GoalSourcedDecision.make({
 *         path: "goals/demo/decisions/2026-11-14-final-merged-over-a-red.md",
 *         source: "origin-main",
 *         text,
 *       }),
 *     ],
 *     2966
 *   )
 * )
 * console.log(claims.committed.redAttributions[0]?.context) // "Heavy / Check"
 * ```
 *
 * @param decisions - Decision files from every source; duplicates are allowed.
 * @param finalPullRequest - The final whose claims to collect.
 * @returns The committed claims and the preview.
 * @category use-cases
 * @since 0.0.0
 */
export const goalCompletionClaims = Effect.fn("Goals.goalCompletionClaims")(function* (
  decisions: ReadonlyArray<GoalSourcedDecision>,
  finalPullRequest: number
) {
  const distinct = pipe(
    decisions,
    A.sort(strongestSourcedDecision),
    A.dedupeWith((self, that) => self.path === that.path && self.text === that.text)
  );
  const results = yield* Effect.forEach(distinct, parseSourced);
  const parsed = A.getSomes(results);
  return GoalCompletionClaims.make({
    committed: claimSet(
      A.filter(parsed, (decision) => isCommittedSource(decision.source)),
      finalPullRequest
    ),
    preview: claimSet(parsed, finalPullRequest),
  });
});

/**
 * The claims that count toward a stored receipt, doctor and the sweep.
 *
 * **Example** (Select the committed set)
 *
 * ```ts
 * import { GoalCompletionClaims } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import { committedGoalCompletionClaims } from "@beep/repo-cli/commands/Goals/RedAttribution"
 *
 * console.log(committedGoalCompletionClaims(GoalCompletionClaims.make({})).redAttributions.length) // 0
 * ```
 *
 * @param claims - Claims from {@link goalCompletionClaims}.
 * @returns The committed claim set.
 * @category getters
 * @since 0.0.0
 */
export const committedGoalCompletionClaims = (claims: GoalCompletionClaims): GoalClaimSet => claims.committed;

/**
 * Operations the claims reader supplies.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalCompletionClaimsReaderShape = {
  readonly read: (
    root: string,
    slug: string,
    finalPullRequest: number,
    scope?: GoalClaimScope
  ) => Effect.Effect<GoalCompletionClaims>;
};

const isDirectChild = (directory: string, path: string): boolean =>
  Str.startsWith(`${directory}/`)(path) && !Str.includes("/")(Str.slice(Str.length(directory) + 1)(path));

const makeGoalCompletionClaimsReader = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* Git.make;

  // The reader never fetches: callers that need a fresh origin/main fetch first.
  const committedDecisions = Effect.fn("GoalCompletionClaimsReader.committedDecisions")(function* (
    root: string,
    ref: string,
    source: GoalClaimSource,
    directory: string
  ) {
    return yield* git.lsTree(root, ref, { pathspec: [directory], fullTree: true }).pipe(
      Effect.map((entries) =>
        A.filter(entries, (entry) => entry.type === "blob" && isDirectChild(directory, entry.path))
      ),
      Effect.flatMap((entries) =>
        Effect.forEach(entries, (entry) =>
          git
            .show(root, ref, entry.path)
            .pipe(Effect.map(O.map((text) => GoalSourcedDecision.make({ path: entry.path, source, text }))))
        )
      ),
      Effect.map(A.getSomes),
      Effect.orElseSucceed(A.empty<GoalSourcedDecision>)
    );
  });

  const workingTreeDecisions = Effect.fn("GoalCompletionClaimsReader.workingTreeDecisions")(function* (
    root: string,
    directory: string
  ) {
    const absolute = path.join(root, directory);
    const entries = yield* fs.readDirectory(absolute).pipe(Effect.orElseSucceed(A.empty<string>));
    const files = yield* Effect.filter(entries, (entry) =>
      fs.stat(path.join(absolute, entry)).pipe(
        Effect.map((info) => info.type === "File"),
        Effect.orElseSucceed(constFalse)
      )
    );
    const read = yield* Effect.forEach(files, (file) =>
      fs.readFileString(path.join(absolute, file)).pipe(
        Effect.map((text) =>
          O.some(GoalSourcedDecision.make({ path: `${directory}/${file}`, source: "working-tree", text }))
        ),
        Effect.orElseSucceed(O.none<GoalSourcedDecision>)
      )
    );
    return A.getSomes(read);
  });

  // The checkout's own files: its HEAD commit, then its working tree.
  const checkoutDecisions = Effect.fn("GoalCompletionClaimsReader.checkoutDecisions")(function* (
    root: string,
    directory: string
  ) {
    const head = yield* committedDecisions(root, "HEAD", GoalClaimSource.Enum.head, directory);
    const workingTree = yield* workingTreeDecisions(root, directory);
    return A.appendAll(head, workingTree);
  });

  const read = Effect.fn("GoalCompletionClaimsReader.read")(function* (
    root: string,
    slug: string,
    finalPullRequest: number,
    scope?: GoalClaimScope
  ) {
    const directory = `goals/${slug}/${GOAL_DECISIONS_DIR}`;
    const originMain = yield* committedDecisions(root, "origin/main", GoalClaimSource.Enum["origin-main"], directory);
    // No scope reads the checkout's files too.
    const checkout = GoalClaimScope.is["origin-main"](scope)
      ? A.empty<GoalSourcedDecision>()
      : yield* checkoutDecisions(root, directory);
    return yield* goalCompletionClaims(A.appendAll(originMain, checkout), finalPullRequest);
  });

  const shape: GoalCompletionClaimsReaderShape = { read };
  return shape;
});

/**
 * Reads a packet's completion claims for one final.
 *
 * **Details**
 *
 * The live {@link GoalCompletionClaimsReader.layer} collects
 * `goals/<slug>/decisions/*.md` from `origin/main` and `HEAD` (`git ls-tree`
 * and `git show`, with `Git` built inside the reader) and from the working
 * tree, then matches them with {@link goalCompletionClaims}. The
 * `origin-main` {@link GoalClaimScope} skips `HEAD` and the working tree. A failed git or
 * filesystem read contributes no files from that source and never fails the
 * read; a missing `origin/main` ref contributes nothing. The reader never
 * fetches. {@link GoalCompletionClaimsReader.layerTest} returns fixed claims.
 *
 * **Example** (Read fixed claims)
 *
 * ```ts
 * import { GoalCompletionClaims } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution"
 * import * as Effect from "effect/Effect"
 *
 * const program = GoalCompletionClaimsReader.use((reader) => reader.read("/repo", "demo", 2966))
 * const claims = Effect.runSync(
 *   Effect.provide(program, GoalCompletionClaimsReader.layerTest(GoalCompletionClaims.make({})))
 * )
 * console.log(claims.committed.redAttributions.length) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCompletionClaimsReader extends Context.Service<
  GoalCompletionClaimsReader,
  GoalCompletionClaimsReaderShape
>()($I`GoalCompletionClaimsReader`) {
  /**
   * Live reader over `origin/main`, `HEAD` and the working tree.
   *
   * **Example** (Inspect the live layer)
   *
   * ```ts
   * import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(GoalCompletionClaimsReader.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    GoalCompletionClaimsReader,
    never,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(GoalCompletionClaimsReader, makeGoalCompletionClaimsReader);

  /**
   * A reader that returns `claims` for every packet and final.
   *
   * **Example** (Build a fixed reader)
   *
   * ```ts
   * import { GoalCompletionClaims } from "@beep/repo-cli/commands/Goals/Goals.schemas"
   * import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(GoalCompletionClaimsReader.layerTest(GoalCompletionClaims.make({})))) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (claims: GoalCompletionClaims): Layer.Layer<GoalCompletionClaimsReader> =>
    Layer.succeed(GoalCompletionClaimsReader, {
      read: Effect.fn("GoalCompletionClaimsReader.layerTest.read")(() => Effect.succeed(claims)),
    });
}

/**
 * Reads completion claims through a provided {@link GoalCompletionClaimsReader}, or the live reader.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGoalCompletionClaims } from "@beep/repo-cli/commands/Goals/RedAttribution"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readGoalCompletionClaims("/repo", "demo", 2966))) // true
 * ```
 *
 * @param root - Repository root.
 * @param slug - Packet slug under `goals/`.
 * @param finalPullRequest - The final whose claims to collect.
 * @param scope - Which decision files to collect; `checkout` by default.
 * @returns The committed claims and the preview.
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionClaims = Effect.fn("Goals.readGoalCompletionClaims")(function* (
  root: string,
  slug: string,
  finalPullRequest: number,
  scope: GoalClaimScope = "checkout"
) {
  const supplied = yield* Effect.serviceOption(GoalCompletionClaimsReader);
  const reader = O.isSome(supplied) ? supplied.value : yield* makeGoalCompletionClaimsReader;
  return yield* reader.read(root, slug, finalPullRequest, scope);
});
