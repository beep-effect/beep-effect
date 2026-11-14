/** Actual semantic model to native resource input; no observed model fields.
 * @internal @packageDocumentation @since 0.0.0
 */

import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationResourceCitationCorrectionInput } from "@beep/law-practice-server/internal/Citation/ResourceCorrection";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineExtractionResult, CitationEngineLimits } from "@beep/law-practice-use-cases/server";

type Unicode = Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>;
const nativeGroup = Effect.fn("CanonicalParsedResourceTest.group")(function* (
  unicode: Unicode,
  value: O.Option<string> | undefined
) {
  if (value === undefined) return undefined;
  if (O.isNone(value)) return null;
  return (yield* unicode.fromText(value.value)).storage;
});
/** Preserve absent/None groups, actual selected edition and verified matched text.
 * @internal @category testing @since 0.0.0
 */
export const prepareCitationParsedResource = Effect.fn("CanonicalParsedResourceTest.prepare")(function* (
  unicode: Unicode,
  actual: CitationEngineExtractionResult
) {
  const citation = A.getUnsafe(actual.citations, 0);
  const mention = A.getUnsafe(actual.document.mentions, 0);
  const anchor = mention.anchor.anchor;
  const matched = yield* unicode.fromText(Str.slice(anchor.startChar, anchor.endChar)(actual.source.source.sourceText));
  const reporter = yield* nativeGroup(unicode, citation.components.reporter);
  const page = yield* nativeGroup(unicode, citation.components.page);
  const editionGuess = "publication" in citation ? O.getOrNull(citation.publication.selectedEdition) : null;
  return CitationResourceCitationCorrectionInput.make({
    ...(reporter === undefined ? {} : { reporter }),
    ...(page === undefined ? {} : { page }),
    editionGuess,
    matchedText: matched.storage,
  });
});

/** Compose actual parser replay, native Unicode and the authenticated edition owner.
 * @internal @category testing @since 0.0.0
 */
export const installCitationParsedResourceReplay = Effect.fn("CanonicalParsedResourceTest.install")(function* <A, E>(
  kind: CitationNativeRuntimeKind,
  makeService: (policy: CitationEngineLimits) => Effect.Effect<A, E, CitationFrozenEditions>
) {
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const unicode = yield* makeCitationPythonUnicode(replay.limits);
  const service = yield* makeService(replay.limits).pipe(Effect.provideService(CitationFrozenEditions, owner));
  return { replay, unicode, service };
});
