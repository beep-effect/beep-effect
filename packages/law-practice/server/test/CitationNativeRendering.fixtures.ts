/** Shared packed rendering facts and reproducible producer authentication.
 * @internal @packageDocumentation @since 0.0.0
 */
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

/** Read one private immutable rendering configuration through the platform Path.
 * @internal @category testing @since 0.0.0
 */
export const readCitationNativeRenderingAsset = Effect.fn("NativeRenderingTest.asset")(function* (
  name: "python-printability" | "builtin-dump-profile"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* path.fromFileUrl(new URL(`../assets/citation/${name}.data`, import.meta.url));
  return yield* fs.readFileString(location);
});
/** Bind a captured fixture to its actual portable maintainer producer bytes.
 * @internal @category testing @since 0.0.0
 */
export const authenticateCitationRenderingProducer = Effect.fn("NativeRenderingTest.producer")(function* (
  name: "probe-python-repr.py" | "probe-dump.py",
  expected: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = yield* path.fromFileUrl(
    new URL(`../../../../goals/citation-extraction-engine/ops/${name}`, import.meta.url)
  );
  const bytes = yield* fs.readFile(location);
  const actual = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(actual).toBe(expected);
});
