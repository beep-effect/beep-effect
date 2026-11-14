/** Shared packed rendering facts.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

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
