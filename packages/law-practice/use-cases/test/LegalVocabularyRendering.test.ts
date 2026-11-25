import {
  legalVocabularyManifestUrl,
  legalVocabularyRootUrl,
  scheme,
} from "@beep/law-practice-domain/values/LegalVocabularyPack";
import { N3ParseTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { skosDataset } from "./support/SkosProjection.ts";
import type { LoadedPack } from "@beep/ontology/TaxonomyLoader";

const loadPack = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const loader = yield* TaxonomyLoader;
  const manifestPath = yield* path.fromFileUrl(legalVocabularyManifestUrl);
  const rootPath = yield* path.fromFileUrl(legalVocabularyRootUrl);
  const manifest = yield* fs.realPath(manifestPath);
  const root = yield* fs.realPath(rootPath);
  return yield* loader.load(manifest, root);
});

const source = (pack: LoadedPack, id: string) =>
  N3ParseTurtleRequest.make({
    source: new TextDecoder().decode(O.getOrElse(HashMap.get(pack.payloads, id), () => new Uint8Array())),
  });

it.layer(
  Layer.mergeAll(TaxonomyLoader.layer, NodeFileSystem.layer, NodePath.layer, Digest.layerWebCrypto, N3TurtleCodecLive),
  { timeout: "30 seconds" }
)("legal vocabulary Turtle renderings", (it) => {
  it.effect(
    "parse to the SKOS projection of their JSON schemes, and legal-intake stays refused",
    Effect.fnUntraced(function* () {
      const pack = yield* loadPack();
      const codec = yield* N3TurtleCodec;
      const docketing = yield* scheme(pack, "docketing");
      const partyKinds = yield* scheme(pack, "party-kinds");
      const legalRoles = yield* scheme(pack, "legal-roles");
      const parsedDocketing = yield* codec.parse(source(pack, "docketing-ttl"));
      const parsedPartyRoles = yield* codec.parse(source(pack, "party-roles-ttl"));
      expect(Equal.equals(parsedDocketing.dataset, skosDataset([docketing]))).toBe(true);
      expect(Equal.equals(parsedPartyRoles.dataset, skosDataset([partyKinds, legalRoles]))).toBe(true);
      const refused = yield* codec.parse(source(pack, "legal-intake-ttl")).pipe(Effect.flip);
      expect(Str.split("\n")(refused.message)[0]).toBe('Unexpected "beep:taxonomy/legal-intake" on line 5.');
    })
  );
});
