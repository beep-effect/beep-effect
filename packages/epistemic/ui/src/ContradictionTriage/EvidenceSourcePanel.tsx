/**
 * Verified canonical source inspector for contradiction evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@beep/ui/components/card";
import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer";
import * as Str from "effect/String";
import type { ContradictionTriage } from "@beep/epistemic-use-cases/public";
import type { JSX } from "react";

/**
 * Props for {@link EvidenceSourcePanel}.
 *
 * **Example** (Render with typed props)
 *
 * ```tsx
 * import {
 *   EvidenceSourcePanel,
 *   type EvidenceSourcePanelProps,
 * } from "@beep/epistemic-ui"
 *
 * const renderSource = (props: EvidenceSourcePanelProps) => <EvidenceSourcePanel {...props} />
 * console.log(renderSource)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export interface EvidenceSourcePanelProps {
  readonly highlight: ContradictionTriage.EvidenceSourceHighlight;
  readonly loading?: boolean | undefined;
  readonly onPageChange: (pageIndex: number) => void;
  readonly page: ContradictionTriage.EvidenceSourcePage["page"];
}

const shortDigest = (digest: string): string => `${Str.slice(0, 18)(digest)}…`;

/**
 * Display one verified source page, its immutable manifestation metadata, and
 * adjacent-page navigation.
 *
 * **Details**
 *
 * The panel delegates highlighting to `VerifiedSourceTextViewer`, which uses
 * the anchor's absolute half-open UTF-16 offsets without normalization or
 * fuzzy relocation.
 *
 * **Example** (Basic wrapper component)
 *
 * ```tsx
 * import {
 *   EvidenceSourcePanel,
 *   type EvidenceSourcePanelProps,
 * } from "@beep/epistemic-ui"
 *
 * export function SourceInspector(props: EvidenceSourcePanelProps) {
 *   return <EvidenceSourcePanel {...props} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EvidenceSourcePanel({
  highlight,
  loading = false,
  onPageChange,
  page,
}: EvidenceSourcePanelProps): JSX.Element {
  const source = highlight.source;

  return (
    <Card className="h-full min-h-0" data-testid="contradiction-source-panel">
      <CardHeader className="border-b">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="wrap-anywhere min-w-0">{source.sourceRef}</CardTitle>
          <Badge variant="secondary">Verified source</Badge>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="min-w-0 basis-full">
            <dt className="sr-only">Source locator</dt>
            <dd className="wrap-anywhere">{source.locator}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Text digest</dt>
            <dd className="font-mono" title={source.textDigest}>
              {shortDigest(source.textDigest)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Extractor</dt>
            <dd className="font-mono">
              {source.extractor.name}@{source.extractor.version}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Anchor</dt>
            <dd className="font-mono">
              {highlight.startChar}–{highlight.endChar}
            </dd>
          </div>
        </dl>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            disabled={loading || !page.hasPreviousPage}
            onClick={() => onPageChange(page.pageIndex - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Page {page.pageIndex + 1} of {page.pageCount} · {page.totalCodeUnits.toLocaleString()} UTF-16 units
          </span>
          <Button
            disabled={loading || !page.hasNextPage}
            onClick={() => onPageChange(page.pageIndex + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
          </Button>
        </div>
        <VerifiedSourceTextViewer
          anchorEndOffset={highlight.endChar}
          anchorStartOffset={highlight.startChar}
          aria-busy={loading}
          className="min-h-64 flex-1"
          pageStartOffset={page.startOffset}
          pageText={page.text}
        />
      </CardContent>
    </Card>
  );
}
