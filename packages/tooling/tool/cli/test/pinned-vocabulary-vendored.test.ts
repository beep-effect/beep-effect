import { pinnedVocabularyRows } from "@beep/repo-cli/test/SyncDataToTs";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

const vendoredSchema = "../../../foundation/modeling/rdf/data/vocab/nanopub-nschema/nschema.ttl";

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "vendored pinned vocabularies",
  (it) => {
    it.effect("keeps the vendored nanopublication schema byte-identical to its CC BY-SA 3.0 np pin", () =>
      Effect.gen(function* () {
        const pin = O.getOrThrow(A.findFirst(pinnedVocabularyRows, (row) => row.prefix === "np"));
        const fs = yield* FileSystem.FileSystem;
        const path = yield* fs.realPath(vendoredSchema);
        const bytes = yield* fs.readFile(path);
        const crypto = yield* Digest.Digest;
        const digest = yield* crypto.digest(Digest.sha256, bytes);
        strictEqual(Hex.encode(digest), pin.sha256);
        strictEqual(pin.license, "CC-BY-SA-3.0");
        const text = new TextDecoder().decode(bytes);
        assertTrue(A.every(pin.terms, (term) => Str.includes(`np:${term} `)(text)));
      })
    );
  }
);
