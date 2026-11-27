import * as Effect from "effect/Effect";
import { wrapError } from "../PlaywrightError.ts";
import type { PlaywrightError } from "../PlaywrightError.ts";

/** @internal */
export const useHelper =
  <Wrap>(api: Wrap) =>
  <A>(userFunction: (api: Wrap) => Promise<A>): Effect.Effect<A, PlaywrightError> =>
    Effect.tryPromise({ try: () => userFunction(api), catch: wrapError });
