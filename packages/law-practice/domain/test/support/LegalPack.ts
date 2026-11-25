import {
  legalVocabularyManifestUrl,
  legalVocabularyRootUrl,
} from "@beep/law-practice-domain/values/LegalVocabularyPack";
import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

export const legalPackLayer = Layer.mergeAll(
  TaxonomyLoader.layer,
  BunFileSystem.layer,
  BunPath.layer,
  Digest.layerWebCrypto
);

export const loadLegalPack = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const loader = yield* TaxonomyLoader;
  const manifest = yield* path.fromFileUrl(legalVocabularyManifestUrl);
  const root = yield* path.fromFileUrl(legalVocabularyRootUrl);
  return yield* loader.load(manifest, root);
});
