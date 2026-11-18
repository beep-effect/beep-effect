// The test side of the checkout-subject rule (goals/prunable-product-leaves, seam 1): a test that
// reads a real repository file skips, naming what is missing, only when the checkout lacks the
// packet or workspace the file belongs to. In a checkout that holds every subject it is a no-op,
// so the test's assertions run exactly as strict as before.

import {
  absentCheckoutSubjects,
  absentCheckoutSubjectsNote,
  loadCheckoutInventory,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import type { CheckoutInventory, CheckoutSubject } from "@beep/repo-cli-kit/CheckoutSubject";

/** The part of a Vitest test context that marks the running test skipped. */
type Skippable = { readonly skip: (note?: string) => void };

/** The current checkout's packets and workspaces, read through the ambient file system. */
export const currentCheckoutInventory = Effect.gen(function* () {
  const root = yield* findRepoRoot();
  return yield* loadCheckoutInventory(root);
});

/** The real checkout's inventory, for tests whose ambient file system is an in-memory one. */
export class CurrentCheckout extends Context.Service<CurrentCheckout, CheckoutInventory>()(
  "@beep/repo-cli/test/support/CheckoutSkip/CurrentCheckout"
) {}

/** Reads {@link CurrentCheckout} once from the real file system. */
export const CurrentCheckoutLive = Layer.effect(CurrentCheckout, currentCheckoutInventory).pipe(
  Layer.provide(NodeServices.layer)
);

/**
 * Skip the running test when `absent` names any subject, with a note naming each one. Vitest's
 * skip throws, so the test stops here; with nothing absent it returns and the test runs on.
 */
export const skipWhenAbsent: {
  (absent: ReadonlyArray<CheckoutSubject>): (ctx: Skippable) => void;
  (ctx: Skippable, absent: ReadonlyArray<CheckoutSubject>): void;
} = dual(2, (ctx: Skippable, absent: ReadonlyArray<CheckoutSubject>): void => {
  if (A.isReadonlyArrayNonEmpty(absent)) {
    ctx.skip(absentCheckoutSubjectsNote(absent));
  }
});

/** Skip the running test when the checkout lacks one of `subjects`. */
export const skipUnlessCheckoutHolds: {
  (inventory: CheckoutInventory, subjects: ReadonlyArray<CheckoutSubject>): (ctx: Skippable) => void;
  (ctx: Skippable, inventory: CheckoutInventory, subjects: ReadonlyArray<CheckoutSubject>): void;
} = dual(3, (ctx: Skippable, inventory: CheckoutInventory, subjects: ReadonlyArray<CheckoutSubject>): void =>
  skipWhenAbsent(ctx, absentCheckoutSubjects(inventory, subjects))
);
