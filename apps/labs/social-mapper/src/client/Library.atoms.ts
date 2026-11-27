/**
 * The window's view of the library: what is kept, and the actions on it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CollectionLocatorFromUrl } from "@/core/locator";
import { LibraryRpcs } from "@/core/protocol";
import { Listing } from "./Listing.ts";
import type { MapMode } from "@/core/library";
import type { Platform } from "@/core/locator";

const protocol = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer])
);

/**
 * Calls the library the desktop server hosts.
 *
 * **Example** (List what the library keeps)
 *
 * ```ts
 * import { LibraryClient } from "@/client/Library.atoms"
 *
 * const kept = LibraryClient.use((client) => client("InventoryList", {}))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LibraryClient extends AtomRpc.Service<LibraryClient>()("LibraryClient", {
  group: LibraryRpcs,
  protocol,
}) {}

const sameListings = S.toEquivalence(S.Array(Listing));

/**
 * Every kept listing, read again each second so a run or a download shows as it goes.
 *
 * @category atoms
 * @since 0.0.0
 */
export const listings = LibraryClient.runtime.atom(
  Stream.tick(Duration.seconds(1)).pipe(
    Stream.mapEffect(() => LibraryClient.use((client) => client("InventoryList", {}))),
    Stream.mapEffect(Effect.forEach(Listing.of, { concurrency: 1 })),
    Stream.changesWith(sameListings),
    Stream.retry(Schedule.spaced(Duration.seconds(2)))
  )
);

/**
 * @category atoms
 * @since 0.0.0
 */
export const platforms = LibraryClient.query("PlatformList", {});

/**
 * @category atoms
 * @since 0.0.0
 */
export const draft = Atom.make("");

/**
 * @category atoms
 * @since 0.0.0
 */
export const chosen = Atom.make(O.none<string>());

const located = (address: string) => S.decodeEffect(CollectionLocatorFromUrl)(Str.trim(address));

/**
 * Starts a run over the listing at an address; a new address is kept from then on.
 *
 * @category atoms
 * @since 0.0.0
 */
export const run = Atom.family((mode: MapMode) =>
  LibraryClient.runtime.fn(
    Effect.fn("Library.run")(function* (address: string) {
      const source = yield* located(address);
      return yield* LibraryClient.use((client) => client("MapRun", { source, mode }));
    })
  )
);

/**
 * @category atoms
 * @since 0.0.0
 */
export const stop = LibraryClient.runtime.fn(
  Effect.fn("Library.stop")(function* (address: string) {
    const source = yield* located(address);
    return yield* LibraryClient.use((client) => client("MapStop", { source }));
  })
);

/**
 * Saves the files a listing still lacks; one atom for each listing, so each shows its own progress.
 *
 * @category atoms
 * @since 0.0.0
 */
export const download = Atom.family((address: string) =>
  LibraryClient.runtime.fn(
    Effect.fn("Library.download")(function* () {
      const source = yield* located(address);
      return yield* LibraryClient.use((client) => client("Download", { source }));
    })
  )
);

/**
 * Opens a platform's sign-in window; it stays waiting until the window closes or the call is interrupted.
 *
 * @category atoms
 * @since 0.0.0
 */
export const signIn = Atom.family((platform: Platform) =>
  LibraryClient.runtime.fn(
    Effect.fn("Library.signIn")(function* (entry: URL) {
      return yield* LibraryClient.use((client) => client("SessionOpen", { session: { platform }, entry }));
    })
  )
);
