/**
 * Serves the library to the desktop window over loopback HTTP.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as R from "effect/Record";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import { layer as chromium } from "../src/core/browser.playwright.ts";
import { Catalog } from "../src/core/catalog.ts";
import { Downloads } from "../src/core/download.ts";
import { Library } from "../src/core/library.ts";
import { LibraryHandlers, ReaderHandlers } from "../src/core/protocol.layer.ts";
import { LibraryRpcs, ReaderRpcs } from "../src/core/protocol.ts";
import { Sessions } from "../src/core/session.ts";
import { installed, Options, layer as onlyfans } from "../src/core/sites/onlyfans.ts";
import { layer as unmapped } from "../src/core/sites/unmapped.ts";
import { Inventories } from "../src/core/store.ts";
import * as Guard from "./Guard.ts";

const bunMaxIdleTimeoutSeconds = 255;

const Settings = Config.all({
  port: Config.Port("SOCIAL_MAPPER_PORT").pipe(Config.withDefault(3941)),
  token: Config.Redacted("SOCIAL_MAPPER_TOKEN"),
  origins: Config.Array(S.NonEmptyString, "SOCIAL_MAPPER_ORIGINS").pipe(
    Config.withDefault(["http://social-mapper.labs.beep.localhost:1355"])
  ),
  data: Config.option(Config.NonEmptyString("SOCIAL_MAPPER_DATA")),
  home: Config.NonEmptyString("HOME"),
  onlyfans: Config.all({
    origin: Config.option(Config.URL("SOCIAL_MAPPER_ONLYFANS_ORIGIN")),
    entry: Config.option(Config.NonEmptyString("SOCIAL_MAPPER_ONLYFANS_ENTRY")),
    media: Config.option(Config.Array(S.NonEmptyString, "SOCIAL_MAPPER_ONLYFANS_MEDIA")),
  }).pipe(
    Config.map((given) =>
      Options.make({
        ...R.getSomes({ origin: given.origin }),
        ...R.getSomes({ entry: given.entry }),
        ...R.getSomes({ media: given.media }),
      })
    )
  ),
});

const Main = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* Settings;
    const path = yield* Path.Path;
    const root = O.getOrElse(settings.data, () => path.join(settings.home, ".local", "share", "beep-social-mapper"));
    const Services = Downloads.layer(path.join(root, "files")).pipe(
      Layer.provide(FetchHttpClient.layer),
      Layer.provideMerge(Library.layer()),
      Layer.provideMerge(Inventories.layer),
      Layer.provide(KeyValueStore.layerFileSystem(path.join(root, "store"))),
      Layer.provideMerge(Layer.merge(onlyfans(settings.onlyfans), unmapped)),
      Layer.provideMerge(Sessions.layer(path.join(root, "sessions"))),
      Layer.provide(chromium),
      Layer.provideMerge(Layer.succeed(Catalog, { installed: [installed(settings.onlyfans)] }))
    );
    const Served = RpcServer.layer(LibraryRpcs.merge(ReaderRpcs)).pipe(
      Layer.provide(Layer.merge(LibraryHandlers, ReaderHandlers)),
      Layer.provide(Services)
    );
    const Routes = Layer.merge(
      RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(Layer.provide(HttpRouter.layer)),
      Guard.layer({ token: settings.token, origins: settings.origins }).pipe(Layer.provide(HttpRouter.layer))
    );
    return HttpRouter.serve(Served.pipe(Layer.provideMerge(Routes))).pipe(
      Layer.provide(
        BunHttpServer.layer({ hostname: "127.0.0.1", port: settings.port, idleTimeout: bunMaxIdleTimeoutSeconds })
      ),
      Layer.provide(RpcSerialization.layerNdjson)
    );
  })
).pipe(Layer.provide(BunServices.layer));

Main.pipe(Layer.launch, BunRuntime.runMain);
