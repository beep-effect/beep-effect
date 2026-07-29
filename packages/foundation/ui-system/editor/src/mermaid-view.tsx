/**
 * Mermaid diagram renderer shared by persisted editor and streaming chat
 * surfaces.
 *
 * @packageDocumentation \@beep/editor/mermaid-view
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import { Str } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import { Effect, Layer, Match } from "effect";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useId } from "react";
import type { JSX } from "react";

const $I = $EditorId.create("mermaid-view");

type MermaidRenderState =
  | { readonly _tag: "pending" }
  | { readonly _tag: "ok"; readonly svg: string }
  | { readonly _tag: "failed"; readonly message: string };

const pendingState: MermaidRenderState = { _tag: "pending" };
const fallbackErrorMessage = "Unable to render diagram.";
const invalidDiagramMessage = "Diagram could not be parsed.";

/**
 * Typed Mermaid load, parse, or render failure. The optional defect is retained
 * for runtime diagnostics; only the user-safe message is rendered.
 *
 * @example
 * ```ts
 * import { MermaidRenderError } from "@beep/editor/mermaid-view"
 *
 * const error = MermaidRenderError.make({ message: "Unable to render diagram." })
 * console.log(error._tag) // "MermaidRenderError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MermaidRenderError extends TaggedErrorClass<MermaidRenderError>($I`MermaidRenderError`)(
  "MermaidRenderError",
  {
    message: S.String.annotateKey({ description: "User-safe diagram failure message." }),
    cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({
      description: "Optional underlying Mermaid defect retained for diagnostics.",
    }),
  },
  $I.annote("MermaidRenderError", {
    description: "A typed Mermaid load, parse, or render failure.",
  })
) {}

/**
 * Upper bound on the diagram source Mermaid is asked to lay out.
 *
 * `mermaid.render` parses and lays the graph out synchronously on the main
 * thread. An assistant can emit arbitrarily large content, so oversized source
 * falls back to inert text before Mermaid is imported.
 */
const maxSourceLength = 20_000;

const oversizedMessage = (length: number): string =>
  `Diagram source is too large to render (${length.toLocaleString()} characters; limit ${maxSourceLength.toLocaleString()}).`;

const mermaidConfig = Object.freeze({
  securityLevel: "strict" as const,
  startOnLoad: false,
  suppressErrorRendering: true,
});

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const maxIdPartLength = 64;

const sanitizeIdPart = (value: string): string => {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/gu, "-");
  if (sanitized.length === 0) return "diagram";
  return sanitized.length > maxIdPartLength ? hashString(sanitized) : sanitized;
};

const boundedSourceIdentity = (source: string): string => {
  const length = Str.length(source);
  return length > maxSourceLength
    ? `${Str.takeLeft(source, maxIdPartLength)}:${Str.takeRight(source, maxIdPartLength)}:${length}`
    : source;
};

const failedState = (message: string): MermaidRenderState => ({ _tag: "failed", message });
const okState = (svg: string): MermaidRenderState => ({ _tag: "ok", svg });

const renderMermaid = Effect.fnUntraced(function* (renderId: string, source: string) {
  if (Str.length(source) > maxSourceLength) {
    return yield* MermaidRenderError.make({ message: oversizedMessage(Str.length(source)) });
  }

  const { default: mermaid } = yield* Effect.tryPromise({
    try: () => import("mermaid"),
    catch: (cause) => MermaidRenderError.make({ message: fallbackErrorMessage, cause }),
  });

  mermaid.initialize(mermaidConfig);

  const parsed = yield* Effect.tryPromise({
    try: () => mermaid.parse(source, { suppressErrors: true }),
    catch: (cause) => MermaidRenderError.make({ message: invalidDiagramMessage, cause }),
  });
  if (parsed === false) {
    return yield* MermaidRenderError.make({ message: invalidDiagramMessage });
  }

  const rendered = yield* Effect.tryPromise({
    try: () => mermaid.render(renderId, source),
    catch: (cause) => MermaidRenderError.make({ message: fallbackErrorMessage, cause }),
  });
  return okState(rendered.svg);
});

const mermaidRuntime = Atom.runtime(Layer.empty);

// Nested families keep both identities primitive and stable without a React
// memo: render id isolates concurrent diagrams, source changes select a fresh
// async atom, and unmounting interrupts obsolete work through the registry.
const mermaidRenderAtom = Atom.family((renderId: string) =>
  Atom.family((source: string) =>
    mermaidRuntime.atom(
      renderMermaid(renderId, source).pipe(Effect.catch((failure) => Effect.succeed(failedState(failure.message))))
    )
  )
);

const renderMermaidState = (source: string) =>
  Match.type<MermaidRenderState>().pipe(
    Match.tagsExhaustive({
      failed: (state) => (
        <div className="my-3 rounded border border-destructive/40 bg-muted p-3" data-testid="mermaid-diagram">
          <div className="mb-2 text-xs text-muted-foreground">{state.message}</div>
          <pre className="overflow-x-auto rounded bg-background p-3 text-sm">
            <code>{source}</code>
          </pre>
        </div>
      ),
      ok: (state) => (
        <div
          className="my-3 overflow-x-auto rounded border bg-background p-3"
          data-testid="mermaid-diagram"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid renders sanitized SVG under the frozen strict-security config above; this is the sole raw-HTML sink.
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ),
      pending: () => (
        <div className="my-3 rounded border bg-muted p-3 text-sm text-muted-foreground" data-testid="mermaid-diagram">
          Rendering diagram...
        </div>
      ),
    })
  );

/**
 * Renders Mermaid source to SVG and falls back to source text on render
 * failure. Async lifecycle is owned by an interruptible Atom runtime rather
 * than app-authored React state/effect hooks.
 *
 * @example
 * ```tsx
 * import { MermaidView } from "@beep/editor/mermaid-view"
 *
 * const props = { renderKey: "checkout-flow", source: "graph TD; A-->B" }
 * const diagram = <MermaidView {...props} />
 *
 * console.log(props.renderKey) // "checkout-flow"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function MermaidView({
  source,
  renderKey,
}: {
  readonly source: string;
  readonly renderKey: string;
}): JSX.Element {
  const reactId = useId();
  const renderId = `mermaid-${sanitizeIdPart(reactId)}-${sanitizeIdPart(renderKey)}-${hashString(
    boundedSourceIdentity(source)
  )}`;
  const state = useAtomValue(mermaidRenderAtom(renderId)(source));

  return AsyncResult.match(state, {
    onInitial: () => renderMermaidState(source)(pendingState),
    onSuccess: ({ value }) => renderMermaidState(source)(value),
    onFailure: () => renderMermaidState(source)(failedState(fallbackErrorMessage)),
  });
}
