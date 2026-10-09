// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/wrappers.ts. Pure: no process reads.
import type { Env } from "../types.ts";

/** Multiplexer info, when detected. */
export interface WrapperInfo {
	readonly name: "tmux" | "screen";
	/**
	 * Whether the wrapper passes OSC8 through to the outer terminal. We
	 * conservatively report `false` since we cannot verify without spawning.
	 */
	readonly passesThrough: boolean;
}
/**
 * Detect a multiplexer wrapper from the env. Conservative — `passesThrough`
 * is always `false` because we cannot verify version or config without
 * spawning a subprocess, which this package never does.
 *
 * Users who know their tmux ≥ 3.4 has `set -g allow-passthrough on` can
 * opt back in via FORCE_HYPERLINK=1.
 */
export const detectWrapper = (env: Env): WrapperInfo | null => {
	if (env.TMUX) return { name: "tmux", passesThrough: false };
	if (env.STY) return { name: "screen", passesThrough: false };
	return null;
};
