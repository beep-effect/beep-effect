/**
 * Publish a branch as the upper layer of a two-layer native GitHub stack.
 *
 * **Details**
 *
 * `yeet publish --stack-on <pr>` and `yeet open --stack-on <pr>` open the
 * branch's pull request on the parent pull request's branch and link the two
 * through `POST /repos/{owner}/{repo}/stacks`. A branch whose open pull request
 * is already a stacked layer publishes the same way without the flag. The
 * layer is resolved before anything is committed or pushed, so a refusal
 * changes nothing; `--base` stays the trunk everywhere.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { GithubRest, GithubStackLinkOutcome } from "../../../internal/github/GithubRest.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { buildYeetGhLogin, yeetGithubFailure } from "./GhOps.ts";
import { refreshBaseRef } from "./GitExec.ts";
import { originPushOwner, resolveDefaultBranchViaRest } from "./PullRequest.ts";
import { YeetStackPublishDecision, YeetStackPublishFacts } from "./Stack.schemas.ts";
import { decideYeetStackPublish, renderYeetStackPublishRefusal, yeetStackParentLayer } from "./Stack.ts";
import { readYeetTrunkHealth } from "./StackTrunk.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubPullRequestRecord, GithubStackRecord } from "../../../internal/github/GithubRest.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetRunOptions } from "../Yeet.schemas.ts";
import type { YeetGithubServices } from "./GhOps.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/StackPublish");

const shortSha = Str.slice(0, 10);

const STACK_CREATE_COMMAND = "gh api -X POST repos/{owner}/{repo}/stacks";

/**
 * The `Layer` case of a layer-publish decision: the parent a branch publishes
 * on, the trunk its stack lands on, and whether the two are already linked.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackLayerDecision = typeof YeetStackPublishDecision.cases.Layer.Type;

/**
 * The stack layer the current publish runs as, `Option.none()` (the default)
 * for an ordinary trunk publish.
 *
 * **Details**
 *
 * The publish path resolves the layer once, before its commit, and provides it
 * to the phases after the commit, so the pull-request tail opens the pull
 * request on the parent's branch and links it without every phase between
 * passing the decision along.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { YeetPublishStackLayer } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(Effect.runSync(Effect.service(YeetPublishStackLayer)))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const YeetPublishStackLayer: Context.Reference<O.Option<YeetStackLayerDecision>> = Context.Reference(
  $I`YeetPublishStackLayer`,
  { defaultValue: O.none<YeetStackLayerDecision> }
);

// This branch's open pull request, read by the head the checkout pushes.
const readOwnPullRequest = Effect.fn("Yeet.readStackOwnPullRequest")(function* (context: RepoRunContext) {
  const headOwner = yield* originPushOwner(context);
  const pull = yield* GithubRest.use((rest) => rest.openPullRequestForBranch(headOwner, context.branch)).pipe(
    Effect.mapError(yeetGithubFailure(`gh api repos/{owner}/{repo}/pulls?head=${headOwner}:${context.branch}`))
  );
  return O.filter(pull, (record) => record.state === "open" && record.headRef === context.branch);
});

// The open layer directly below a stacked pull request, which a later publish
// of that layer builds on without repeating --stack-on.
const inferStackParent = (own: GithubPullRequestRecord) =>
  O.match(own.stack, {
    onNone: () => Effect.succeedNone,
    onSome: (ref) =>
      GithubRest.use((rest) => rest.stack(ref.number)).pipe(
        Effect.mapBoth({
          onFailure: yeetGithubFailure(`gh api repos/{owner}/{repo}/stacks/${ref.number}`),
          onSuccess: (stack) => O.map(yeetStackParentLayer(own.number, stack), (layer) => layer.number),
        })
      ),
  });

interface StackParentRead {
  readonly own: O.Option<GithubPullRequestRecord>;
  readonly parentNumber: O.Option<number>;
}

// The flag names the parent and every read must succeed; without it the parent
// is inferred, and a failed read leaves an ordinary trunk publish.
const readStackParent = (context: RepoRunContext, stackOn: O.Option<number>) =>
  O.match(stackOn, {
    onSome: (parentNumber) =>
      Effect.map(readOwnPullRequest(context), (own): StackParentRead => ({ own, parentNumber: O.some(parentNumber) })),
    onNone: () =>
      readOwnPullRequest(context).pipe(
        Effect.flatMap((own) =>
          Effect.map(
            O.match(own, { onNone: () => Effect.succeedNone, onSome: inferStackParent }),
            (parentNumber): StackParentRead => ({ own, parentNumber })
          )
        ),
        Effect.catch((error) =>
          Effect.as(
            Console.error(
              `[yeet] warning: could not read whether ${context.branch} is a stack layer; publishing on the trunk: ${error.message}`
            ),
            { own: O.none(), parentNumber: O.none() } satisfies StackParentRead
          )
        )
      ),
  });

const announceLayer = (context: RepoRunContext, layer: YeetStackLayerDecision) =>
  Effect.andThen(
    Console.log(
      `[yeet] --stack-on: publishing ${context.branch} as a layer on #${layer.parentNumber} (${layer.parentHeadRef} @ ${shortSha(layer.parentHeadSha)}), trunk ${layer.trunk}`
    ),
    layer.parentMoved
      ? Console.error(
          `[yeet] warning: --stack-on: #${layer.parentNumber}'s head ${shortSha(layer.parentHeadSha)} is not in HEAD; merge origin/${layer.parentHeadRef} into this branch, or the merge gate holds the stack`
        )
      : Effect.void
  );

/**
 * Resolve whether this publish runs as a stack layer, and on which parent.
 *
 * **Details**
 *
 * The parent is `stackOn`, else the open layer below this branch's open pull
 * request when that pull request is already stacked; with neither, the
 * publish is an ordinary trunk publish (`Option.none()`). Without `stackOn` a
 * failed read is reported on one line and leaves a trunk publish.
 *
 * Once a parent is known this reads it and the trunk, fetches
 * `origin/<parent branch>` (best effort), checks that the parent's head is an
 * ancestor of `HEAD`, and, only for a branch with no pull request yet, reads
 * the trunk's health. A refused decision fails, so nothing is committed or
 * pushed.
 *
 * **Example** (Resolve a layer on #41)
 *
 * ```ts
 * import { RepoRunContext, resolveYeetStackPublish } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/child",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const layer = resolveYeetStackPublish(context, O.some(41))
 * console.log(Effect.isEffect(layer)) // true
 * ```
 *
 * @param context - The checkout and branch being published.
 * @param stackOn - The `--stack-on` pull request, if given.
 * @returns The layer decision, or none for a trunk publish.
 * @category workflows
 * @since 0.0.0
 */
export const resolveYeetStackPublish = Effect.fn("Yeet.resolveStackPublish")(function* (
  context: RepoRunContext,
  stackOn: O.Option<number>
): Effect.fn.Return<
  O.Option<YeetStackLayerDecision>,
  YeetCommandError,
  YeetGithubServices | Git | ChildProcessSpawner.ChildProcessSpawner
> {
  const { own, parentNumber } = yield* readStackParent(context, stackOn);
  if (O.isNone(parentNumber)) return O.none();
  const parent = yield* GithubRest.use((rest) => rest.pullRequest(parentNumber.value)).pipe(
    Effect.mapError(yeetGithubFailure(`gh api repos/{owner}/{repo}/pulls/${parentNumber.value}`))
  );
  const trunk = yield* resolveDefaultBranchViaRest();
  yield* refreshBaseRef(context.repoRoot, `origin/${parent.headRef}`).pipe(
    Effect.catch((error) =>
      Console.error(`[yeet] warning: --stack-on: could not fetch origin/${parent.headRef}: ${error.message}`)
    )
  );
  const git = yield* Git;
  const builtOnParent = yield* git
    .isAncestor(context.repoRoot, parent.headSha, "HEAD")
    .pipe(Effect.orElseSucceed(() => false));
  // An existing layer's stack is already open, so only a new layer reads the trunk.
  const trunkHealth = yield* O.match(own, {
    onNone: () => Effect.asSome(readYeetTrunkHealth(context, trunk)),
    onSome: () => Effect.succeedNone,
  });
  const decision = decideYeetStackPublish(
    YeetStackPublishFacts.make({ branch: context.branch, trunk, parent, existing: own, builtOnParent, trunkHealth })
  );
  return yield* YeetStackPublishDecision.match(decision, {
    Refused: ({ reason, detail }) =>
      Effect.fail(
        YeetCommandError.make({ message: `yeet publish ${renderYeetStackPublishRefusal(reason, detail)}`, exitCode: 1 })
      ),
    Layer: (layer) => Effect.as(announceLayer(context, layer), O.some(layer)),
  });
});

/**
 * Resolve the stack layer a publish runs as, through the gh login.
 *
 * **Details**
 *
 * The publish path's entry to {@link resolveYeetStackPublish}. A publish with
 * no `--stack-on` and no pull request (`--no-pr`) reads nothing. Without the
 * flag, a gh login that cannot be built is reported on one line and leaves a
 * trunk publish, so an ordinary publish keeps failing where it always did.
 *
 * **Example** (A no-PR trunk publish reads nothing)
 *
 * ```ts
 * import { defaultYeetRunOptions, RepoRunContext, resolveYeetPublishStackLayer } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/child",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const layer = resolveYeetPublishStackLayer(context, defaultYeetRunOptions({ pr: false }))
 * console.log(Effect.isEffect(layer)) // true
 * ```
 *
 * @param context - The checkout and branch being published.
 * @param options - The run options carrying `stackOn` and `pr`.
 * @returns The layer decision, or none for a trunk publish.
 * @category workflows
 * @since 0.0.0
 */
export const resolveYeetPublishStackLayer = Effect.fn("Yeet.resolvePublishStackLayer")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  O.Option<YeetStackLayerDecision>,
  YeetCommandError,
  Git | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  if (O.isNone(options.stackOn) && !options.pr) return O.none();
  return yield* Effect.scoped(
    buildYeetGhLogin(context.repoRoot).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          O.isSome(options.stackOn)
            ? Effect.fail(error)
            : Effect.as(
                Console.error(
                  `[yeet] warning: could not read whether ${context.branch} is a stack layer; publishing on the trunk: ${error.message}`
                ),
                O.none<YeetStackLayerDecision>()
              ),
        onSuccess: (services) => Effect.provideContext(resolveYeetStackPublish(context, options.stackOn), services),
      })
    )
  );
});

const linkFailure = (parentNumber: number, childNumber: number, why: string): YeetCommandError =>
  YeetCommandError.make({
    message: `yeet could not link #${parentNumber} and #${childNumber} into a stack: ${why}. Pull request #${childNumber} is open; run the same command again to retry the link.`,
    command: STACK_CREATE_COMMAND,
    exitCode: 1,
  });

/**
 * Link a layer's pull request onto its parent as a two-layer native stack.
 *
 * **Details**
 *
 * One `POST /repos/{owner}/{repo}/stacks` with the parent first. GitHub
 * refuses with a sentence when the pair is out of order or either is already
 * stacked; that refusal, like a failed request, fails with the repair hint:
 * the pull request exists, so running the same publish again reuses it and
 * retries the link.
 *
 * **Example** (Link #42 onto #41)
 *
 * ```ts
 * import { linkYeetStackLayer } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(linkYeetStackLayer(41, 42))) // true
 * ```
 *
 * @param parentNumber - The parent pull request, the stack's bottom layer.
 * @param childNumber - The layer's pull request, on the parent's branch.
 * @returns The stack GitHub created.
 * @category workflows
 * @since 0.0.0
 */
export const linkYeetStackLayer = Effect.fn("Yeet.linkStackLayer")(function* (
  parentNumber: number,
  childNumber: number
): Effect.fn.Return<GithubStackRecord, YeetCommandError, GithubRest> {
  const outcome = yield* GithubRest.use((rest) => rest.createStack([parentNumber, childNumber])).pipe(
    Effect.mapError((error) => linkFailure(parentNumber, childNumber, `the request failed (${error.message})`))
  );
  return yield* GithubStackLinkOutcome.match(outcome, {
    Linked: ({ stack }) =>
      Effect.as(
        Console.log(`[yeet] --stack-on: linked #${parentNumber} and #${childNumber} as stack #${stack.number}`),
        stack
      ),
    Refused: ({ message }) => Effect.fail(linkFailure(parentNumber, childNumber, `GitHub answered "${message}"`)),
  });
});
