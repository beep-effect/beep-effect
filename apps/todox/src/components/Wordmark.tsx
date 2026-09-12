/**
 * The Todox wordmark: display lettering with the evidence dot. Original
 * lettering in the site's display face; not a licensed logo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Renders the wordmark as a link.
 *
 * **Example** (Render the wordmark)
 *
 * ```tsx
 * import { Wordmark } from "@/components/Wordmark"
 *
 * console.log(<Wordmark href="#top" />.props.href)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Wordmark({ href, light = false }: { readonly href: string; readonly light?: boolean }) {
  return (
    <a className={`wordmark${light ? " wordmark--light" : ""}`} href={href} aria-label="Todox home">
      <span>Todox</span>
      <span className="wordmark__dot" aria-hidden="true" />
    </a>
  );
}
