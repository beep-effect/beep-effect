// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/wrappers.ts. Pure: no process reads.
/**
 * Terminal multiplexer detection for the OSC 8 hyperlink decision.
 *
 * **Details**
 *
 * tmux and GNU screen strip OSC 8 unless configured otherwise, and that configuration cannot be read without a
 * subprocess, so a detected multiplexer always reports that it does not pass hyperlinks through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RuntimeEnvId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { Env } from "../types.ts";

const $I = $RuntimeEnvId.create("internal/osc8/wrappers");

/**
 * Describe multiplexer info when a wrapper is detected.
 *
 * **Example** (Validate a detected multiplexer)
 *
 * ```ts
 * import { WrapperInfo } from "@beep/runtime-env/internal/osc8/wrappers"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(WrapperInfo)({ name: "tmux", passesThrough: false })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class WrapperInfo extends S.Opaque<WrapperInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.Literals(["tmux", "screen"]).pipe(
      $I.annoteKey("WrapperInfo.name", { description: "The detected multiplexer name." })
    ),
    /**
     * Whether the wrapper passes OSC8 through to the outer terminal. We
     * conservatively report `false` since we cannot verify without spawning.
     */
    passesThrough: S.Boolean.pipe(
      $I.annoteKey("WrapperInfo.passesThrough", {
        description:
          "Whether the wrapper passes OSC8 through to the outer terminal. Conservatively false without subprocess verification.",
      })
    ),
  }).pipe($I.annoteSchema("WrapperInfo", { description: "Multiplexer info, when detected." }))
) {}

const isSet = (value: string | undefined): boolean => value !== undefined && value !== "";

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
 * import { detectWrapper } from "@beep/runtime-env/internal/osc8/wrappers"
 * import * as O from "effect/Option"
 *
 * const wrapper = detectWrapper({ TMUX: "/tmp/tmux-1000/default,1,0" })
 * console.log(O.getOrNull(O.map(wrapper, (info) => info.name))) // tmux
 * console.log(O.isNone(detectWrapper({}))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const detectWrapper = (env: Env): O.Option<WrapperInfo> => {
  if (isSet(env.TMUX)) return WrapperInfo.makeOption({ name: "tmux", passesThrough: false });
  if (isSet(env.STY)) return WrapperInfo.makeOption({ name: "screen", passesThrough: false });
  return O.none();
};
