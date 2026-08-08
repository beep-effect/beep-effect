/**
 * Content-editable surface for the Lexical editor, sized to match its placeholder overlay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $UiId } from "@beep/identity";
import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";
import * as S from "effect/Schema";
import type { JSX } from "react";

const $I = $UiId.create("components/editor/content-editable");

/**
 * The padding shared by the editable surface and its placeholder overlay. The
 * placeholder is an `absolute top-0 left-0` sibling of the editable, so the
 * empty-state cursor (which sits at the editable's content-box origin) only
 * lines up with the placeholder text when both boxes use the *same* padding.
 * Keeping one constant for both prevents the cursor-above-placeholder drift the
 * previous `py-[18px]` placeholder (vs `py-4` editable) produced.
 *
 * Consumers passing a custom `className` should pass a `placeholderClassName`
 * whose padding matches, for the same reason.
 */
const DEFAULT_EDITABLE_CLASS_NAME =
  "ContentEditable__root relative block min-h-72 min-h-full overflow-auto px-8 py-4 focus:outline-none";

const DEFAULT_PLACEHOLDER_CLASS_NAME =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-8 py-4 text-ellipsis select-none";

class Props extends S.Class<Props>($I`Props`)({
  placeholder: S.String,
  ariaLabel: S.optionalKey(S.String),
  className: S.optionalKey(S.String),
  placeholderClassName: S.optionalKey(S.String),
}) {
  declare readonly placeholder: string;
  declare readonly ariaLabel?: string;
  declare readonly className?: string;
  declare readonly placeholderClassName?: string;
}

/**
 * Lexical content-editable surface with a padding-aligned placeholder.
 *
 * **Gotchas**
 *
 * The placeholder overlay shares the editable's padding so the empty-state
 * cursor aligns with the placeholder text. When a custom `className` changes
 * the editable padding, pass a matching `placeholderClassName`.
 *
 * Pass `ariaLabel` whenever the editable is exposed as a named widget — a
 * typeahead plugin promotes the root to `role="combobox"`, and a combobox with
 * only `aria-placeholder` has no accessible name.
 *
 * **Example** (With RichTextPlugin usage)
 *
 * ```tsx
 * import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
 * import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
 * import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable"
 *
 * export function BodyEditorPlugin() {
 *   return (
 *     <RichTextPlugin
 *       contentEditable={<ContentEditable placeholder="Start typing ..." />}
 *       ErrorBoundary={LexicalErrorBoundary}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContentEditable({ ariaLabel, placeholder, className, placeholderClassName }: Props): JSX.Element {
  return (
    <LexicalContentEditable
      className={className ?? DEFAULT_EDITABLE_CLASS_NAME}
      aria-label={ariaLabel}
      aria-placeholder={placeholder}
      placeholder={<div className={placeholderClassName ?? DEFAULT_PLACEHOLDER_CLASS_NAME}>{placeholder}</div>}
    />
  );
}
