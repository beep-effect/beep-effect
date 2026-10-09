// The one way an unstubbed test-double member dies, for every `makeTest` in
// this package.
//
// A double's unstubbed member must die rather than silently succeed — a stub
// that returns nothing teaches a test that nothing happened. The message names
// the double, the member and the override that fixes it, and it is spelled
// here once so a wording change is one edit rather than ten.

import { Effect } from "effect";

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
			throw new Error(`${double}: ${member}() was called but not stubbed — pass a \`${member}\` override.`);
		});
