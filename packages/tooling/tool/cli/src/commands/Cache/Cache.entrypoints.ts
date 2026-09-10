/**
 * Immutable source-review integration for the executable census.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CacheCensusEntrypointReview,
  CacheEntrypointArtifact,
  CacheEntrypointArtifactFormat,
} from "./Cache.entrypoints.schemas.ts";
import { readCacheEvidenceBytes } from "./Cache.evidence.ts";
import { CacheCensusReport, CacheCommandError } from "./Cache.schemas.ts";
import type { CacheEntrypointReviewRequest } from "./Cache.entrypoints.schemas.ts";

const Envelope = S.Struct({ schemaVersion: CacheEntrypointArtifactFormat });

/**
 * Attach complete source documents after verifying the census population and referenced bytes.
 *
 * **Details**
 *
 * No document is executed, no command count becomes an execution count, and
 * qualification state is not changed. The attachment checks JSON syntax and
 * the version envelope; each producer retains its complete semantic schema.
 * Existing unresolved census obligations are preserved.
 *
 * **Example** (Plan source attachment)
 *
 * ```ts
 * import { attachCacheEntrypointReview } from "@beep/repo-cli/commands/Cache"
 * import type { CacheCensusReport, CacheEntrypointReviewRequest } from "@beep/repo-cli/commands/Cache"
 * const plan = (census: CacheCensusReport, review: CacheEntrypointReviewRequest) =>
 *   attachCacheEntrypointReview("/repo", census, review)
 * console.assert(typeof plan === "function")
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const attachCacheEntrypointReview = Effect.fn("CacheEntrypoints.attachReview")(function* (
  root: string,
  census: CacheCensusReport,
  request: CacheEntrypointReviewRequest
) {
  const sources = HashMap.fromIterable(A.map(request.sources, (source) => [source.path, source.sha256]));
  if (HashMap.size(sources) !== A.length(request.sources))
    return yield* CacheCommandError.new("Entrypoint review repeats a source path.");
  for (const source of census.sources) {
    if (!O.contains(source.sha256)(HashMap.get(sources, source.path)))
      return yield* CacheCommandError.new(`Entrypoint review does not bind the current census source: ${source.path}`);
  }
  const references = [...request.sources, ...request.reviews, ...A.map(request.artifacts, (row) => row.reference)];
  const paths = A.map(references, (reference) => reference.path);
  if (A.length(A.dedupe(paths)) !== A.length(paths))
    return yield* CacheCommandError.new("Entrypoint review repeats a source, review or artifact reference.");
  if (
    A.isReadonlyArrayNonEmpty(
      A.difference(
        CacheEntrypointArtifactFormat.Options,
        A.map(request.artifacts, (row) => row.format)
      )
    )
  )
    return yield* CacheCommandError.new("Entrypoint review omits a required document family.");
  yield* Effect.forEach(
    [...request.sources, ...request.reviews],
    (reference) => readCacheEvidenceBytes(root, reference),
    {
      concurrency: 4,
      discard: true,
    }
  );
  const artifacts = yield* Effect.forEach(
    request.artifacts,
    Effect.fn("CacheEntrypoints.readArtifact")(function* (artifact) {
      const bytes = yield* readCacheEvidenceBytes(root, artifact.reference);
      const text = yield* Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
        catch: (cause) => CacheCommandError.new("Entrypoint artifact is not valid UTF-8.", cause),
      });
      const document = yield* S.decodeEffect(S.fromJsonString(S.JsonObject))(text);
      const envelope = yield* S.decodeUnknownEffect(Envelope)(document);
      if (envelope.schemaVersion !== artifact.format)
        return yield* CacheCommandError.new("Entrypoint artifact format differs from its reviewed reference.");
      return CacheEntrypointArtifact.make({ ...artifact, document });
    })
  );
  return CacheCensusReport.make({
    ...census,
    entrypointReview: O.some(
      CacheCensusEntrypointReview.make({
        sources: request.sources,
        artifacts,
        reviews: request.reviews,
        unresolved: request.unresolved,
      })
    ),
    unresolved: pipe(
      A.appendAll(census.unresolved, request.unresolved),
      A.append("Entrypoint attachments establish source identity only; candidate runtime evidence remains required."),
      A.dedupe,
      A.sort(Order.String)
    ),
  });
}, CacheCommandError.mapError("Cannot attach reviewed entrypoint evidence."));
