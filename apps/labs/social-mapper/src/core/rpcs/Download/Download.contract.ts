/**
 * The `Download` operation of the library contract: save the media a listing still lacks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Rpc from "effect/rpc/Rpc";
import * as S from "effect/Schema";
import { DownloadFailed } from "../../download.ts";
import { SavedFile } from "../../inventory.ts";
import { CollectionLocatorFromUrl, MapFailure } from "../../locator.ts";
import { StoreFailed } from "../../store.ts";

const $I = $SocialMapperId.create("core/rpcs/Download");

/**
 * **Example** (Name the listing to save)
 *
 * ```ts import.meta.vitest name="Name the listing to save (Download)"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@/core/locator"
 * import { Payload } from "@/core/rpcs/Download/Download.contract"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * Payload.make({ source }).source.platform // => "redgifs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Payload extends S.Opaque<Payload, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CollectionLocatorFromUrl,
  }).pipe($I.annoteSchema("Payload", { description: "The listing whose missing files are saved." }))
) {}

/**
 * **Example** (Accept a listing with nothing left to save)
 *
 * ```ts import.meta.vitest name="Accept a listing with nothing left to save"
 * import { Success } from "@/core/rpcs/Download/Download.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Success)([]) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Success = S.Array(SavedFile).pipe(
  $I.annoteSchema("Success", { description: "The files this call saved." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Success = typeof Success.Type;

/**
 * **Example** (Tell a refused site from a full disk)
 *
 * ```ts import.meta.vitest name="Tell a refused site from a full disk"
 * import { AuthRequired } from "@/core/locator"
 * import { Failure } from "@/core/rpcs/Download/Download.contract"
 * import * as S from "effect/Schema"
 *
 * S.is(Failure)(AuthRequired.make({ platform: "onlyfans" })) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const Failure = S.Union([DownloadFailed, MapFailure, StoreFailed]).pipe(
  $I.annoteSchema("Failure", { description: "Why the files of a listing could not be saved." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Failure = typeof Failure.Type;

/**
 * Saves every file the listing still lacks, one post at a time, and answers with the files saved.
 *
 * **Example** (Read the operation's tag)
 *
 * ```ts import.meta.vitest name="Read the Download operation's tag"
 * import { Contract } from "@/core/rpcs/Download/Download.contract"
 *
 * Contract._tag // => "Download"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Contract = Rpc.make("Download", {
  payload: Payload,
  success: Success,
  error: Failure,
});
