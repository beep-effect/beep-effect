/**
 * Orb-background primitive: an animated glow backdrop with hue-family variants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Hue family for the glow; each tone maps to a base HSL hue that drives every orb layer.
 *
 * Adjacent layers are derived from that base by small hue offsets for depth.
 *
 * @example
 * ```ts
 * import type { OrbTone } from "@beep/ui/components/orb-background"
 *
 * const tone: OrbTone = "green"
 * console.log(tone)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
type OrbTone = "green" | "emerald" | "teal" | "sky" | "violet" | "amber" | "rose";

/**
 * Visual strength of the glow; controls per-orb alpha and lightness from a faint wash to a saturated bloom.
 *
 * @example
 * ```ts
 * import type { OrbIntensity } from "@beep/ui/components/orb-background"
 *
 * const intensity: OrbIntensity = "medium"
 * console.log(intensity)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
type OrbIntensity = "subtle" | "medium" | "vivid";

const TONE_HUE: Record<OrbTone, number> = {
  green: 138,
  emerald: 152,
  teal: 174,
  sky: 205,
  violet: 270,
  amber: 38,
  rose: 344,
};

const INTENSITY_ALPHA: Record<OrbIntensity, number> = {
  subtle: 0.28,
  medium: 0.44,
  vivid: 0.62,
};

const INTENSITY_LIGHTNESS: Record<OrbIntensity, number> = {
  subtle: 58,
  medium: 60,
  vivid: 63,
};

/**
 * A single orb layer descriptor. Sizes are percentages of the container so the
 * backdrop scales with whatever it fills; drift values feed the idle keyframe.
 */
interface OrbLayer {
  /** Relative alpha multiplier vs. the intensity base. */
  readonly alphaScale: number;
  readonly blur: number;
  readonly driftDelay: string;
  readonly driftDuration: string;
  readonly driftX: string;
  readonly driftY: string;
  readonly height: string;
  /** Hue offset applied on top of the tone's base hue. */
  readonly hueShift: number;
  readonly introDuration: string;
  readonly key: string;
  readonly left: string;
  readonly rotate: string;
  readonly top: string;
  readonly width: string;
}

const LAYERS: ReadonlyArray<OrbLayer> = [
  {
    key: "primary",
    hueShift: 0,
    alphaScale: 1,
    width: "62%",
    height: "78%",
    // `left` is the orb's left edge, so center ≈ left + width/2. These values
    // keep the three-orb bloom balanced around the horizontal middle.
    left: "19%",
    top: "-12%",
    rotate: "14deg",
    blur: 56,
    driftX: "-16px",
    driftY: "12px",
    introDuration: "2.4s",
    driftDuration: "16s",
    driftDelay: "0s",
  },
  {
    key: "secondary",
    hueShift: -18,
    alphaScale: 0.78,
    width: "52%",
    height: "70%",
    left: "7%",
    top: "-4%",
    rotate: "26deg",
    blur: 52,
    driftX: "14px",
    driftY: "-10px",
    introDuration: "2.8s",
    driftDuration: "22s",
    driftDelay: "0.4s",
  },
  {
    key: "accent",
    hueShift: 28,
    alphaScale: 0.6,
    width: "44%",
    height: "58%",
    left: "45%",
    top: "6%",
    rotate: "-12deg",
    blur: 60,
    driftX: "-10px",
    driftY: "-14px",
    introDuration: "3.2s",
    driftDuration: "26s",
    driftDelay: "0.8s",
  },
];

/**
 * Props for {@link OrbBackground}.
 *
 * @example
 * ```ts
 * import type { OrbBackgroundProps } from "@beep/ui/components/orb-background"
 *
 * const props = { tone: "green", intensity: "vivid" } satisfies OrbBackgroundProps
 * console.log(props)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
interface OrbBackgroundProps extends React.ComponentProps<"div"> {
  /**
   * When `true`, orbs fade in and gently drift forever. When `false`, they fade
   * in once and hold still. Idle drift is also disabled automatically for users
   * who request reduced motion.
   *
   * @defaultValue true
   */
  readonly animated?: boolean;
  /**
   * Visual strength of the glow.
   *
   * @defaultValue "medium"
   */
  readonly intensity?: OrbIntensity;
  /**
   * Hue family for the glow.
   *
   * @defaultValue "green"
   */
  readonly tone?: OrbTone;
}

function buildGradient(hue: number, lightness: number, alpha: number): string {
  const core = `hsl(${hue} 82% ${lightness}% / ${alpha})`;
  const mid = `hsl(${hue + 14} 76% ${lightness + 4}% / ${alpha * 0.55})`;
  return `radial-gradient(circle at 50% 38%, ${core}, ${mid} 46%, transparent 72%)`;
}

/**
 * `OrbBackground` is a purely decorative, theme-aware backdrop of soft, blurred, glowing orbs.
 *
 * It fills its nearest positioned ancestor, sits behind content (`-z-10`),
 * ignores pointer events, and is hidden from assistive technology.
 *
 * Each orb is a blurred radial gradient. On dark surfaces the layers blend
 * additively (`screen`) for a luminous bloom; on light surfaces they blend
 * normally as a soft tint, so the effect reads well in both color schemes. The
 * intro animation fades and scales the orbs in once; the idle animation drifts
 * them forever (unless `animated` is `false` or the user prefers reduced motion).
 *
 * @example
 * ```tsx
 * import { OrbBackground } from "@beep/ui/components/orb-background"
 *
 * function Hero() {
 *   return (
 *     <section className="relative isolate overflow-hidden rounded-xl">
 *       <OrbBackground tone="green" intensity="medium" />
 *       <div className="relative p-12">
 *         <h1>One Prompt. One App.</h1>
 *       </div>
 *     </section>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function OrbBackground({
  tone = "green",
  intensity = "medium",
  animated = true,
  className,
  ...props
}: OrbBackgroundProps) {
  const baseHue = TONE_HUE[tone];
  const baseAlpha = INTENSITY_ALPHA[intensity];
  const lightness = INTENSITY_LIGHTNESS[intensity];

  return (
    <div
      aria-hidden="true"
      data-slot="orb-background"
      data-tone={tone}
      data-intensity={intensity}
      className={cn("pointer-events-none absolute inset-0 -z-10 isolate overflow-hidden", className)}
      {...props}
    >
      {LAYERS.map((layer) => (
        <div
          key={layer.key}
          data-slot="orb-background-orb"
          data-orb={layer.key}
          data-animated={animated ? "true" : "false"}
          className={cn(
            "absolute rounded-[50%] opacity-0 will-change-[opacity,transform]",
            "mix-blend-normal dark:mix-blend-screen"
          )}
          style={
            {
              width: layer.width,
              height: layer.height,
              left: layer.left,
              top: layer.top,
              rotate: layer.rotate,
              filter: `blur(${layer.blur}px)`,
              background: buildGradient(baseHue + layer.hueShift, lightness, baseAlpha * layer.alphaScale),
              // Per-orb timing consumed by the `[data-slot]` animation rules in globals.css.
              "--orb-intro": layer.introDuration,
              "--orb-drift-duration": layer.driftDuration,
              "--orb-drift-delay": layer.driftDelay,
              "--orb-drift-x": layer.driftX,
              "--orb-drift-y": layer.driftY,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { OrbBackground };
/**
 * @category components
 * @since 0.0.0
 */
export type { OrbBackgroundProps, OrbIntensity, OrbTone };
