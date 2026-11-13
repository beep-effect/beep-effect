/**
 * Loads a host stack's typed configuration from a JSON file named by an
 * environment variable.
 *
 * Host addresses, logins, paths and ports are machine facts, so no tracked
 * file carries them: each stack reads one JSON file that lives on the operator
 * workstation, decoded through the stack's schema. The file holds `op://`
 * references only; resolved secrets reach a deploy solely through the
 * environment `op run` builds, never through this file or the stack props.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Config from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

/**
 * Read and decode the JSON configuration file named by `envKey`.
 *
 * Every failure (unset variable, unreadable file, malformed JSON, a value the
 * schema rejects) surfaces as a `ConfigError`, the one error an
 * `Alchemy.Stack` body may raise, so a bad file stops a plan before any
 * resource is read.
 *
 * **Example** (Load a config file)
 * ```ts
 * import { loadHostConfigFile } from "@beep/infra-hosts/HostConfigFile"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const Settings = S.Struct({ port: S.Int })
 * const load = loadHostConfigFile(Settings, "EXAMPLE_HOST_CONFIG")
 * console.log(Effect.isEffect(load)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadHostConfigFile = Effect.fn("HostConfigFile.loadHostConfigFile")(function* <
  Codec extends S.Top & { readonly DecodingServices: never },
>(schema: Codec, envKey: string): Effect.fn.Return<Codec["Type"], Config.ConfigError, FileSystem.FileSystem> {
  const path = yield* Config.NonEmptyString(envKey);
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(path)
    .pipe(
      Effect.mapError(
        (cause) =>
          new Config.ConfigError(
            new SourceError({ message: `Cannot read the host stack config file named by ${envKey}.`, cause })
          )
      )
    );
  return yield* S.decodeEffect(S.fromJsonString(schema))(text).pipe(
    Effect.mapError((error) => new Config.ConfigError(error))
  );
});
