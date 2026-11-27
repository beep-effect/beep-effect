/**
 * Maps a site by watching what its own pages fetch in a signed-in browser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { ConnectionsHidden, Post } from "./content.ts";
import { AuthRequired, MappedItem, MapperFailed, Page, RateLimited, Unavailable } from "./locator.ts";
import { Sessions } from "./session.ts";
import type { BrowserFailed, Exchange } from "./browser.ts";
import type { Profile } from "./content.ts";
import type { MapFailure, Platform } from "./locator.ts";
import type { SiteMapper } from "./mapper.ts";
import type { SiteReader } from "./reader.ts";
import type { Session } from "./session.ts";

const $I = $SocialMapperId.create("core/feed");

/**
 * **Details**
 *
 * `owner` is the answer that describes the account a page belongs to,
 * `timeline` a page of its listing, `aside` a page of a side list such as
 * pinned posts, and `post` the answer for one post opened on its own.
 *
 * **Example** (Tell a side list from the timeline)
 *
 * ```ts import.meta.vitest name="Tell a side list from the timeline"
 * import { FeedPart } from "@/core/feed"
 *
 * FeedPart.is.aside("aside") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FeedPart = LiteralKit(["owner", "timeline", "aside", "post"]).pipe(
  $I.annoteSchema("FeedPart", { description: "What one answer of a site contributes to a mapping run." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type FeedPart = typeof FeedPart.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeedPart {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FeedPart.Encoded;
}

/**
 * **Details**
 *
 * `more` is what the site says about the listing after this page. A site
 * that says nothing leaves it `true`, and the run then ends only by its
 * limits.
 *
 * **Example** (Mark the last page of a listing)
 *
 * ```ts import.meta.vitest name="Mark the last page of a listing"
 * import { FeedPage } from "@/core/feed"
 *
 * FeedPage.make({ more: false }).posts // => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedPage extends S.Opaque<FeedPage, { readonly brand: unique symbol }>()(
  S.Struct({
    posts: S.Array(Post).pipe(
      S.annotateKey({ description: "Posts the answer carried, in the site's order." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    more: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the site reports further pages after this one." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(true)),
      S.withConstructorDefault(Effect.succeed(true))
    ),
  }).pipe($I.annoteSchema("FeedPage", { description: "The posts one answer of a site carried." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FeedPage {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly more?: boolean;
    readonly posts?: ReadonlyArray<Post.Encoded>;
  }
}

/**
 * Everything the engine needs to know about one site.
 *
 * **Details**
 *
 * A site mapped through the browser differs from the next one in five
 * places only: where a target's page lives, which cookies mean a sign-in,
 * which of the page's fetches matter, how their bodies read, and how fast
 * the page may be scrolled. `pace.quiet` is how long the page may go without
 * a fetch that matters before the run is given up. Sign-in checks, status handling, scrolling,
 * ending and the browser's lifetime belong to the engine and are the same
 * for every rule.
 *
 * @category models
 * @since 0.0.0
 */
export interface FeedRule<Target> {
  readonly entry: (target: Target) => URL;
  readonly origin: URL;
  readonly pace: {
    readonly moved: Duration.Duration;
    readonly quiet: Duration.Duration;
    readonly still: Duration.Duration;
  };
  readonly page: (body: unknown, target: Target) => Effect.Effect<FeedPage, S.SchemaError>;
  readonly part: (url: URL, target: Target) => O.Option<FeedPart>;
  readonly platform: Platform;
  readonly profile: (body: unknown, target: Target) => Effect.Effect<Profile, S.SchemaError>;
  readonly signedIn: ReadonlyArray<string>;
}

interface Heard {
  readonly body: unknown;
  readonly part: FeedPart;
}

const refused = (status: number) => status === 401 || status === 403;

const heard = <Target>(rule: FeedRule<Target>, session: Session) => {
  const broken = (detail: string) => MapperFailed.make({ platform: rule.platform, detail });
  const lost = ({ detail }: BrowserFailed) => broken(detail);

  const answer = (part: FeedPart, { body, retryAfter, status }: Exchange): Stream.Stream<Heard, MapFailure> =>
    refused(status)
      ? Stream.fail(AuthRequired.make({ platform: rule.platform }))
      : status === 429
        ? Stream.fail(RateLimited.make({ platform: rule.platform, retryAfter }))
        : status === 404 && !FeedPart.is.aside(part)
          ? Stream.fail(Unavailable.make({ platform: rule.platform, reason: "missing" }))
          : status >= 400
            ? Stream.empty
            : Stream.fromEffect(Effect.mapBoth(body, { onSuccess: (read) => ({ part, body: read }), onFailure: lost }));

  return (target: Target): Stream.Stream<Heard, MapFailure, Sessions> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const sessions = yield* Sessions;
        const tab = yield* Effect.mapError(sessions.tab(session), lost);
        const cookies = yield* Effect.mapError(tab.cookies(rule.origin), lost);
        yield* Effect.logInfo(`opened ${rule.platform}`, rule.entry(target).href);
        if (!A.every(rule.signedIn, (name) => HashSet.has(cookies, name))) {
          yield* Effect.logInfo(`${rule.platform} is not signed in`);
          return yield* AuthRequired.make({ platform: rule.platform });
        }
        yield* tab.scroll.pipe(
          Effect.orElseSucceed(() => false),
          Effect.flatMap((moved) => Effect.sleep(moved ? rule.pace.moved : rule.pace.still)),
          Effect.forever,
          Effect.forkScoped
        );
        return tab.visit(rule.entry(target)).pipe(
          Stream.mapError(lost),
          Stream.flatMap((exchange) =>
            O.match(rule.part(exchange.url, target), {
              onNone: () =>
                Effect.logInfo("passed over", exchange.url.pathname, exchange.status).pipe(
                  Stream.fromEffect,
                  Stream.drain
                ),
              onSome: (part) =>
                Stream.unwrap(
                  Effect.as(
                    Effect.logInfo(`heard ${part}`, exchange.url.pathname, exchange.status),
                    answer(part, exchange)
                  )
                ),
            })
          ),
          Stream.timeoutOrElse({
            duration: rule.pace.quiet,
            orElse: () =>
              Stream.fail(
                broken(
                  `the page loaded no posts for ${Duration.format(rule.pace.quiet)}; this account may have no access to the profile`
                )
              ),
          }),
          Stream.interruptWhen(Effect.andThen(tab.closed, Effect.fail(broken("the browser window was closed"))))
        );
      })
    );
};

const read = <Target>(rule: FeedRule<Target>, session: Session) => {
  const listen = heard(rule, session);
  return (target: Target): Stream.Stream<readonly [FeedPart, FeedPage], MapFailure, Sessions> =>
    listen(target).pipe(
      Stream.filter(({ part }) => !FeedPart.is.owner(part)),
      Stream.mapEffect(({ body, part }) =>
        Effect.mapBoth(rule.page(body, target), {
          onSuccess: (page) => [part, page] as const,
          onFailure: ({ message }) => MapperFailed.make({ platform: rule.platform, detail: message }),
        })
      ),
      Stream.takeUntil(([part, page]) => FeedPart.is.post(part) || (FeedPart.is.timeline(part) && !page.more))
    );
};

const summary = (pinned: boolean) => (post: Post) => {
  const { images, locked, publishedAt, source, videos } = Post.summary(post);
  return MappedItem.make({ source, images, videos, locked, publishedAt, pinned });
};

/**
 * Builds the mapper of a site from its rule.
 *
 * **Details**
 *
 * The listing has no cursor: a page loads its feed from the top and the
 * engine cannot ask for the middle of it, so a resumed run starts over and
 * leans on what the record already holds. Posts of a side list are marked
 * pinned, which keeps them out of the count that ends an incremental run.
 *
 * **Example** (Map a site from a rule)
 *
 * ```ts import.meta.vitest name="Map a site from a rule"
 * import { mapper } from "@/core/feed"
 * import { Session } from "@/core/session"
 * import { rule } from "@/core/sites/onlyfans"
 *
 * const site = mapper(rule(), Session.make({ platform: "onlyfans" }))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mapper: {
  (session: Session): <Target>(rule: FeedRule<Target>) => Effect.Effect<SiteMapper<Target>, never, Sessions>;
  <Target>(rule: FeedRule<Target>, session: Session): Effect.Effect<SiteMapper<Target>, never, Sessions>;
} = dual(
  2,
  <Target>(rule: FeedRule<Target>, session: Session): Effect.Effect<SiteMapper<Target>, never, Sessions> =>
    Effect.map(Effect.context<Sessions>(), (context) => {
      const pages = read(rule, session);
      return {
        pages: (target) =>
          pages(target).pipe(
            Stream.map(([part, { posts }]) =>
              Page.make({ items: A.map(posts, summary(FeedPart.is.aside(part))), aside: FeedPart.is.aside(part) })
            ),
            Stream.provide(context)
          ),
      };
    })
);

/**
 * Builds the reader of a site from its rule.
 *
 * **Details**
 *
 * `posts` of a single post opens that post's own page, which is how a
 * signed media address that has expired is obtained again. No rule reads
 * follower lists, so `connections` always reports them hidden.
 *
 * **Example** (Read a site from a rule)
 *
 * ```ts import.meta.vitest name="Read a site from a rule"
 * import { reader } from "@/core/feed"
 * import { Session } from "@/core/session"
 * import { rule } from "@/core/sites/onlyfans"
 *
 * const site = reader(rule(), Session.make({ platform: "onlyfans" }))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const reader: {
  (session: Session): <Target>(rule: FeedRule<Target>) => Effect.Effect<SiteReader<Target>, never, Sessions>;
  <Target>(rule: FeedRule<Target>, session: Session): Effect.Effect<SiteReader<Target>, never, Sessions>;
} = dual(
  2,
  <Target>(rule: FeedRule<Target>, session: Session): Effect.Effect<SiteReader<Target>, never, Sessions> =>
    Effect.map(Effect.context<Sessions>(), (context) => {
      const pages = read(rule, session);
      const listen = heard(rule, session);
      const missing = Unavailable.make({ platform: rule.platform, reason: "missing" });
      return {
        posts: (target) =>
          pages(target).pipe(
            Stream.flatMap(([, { posts }]) => Stream.fromIterable(posts)),
            Stream.provide(context)
          ),
        profile: (target) =>
          listen(target).pipe(
            Stream.filter(({ part }) => FeedPart.is.owner(part)),
            Stream.mapEffect(({ body }) =>
              Effect.mapError(rule.profile(body, target), ({ message }) =>
                MapperFailed.make({ platform: rule.platform, detail: message })
              )
            ),
            Stream.runHead,
            Effect.flatMap(O.match({ onNone: () => Effect.fail(missing), onSome: Effect.succeed })),
            Effect.provide(context)
          ),
        connections: flow(
          (_: Target, connection) => ConnectionsHidden.make({ platform: rule.platform, connection }),
          Stream.fail
        ),
      };
    })
);
