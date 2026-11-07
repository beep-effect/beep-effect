import {
  CitationAssetSeal,
  loadCitationJsonAsset,
  loadCitationTextAsset,
} from "@beep/law-practice-server/internal/Citation/Asset";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { CitationAssetFailureReason } from "@beep/law-practice-server/internal/Citation/Asset";

const Payload = S.fromJsonString(S.Struct({ version: S.Finite }));
const failed = (reason: CitationAssetFailureReason) => ({ reason });
// Write one asset and seal it exactly as a trusted adapter would.
const sealed = Effect.fnUntraced(function* (text: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-asset-coverage-" });
  const path = `${directory}/asset.json`;
  const bytes = new TextEncoder().encode(text);
  yield* fs.writeFile(path, bytes);
  const sha256 = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  return { path, seal: CitationAssetSeal.make({ byteLength: bytes.byteLength, sha256 }) };
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("bounded production assets", (it) => {
  it.effect("decodes authenticated JSON text through the supplied codec", () =>
    Effect.gen(function* () {
      const { path, seal } = yield* sealed('{"version":3}');
      const text = yield* loadCitationTextAsset(path, seal, failed);
      strictEqual(text, '{"version":3}');
      const decoded = yield* loadCitationJsonAsset(path, seal, Payload, failed);
      deepStrictEqual(decoded, { version: 3 });
    })
  );
  it.effect("refuses an empty asset path as unavailable before any read", () =>
    Effect.gen(function* () {
      const { seal } = yield* sealed("{}");
      const failure = yield* loadCitationTextAsset("", seal, failed).pipe(Effect.flip);
      deepStrictEqual(failure, { reason: "unavailable" });
    })
  );
  it.effect("refuses authenticated text the supplied codec cannot decode as invalid data", () =>
    Effect.gen(function* () {
      const { path, seal } = yield* sealed('{"version":"three"}');
      const failure = yield* loadCitationJsonAsset(path, seal, Payload, failed).pipe(Effect.flip);
      deepStrictEqual(failure, { reason: "invalid-data" });
    })
  );
});
