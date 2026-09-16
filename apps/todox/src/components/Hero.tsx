/**
 * The hero: headline, lede, actions, and the interactive evidence graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { hero, nav } from "@/content/copy";
import { EvidenceGraph } from "./EvidenceGraph";

/**
 * Renders the hero band.
 *
 * **Example** (Render the hero)
 *
 * ```ts
 * import { Hero } from "@/components/Hero"
 * import { createElement } from "react"
 *
 * console.log(createElement(Hero).type === Hero)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="frame hero__grid">
        <div className="hero__copy">
          <h1 className="display display--xl" id="hero-title">
            {hero.headline}
          </h1>
          <p className="lede">{hero.lede}</p>
          <div className="hero__actions">
            <a className="button button--glow" href={nav.primary.href}>
              {nav.primary.label}
              <svg className="button__arrow" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <a className="button button--outline" href={nav.secondary.href}>
              {nav.secondary.label}
            </a>
          </div>
          <p className="hero__proof">{hero.proofLine}</p>
        </div>
        <div className="hero__figure">
          <EvidenceGraph />
        </div>
      </div>
    </section>
  );
}
