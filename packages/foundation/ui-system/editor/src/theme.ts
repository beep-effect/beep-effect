/**
 * Editor theme for `@beep/editor`, reusing the `@beep/ui` editor substrate
 * theme (Tailwind class mappings + token CSS).
 *
 * @packageDocumentation \@beep/editor/theme
 * @since 0.0.0
 */

/**
 * The `@beep/ui` Lexical theme: maps node types to Tailwind classes.
 *
 * **Example** (Read paragraph theme class)
 *
 * ```ts
 * import { editorTheme } from "@beep/editor/theme"
 *
 * const paragraphClass = editorTheme.paragraph
 * console.log(paragraphClass)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export { editorTheme } from "@beep/ui/components/editor/themes/editor-theme";
