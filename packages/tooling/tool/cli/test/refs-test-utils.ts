import { ReferenceWorkspace, referenceWorkspaceLayer } from "@beep/repo-cli/commands/Refs";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Config, ConfigProvider, Context, Effect, FileSystem, Layer, Path } from "effect";

export const writeExecutable = Effect.fn("RefsTest.writeExecutable")(function* (file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, content);
  yield* fs.chmod(file, 0o755);
});

export const fixture = Effect.fn("RefsTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-refs-test-" });
  const owner = path.join(temp, "owner");
  const root = path.join(temp, "references");
  const home = path.join(temp, "home");
  const bin = path.join(temp, "bin");
  for (const directory of [path.join(owner, "scripts"), root, home, bin])
    yield* fs.makeDirectory(directory, { recursive: true });
  const manifestPath = yield* path.fromFileUrl(new URL("../../../../../scripts/references.json", import.meta.url));
  yield* fs.copyFile(manifestPath, path.join(owner, "scripts", "references.json"));
  const ambientPath = yield* Config.String("PATH");
  const config = ConfigProvider.layer(
    ConfigProvider.fromUnknown({ HOME: home, PATH: `${bin}:${ambientPath}`, BEEP_REFERENCES_ROOT: root })
  );
  const service = referenceWorkspaceLayer(owner).pipe(Layer.provideMerge(config));
  return { fs, path, temp, owner, root, home, bin, config, service };
});

export const testPlatform = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(provideScopedLayer(NodeServices.layer));

export const workspace = ReferenceWorkspace;

/**
 * Exposes one isolated reference fixture to its test registration.
 *
 * **Example** (Read the fixture)
 * ```ts
 * import { Effect } from "effect"
 * Effect.isEffect(ReferenceFixture) // => true
 * ```
 * @category test-services
 * @since 0.0.0
 */
export class ReferenceFixture extends Context.Service<ReferenceFixture, Effect.Success<ReturnType<typeof fixture>>>()(
  "@beep/repo-cli/test/refs-test-utils/ReferenceFixture"
) {}

/**
 * Acquires a fixture and its reference service for one test registration.
 *
 * **Details**
 * Register this layer separately for each test. Its temporary directory lives
 * until that registration closes; never share the mutable fixture across tests.
 *
 * **Example** (Inspect the fixture layer)
 * ```ts
 * import { Layer } from "effect"
 * Layer.isLayer(referenceFixtureLayer) // => true
 * ```
 * @category test-layers
 * @since 0.0.0
 */
export const referenceFixtureLayer = Layer.unwrap(
  Effect.gen(function* () {
    const value = yield* fixture();
    return Layer.mergeAll(Layer.succeed(ReferenceFixture, value), value.service);
  })
).pipe(Layer.provideMerge(NodeServices.layer));
