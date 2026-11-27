import {
  Account,
  ConnectionsHidden,
  DzenReader,
  FacebookReader,
  FanslyReader,
  handleOf,
  InstagramReader,
  OnlyFansReader,
  PinterestReader,
  Post,
  Profile,
  RedditReader,
  RedGifsReader,
  SnapchatReader,
  ThreadsReader,
  TikTokReader,
  VscoReader,
  XReader,
  YouTubeReader,
} from "@beep/scratchpad/int/content";
import {
  AuthRequired,
  CollectionLocator,
  Locator,
  LocatorFromUrl,
  type Platform,
  PostLocator,
  RateLimited,
  RedGifsTarget,
  locate,
} from "@beep/scratchpad/int/locator";
import { ReaderRpcs } from "@beep/scratchpad/int/protocol";
import { ReaderHandlers } from "@beep/scratchpad/int/protocol.handler";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as RpcTest from "effect/rpc/RpcTest";
import * as Stream from "effect/Stream";

const owner = Account.cases.handle.make({ handle: "example" });
const clip = (id: string) =>
  Post.make({
    source: PostLocator.make(Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id }) })),
    author: owner,
  });

const signedOut = (platform: Platform) => ({
  posts: () => Stream.fail(AuthRequired.make({ platform })),
  profile: () => Effect.fail(AuthRequired.make({ platform })),
  connections: () => Stream.fail(AuthRequired.make({ platform })),
});

const redgifs = Layer.succeed(RedGifsReader, {
  posts: () => Stream.make(clip("calmclip"), clip("loudclip")).pipe(Stream.concat(Stream.fail(RateLimited.make({ platform: "redgifs" })))),
  profile: Effect.fn("RedGifsReader.profile")((target: RedGifsTarget) =>
    RedGifsTarget.match(target, {
      collection: (collection) =>
        Effect.succeed(
          Profile.make({
            source: CollectionLocator.make(Locator.cases.redgifs.make({ target: collection })),
            account: owner,
          })
        ),
      post: () => Effect.fail(RateLimited.make({ platform: "redgifs" })),
    })
  ),
  connections: (_, connection) => Stream.fail(ConnectionsHidden.make({ platform: "redgifs", connection })),
});

const readers = Layer.mergeAll(
  redgifs,
  Layer.succeed(XReader, signedOut("x")),
  Layer.succeed(YouTubeReader, signedOut("youtube")),
  Layer.succeed(FacebookReader, signedOut("facebook")),
  Layer.succeed(FanslyReader, signedOut("fansly")),
  Layer.succeed(InstagramReader, signedOut("instagram")),
  Layer.succeed(OnlyFansReader, signedOut("onlyfans")),
  Layer.succeed(PinterestReader, signedOut("pinterest")),
  Layer.succeed(SnapchatReader, signedOut("snapchat")),
  Layer.succeed(ThreadsReader, signedOut("threads")),
  Layer.succeed(TikTokReader, signedOut("tiktok")),
  Layer.succeed(VscoReader, signedOut("vsco")),
  Layer.succeed(RedditReader, signedOut("reddit")),
  Layer.succeed(DzenReader, signedOut("dzen"))
);

it.layer(ReaderHandlers.pipe(Layer.provide(readers)))("the reader protocol", (it) => {
  it.effect("reads a profile from a URL in two steps", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ReaderRpcs);
      const locator = yield* locate("https://redgifs.com/users/Example/");
      const found = yield* client.Profile({ locator });
      expect(handleOf(found.account)).toEqual(O.some("example"));
    }).pipe(Effect.scoped)
  );

  it.effect("keeps a failure of a single read tagged for the caller", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ReaderRpcs);
      const locator = yield* locate("https://www.redgifs.com/watch/calmclip");
      const outcome = yield* client.Profile({ locator }).pipe(
        Effect.as("read"),
        Effect.catchTag("RateLimited", ({ platform }) => Effect.succeed(`throttled by ${platform}`))
      );
      expect(outcome).toBe("throttled by redgifs");
    }).pipe(Effect.scoped)
  );

  it.effect("routes a locator to the reader of its platform", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ReaderRpcs);
      const refusals = yield* Effect.forEach(
        ["https://x.com/jack", "https://www.instagram.com/example/", "https://www.tiktok.com/@example"],
        (url) =>
          locate(url).pipe(
            Effect.flatMap((locator) => client.Profile({ locator })),
            Effect.as("read"),
            Effect.catchTag("AuthRequired", ({ platform }) => Effect.succeed(platform))
          ),
        { concurrency: 3 }
      );
      expect(refusals).toEqual(["x", "instagram", "tiktok"]);
    }).pipe(Effect.scoped)
  );

  it.effect("streams posts and keeps what arrived before a tagged failure", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ReaderRpcs);
      const locator = yield* locate("https://www.redgifs.com/users/example");
      const seen = yield* client.Posts({ locator }).pipe(
        Stream.mapEffect(({ source }) => S.encodeEffect(LocatorFromUrl)(source)),
        Stream.catchTag("RateLimited", () => Stream.make("throttled")),
        Stream.runCollect
      );
      expect(A.fromIterable(seen)).toEqual(["https://www.redgifs.com/watch/calmclip", "https://www.redgifs.com/watch/loudclip", "throttled"]);
    }).pipe(Effect.scoped)
  );

  it.effect("names a hidden connection list in the stream's own error", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(ReaderRpcs);
      const locator = yield* locate("https://www.redgifs.com/users/example");
      const outcome = yield* client.Connections({ locator, connection: "followers" }).pipe(
        Stream.runCount,
        Effect.catchTag("ConnectionsHidden", ({ connection }) => Effect.succeed(`no ${connection} list`))
      );
      expect(outcome).toBe("no followers list");
    }).pipe(Effect.scoped)
  );
});
