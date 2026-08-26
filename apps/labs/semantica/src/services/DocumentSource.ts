import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import * as S from "effect/Schema";
import { CorpusManifest, CorpusPaperId } from "@/corpus/Manifest";
import { F1Index } from "@/fixtures/F1";
import type { Effect } from "effect";
import type { SourceDocument } from "@/schema/Document";
import type { DocumentUnavailable } from "@/schema/Errors";

const $I = $SemanticaId.create("services/DocumentSource");

/**
 * Verified W1 and F1 inputs used to select source documents.
 *
 * @category schemas
 * @since 0.0.0
 */
export class DocumentSelection extends S.Class<DocumentSelection>($I`DocumentSelection`)(
  {
    fixtures: F1Index,
    manifest: CorpusManifest,
    paper: S.OptionFromNullOr(CorpusPaperId),
  },
  $I.annote("DocumentSelection", {
    description: "Verified W1 manifest, F1 index, and optional W1 paper selection.",
  })
) {}

/**
 * Source-document listing and exact-byte access.
 *
 * @category services
 * @since 0.0.0
 */
interface DocumentSourceShape {
  readonly list: (selection: DocumentSelection) => Effect.Effect<ReadonlyArray<SourceDocument>, DocumentUnavailable>;
  readonly read: (document: SourceDocument) => Effect.Effect<Uint8Array, DocumentUnavailable>;
}

/**
 * App-local content-addressed source document service.
 *
 * @category services
 * @since 0.0.0
 */
export class DocumentSource extends Context.Service<DocumentSource, DocumentSourceShape>()($I`DocumentSource`) {}
