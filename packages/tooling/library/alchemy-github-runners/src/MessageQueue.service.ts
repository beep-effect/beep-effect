/**
 * SQS send contract of the runner fleet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type { AwsApiError } from "./RunnerFleet.errors.ts";

const $I = $AlchemyGithubRunnersId.create("MessageQueue.service");

/**
 * Sends one message to a queue, optionally delayed (0-900 seconds).
 *
 * **Example** (Send now)
 *
 * ```ts
 * import { MessageQueue } from "@beep/alchemy-github-runners/MessageQueue.service"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* MessageQueue
 *   yield* queue.send({ queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q", body: "{}", delaySeconds: O.none() })
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MessageQueue extends Context.Service<
  MessageQueue,
  {
    readonly send: (input: {
      readonly queueUrl: string;
      readonly body: string;
      readonly delaySeconds: O.Option<number>;
    }) => Effect.Effect<void, AwsApiError>;
  }
>()($I`MessageQueue`) {}
