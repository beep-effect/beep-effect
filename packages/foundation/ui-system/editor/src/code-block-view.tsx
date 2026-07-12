/**
 * A readable, copyable code block.
 *
 * @packageDocumentation \@beep/editor/code-block-view
 * @since 0.0.0
 */
"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { JSX } from "react";

const COPIED_FOR = Duration.millis(1_500);

/**
 * Whether a block's code has just been copied. Keyed by the code itself, so two
 * blocks showing the same snippet cannot disagree and a different snippet starts
 * unclaimed.
 */
const copiedAtom = Atom.family((_code: string) => Atom.make(false));

const copyRuntime = Atom.runtime(Layer.empty);

/**
 * Copy the code, then let the confirmation fade. A refused clipboard — no permission,
 * an insecure origin — must never look like a successful copy, so the label simply
 * stays on "Copy".
 */
const copyFn = Atom.family((code: string) =>
  copyRuntime.fn<void>()(
    Effect.fnUntraced(function* (_, get) {
      yield* Effect.tryPromise(() => navigator.clipboard.writeText(code)).pipe(
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
 * @example
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
    <div className="group relative my-3" data-testid="code-block">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
        {language === "" ? null : (
          <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">{language}</span>
        )}
        <button
          type="button"
          aria-label={copied ? "Code copied" : "Copy code"}
          data-testid="code-block-copy"
          className="rounded border bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => copy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* The wrapper scrolls and the code does not wrap. Lexical renders code inside a
          contenteditable whose `white-space` is `pre-wrap`, so a long line folded back
          on itself instead of scrolling — and code that wraps at an arbitrary column
          has to be reassembled in the reader's head before it can be read. */}
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-sm">
        <code className="whitespace-pre font-mono text-[13px] leading-[1.53]">{code}</code>
      </pre>
    </div>
  );
}
