import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Reviewer } from "../Party.bindings.ts";
import { partyRuntime } from "../Party.runtime.ts";
import { initial, type Intent, Message, type Screen, update } from "./ClaimReview.machine.ts";

/**
 * The live claim review: the screen state, a way to send it a message, and
 * the Approve action, which mints a fresh command id.
 *
 * @category models
 * @since 0.0.0
 */
export interface ClaimReviewController {
  readonly screen: SubscriptionRef.SubscriptionRef<Screen>;
  readonly dispatch: (message: Message) => Effect.Effect<void>;
  readonly approve: Effect.Effect<void>;
}

/**
 * Run the claim review machine for one claim, for the life of the scope: it
 * follows the view's subscription and executes the machine's intents through
 * the generated bindings, feeding each result back as a message.
 *
 * **Details**
 *
 * The controller holds no law of its own: `update` decides, the controller
 * only executes. Each intent runs in its own fiber in the controller's
 * scope, so a slow read never blocks the next message.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimReviewController = Effect.fnUntraced(function* (claim: ClaimId) {
  const screen = yield* SubscriptionRef.make(initial(claim));
  const scope = yield* Effect.scope;
  const services = yield* Effect.context<Effect.Services<ReturnType<typeof Reviewer.ClaimReview.read>>>();

  const execute = (intent: Intent): Effect.Effect<void> =>
    Match.value(intent).pipe(
      Match.tagsExhaustive({
        Approve: ({ commandId, digest, evidenceRevision }) =>
          Reviewer.ApproveProposal.send({ target: claim, input: { digest, evidenceRevision }, commandId }).pipe(
            Effect.flatMap((outcome) =>
              dispatch(
                Match.value(outcome).pipe(
                  Match.tagsExhaustive({
                    Accepted: ({ receipt }) => Message.cases.Accepted.make({ commandId, receipt }),
                    Rejected: ({ rejection }) => Message.cases.Rejected.make({ commandId, reason: rejection._tag }),
                    Denied: ({ reason }) => Message.cases.Denied.make({ commandId, reason }),
                    Unknown: () => Message.cases.Unknown.make({ commandId }),
                  }),
                ),
              ),
            ),
          ),
        ReadAfterWrite: ({ commandId, receipt }) =>
          Reviewer.ClaimReview.read(claim, receipt).pipe(
            Effect.flatMap((read) =>
              dispatch(Message.cases.CaughtUp.make({ commandId, review: read.state, revision: read.revision })),
            ),
            // A read that timed out leaves the approval committed and not yet seen; the next snapshot shows it.
            Effect.ignore,
          ),
      }),
      Effect.provide(services),
    );

  const dispatch = (message: Message): Effect.Effect<void> =>
    SubscriptionRef.modify(screen, (current) => {
      const [next, intents] = update(current, message);
      return [intents, next];
    }).pipe(Effect.flatMap((intents) => Effect.forEach(intents, (intent) => Effect.forkIn(execute(intent), scope), { discard: true })));

  yield* Effect.forkIn(
    Reviewer.ClaimReview.subscribe(claim).pipe(
      Stream.runForEach((snapshot) =>
        dispatch(Message.cases.Snapshot.make({ review: snapshot.state, revision: snapshot.revision, epoch: snapshot.epoch })),
      ),
      Effect.ignore,
    ),
    scope,
  );

  const approve = Effect.flatMap(Effect.service(SecureRandom.SecureRandom), (random) => random.uuidV4()).pipe(
    Effect.flatMap((commandId) => dispatch(Message.cases.ApproveClicked.make({ commandId }))),
    Effect.provide(services),
  );

  return { screen, dispatch, approve } satisfies ClaimReviewController;
});

/**
 * One controller per claim, alive while a screen reads it.
 *
 * @category atoms
 * @since 0.0.0
 */
export const claimReviewController = Atom.family((claim: ClaimId) => partyRuntime.atom(makeClaimReviewController(claim)));

/**
 * The claim review screen state, as the controller publishes it.
 *
 * @category atoms
 * @since 0.0.0
 */
export const claimReviewScreen = Atom.family((claim: ClaimId) =>
  partyRuntime.atom((get) =>
    Stream.unwrap(
      Effect.map(get.result(claimReviewController(claim)), (controller) =>
        Stream.concat(Stream.fromEffect(SubscriptionRef.get(controller.screen)), SubscriptionRef.changes(controller.screen)),
      ),
    ),
  ),
);

/**
 * Press Approve on the claim's current proposal.
 *
 * @category atoms
 * @since 0.0.0
 */
export const approveClaim = Atom.family((claim: ClaimId) =>
  partyRuntime.fn<void>()((_, get) =>
    Effect.flatMap(get.result(claimReviewController(claim)), (controller) => controller.approve),
  ),
);
