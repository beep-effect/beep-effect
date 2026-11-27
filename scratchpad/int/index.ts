/**
 * Profile and media route templates for the VidBee mapper catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as T from "effect/SchemaTransformation";
import * as UrlParams from "effect/http/UrlParams";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Layer from "effect/Layer";
import { identity } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as Tuple from "effect/Tuple";
import * as Url from "effect/http/Url";
import * as O from "effect/Option";

const $I = $ScratchpadId.create("int/index");

const MediaFormat = LiteralKit(["Image", "Video", "Audio"]).pipe(
  $I.annoteSchema("MediaFormat", { description: "Media format served by a content section." })
);
const MediaFormats = S.NonEmptyArray(MediaFormat)
  .check(S.isUnique())
  .pipe($I.annoteSchema("MediaFormats", { description: "Distinct media formats supported by one section." }));

const ParameterName = S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9_]*$/)).pipe(
  $I.annoteSchema("ParameterName", { description: "Identifier used between braces in a route template." })
);

const ParameterRole = LiteralKit(["profile", "content", "selector"]).pipe(
  $I.annoteSchema("ParameterRole", { description: "Identifies the entity or selector supplied by a route parameter." })
);
const Parameters = S.Record(S.String, S.Struct({ role: ParameterRole }))
  .check(S.isPropertyNames(ParameterName))
  .pipe($I.annoteSchema("Parameters", { description: "Platform-specific bindings indexed by placeholder name." }));

const legacyParameters = {
  username: { role: "profile" },
  userId: { role: "profile" },
  contentId: { role: "content" },
  galleryIndex: { role: "selector" },
} satisfies typeof Parameters.Type;

const placeholder = /\{([A-Za-z][A-Za-z0-9_]*)}/;
const segment = `(?:[A-Za-z0-9@._~-]|${placeholder.source})+`;
const noDotSegments = S.isPattern(/^(?!.*\/\.{1,2}(?:\/|$))/, {
  identifier: "NoDotSegments",
  title: "No dot segments",
  description: "Disallows path traversal before URL normalization.",
});
const Pathname = S.String.check(
  S.isPattern(new RegExp(`^/(?:${segment}(?:/${segment})*/?)?$`), { message: "Expected a root-relative pathname." }),
  noDotSegments
).pipe($I.annoteSchema("Pathname", { description: "Root-relative path template with no dot segments." }));

const QueryValue = S.String.check(S.isPattern(new RegExp(`^(?:[^{}]|${placeholder.source})*$`))).pipe(
  $I.annoteSchema("QueryValue", { description: "Query value containing literal text and named placeholders." })
);

const Query = S.Record(S.String, S.Union([QueryValue, S.NonEmptyArray(QueryValue)]))
  .check(S.isPropertyNames(S.NonEmptyString))
  .pipe($I.annoteSchema("Query", { description: "Query keys with single or repeated templated values." }));

const StructuredRoute = S.Struct({
  pathname: Pathname,
  query: Query.pipe(
    S.annotateKey({ description: "Literal query keys and their template values." }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  ),
}).pipe(
  $I.annoteSchema("StructuredRoute", { description: "Pathname and optional query fields for a platform route." })
);

const legacyPair = `[A-Za-z][A-Za-z0-9_]*=(?:[A-Za-z0-9_.-]+|${placeholder.source})`;
const LegacyRoute = S.String.check(S.isPattern(new RegExp(`^[^?#]+(?:\\?${legacyPair}(?:&${legacyPair})*)?$`))).pipe(
  $I.annoteSchema("LegacyRoute", { description: "Historical string representation of a catalog route." })
);

const RouteTemplate = S.Union([S.toEncoded(StructuredRoute), LegacyRoute]).pipe(
  S.decodeTo(
    StructuredRoute,
    T.transform({
      decode: (route) => {
        if (!P.isString(route)) return route;
        const [pathname, search] = Str.split(route, "?");
        return P.isUndefined(search)
          ? { pathname }
          : {
              pathname,
              query: UrlParams.toReadonlyRecord(UrlParams.fromInput(new URLSearchParams(search))),
            };
      },
      encode: (route) => route,
    })
  ),
  $I.annoteSchema("RouteTemplate", {
    description: "Reads structured or legacy templates and writes a structured route.",
  })
);

const LandingSection = S.Struct({
  key: S.String.check(
    S.isPattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, { message: "Use a lowercase kebab-case section key." })
  ),
  mediaFormats: MediaFormats,
  detailRoutes: S.UniqueArray(RouteTemplate).pipe(
    S.annotateKey({ description: "Templates for opening individual items in this section." }),
    S.withDecodingDefaultTypeKey(Effect.succeed([])),
    S.withConstructorDefault(Effect.succeed([]))
  ),
}).pipe($I.annoteSchema("LandingSection", { description: "Content available at a profile or section landing page." }));

const ContentRoute = LandingSection.pipe(
  S.fieldsAssign({ template: RouteTemplate }),
  $I.annoteSchema("ContentRoute", { description: "Content section with an explicit template." })
);

const platformFields = S.Struct({
  parameters: Parameters.pipe(
    S.withDecodingDefaultTypeKey(Effect.succeed(legacyParameters)),
    S.withConstructorDefault(Effect.succeed(legacyParameters))
  ),
  baseUrl: S.URLFromString.check(
    S.makeFilter(
      (url) => url.protocol === "https:" || url.protocol === "http:" || "Expected an HTTP or HTTPS platform URL."
    )
  ),
  logoUrl: S.URLFromString.pipe(
    S.annotateKey({ description: "Verified logo asset published by the platform." }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  ),
  profileRoutes: S.NonEmptyArray(RouteTemplate).check(S.isUnique()).annotateKey({
    description: "Canonical profile route first, followed by alternative routes to the same profile.",
  }),
  landingSection: LandingSection,
  additionalContentRoutes: S.Array(ContentRoute).pipe(
    S.withDecodingDefaultTypeKey(Effect.succeed([])),
    S.withConstructorDefault(Effect.succeed([]))
  ),
}).check(
  S.makeFilter(
    ({ parameters, profileRoutes, landingSection, additionalContentRoutes }) => {
      const routeIssues = (
        route: typeof StructuredRoute.Type,
        kind: "profile" | "content" | "section",
        path: Array<string | number>
      ): Array<S.FilterIssue> => {
        const values = [
          route.pathname,
          ...A.flatMap(O.toArray(route.query), (query) => A.flatMap(R.values(query), A.ensure)),
        ];
        const names = A.flatMap(values, (value) =>
          A.map(A.fromIterable(Str.matchAll(new RegExp(placeholder, "g"))(value)), ([token]) => Str.slice(1, -1)(token))
        );
        const roles = HashSet.fromIterable(
          A.getSomes(A.map(names, (name) => O.map(R.get(parameters, name), (definition) => definition.role)))
        );
        const identified =
          kind === "section"
            ? HashSet.has(roles, "profile") || HashSet.has(roles, "content")
            : HashSet.has(roles, kind);
        return [
          ...A.map(
            A.filter(names, (name) => !R.has(parameters, name)),
            (name) => ({ path, issue: `Undeclared route parameter {${name}}.` })
          ),
          ...(identified ? [] : [{ path, issue: `Missing an identifying parameter for this ${kind} route.` }]),
          ...(kind === "profile" && HashSet.has(roles, "content")
            ? [{ path, issue: "A profile route cannot require a content identifier." }]
            : []),
        ];
      };
      const sectionKeys = MutableHashSet.make(landingSection.key);
      return [
        ...A.flatMap(profileRoutes, (route, i) => routeIssues(route, "profile", ["profileRoutes", i])),
        ...A.flatMap(landingSection.detailRoutes, (route, i) =>
          routeIssues(route, "content", ["landingSection", "detailRoutes", i])
        ),
        ...A.flatMap(additionalContentRoutes, (section, i) => {
          const path = ["additionalContentRoutes", i];
          const duplicate = MutableHashSet.has(sectionKeys, section.key);
          MutableHashSet.add(sectionKeys, section.key);
          return [
            ...(duplicate ? [{ path: [...path, "key"], issue: "Duplicate section key." }] : []),
            ...routeIssues(section.template, "section", [...path, "template"]),
            ...A.flatMap(section.detailRoutes, (route, j) =>
              routeIssues(route, "content", [...path, "detailRoutes", j])
            ),
          ];
        }),
      ];
    },
    {
      identifier: "PlatformRouteBindings",
      title: "Platform route bindings",
      description: "Checks declared parameters, identifying roles and unique section keys across a platform.",
    }
  )
);

/**
 * **Example** (Recognize validated platform metadata)
 *
 * ```ts import.meta.vitest name="Recognize validated platform metadata"
 * import { SocialPlatform, socialMappers } from "@beep/scratchpad/int/index"
 * import * as S from "effect/Schema"
 *
 * S.is(SocialPlatform)(socialMappers.instagram.metadata) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SocialPlatform extends S.Class<
  SocialPlatform,
  {
    readonly brand: unique symbol;
  }
>($I`SocialPlatform`)(
  platformFields,
  $I.annote("SocialPlatform", { description: "Profile and content routes for a social platform." })
) {
  /**
   * Lists the landing section at its canonical profile route, followed by the platform's additional sections.
   *
   * **Example** (Find the default Instagram section)
   *
   * ```ts import.meta.vitest name="Find the default Instagram section"
   * import { socialMappers } from "@beep/scratchpad/int/index"
   *
   * socialMappers.instagram.metadata.contentRoutes[0].key // => "posts"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get contentRoutes() {
    return [
      { ...this.landingSection, template: A.headNonEmpty(this.profileRoutes) },
      ...this.additionalContentRoutes,
    ] as const;
  }
}

const profile = { role: ParameterRole.Enum.profile };
const content = { role: ParameterRole.Enum.content };
const selector = { role: ParameterRole.Enum.selector };
const imagesAndVideos = MediaFormats.make(["Image", "Video"]);
const videos = MediaFormats.make(["Video"]);
const images = MediaFormats.make(["Image"]);
const route = (pathname: string, query: typeof Query.Type = {}) =>
  StructuredRoute.make({ pathname, query: R.isEmptyRecord(query) ? O.none() : O.some(query) });
const section = (
  key: string,
  mediaFormats: typeof MediaFormats.Type,
  ...detailRoutes: Array<typeof StructuredRoute.Type>
) => LandingSection.make({ key, mediaFormats, detailRoutes });
const tab = (template: string, fields: typeof LandingSection.Type) =>
  ContentRoute.make({ template: route(template), ...fields });

const isStructuredRoute = S.is(StructuredRoute);
const isBoundPath = S.is(S.String.check(noDotSegments));
const isBindingValue = S.is(
  S.NonEmptyString.check(
    S.makeFilter(Str.isWellFormed, {
      identifier: "WellFormedBinding",
      title: "Well-formed binding",
      description: "Rejects unpaired surrogates before URL encoding.",
    })
  )
);

const taggedPlatform = <Tag extends string>(tag: Tag, define: () => Parameters<typeof SocialPlatform.make>[0]) => {
  const metadata = SocialPlatform.make(define());
  return class extends Data.TaggedClass(tag) {
    readonly metadata = metadata;

    map(template: typeof StructuredRoute.Type, bindings: Readonly<Record<string, string>>): O.Option<URL> {
      return O.gen(function* () {
        yield* O.liftPredicate(isStructuredRoute)(template);
        const bind = (text: string, encode: (value: string) => string) =>
          O.map(
            O.all(
              A.map(Str.split(text, placeholder), (part, index) =>
                index % 2 === 0 ? O.some(part) : R.get(bindings, part).pipe(O.filter(isBindingValue), O.map(encode))
              )
            ),
            A.join("")
          );
        const pathname = yield* bind(template.pathname, encodeURIComponent).pipe(O.filter(isBoundPath));
        const entries = yield* O.all(
          A.flatMap(O.toArray(template.query), (query) =>
            A.flatMap(R.toEntries(query), ([key, values]) =>
              A.map(A.ensure(values), (value) => O.map(bind(value, identity), (bound) => Tuple.make(key, bound)))
            )
          )
        );
        return Url.setUrlParams(new URL(pathname, metadata.baseUrl), UrlParams.fromInput(entries));
      });
    }
  };
};

/**
 * Resolves Facebook profile and media links from catalog bindings.
 *
 * **Example** (Build a Facebook profile URL)
 *
 * ```ts import.meta.vitest name="Build a Facebook profile URL"
 * import { Facebook } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Facebook()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.facebook.com/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Facebook extends taggedPlatform("Facebook", () => ({
  baseUrl: new URL("https://www.facebook.com/"),
  parameters: { username: profile, userId: profile, photoId: content, reelId: content },
  profileRoutes: [route("/{username}"), route("/profile.php", { id: "{userId}" })],
  landingSection: section("posts", imagesAndVideos),
  additionalContentRoutes: [
    tab("/{username}/photos", section("photos", images, route("/photo/", { fbid: "{photoId}" }))),
    tab("/{username}/photos_albums", section("albums", images)),
    tab("/{username}/reels", section("reels", videos, route("/reel/{reelId}"))),
  ],
})) {}

/**
 * Resolves Fansly profile and media links from catalog bindings.
 *
 * **Example** (Build a Fansly profile URL)
 *
 * ```ts import.meta.vitest name="Build a Fansly profile URL"
 * import { Fansly } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Fansly()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://fansly.com/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Fansly extends taggedPlatform("Fansly", () => ({
  baseUrl: new URL("https://fansly.com/"),
  parameters: { username: profile, postId: content },
  profileRoutes: [route("/{username}")],
  landingSection: section("posts", imagesAndVideos, route("/post/{postId}")),
})) {}

/**
 * Resolves Instagram profile and media links from catalog bindings.
 *
 * **Example** (Build a Instagram profile URL)
 *
 * ```ts import.meta.vitest name="Build a Instagram profile URL"
 * import { Instagram } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Instagram()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.instagram.com/example/"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Instagram extends taggedPlatform("Instagram", () => {
  const instagramPost = route("/p/{shortcode}/");
  const instagramGallery = route("/p/{shortcode}/", { img_index: "{galleryIndex}" });
  return {
    baseUrl: new URL("https://www.instagram.com/"),
    parameters: { username: profile, shortcode: content, highlightId: content, galleryIndex: selector },
    profileRoutes: [route("/{username}/")],
    landingSection: section("posts", imagesAndVideos, instagramPost, instagramGallery),
    additionalContentRoutes: [
      tab("/{username}/tagged/", section("tagged", imagesAndVideos, instagramPost, instagramGallery)),
      tab("/{username}/reels/", section("reels", videos, route("/reel/{shortcode}/"))),
      tab("/stories/{username}/", section("stories", imagesAndVideos)),
      tab("/stories/highlights/{highlightId}/", section("highlights", imagesAndVideos)),
    ],
  };
}) {}

/**
 * Resolves OnlyFans profile and media links from catalog bindings.
 *
 * **Example** (Build a OnlyFans profile URL)
 *
 * ```ts import.meta.vitest name="Build a OnlyFans profile URL"
 * import { OnlyFans } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new OnlyFans()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://onlyfans.com/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class OnlyFans extends taggedPlatform("OnlyFans", () => ({
  baseUrl: new URL("https://onlyfans.com/"),
  parameters: { username: profile, postId: content },
  profileRoutes: [route("/{username}")],
  landingSection: section("posts", imagesAndVideos, route("/{postId}/{username}")),
})) {}

/**
 * Resolves Pinterest profile and media links from catalog bindings.
 *
 * **Example** (Build a Pinterest profile URL)
 *
 * ```ts import.meta.vitest name="Build a Pinterest profile URL"
 * import { Pinterest } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Pinterest()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.pinterest.com/example/"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Pinterest extends taggedPlatform("Pinterest", () => ({
  baseUrl: new URL("https://www.pinterest.com/"),
  parameters: { username: profile, pinId: content },
  profileRoutes: [route("/{username}/")],
  landingSection: section("pins", imagesAndVideos, route("/pin/{pinId}/")),
})) {}

/**
 * Resolves RedGifs profile and media links from catalog bindings.
 *
 * **Example** (Build a RedGifs profile URL)
 *
 * ```ts import.meta.vitest name="Build a RedGifs profile URL"
 * import { RedGifs } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new RedGifs()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.redgifs.com/users/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class RedGifs extends taggedPlatform("RedGifs", () => ({
  baseUrl: new URL("https://www.redgifs.com/"),
  parameters: { username: profile, gifId: content },
  profileRoutes: [route("/users/{username}")],
  landingSection: section("posts", imagesAndVideos, route("/watch/{gifId}")),
})) {}

/**
 * Resolves Snapchat profile and media links from catalog bindings.
 *
 * **Example** (Build a Snapchat profile URL)
 *
 * ```ts import.meta.vitest name="Build a Snapchat profile URL"
 * import { Snapchat } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Snapchat()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.snapchat.com/@example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Snapchat extends taggedPlatform("Snapchat", () => ({
  baseUrl: new URL("https://www.snapchat.com/"),
  parameters: { username: profile, spotlightId: content },
  profileRoutes: [route("/@{username}"), route("/add/{username}")],
  landingSection: section("profile", imagesAndVideos),
  additionalContentRoutes: [
    tab("/@{username}/stories", section("stories", imagesAndVideos)),
    tab("/@{username}/spotlights", section("spotlight", videos, route("/@{username}/spotlight/{spotlightId}"))),
  ],
})) {}

/**
 * Resolves YouTube profile and media links from catalog bindings.
 *
 * **Example** (Build a YouTube profile URL)
 *
 * ```ts import.meta.vitest name="Build a YouTube profile URL"
 * import { YouTube } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new YouTube()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { handle: "example" })
 * O.getOrThrow(url).href // => "https://www.youtube.com/@example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class YouTube extends taggedPlatform("YouTube", () => {
  const youtubeVideo = route("/watch", { v: "{videoId}" });
  return {
    baseUrl: new URL("https://www.youtube.com/"),
    parameters: { handle: profile, channelId: profile, username: profile, videoId: content },
    profileRoutes: [route("/@{handle}"), route("/channel/{channelId}"), route("/user/{username}")],
    landingSection: section("home", videos, youtubeVideo),
    additionalContentRoutes: [
      tab("/@{handle}/videos", section("videos", videos, youtubeVideo)),
      tab("/@{handle}/shorts", section("shorts", videos, route("/shorts/{videoId}"))),
    ],
  };
}) {}

/**
 * Resolves Threads profile and media links from catalog bindings.
 *
 * **Example** (Build a Threads profile URL)
 *
 * ```ts import.meta.vitest name="Build a Threads profile URL"
 * import { Threads } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Threads()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.threads.com/@example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Threads extends taggedPlatform("Threads", () => {
  const threadsPost = route("/@{username}/post/{shortcode}");
  return {
    baseUrl: new URL("https://www.threads.com/"),
    parameters: { username: profile, shortcode: content },
    profileRoutes: [route("/@{username}")],
    landingSection: section("posts", imagesAndVideos, threadsPost),
    additionalContentRoutes: [tab("/@{username}/media", section("media", imagesAndVideos, threadsPost))],
  };
}) {}

/**
 * Resolves TikTok profile and media links from catalog bindings.
 *
 * **Example** (Build a TikTok profile URL)
 *
 * ```ts import.meta.vitest name="Build a TikTok profile URL"
 * import { TikTok } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new TikTok()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.tiktok.com/@example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class TikTok extends taggedPlatform("TikTok", () => ({
  baseUrl: new URL("https://www.tiktok.com/"),
  parameters: { username: profile, postId: content },
  profileRoutes: [route("/@{username}")],
  landingSection: section(
    "posts",
    imagesAndVideos,
    route("/@{username}/video/{postId}"),
    route("/@{username}/photo/{postId}")
  ),
})) {}

/**
 * Resolves VSCO profile and media links from catalog bindings.
 *
 * **Example** (Build a VSCO profile URL)
 *
 * ```ts import.meta.vitest name="Build a VSCO profile URL"
 * import { VSCO } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new VSCO()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://vsco.co/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class VSCO extends taggedPlatform("VSCO", () => ({
  baseUrl: new URL("https://vsco.co/"),
  parameters: { username: profile, mediaId: content, videoId: content },
  profileRoutes: [route("/{username}"), route("/{username}/gallery"), route("/{username}/images")],
  landingSection: section(
    "gallery",
    imagesAndVideos,
    route("/{username}/media/{mediaId}"),
    route("/{username}/video/{videoId}")
  ),
})) {}

/**
 * Resolves X profile and media links from catalog bindings.
 *
 * **Example** (Build a X profile URL)
 *
 * ```ts import.meta.vitest name="Build a X profile URL"
 * import { X } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new X()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://x.com/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class X extends taggedPlatform("X", () => {
  const xPost = route("/{username}/status/{postId}");
  return {
    baseUrl: new URL("https://x.com/"),
    parameters: { username: profile, postId: content },
    profileRoutes: [route("/{username}")],
    landingSection: section("posts", imagesAndVideos, xPost),
    additionalContentRoutes: [
      tab("/{username}/media", section("media", imagesAndVideos, xPost)),
      tab("/{username}/with_replies", section("replies", imagesAndVideos, xPost)),
    ],
  };
}) {}

/**
 * Resolves Reddit profile and media links from catalog bindings.
 *
 * **Example** (Build a Reddit profile URL)
 *
 * ```ts import.meta.vitest name="Build a Reddit profile URL"
 * import { Reddit } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Reddit()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { username: "example" })
 * O.getOrThrow(url).href // => "https://www.reddit.com/user/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Reddit extends taggedPlatform("Reddit", () => {
  const redditPost = route("/comments/{postId}");
  return {
    baseUrl: new URL("https://www.reddit.com/"),
    parameters: { username: profile, postId: content },
    profileRoutes: [route("/user/{username}"), route("/u/{username}")],
    landingSection: section("overview", imagesAndVideos, redditPost),
    additionalContentRoutes: [tab("/user/{username}/submitted", section("submitted", imagesAndVideos, redditPost))],
    logoUrl: O.some(new URL("https://redditinc.com/hubfs/Reddit%20Inc/Content/Brand%20Page/Reddit_Lockup_Logo.svg")),
  };
}) {}

/**
 * Resolves Dzen profile and media links from catalog bindings.
 *
 * **Example** (Build a Dzen profile URL)
 *
 * ```ts import.meta.vitest name="Build a Dzen profile URL"
 * import { Dzen } from "@beep/scratchpad/int/index"
 * import * as O from "effect/Option"
 *
 * const mapper = new Dzen()
 * const url = mapper.map(mapper.metadata.profileRoutes[0], { channelName: "example" })
 * O.getOrThrow(url).href // => "https://dzen.ru/example"
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export class Dzen extends taggedPlatform("Dzen", () => ({
  baseUrl: new URL("https://dzen.ru/"),
  parameters: { channelName: profile, channelId: profile },
  profileRoutes: [route("/{channelName}"), route("/id/{channelId}")],
  landingSection: section("publications", imagesAndVideos),
})) {}

/**
 * Looks up a mapper by its VidBee platform identifier.
 *
 * **Example** (Find the YouTube channel route)
 *
 * ```ts import.meta.vitest name="Find the YouTube channel route"
 * import { socialMappers } from "@beep/scratchpad/int/index"
 *
 * socialMappers.youtube.metadata.profileRoutes[1]?.pathname // => "/channel/{channelId}"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const socialMappers = {
  facebook: new Facebook(),
  fansly: new Fansly(),
  instagram: new Instagram(),
  onlyfans: new OnlyFans(),
  pinterest: new Pinterest(),
  redgifs: new RedGifs(),
  snapchat: new Snapchat(),
  youtube: new YouTube(),
  threads: new Threads(),
  tiktok: new TikTok(),
  vsco: new VSCO(),
  x: new X(),
  reddit: new Reddit(),
  dzen: new Dzen(),
} as const;

/**
 * A registered mapper instance narrowed by its platform tag.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SocialMapper = (typeof socialMappers)[keyof typeof socialMappers];

const mapperCases = Data.taggedEnum<SocialMapper>();

/**
 * Narrows a registered mapper to the platform with the given tag.
 *
 * **Example** (Identify an Instagram mapper)
 *
 * ```ts import.meta.vitest name="Identify an Instagram mapper"
 * import { isSocialMapperTag, socialMappers } from "@beep/scratchpad/int/index"
 *
 * isSocialMapperTag("Instagram")(socialMappers.instagram) // => true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSocialMapperTag = mapperCases.$is;

/**
 * Dispatches a mapper instance to the handler for its platform tag.
 *
 * **Example** (Select a platform-specific template)
 *
 * ```ts import.meta.vitest name="Select a platform-specific template"
 * import { matchSocialMapper, socialMappers, type SocialMapper } from "@beep/scratchpad/int/index"
 *
 * const profilePath = (mapper: SocialMapper) => mapper.metadata.profileRoutes[0].pathname
 * const path = matchSocialMapper(socialMappers.instagram, {
 *   Facebook: profilePath,
 *   Fansly: profilePath,
 *   Instagram: () => "/p/{shortcode}/",
 *   OnlyFans: profilePath,
 *   Pinterest: profilePath,
 *   RedGifs: profilePath,
 *   Snapchat: profilePath,
 *   YouTube: profilePath,
 *   Threads: profilePath,
 *   TikTok: profilePath,
 *   VSCO: profilePath,
 *   X: profilePath,
 *   Reddit: profilePath,
 *   Dzen: profilePath,
 * })
 * path // => "/p/{shortcode}/"
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const matchSocialMapper = mapperCases.$match;

type MapperContract<Implementation extends SocialMapper> = Pick<Implementation, "_tag" | "metadata" | "map">;


const mapperService = <Self>() => <Id extends string, Implementation extends SocialMapper>(
  id: Id,
  implementation: Implementation
): Context.ServiceClass<Self, Id, MapperContract<Implementation>> & { readonly layer: Layer.Layer<Self> } => {
  const service = Context.Service<Self, MapperContract<Implementation>>()(id);
  return class extends service {
    static readonly layer = Layer.succeed(service, implementation);
  };
};

/**
 * Supplies the Facebook route mapper to an Effect program.
 *
 * **Example** (Resolve the Facebook mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Facebook mapper"
 * import { FacebookMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(FacebookMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, FacebookMapper.layer)) // => "Facebook"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FacebookMapper extends mapperService<FacebookMapper>()($I`FacebookMapper`, socialMappers.facebook) {}

/**
 * Supplies the Fansly route mapper to an Effect program.
 *
 * **Example** (Resolve the Fansly mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Fansly mapper"
 * import { FanslyMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(FanslyMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, FanslyMapper.layer)) // => "Fansly"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FanslyMapper extends mapperService<FanslyMapper>()($I`FanslyMapper`, socialMappers.fansly) {}

/**
 * Supplies the Instagram route mapper to an Effect program.
 *
 * **Example** (Resolve the Instagram mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Instagram mapper"
 * import { InstagramMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(InstagramMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, InstagramMapper.layer)) // => "Instagram"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstagramMapper extends mapperService<InstagramMapper>()($I`InstagramMapper`, socialMappers.instagram) {}

/**
 * Supplies the OnlyFans route mapper to an Effect program.
 *
 * **Example** (Resolve the OnlyFans mapper)
 *
 * ```ts import.meta.vitest name="Resolve the OnlyFans mapper"
 * import { OnlyFansMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(OnlyFansMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, OnlyFansMapper.layer)) // => "OnlyFans"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnlyFansMapper extends mapperService<OnlyFansMapper>()($I`OnlyFansMapper`, socialMappers.onlyfans) {}

/**
 * Supplies the Pinterest route mapper to an Effect program.
 *
 * **Example** (Resolve the Pinterest mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Pinterest mapper"
 * import { PinterestMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(PinterestMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, PinterestMapper.layer)) // => "Pinterest"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PinterestMapper extends mapperService<PinterestMapper>()($I`PinterestMapper`, socialMappers.pinterest) {}

/**
 * Supplies the RedGifs route mapper to an Effect program.
 *
 * **Example** (Resolve the RedGifs mapper)
 *
 * ```ts import.meta.vitest name="Resolve the RedGifs mapper"
 * import { RedGifsMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(RedGifsMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, RedGifsMapper.layer)) // => "RedGifs"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedGifsMapper extends mapperService<RedGifsMapper>()($I`RedGifsMapper`, socialMappers.redgifs) {}

/**
 * Supplies the Snapchat route mapper to an Effect program.
 *
 * **Example** (Resolve the Snapchat mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Snapchat mapper"
 * import { SnapchatMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(SnapchatMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, SnapchatMapper.layer)) // => "Snapchat"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SnapchatMapper extends mapperService<SnapchatMapper>()($I`SnapchatMapper`, socialMappers.snapchat) {}

/**
 * Supplies the YouTube route mapper to an Effect program.
 *
 * **Example** (Resolve the YouTube mapper)
 *
 * ```ts import.meta.vitest name="Resolve the YouTube mapper"
 * import { YouTubeMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(YouTubeMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, YouTubeMapper.layer)) // => "YouTube"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YouTubeMapper extends mapperService<YouTubeMapper>()($I`YouTubeMapper`, socialMappers.youtube) {}

/**
 * Supplies the Threads route mapper to an Effect program.
 *
 * **Example** (Resolve the Threads mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Threads mapper"
 * import { ThreadsMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(ThreadsMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, ThreadsMapper.layer)) // => "Threads"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ThreadsMapper extends mapperService<ThreadsMapper>()($I`ThreadsMapper`, socialMappers.threads) {}

/**
 * Supplies the TikTok route mapper to an Effect program.
 *
 * **Example** (Resolve the TikTok mapper)
 *
 * ```ts import.meta.vitest name="Resolve the TikTok mapper"
 * import { TikTokMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(TikTokMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, TikTokMapper.layer)) // => "TikTok"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TikTokMapper extends mapperService<TikTokMapper>()($I`TikTokMapper`, socialMappers.tiktok) {}

/**
 * Supplies the VSCO route mapper to an Effect program.
 *
 * **Example** (Resolve the VSCO mapper)
 *
 * ```ts import.meta.vitest name="Resolve the VSCO mapper"
 * import { VSCOMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(VSCOMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, VSCOMapper.layer)) // => "VSCO"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VSCOMapper extends mapperService<VSCOMapper>()($I`VSCOMapper`, socialMappers.vsco) {}

/**
 * Supplies the X route mapper to an Effect program.
 *
 * **Example** (Resolve the X mapper)
 *
 * ```ts import.meta.vitest name="Resolve the X mapper"
 * import { XMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(XMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, XMapper.layer)) // => "X"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class XMapper extends mapperService<XMapper>()($I`XMapper`, socialMappers.x) {}

/**
 * Supplies the Reddit route mapper to an Effect program.
 *
 * **Example** (Resolve the Reddit mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Reddit mapper"
 * import { RedditMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(RedditMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, RedditMapper.layer)) // => "Reddit"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RedditMapper extends mapperService<RedditMapper>()($I`RedditMapper`, socialMappers.reddit) {}

/**
 * Supplies the Dzen route mapper to an Effect program.
 *
 * **Example** (Resolve the Dzen mapper)
 *
 * ```ts import.meta.vitest name="Resolve the Dzen mapper"
 * import { DzenMapper } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(DzenMapper, (mapper) => mapper._tag)
 * Effect.runSync(Effect.provide(program, DzenMapper.layer)) // => "Dzen"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DzenMapper extends mapperService<DzenMapper>()($I`DzenMapper`, socialMappers.dzen) {}

/**
 * Provides every registered platform mapper for programs that dispatch across sites.
 *
 * **Example** (Resolve two platforms together)
 *
 * ```ts import.meta.vitest name="Resolve two platforms together"
 * import { InstagramMapper, YouTubeMapper, socialMapperLayer } from "@beep/scratchpad/int/index"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const instagram = yield* InstagramMapper
 *   const youtube = yield* YouTubeMapper
 *   return [instagram._tag, youtube._tag]
 * })
 * Effect.runSync(Effect.provide(program, socialMapperLayer)) // => ["Instagram", "YouTube"]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const socialMapperLayer = Layer.mergeAll(
  FacebookMapper.layer,
  FanslyMapper.layer,
  InstagramMapper.layer,
  OnlyFansMapper.layer,
  PinterestMapper.layer,
  RedGifsMapper.layer,
  SnapchatMapper.layer,
  YouTubeMapper.layer,
  ThreadsMapper.layer,
  TikTokMapper.layer,
  VSCOMapper.layer,
  XMapper.layer,
  RedditMapper.layer,
  DzenMapper.layer,
);
