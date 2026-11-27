import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { Account, ConnectionsHidden, handleOf, Post, Profile } from "@/core/content";
import { AuthRequired, CollectionLocator, Locator, locate, PostLocator, XTarget } from "@/core/locator";
import {
  connections,
  DzenReader,
  FacebookReader,
  FanslyReader,
  InstagramReader,
  OnlyFansReader,
  PinterestReader,
  posts,
  profile,
  RedditReader,
  RedGifsReader,
  SnapchatReader,
  ThreadsReader,
  TikTokReader,
  VscoReader,
  XReader,
  YouTubeReader,
} from "@/core/reader";
import type { Connection } from "@/core/content";
import type { Platform } from "@/core/locator";

const jack = Account.cases.id.make({ id: "12", handle: O.some("jack") });
const follower = Account.cases.handle.make({ handle: "fan" });
const silent = (platform: Platform) => ({
  posts: () => Stream.empty,
  profile: () => Effect.fail(AuthRequired.make({ platform })),
  connections: (_: unknown, connection: Connection) => Stream.fail(ConnectionsHidden.make({ platform, connection })),
});

it.layer(
  Layer.mergeAll(
    Layer.succeed(XReader, {
      posts: (target) =>
        Stream.make(
          Post.make({
            source: PostLocator.make(
              Locator.cases.x.make({ target: XTarget.cases.post.make({ handle: target.handle, id: "20" }) })
            ),
            author: jack,
          })
        ),
      profile: Effect.fn("XReader.profile")((target: XTarget) =>
        Effect.succeed(
          Profile.make({ source: CollectionLocator.make(Locator.cases.x.make({ target })), account: jack })
        )
      ),
      connections: (_, connection) => (connection === "followers" ? Stream.make(follower) : Stream.empty),
    }),
    Layer.succeed(YouTubeReader, silent("youtube")),
    Layer.succeed(RedGifsReader, silent("redgifs")),
    Layer.succeed(FacebookReader, silent("facebook")),
    Layer.succeed(FanslyReader, silent("fansly")),
    Layer.succeed(InstagramReader, silent("instagram")),
    Layer.succeed(OnlyFansReader, silent("onlyfans")),
    Layer.succeed(PinterestReader, silent("pinterest")),
    Layer.succeed(SnapchatReader, silent("snapchat")),
    Layer.succeed(ThreadsReader, silent("threads")),
    Layer.succeed(TikTokReader, silent("tiktok")),
    Layer.succeed(VscoReader, silent("vsco")),
    Layer.succeed(RedditReader, silent("reddit")),
    Layer.succeed(DzenReader, silent("dzen"))
  )
)("readers", (it) => {
  it.effect("routes a locator to the reader of its platform", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://twitter.com/jack");
      const found = yield* profile(locator);
      const read = yield* posts(locator).pipe(Stream.runCollect);
      expect(handleOf(found.account)).toEqual(O.some("jack"));
      expect(A.length(read)).toBe(1);
    })
  );

  it.effect("streams the accounts behind a follower count in either argument order", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://x.com/jack");
      const followers = yield* connections(locator, "followers").pipe(Stream.runCollect);
      const following = yield* pipe(locator, connections("following"), Stream.runCollect);
      expect(A.map(followers, handleOf)).toEqual([O.some("fan")]);
      expect(A.length(following)).toBe(0);
    })
  );

  it.effect("names the hidden connection when a site lists none", () =>
    Effect.gen(function* () {
      const locator = yield* locate("https://www.reddit.com/user/example");
      const failure = yield* connections(locator, "followers").pipe(Stream.runCollect, Effect.flip);
      expect(failure._tag).toBe("ConnectionsHidden");
    })
  );
});
