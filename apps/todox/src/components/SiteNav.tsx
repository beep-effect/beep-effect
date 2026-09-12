/**
 * Sticky site navigation: wordmark, section links, and the demo call to action.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { nav } from "@/content/copy";
import { Wordmark } from "./Wordmark";

/**
 * Renders the top navigation bar.
 *
 * **Example** (Render the nav)
 *
 * ```ts
 * import { SiteNav } from "@/components/SiteNav"
 * import { createElement } from "react"
 *
 * console.log(createElement(SiteNav).type === SiteNav)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function SiteNav() {
  return (
    <header className="nav">
      <div className="frame nav__bar">
        <Wordmark href="#top" />
        <nav className="nav__links" aria-label="Sections">
          {nav.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a className="button button--primary nav__cta" href={nav.primary.href}>
          {nav.primary.label}
        </a>
      </div>
    </header>
  );
}
