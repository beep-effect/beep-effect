import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";
// The one way an unstubbed test-double member dies, for every `makeTest` in
// this package.
//
// A double's unstubbed member must die rather than silently succeed — a stub
// that returns nothing teaches a test that nothing happened. The message names
// the double, the member and the override that fixes it, and it is spelled
// here once so a wording change is one edit rather than ten.

import * as Effect from "effect/Effect";

const $I = $ScratchpadId.create("effected/github-actions/internal/unstubbed");

/** A test-double member was called without an override. */
export class UnstubbedMemberError extends S.TaggedError<UnstubbedMemberError>($I`UnstubbedMemberError`)("UnstubbedMemberError", {
	message: S.String,
}, $I.annote("UnstubbedMemberError", { description: "A test-double member was called without an override." })) {}

/**
 * The die-on-call members of `<double>.makeTest`: `dies("save")` is an
 * `Effect` that defects naming `save` when run. Each package double binds its
 * own name once, then lists its members.
 *
 * @internal
 */
export const unstubbed =
	(double: string) =>
	(member: string): Effect.Effect<never> =>
		Effect.sync(() => {
			throw UnstubbedMemberError.make({ message: `${double}: ${member}() was called but not stubbed — pass a \`${member}\` override.` });
		});
