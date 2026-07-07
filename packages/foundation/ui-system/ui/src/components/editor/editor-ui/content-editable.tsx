import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";
import type { JSX } from "react";

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

type ContentEditableProps = {
  readonly className?: string | undefined;
  readonly placeholder: string;
  readonly placeholderClassName?: string | undefined;
};

/**
 * Lexical content-editable surface with a padding-aligned placeholder.
 *
 * @remarks
 * The placeholder overlay shares the editable's padding so the empty-state
 * cursor aligns with the placeholder text. When a custom `className` changes
 * the editable padding, pass a matching `placeholderClassName`.
 *
 * @example
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
export function ContentEditable({ placeholder, className, placeholderClassName }: ContentEditableProps): JSX.Element {
  return (
    <LexicalContentEditable
      className={className ?? DEFAULT_EDITABLE_CLASS_NAME}
      aria-placeholder={placeholder}
      placeholder={<div className={placeholderClassName ?? DEFAULT_PLACEHOLDER_CLASS_NAME}>{placeholder}</div>}
    />
  );
}
