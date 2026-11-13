/**
 * Decisions for two-layer native GitHub stacks in Yeet.
 *
 * **Details**
 *
 * The pure half of stack support: whether a lane may publish a layer on a
 * parent pull request, what one merge request from a pull request would merge,
 * and which branch's ruleset governs a layer. The publish path, the ready gate
 * and the merge gate read GitHub and call these; nothing here pushes, links or
 * merges.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { GithubRest } from "../../../internal/github/GithubRest.ts";
import {
  YEET_STACK_LAYER_CAP,
  YeetStackLayer,
  YeetStackMergeScope,
  YeetStackPublishDecision,
  YeetTrunkHealth,
} from "./Stack.schemas.ts";
import type {
  GithubPullRequestRecord,
  GithubStackLayerRecord,
  GithubStackRecord,
} from "../../../internal/github/GithubRest.ts";
import type { YeetStackPublishFacts, YeetStackPublishRefusal } from "./Stack.schemas.ts";

const shortSha = Str.slice(0, 10);

/**
 * The branch whose ruleset governs a pull request: the stack's trunk for a
 * layer, the pull request's own base otherwise.
 *
 * **Details**
 *
 * An upper layer's base ref is the branch of the layer below, which no ruleset
 * targets. GitHub evaluates the trunk's rules when the stack merges, so a gate
 * that read the base ref would find no required contexts and hold forever.
 *
 * **Example** (Reference the helper)
 *
 * ```ts
 * import { yeetStackRulesBranch } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetStackRulesBranch) // "function"
 * ```
 *
 * @param pull - The pull request the gate reads.
 * @returns The branch name to read rules for.
 * @category accessors
 * @since 0.0.0
 */
export const yeetStackRulesBranch = (pull: GithubPullRequestRecord): string =>
  O.match(pull.stack, { onNone: () => pull.baseRef, onSome: (stack) => stack.baseRef });

const refuse = (reason: YeetStackPublishRefusal, detail: string): YeetStackPublishDecision =>
  YeetStackPublishDecision.cases.Refused.make({ reason, detail });

const refuseWhen = (
  condition: boolean,
  reason: YeetStackPublishRefusal,
  detail: string
): O.Option<YeetStackPublishDecision> => (condition ? O.some(refuse(reason, detail)) : O.none());

const asLayer = (
  facts: YeetStackPublishFacts,
  stackNumber: O.Option<number>,
  parentMoved: boolean
): YeetStackPublishDecision =>
  YeetStackPublishDecision.cases.Layer.make({
    parentNumber: facts.parent.number,
    parentHeadRef: facts.parent.headRef,
    parentHeadSha: facts.parent.headSha,
    trunk: facts.trunk,
    stackNumber,
    parentMoved,
  });

// Refusals that depend on the parent alone, whatever this branch has published.
const parentRefusal = ({ branch, parent, trunk }: YeetStackPublishFacts): O.Option<YeetStackPublishDecision> =>
  O.firstSomeOf([
    refuseWhen(parent.headRef === branch, "parent-is-self", `#${parent.number} is this branch's own pull request`),
    refuseWhen(
      parent.merged || parent.state !== "open",
      "parent-not-open",
      `#${parent.number} is ${parent.merged ? "merged" : "closed"}; publish on ${trunk} without --stack-on`
    ),
    refuseWhen(
      parent.baseRef !== trunk,
      "parent-off-trunk",
      `#${parent.number} targets ${parent.baseRef}, not ${trunk}; a stack holds ${YEET_STACK_LAYER_CAP} layers at most`
    ),
  ]);

const trunkRefusal = (health: O.Option<YeetTrunkHealth>, trunk: string): O.Option<YeetStackPublishDecision> =>
  O.match(health, {
    onNone: () => O.some(refuse("trunk-unknown", `${trunk}'s required checks were not read`)),
    onSome: YeetTrunkHealth.match({
      Green: () => O.none(),
      Red: ({ contexts, sha }) =>
        O.some(
          refuse(
            "trunk-red",
            `${trunk}'s required checks are red at ${shortSha(sha)} (${A.join(contexts, ", ")}); open a stack only on a green trunk`
          )
        ),
      Unknown: ({ detail }) => O.some(refuse("trunk-unknown", `${trunk}'s required checks are unknown: ${detail}`)),
    }),
  });

// This branch has no pull request yet: every precondition for opening a stack applies.
const newLayerDecision = (facts: YeetStackPublishFacts): YeetStackPublishDecision =>
  pipe(
    O.firstSomeOf([
      O.map(facts.parent.stack, (stack) =>
        refuse(
          "parent-stacked",
          `#${facts.parent.number} is already layer ${stack.position} of stack #${stack.number}; a stack holds ${YEET_STACK_LAYER_CAP} layers at most`
        )
      ),
      refuseWhen(
        !facts.builtOnParent,
        "not-built-on-parent",
        `#${facts.parent.number}'s head ${shortSha(facts.parent.headSha)} is not an ancestor of HEAD; merge origin/${facts.parent.headRef} into this branch first`
      ),
      trunkRefusal(facts.trunkHealth, facts.trunk),
    ]),
    O.getOrElse(() => asLayer(facts, O.none(), false))
  );

// This branch already has a pull request: a later publish of the same layer, or
// a link that failed after the create. The stack is open, so trunk health and
// ancestry no longer refuse; a parent that moved is reported, not refused.
const existingLayerDecision = (
  facts: YeetStackPublishFacts,
  existing: GithubPullRequestRecord
): YeetStackPublishDecision => {
  const { parent } = facts;
  return existing.baseRef !== parent.headRef
    ? refuse(
        "existing-base-mismatch",
        `#${existing.number} targets ${existing.baseRef}, not #${parent.number}'s branch ${parent.headRef}; Yeet does not retarget a pull request`
      )
    : O.match(existing.stack, {
        onSome: (own) =>
          O.exists(parent.stack, (stack) => stack.number === own.number)
            ? asLayer(facts, O.some(own.number), !facts.builtOnParent)
            : refuse("stack-mismatch", `#${existing.number} is in stack #${own.number} and #${parent.number} is not`),
        onNone: () =>
          O.match(parent.stack, {
            onSome: (stack) =>
              refuse(
                "parent-stacked",
                `#${parent.number} is already in stack #${stack.number}, which does not hold #${existing.number}`
              ),
            onNone: () => asLayer(facts, O.none(), !facts.builtOnParent),
          }),
      });
};

/**
 * Decide whether a lane may publish its branch as a layer on a parent.
 *
 * **Details**
 *
 * The parent must be open, on the trunk and not this branch's own. A branch
 * with no pull request yet opens a stack, so the parent must be unstacked, the
 * branch must contain the parent's head, and the trunk's required checks must
 * be green. A branch that already has its pull request on the parent's branch
 * keeps publishing: it is linked when it is not yet, and a parent that moved
 * since is flagged for the merge gate instead of refused.
 *
 * **Example** (A merged parent refuses)
 *
 * ```ts
 * import { decideYeetStackPublish } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof decideYeetStackPublish) // "function"
 * ```
 *
 * @param facts - The parent, this branch's own pull request, ancestry and trunk health.
 * @returns Publish as a layer, or refuse with the first unmet precondition.
 * @category decisions
 * @since 0.0.0
 */
export const decideYeetStackPublish = (facts: YeetStackPublishFacts): YeetStackPublishDecision =>
  pipe(
    parentRefusal(facts),
    O.getOrElse(() =>
      O.match(facts.existing, {
        onNone: () => newLayerDecision(facts),
        onSome: (existing) => existingLayerDecision(facts, existing),
      })
    )
  );

/**
 * Render a refused layer publish as the sentence the command fails with.
 *
 * **Example** (Render a refusal)
 *
 * ```ts
 * import { renderYeetStackPublishRefusal } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetStackPublishRefusal("parent-not-open", "#41 is merged"))
 * // "--stack-on refused (parent-not-open): #41 is merged"
 * ```
 *
 * @param reason - The unmet precondition.
 * @param detail - What was observed.
 * @returns The rendered sentence.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetStackPublishRefusal: {
  (reason: YeetStackPublishRefusal, detail: string): string;
  (detail: string): (reason: YeetStackPublishRefusal) => string;
} = dual(2, (reason: YeetStackPublishRefusal, detail: string): string => `--stack-on refused (${reason}): ${detail}`);

interface PositionedLayer {
  readonly layer: GithubStackLayerRecord;
  readonly position: number;
}

const isOpenLayer = ({ layer }: PositionedLayer): boolean => !layer.merged && layer.state === "open";

const toStackLayer = ({ layer, position }: PositionedLayer): YeetStackLayer =>
  YeetStackLayer.make({ number: layer.number, position, headRef: layer.headRef, headSha: layer.headSha });

const positioned = (stack: GithubStackRecord): ReadonlyArray<PositionedLayer> =>
  A.map(stack.layers, (layer, index) => ({ layer, position: index + 1 }));

/**
 * Decide what one merge request for a pull request in a stack would merge.
 *
 * **Details**
 *
 * Merged and closed layers are ignored: GitHub keeps them in the stack and
 * never renumbers. With the pull request itself, more than
 * {@link YEET_STACK_LAYER_CAP} open layers is `TooDeep`. Otherwise an open
 * layer above it is `BelowTop`, an open layer below it is `Group`, and neither
 * is `Single`.
 *
 * **Example** (Reference the decision)
 *
 * ```ts
 * import { decideYeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof decideYeetStackMergeScope) // "function"
 * ```
 *
 * @param pullNumber - The pull request the caller wants merged.
 * @param stack - The stack GitHub lists it in.
 * @returns One pull request, a two-layer group, or the layout the gate holds on.
 * @category decisions
 * @since 0.0.0
 */
export const decideYeetStackMergeScope: {
  (pullNumber: number, stack: GithubStackRecord): YeetStackMergeScope;
  (stack: GithubStackRecord): (pullNumber: number) => YeetStackMergeScope;
} = dual(2, (pullNumber: number, stack: GithubStackRecord): YeetStackMergeScope => {
  const layers = positioned(stack);
  return pipe(
    A.findFirst(layers, ({ layer }) => layer.number === pullNumber),
    O.match({
      onNone: () =>
        YeetStackMergeScope.cases.Unknown.make({
          stackNumber: stack.number,
          detail: `stack #${stack.number} does not list #${pullNumber}`,
        }),
      onSome: (own) => {
        const others = A.filter(layers, (entry) => entry.position !== own.position && isOpenLayer(entry));
        const below = A.filter(others, (entry) => entry.position < own.position);
        const above = A.filter(others, (entry) => entry.position > own.position);
        const openLayers = A.length(others) + 1;
        return openLayers > YEET_STACK_LAYER_CAP
          ? YeetStackMergeScope.cases.TooDeep.make({ stackNumber: stack.number, openLayers })
          : pipe(
              A.head(above),
              O.map(
                (upper): YeetStackMergeScope =>
                  YeetStackMergeScope.cases.BelowTop.make({ stackNumber: stack.number, upper: toStackLayer(upper) })
              ),
              O.orElse(() =>
                O.map(
                  A.last(below),
                  (lower): YeetStackMergeScope =>
                    YeetStackMergeScope.cases.Group.make({
                      stackNumber: stack.number,
                      trunk: stack.baseRef,
                      lower: toStackLayer(lower),
                      top: toStackLayer(own),
                    })
                )
              ),
              O.getOrElse((): YeetStackMergeScope => YeetStackMergeScope.cases.Single.make({}))
            );
      },
    })
  );
});

/**
 * The open layer directly below a pull request in its stack, if any.
 *
 * **Details**
 *
 * A later publish of an upper layer reads this to find its parent without the
 * lane repeating `--stack-on`. Once the layer below merges there is none, and
 * the pull request publishes on the trunk like any other.
 *
 * **Example** (Reference the accessor)
 *
 * ```ts
 * import { yeetStackParentLayer } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetStackParentLayer) // "function"
 * ```
 *
 * @param pullNumber - The upper layer's pull request.
 * @param stack - The stack GitHub lists it in.
 * @returns The nearest open layer below it.
 * @category accessors
 * @since 0.0.0
 */
export const yeetStackParentLayer: {
  (pullNumber: number, stack: GithubStackRecord): O.Option<YeetStackLayer>;
  (stack: GithubStackRecord): (pullNumber: number) => O.Option<YeetStackLayer>;
} = dual(2, (pullNumber: number, stack: GithubStackRecord): O.Option<YeetStackLayer> => {
  const layers = positioned(stack);
  return pipe(
    A.findFirst(layers, ({ layer }) => layer.number === pullNumber),
    O.flatMap((own) => A.findLast(layers, (entry) => entry.position < own.position && isOpenLayer(entry))),
    O.map(toStackLayer)
  );
});

/**
 * Read what one merge request for a pull request would merge.
 *
 * **Details**
 *
 * A pull request outside a stack is `Single` without a request. A stacked one
 * costs one `GET stacks/{n}`. A failed read stays a `GitHubError`: the caller
 * holds, it never assumes `Single`.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readYeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetStackMergeScope) // "function"
 * ```
 *
 * @param pull - The pull request the caller wants merged.
 * @returns `Single` without a request for an unstacked pull request, else the scope its stack gives it.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetStackMergeScope = Effect.fn("Yeet.readStackMergeScope")(function* (pull: GithubPullRequestRecord) {
  const rest = yield* GithubRest;
  return yield* O.match(pull.stack, {
    onNone: () => Effect.succeed<YeetStackMergeScope>(YeetStackMergeScope.cases.Single.make({})),
    onSome: (ref) => Effect.map(rest.stack(ref.number), (stack) => decideYeetStackMergeScope(pull.number, stack)),
  });
});
