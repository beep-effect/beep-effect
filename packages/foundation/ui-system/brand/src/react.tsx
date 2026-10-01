/**
 * React components for the beep mark and wordmark, driven by the same geometry the SVG assets
 * are rendered from; imported from `@beep/brand/react` so the package root stays framework-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { glassesTransform } from "./Brand.svg.ts";
import { beep } from "./Brand.tokens.ts";
import type { HTMLAttributes, SVGProps } from "react";

const mark = beep.mark;
const glasses = mark.glasses;

/**
 * The beep mark as an inline SVG. The lambda stroke follows `currentColor`; the glasses fill from the theme's `--color-fg` and `--color-surface-0` tokens (brand.css), falling back to the dark scheme where the tokens are absent.
 *
 * **Example** (Render the mark at 32px in the accent color)
 *
 * ```ts
 * import { BeepMark } from "@beep/brand/react"
 * import { createElement } from "react"
 *
 * const element = createElement(BeepMark, { className: "size-8 text-brand-400" })
 * console.log(element.type === BeepMark)
 * ```
 *
 * @param props - Standard SVG element props; `viewBox`, `fill`, and `role` are set by the component.
 * @returns The mark as an `<svg>` element.
 * @category components
 * @since 0.0.0
 */
export const BeepMark = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={mark.name}
    {...props}
    viewBox={`0 0 ${mark.viewBox} ${mark.viewBox}`}
    fill="none"
  >
    {A.map(mark.strokes, (d) => (
      <path
        key={d}
        d={d}
        stroke="currentColor"
        strokeWidth={mark.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))}
    <g transform={glassesTransform(glasses)}>
      <path fill={`var(--color-fg, ${beep.dark.foreground.base})`} d={glasses.frame} />
      {A.map(glasses.lenses, (d) => (
        <path key={d} fill={`var(--color-surface-0, ${beep.dark.surface["0"]})`} d={d} />
      ))}
    </g>
  </svg>
);

/**
 * The beep mark beside the brand name in the sans stack. The wrapper is an inline flex `<span>`; size it with a font size and the mark follows at `1.25em`.
 *
 * **Details**
 *
 * The wrapper layout (inline flex, `0.4em` gap, bold, `-0.02em` tracking) lives in `@beep/brand/styles/react.css`,
 * keyed by the `data-beep-wordmark` attribute, so the component carries no inline styles and needs no Tailwind
 * content scan of this package. The mark is sized by its own `width`/`height` attributes and colored from the
 * theme's `--color-brand-400` token (brand.css), falling back to the dark-scheme value where the token is absent.
 *
 * **Gotchas**
 *
 * Import `@beep/brand/styles/react.css` once in the application stylesheet; without it the name and mark still
 * render, but sit on the text baseline with no gap.
 *
 * **Example** (Render the wordmark)
 *
 * ```ts
 * import { BeepWordmark } from "@beep/brand/react"
 * import { createElement } from "react"
 *
 * const element = createElement(BeepWordmark, { className: "text-xl" })
 * console.log(element.type === BeepWordmark)
 * ```
 *
 * @param props - Standard span props for the wrapper.
 * @returns The wordmark as a `<span>` containing the mark and the brand name.
 * @category components
 * @since 0.0.0
 */
export const BeepWordmark = (props: HTMLAttributes<HTMLSpanElement>) => (
  <span data-beep-wordmark="" {...props}>
    <BeepMark
      aria-hidden="true"
      width="1.25em"
      height="1.25em"
      color={`var(--color-brand-400, ${beep.dark.brand["400"]})`}
    />
    <span>{beep.name}</span>
  </span>
);
