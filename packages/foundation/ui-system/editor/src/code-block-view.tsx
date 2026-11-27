/**
 * A readable, copyable code block.
 *
 * @packageDocumentation \@beep/editor/code-block-view
 * @since 0.0.0
 */
"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as S from "effect/Schema";
import type { JSX } from "react";

class CodeBlockViewOperationError extends S.TaggedError<
  CodeBlockViewOperationError,
  { readonly brand: unique symbol }
>()(
  "CodeBlockViewOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in code-block-view.tsx." }
) {}

const COPIED_FOR = Duration.millis(1_500);

const copiedAtom = Atom.family((_code: string) => Atom.make(false));

const copyRuntime = Atom.runtime(Layer.empty);

const copyFn = Atom.family((code: string) =>
  copyRuntime.fn<void>()(
    Effect.fnUntraced(function* (_, get) {
      yield* Effect.tryPromise({
        try: () => navigator.clipboard.writeText(code),
        catch: (cause) => CodeBlockViewOperationError.make({ cause }),
      }).pipe(
        Effect.andThen(() => Effect.sync(() => get.set(copiedAtom(code), true))),
        Effect.andThen(() => Effect.sleep(COPIED_FOR)),
        Effect.andThen(() => Effect.sync(() => get.set(copiedAtom(code), false))),
        Effect.ignore
      );
    })
  )
);

/**
 * Renders a code block that scrolls rather than wraps, and that can be copied.
 *
 * **Gotchas**
 *
 * Copy confirmation is keyed by code: equal snippets share copied state and different snippets start unclaimed. Clipboard refusal, including permission or insecure-origin rejection, must leave the label on Copy.
 *
 * Keep the header in normal flow: a shrink-to-fit bubble otherwise sizes only from code, allowing an empty fence to collapse until the language and Copy labels wrap one character per line. The in-flow header establishes the width floor.
 *
 * Code must scroll without wrapping. Lexical contenteditable uses pre-wrap, but an arbitrary-column line fold forces the reader to reconstruct the original code.
 *
 * **Example** (Render typescript code block)
 *
 * ```tsx
 * import { CodeBlockView } from "@beep/editor/code-block-view"
 *
 * function Snippet() {
 *   return <CodeBlockView code="export {}" language="typescript" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function CodeBlockView({ code, language }: { readonly code: string; readonly language: string }): JSX.Element {
  const copied = useAtomValue(copiedAtom(code));
  const copy = useAtomSet(copyFn(code));

  return (
    <div className="my-3 overflow-hidden rounded-md border bg-muted" data-testid="code-block">
      <div className="flex items-center justify-between gap-4 border-b bg-background/40 px-3 py-1">
        <span className="font-mono text-2xs text-muted-foreground">{language === "" ? "code" : language}</span>
        <button
          type="button"
          aria-label={copied ? "Code copied" : "Copy code"}
          data-testid="code-block-copy"
          className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => copy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code className="whitespace-pre font-mono text-xs-plus leading-code">{code}</code>
      </pre>
    </div>
  );
}
