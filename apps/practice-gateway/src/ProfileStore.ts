/**
 * The saved practice profile: one JSON file under the gateway data
 * directory, written by the onboarding interview and read by every setup
 * tool.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import { PracticeProfile } from "@beep/law-practice-domain";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { GatewaySettings } from "./GatewaySettings.ts";
import { ProfileStoreFailure } from "./PracticeGateway.errors.ts";

const $I = $PracticeGatewayId.create("ProfileStore");

/**
 * File name of the saved profile inside the gateway data directory.
 *
 * **Example** (Read the profile file name)
 *
 * ```ts
 * import { PROFILE_FILE_NAME } from "@beep/practice-gateway/ProfileStore"
 *
 * console.log(PROFILE_FILE_NAME) // "practice-profile.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROFILE_FILE_NAME = "practice-profile.json";

const ProfileJson = S.fromJsonString(PracticeProfile);
const decodeProfileJson = S.decodeEffect(ProfileJson);
const encodeProfileJson = S.encodeEffect(ProfileJson);

/**
 * Service shape of the profile store.
 *
 * @category models
 * @since 0.0.0
 */
export interface ProfileStoreShape {
  /**
   * Read the saved profile; `None` when none has been saved yet.
   */
  readonly get: Effect.Effect<O.Option<PracticeProfile>, ProfileStoreFailure>;
  /**
   * Replace the saved profile and return it.
   */
  readonly save: (profile: PracticeProfile) => Effect.Effect<PracticeProfile, ProfileStoreFailure>;
}

/**
 * Persistence for the practice profile.
 *
 * **Details**
 *
 * The profile holds capability choices and IT limits only, never secrets or
 * client data. Saving writes a sibling temporary file and renames it over the
 * old one, so a crash mid-write leaves the previous profile intact.
 *
 * **Example** (Read the saved profile)
 *
 * ```ts
 * import { ProfileStore } from "@beep/practice-gateway/ProfileStore"
 * import * as Effect from "effect/Effect"
 *
 * const program = ProfileStore.use((store) => store.get)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProfileStore extends Context.Service<ProfileStore, ProfileStoreShape>()($I`ProfileStore`) {
  /**
   * File-backed store under {@link GatewaySettings}' data directory.
   *
   * **Example** (Compose the file-backed store)
   *
   * ```ts
   * import { ProfileStore } from "@beep/practice-gateway/ProfileStore"
   *
   * console.log(typeof ProfileStore.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    ProfileStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const settings = yield* GatewaySettings;
      const file = path.join(settings.dataDir, PROFILE_FILE_NAME);

      const get = Effect.gen(function* () {
        const present = yield* fs.exists(file);
        if (!present) {
          return O.none<PracticeProfile>();
        }
        const text = yield* fs.readFileString(file);
        return O.some(yield* decodeProfileJson(text));
      }).pipe(
        Effect.mapError((cause) =>
          ProfileStoreFailure.make({ cause, message: `The saved practice profile at "${file}" could not be read.` })
        ),
        Effect.withSpan("ProfileStore.get")
      );

      const save = Effect.fn("ProfileStore.save")(function* (profile: PracticeProfile) {
        const temporary = `${file}.tmp`;
        yield* Effect.gen(function* () {
          const text = yield* encodeProfileJson(profile);
          yield* fs.makeDirectory(settings.dataDir, { recursive: true });
          yield* fs.writeFileString(temporary, `${text}\n`);
          yield* fs.rename(temporary, file);
        }).pipe(
          Effect.mapError((cause) =>
            ProfileStoreFailure.make({ cause, message: `The practice profile could not be saved to "${file}".` })
          )
        );
        return profile;
      });

      return ProfileStore.of({ get, save });
    })
  );
}
