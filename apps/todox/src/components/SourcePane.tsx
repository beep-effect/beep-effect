/**
 * The source pane: one source artifact with its verbatim spans, lit where the
 * record under the cursor draws its evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import type { CSSProperties } from "react";
import type { SourceArtifact, SpanId } from "@/session/Session.schema";

/**
 * Renders a source artifact's header line and spans. Spans in `lit` render in
 * inverse video; when `dimOthers` is set the remaining spans drop to the
 * ghost density so the evidence reads first.
 *
 * **Example** (Light one span)
 *
 * ```tsx
 * import { SourcePane } from "@/components/SourcePane"
 * import { emailSource } from "@/session/session"
 *
 * const pane = <SourcePane artifact={emailSource} lit={["S2"]} />
 * console.log(pane.props.lit)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function SourcePane({
  artifact,
  lit,
  dimOthers = false,
  animate = false,
}: {
  readonly artifact: SourceArtifact;
  readonly lit: ReadonlyArray<SpanId>;
  readonly dimOthers?: boolean;
  readonly animate?: boolean;
}) {
  const isLit = (id: SpanId): boolean => A.contains(lit, id);
  return (
    <article className="source" aria-label={`${artifact.no} ${artifact.kind}`}>
      <p className="source__head" data-post={animate ? "" : undefined}>
        <span className="source__no">{artifact.no}</span>
        <span>{artifact.kind}</span>
        <span>
          {artifact.from} → {artifact.to}
        </span>
        <span className="source__subject">“{artifact.subject}”</span>
        <span>{artifact.dated}</span>
      </p>
      <div className="source__body">
        {artifact.spans.map((span) => (
          <p
            key={span.id}
            className={`span${isLit(span.id) ? " span--lit" : dimOthers ? " span--dim" : ""}`}
            data-span={span.id}
            data-post={animate ? "" : undefined}
            style={animate ? ({ "--post-delay": "260ms" } as CSSProperties) : undefined}
          >
            <span className="span__id" aria-hidden="true">
              {span.id}
            </span>
            <span className="sr-only">{`Span ${span.id}: `}</span>
            {span.text}
          </p>
        ))}
      </div>
    </article>
  );
}
