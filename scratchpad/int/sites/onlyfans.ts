/**
 * OnlyFans, as a rule for the feed engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Profile } from "../content.ts"
import { FeedPage, type FeedPart, type FeedRule, mapper, reader } from "../feed.ts"
import { OnlyFansTarget } from "../locator.ts"
import { OnlyFansMapper } from "../mapper.ts"
import { OnlyFansReader } from "../reader.ts"
import { Session, type Sessions } from "../session.ts"

const $I = $ScratchpadId.create("int/sites/onlyfans")

const canonical = "https://onlyfans.com"

/**
 * **Details**
 *
 * `origin` is where the site is browsed and `media` lists hosts trusted to
 * serve files besides the site's own. Both exist so the rule can be pointed
 * at a stand-in; a post's identity is always its address on the real site.
 *
 * **Example** (Slow the scrolling down)
 *
 * ```ts import.meta.vitest name="Slow the scrolling down"
 * import { Options } from "@beep/scratchpad/int/sites/onlyfans"
 * import * as Duration from "effect/Duration"
 *
 * Options.make({ moved: Duration.seconds(3) }).origin.host // => "onlyfans.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Options extends S.Opaque<Options, { readonly brand: unique symbol }>()(
  S.Struct({
    origin: S.URLFromString.pipe(
      S.annotateKey({ description: "Where the site is browsed." }),
      S.withDecodingDefaultTypeKey(Effect.sync(() => new URL(canonical))),
      S.withConstructorDefault(Effect.sync(() => new URL(canonical)))
    ),
    media: S.Array(S.NonEmptyString).pipe(
      S.annotateKey({ description: "Hosts trusted to serve files besides the site's own." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    moved: S.DurationFromMillis.pipe(
      S.annotateKey({ description: "Pause after a scroll that moved the page." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.millis(1500))),
      S.withConstructorDefault(Effect.succeed(Duration.millis(1500)))
    ),
    still: S.DurationFromMillis.pipe(
      S.annotateKey({ description: "Pause after a scroll that left the page where it was." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.seconds(4))),
      S.withConstructorDefault(Effect.succeed(Duration.seconds(4)))
    )
  }).pipe($I.annoteSchema("Options", { description: "Where and how fast OnlyFans is browsed." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Options {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly origin?: string;
    readonly media?: ReadonlyArray<string>;
    readonly moved?: number;
    readonly still?: number;
  }
}

const maybe = S.OptionFromOptionalNullOr

const Pixels = S.Int.check(S.isGreaterThan(0))

const WireFile = S.Struct({ url: maybe(S.String), width: maybe(S.Finite), height: maybe(S.Finite) })

const WireMedia = S.Struct({
  id: S.Finite,
  type: S.String,
  canView: maybe(S.Boolean),
  duration: maybe(S.Finite),
  files: maybe(S.Struct({ full: maybe(WireFile) }))
})

const WirePost = S.Struct({
  id: S.Finite,
  author: S.Struct({ id: S.Finite }),
  postedAt: maybe(S.DateTimeUtcFromString),
  rawText: maybe(S.String),
  canViewMedia: maybe(S.Boolean),
  media: WireMedia.pipe(S.Array, maybe)
})

const WireList = S.Struct({ list: S.Array(WirePost), hasMore: maybe(S.Boolean) })

const feed = (body: unknown) =>
  Effect.firstSuccessOf([
    S.decodeUnknownEffect(WireList)(body),
    Effect.map(S.decodeUnknownEffect(S.Array(WirePost))(body), (list) => ({ list, hasMore: O.none<boolean>() })),
    Effect.map(S.decodeUnknownEffect(WirePost)(body), (post) => ({ list: A.of(post), hasMore: O.some(false) }))
  ])

const WireOwner = S.Struct({
  id: S.Finite,
  username: S.String,
  name: maybe(S.String),
  rawAbout: maybe(S.String),
  isVerified: maybe(S.Boolean)
})

const denied = O.contains(false)

const cdn = Str.match(/^cdn\d*\.onlyfans\.com$/)

const kinds: Record<string, "image" | "video"> = { photo: "image", video: "video", gif: "video" }

const posts = (options: Options) => {
  const trusted = (address: string) =>
    pipe(
      O.liftThrowable((text: string) => new URL(text))(address),
      O.filter(
        ({ host, pathname }) =>
          A.contains(options.media, host) || (O.isSome(cdn(host)) && Str.startsWith("/files/")(pathname))
      )
    )

  const item = (open: boolean) => (media: typeof WireMedia.Type) =>
    O.map(R.get(kinds, media.type), (kind) => {
      const full = O.flatMap(media.files, ({ full }) => full)
      const size = R.getSomes({
        width: O.filter(O.flatMap(full, ({ width }) => width), S.is(Pixels)),
        height: O.filter(O.flatMap(full, ({ height }) => height), S.is(Pixels))
      })
      return {
        kind,
        id: `${media.id}`,
        ...size,
        ...R.getSomes({
          duration: O.filter(O.map(media.duration, (seconds) => seconds * 1000), () => kind === "video")
        }),
        access:
          open && !denied(media.canView)
            ? {
                kind: "full",
                renditions: pipe(
                  O.flatMap(full, ({ url }) => url),
                  O.flatMap(trusted),
                  O.map(({ href }) => ({ url: href, ...size })),
                  O.toArray
                )
              }
            : { kind: "locked" }
      }
    })

  return (user: string) => (post: typeof WirePost.Type) => ({
    source: `${canonical}/${post.id}/${user}`,
    id: `${post.id}`,
    author: { by: "id", id: `${post.author.id}`, handle: user },
    media: A.getSomes(A.map(O.getOrElse(post.media, A.empty), item(!denied(post.canViewMedia)))),
    ...R.getSomes({ body: O.map(post.rawText, (text) => ({ text })) }),
    ...R.getSomes({ publishedAt: O.map(post.postedAt, DateTime.toEpochMillis) })
  })
}

const numbered = Str.match(/^\/api2\/v2\/users\/\d+\/posts$/)

const named = Str.match(/^\/api2\/v2\/users\/([^/]+)$/)

const single = Str.match(/^\/api2\/v2\/posts\/(\d+)$/)

const captured = (match: O.Option<RegExpMatchArray>) => O.flatMap(match, A.get(1))

/**
 * Describes OnlyFans to the feed engine.
 *
 * **Details**
 *
 * The profile page fetches the account by name and then its posts by
 * number; a `pinned` query marks the side list. A post opened on its own
 * fetches that one post, with freshly signed file addresses. A file is
 * offered for download only from the site's file hosts: any other address
 * is kept out of the post, as is the address of an item the viewer has not
 * paid for.
 *
 * **Gotchas**
 *
 * Items the site serves only through its protected player have no file
 * address. They read as viewable items with nothing to fetch.
 *
 * **Example** (Recognise the answers of a profile page)
 *
 * ```ts import.meta.vitest name="Recognise the answers of a profile page"
 * import { OnlyFansTarget } from "@beep/scratchpad/int/locator"
 * import { rule } from "@beep/scratchpad/int/sites/onlyfans"
 *
 * const target = OnlyFansTarget.cases.collection.make({ user: "example" })
 * const part = rule().part(new URL("https://onlyfans.com/api2/v2/users/7/posts?pinned=1"), target)
 * part // => Option.some("aside")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rule = (options: Options = Options.make({})): FeedRule<OnlyFansTarget> => {
  const encoded = posts(options)
  const listing = (url: URL): O.Option<FeedPart> =>
    O.map(numbered(url.pathname), () => (url.searchParams.get("pinned") === "1" ? "aside" : "timeline"))
  const owner = (url: URL, user: string): O.Option<FeedPart> =>
    O.map(
      O.filter(captured(named(url.pathname)), (name) => Str.toLowerCase(name) === user),
      (): FeedPart => "owner"
    )
  return {
    platform: "onlyfans",
    origin: options.origin,
    signedIn: ["sess", "auth_id"],
    pace: { moved: options.moved, still: options.still },
    entry: OnlyFansTarget.match({
      collection: ({ user }) => new URL(`/${user}`, options.origin),
      post: ({ id, user }) => new URL(`/${id}/${user}`, options.origin)
    }),
    part: (url, target) =>
      url.origin === options.origin.origin
        ? OnlyFansTarget.match(target, {
            collection: ({ user }) => O.orElse(owner(url, user), () => listing(url)),
            post: ({ id }) => O.map(
              O.filter(captured(single(url.pathname)), (found) => found === id),
              (): FeedPart => "post"
            )
          })
        : O.none(),
    page: (body, { user }) =>
      feed(body).pipe(
        Effect.map(({ hasMore, list }) => ({ posts: A.map(list, encoded(user)), more: !denied(hasMore) })),
        Effect.flatMap(S.decodeUnknownEffect(FeedPage))
      ),
    profile: (body, { user }) =>
      S.decodeUnknownEffect(WireOwner)(body).pipe(
        Effect.map(({ id, isVerified, name, rawAbout, username }) => ({
          source: `${canonical}/${user}`,
          account: { by: "id", id: `${id}`, handle: username, ...R.getSomes({ name }) },
          verified: O.getOrElse(isVerified, () => false),
          ...R.getSomes({ bio: O.map(rawAbout, (text) => ({ text })) })
        })),
        Effect.flatMap(S.decodeUnknownEffect(Profile))
      )
  }
}

const account = Session.make({ platform: "onlyfans" })

/**
 * Maps and reads OnlyFans through a signed-in browser session.
 *
 * **Example** (Provide OnlyFans to a program)
 *
 * ```ts import.meta.vitest name="Provide OnlyFans to a program"
 * import { layer } from "@beep/scratchpad/int/sites/onlyfans"
 *
 * const site = layer()
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (options: Options = Options.make({})): Layer.Layer<OnlyFansMapper | OnlyFansReader, never, Sessions> =>
  Layer.merge(
    Layer.effect(OnlyFansMapper, mapper(rule(options), account)),
    Layer.effect(OnlyFansReader, reader(rule(options), account))
  )
