// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/wrappers.ts. Pure: no process reads.
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type { Env } from "../types.ts";

const $I = $ScratchpadId.create("effected/env/internal/osc8/wrappers");

/**
 * Describe multiplexer info when a wrapper is detected.
 *
 * **Example** (Validate a detected multiplexer)
 *
 * ```ts
 * import { WrapperInfo } from "@beep/scratchpad/effected/env/internal/osc8/wrappers"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(WrapperInfo)({ name: "tmux", passesThrough: false })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WrapperInfo = S.Struct({
	name: S.Literals(["tmux", "screen"]).pipe($I.annoteKey("WrapperInfo.name", { description: "The detected multiplexer name." })),
	/**
	 * Whether the wrapper passes OSC8 through to the outer terminal. We
	 * conservatively report `false` since we cannot verify without spawning.
	 */
	passesThrough: S.Boolean.pipe($I.annoteKey("WrapperInfo.passesThrough", { description: "Whether the wrapper passes OSC8 through to the outer terminal. Conservatively false without subprocess verification." })),
}).annotate($I.annote("WrapperInfo", { description: "Multiplexer info, when detected." }));
/**
 * The decoded multiplexer name and OSC8 passthrough flag.
 *
 * @see {@link WrapperInfo} for the runtime wrapper schema.
 * @category type-level
 * @since 0.0.0
 */
export type WrapperInfo = typeof WrapperInfo.Type;
/**
 * Detect a multiplexer wrapper from the supplied environment snapshot.
 *
 * **Details**
 *
 * A non-empty `TMUX` value takes precedence over a non-empty `STY` value.
 * Users who know their tmux ≥ 3.4 has `set -g allow-passthrough on` can
 * opt back in via FORCE_HYPERLINK=1.
 *
 * **Gotchas**
 *
 * Conservative — `passesThrough` is always `false` because we cannot verify version or config without
 * spawning a subprocess, which this package never does.
 *
 * **Example** (Detect tmux without assuming passthrough)
 *
 * ```ts
 * import { detectWrapper } from "@beep/scratchpad/effected/env/internal/osc8/wrappers"
 *
 * const wrapper = detectWrapper({ TMUX: "/tmp/tmux-1000/default,1,0" })
 * console.log(wrapper?.name) // tmux
 * console.log(wrapper?.passesThrough) // false
 * console.log(detectWrapper({})) // null
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const detectWrapper = (env: Env): WrapperInfo | null => {
	if ((env.TMUX ?? "") !== "") return { name: "tmux", passesThrough: false };
	if ((env.STY ?? "") !== "") return { name: "screen", passesThrough: false };
	return null;
};
