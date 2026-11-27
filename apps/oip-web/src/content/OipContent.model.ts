/**
 * Schema-first content contracts for the OIP public website.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { EmailString, LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import type * as Result from "effect/Result";
import type * as AST from "effect/SchemaAST";

const $I = $OipWebId.create("content/OipContent.model");

const HttpsUrl = S.NonEmptyString.check(S.isPattern(/^https:\/\/\S+$/)).pipe(
  $I.annoteSchema("HttpsUrl", {
    description: "Absolute HTTPS URL used by public OIP website content.",
  })
);

const PublicAssetPath = S.NonEmptyString.check(S.isPattern(/^\/\S+$/)).pipe(
  $I.annoteSchema("PublicAssetPath", {
    description: "Root-relative public asset path served by the OIP website.",
  })
);

const HashAnchor = S.NonEmptyString.check(S.isPattern(/^#[A-Za-z][A-Za-z0-9_-]*$/)).pipe(
  $I.annoteSchema("HashAnchor", {
    description: "Hash anchor used for in-page OIP navigation links.",
  })
);

const ImagePixelDimension = S.Int.check(
  S.isGreaterThanOrEqualTo(1, {
    arbitraryConstraint: { order: Order.Number, minimum: 1, maximum: 4_000, number: "integer" },
  })
).pipe(
  $I.annoteSchema("ImagePixelDimension", {
    description: "Positive integer pixel dimension for public OIP image metadata.",
  })
);

const CssAspectRatio = S.NonEmptyString.check(S.isPattern(/^[1-9]\d*\/[1-9]\d*$/)).pipe(
  $I.annoteSchema("CssAspectRatio", {
    description: "CSS aspect-ratio text using positive integer numerator and denominator.",
  })
);

const PressDate = S.NonEmptyString.check(S.isPattern(/^\d{4}-\d{2}-\d{2}$/)).pipe(
  $I.annoteSchema("PressDate", {
    description: "ISO calendar date text for public press metadata.",
  })
);

const ReviewStatusBase = LiteralKit(["approved", "needs_review"]);

/**
 * Review state for public claims that need launch approval.
 *
 * **Example** (Access needs_review enum value)
 *
 * ```ts
 * import { ReviewStatus } from "@beep/oip-web/content"
 *
 * const status = ReviewStatus.Enum.needs_review
 * console.log(status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewStatus = ReviewStatusBase.pipe(
  $I.annoteSchema("ReviewStatus", {
    description: "Review state for public OIP website claims.",
  }),
  SchemaUtils.withLiteralKitStatics(ReviewStatusBase)
);

/**
 * **Example** (Assign approved status type)
 *
 * ```ts
 * import type { ReviewStatus } from "@beep/oip-web/content"
 *
 * const status: ReviewStatus = "approved"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */

// fallow-ignore-next-line unused-type -- the schema-annotation policy requires the type companion although only the ReviewStatus value is consumed. Owner: @beep/oip-web. Exit: remove when the policy stops requiring a type alias per schema value or a consumer imports the type.
export type ReviewStatus = typeof ReviewStatus.Type;

/**
 * **Example** (Create approved review gate)
 *
 * ```ts
 * import { ReviewGate } from "@beep/oip-web/content"
 *
 * const gate = ReviewGate.make({
 *   note: "Launch approved.",
 *   status: "approved"
 * })
 *
 * console.log(gate.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewGate extends S.Opaque<ReviewGate, { readonly brand: unique symbol }>()(
  S.Struct({
    status: ReviewStatus,
    note: S.String,
  }).pipe(
    $I.annoteSchema("ReviewGate", {
      description: "Review note attached to a public website claim.",
    })
  )
) {}

/**
 * **Example** (Create external link instance)
 *
 * ```ts
 * import { ExternalLink } from "@beep/oip-web/content"
 *
 * const link = ExternalLink.make({
 *   href: "https://example.com",
 *   label: "Source"
 * })
 *
 * console.log(link.href)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExternalLink extends S.Opaque<ExternalLink, { readonly brand: unique symbol }>()(
  S.Struct({
    href: HttpsUrl,
    label: S.String,
  }).pipe(
    $I.annoteSchema("ExternalLink", {
      description: "External link displayed by the public OIP website.",
    })
  )
) {}

/**
 * **Example** (Access instagram enum value)
 *
 * ```ts
 * import { SocialPlatform } from "@beep/oip-web/content"
 *
 * const platform = SocialPlatform.Enum.instagram
 * console.log(platform)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SocialPlatform = LiteralKit([
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "threads",
  "tiktok",
  "reddit",
  "discord",
  "pinterest",
]).pipe(
  $I.annoteSchema("SocialPlatform", {
    description: "Social platform the OIP firm maintains a public profile on.",
  })
);

/**
 * **Example** (Assign instagram platform type)
 *
 * ```ts
 * import type { SocialPlatform } from "@beep/oip-web/content"
 *
 * const platform: SocialPlatform = "instagram"
 * console.log(platform)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SocialPlatform = typeof SocialPlatform.Type;

/**
 * **Example** (Create Instagram social link)
 *
 * ```ts
 * import { SocialLink } from "@beep/oip-web/content"
 *
 * const link = SocialLink.make({
 *   href: "https://www.instagram.com/oip.law/",
 *   label: "OIP on Instagram",
 *   platform: "instagram"
 * })
 *
 * console.log(link.active)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SocialLink extends S.Opaque<SocialLink, { readonly brand: unique symbol }>()(
  S.Struct({
    href: HttpsUrl,
    label: S.String,
    platform: SocialPlatform,
    active: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultKey(Effect.succeed(true))
    ),
  }).pipe(
    $I.annoteSchema("SocialLink", {
      description: "Public social media profile link for the OIP firm.",
    })
  )
) {}

/**
 * Runtime asset reference served from the OIP app public folder.
 *
 * **Example** (Create site asset reference)
 *
 * ```ts
 * import { SiteAsset } from "@beep/oip-web/content"
 *
 * const asset = SiteAsset.make({
 *   alt: "Patent drawing",
 *   src: "/oip/patent.png"
 * })
 *
 * console.log(asset.src)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SiteAsset extends S.Opaque<SiteAsset, { readonly brand: unique symbol }>()(
  S.Struct({
    alt: S.String,
    credit: S.optionalKey(S.String),
    height: S.optionalKey(ImagePixelDimension),
    src: PublicAssetPath,
    width: S.optionalKey(ImagePixelDimension),
  }).pipe(
    $I.annoteSchema("SiteAsset", {
      description: "Runtime asset reference served by the OIP website.",
    })
  )
) {}

/**
 * **Example** (Create site metadata content)
 *
 * ```ts
 * import { SiteMetadataContent } from "@beep/oip-web/content"
 *
 * const metadata = SiteMetadataContent.make({
 *   description: "Patent counsel.",
 *   linkedInUrl: "https://linkedin.com/company/example",
 *   ogImage: "/oip/og.png",
 *   siteName: "OIP - Oppold IP Law",
 *   siteUrl: "https://oip.law",
 *   title: "oip.law"
 * })
 *
 * console.log(metadata.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SiteMetadataContent extends S.Opaque<SiteMetadataContent, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.String,
    linkedInUrl: HttpsUrl,
    ogImage: PublicAssetPath,
    siteName: S.String,
    siteUrl: HttpsUrl,
    title: S.String,
  }).pipe(
    $I.annoteSchema("SiteMetadataContent", {
      description: "Top-level metadata used by Next.js and JSON-LD generation.",
    })
  )
) {}

/**
 * **Example** (Create contact nav item)
 *
 * ```ts
 * import { NavItem } from "@beep/oip-web/content"
 *
 * const item = NavItem.make({ href: "#contact", label: "Contact" })
 * console.log(item.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NavItem extends S.Opaque<NavItem, { readonly brand: unique symbol }>()(
  S.Struct({
    href: HashAnchor,
    label: S.String,
  }).pipe(
    $I.annoteSchema("NavItem", {
      description: "Anchor navigation item for the OIP home page.",
    })
  )
) {}

/**
 * A single rotating hero background clip: a poster still plus its background video.
 *
 * **Example** (Create hero clip with assets)
 *
 * ```ts
 * import { HeroClip, SiteAsset } from "@beep/oip-web/content"
 *
 * const clip = HeroClip.make({
 *   poster: SiteAsset.make({ alt: "", src: "/oip/hero-vid-poster.jpg" }),
 *   video: SiteAsset.make({ alt: "", src: "/oip/hero-vid.mp4" })
 * })
 *
 * console.log(clip.video.src)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
// fallow-ignore-next-line unused-export -- nested public content schema is consumed through HeroContent rather than imported directly. Owner: @beep/oip-web. Exit: remove when a consumer imports HeroClip or the hero clip stops being a public contract.
export class HeroClip extends S.Opaque<HeroClip, { readonly brand: unique symbol }>()(
  S.Struct({
    poster: SiteAsset,
    video: SiteAsset,
  }).pipe(
    $I.annoteSchema("HeroClip", {
      description: "A single rotating hero background clip for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create hero content instance)
 *
 * ```ts
 * import { HeroClip, HeroContent, NavItem, SiteAsset } from "@beep/oip-web/content"
 *
 * const link = NavItem.make({ href: "#contact", label: "Contact" })
 * const asset = SiteAsset.make({ alt: "Hero", src: "/oip/hero.jpg" })
 * const hero = HeroContent.make({
 *   headline: "Patent counsel.",
 *   lede: "For builders.",
 *   portrait: asset,
 *   primaryCta: link,
 *   secondaryCta: link,
 *   clips: [HeroClip.make({ poster: asset, video: asset })]
 * })
 *
 * console.log(hero.headline)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeroContent extends S.Opaque<HeroContent, { readonly brand: unique symbol }>()(
  S.Struct({
    headline: S.String,
    lede: S.String,
    primaryCta: NavItem,
    secondaryCta: NavItem,
    portrait: SiteAsset,
    clips: S.NonEmptyArray(HeroClip),
  }).pipe(
    $I.annoteSchema("HeroContent", {
      description: "Hero opening claim and rotating background media for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create about panel instance)
 *
 * ```ts
 * import { AboutPanel, SiteAsset } from "@beep/oip-web/content"
 *
 * const panel = AboutPanel.make({
 *   body: "Trial and prosecution experience.",
 *   id: "law",
 *   image: SiteAsset.make({ alt: "Portrait", src: "/oip/portrait.png" }),
 *   title: "Patent practice"
 * })
 *
 * console.log(panel.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AboutPanel extends S.Opaque<AboutPanel, { readonly brand: unique symbol }>()(
  S.Struct({
    body: S.String,
    id: S.String,
    image: SiteAsset,
    title: S.String,
  }).pipe(
    $I.annoteSchema("AboutPanel", {
      description: "Biographical bridge panel for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create practice area summary)
 *
 * ```ts
 * import { PracticeArea } from "@beep/oip-web/content"
 *
 * const practice = PracticeArea.make({
 *   body: "Patent prosecution and litigation.",
 *   id: "01",
 *   title: "Patents"
 * })
 *
 * console.log(practice.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeArea extends S.Opaque<PracticeArea, { readonly brand: unique symbol }>()(
  S.Struct({
    body: S.String,
    id: S.String,
    title: S.String,
  }).pipe(
    $I.annoteSchema("PracticeArea", {
      description: "Practice-area summary for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create matter item instance)
 *
 * ```ts
 * import { ExternalLink, MatterItem, ReviewGate, SiteAsset } from "@beep/oip-web/content"
 *
 * const matter = MatterItem.make({
 *   body: "Representative public matter.",
 *   caption: "Litigation",
 *   eyebrow: "1999",
 *   figure: SiteAsset.make({ alt: "Patent drawing", src: "/oip/patent.png" }),
 *   id: "matter",
 *   review: ReviewGate.make({ note: "Approved.", status: "approved" }),
 *   source: ExternalLink.make({ href: "https://example.com", label: "Read" }),
 *   title: "Matter"
 * })
 *
 * console.log(matter.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterItem extends S.Opaque<MatterItem, { readonly brand: unique symbol }>()(
  S.Struct({
    body: S.String,
    caption: S.String,
    citation: S.optionalKey(S.String),
    eyebrow: S.String,
    figure: SiteAsset,
    id: S.String,
    review: ReviewGate,
    source: ExternalLink,
    title: S.String,
  }).pipe(
    $I.annoteSchema("MatterItem", {
      description: "Selected matter summary for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create client logo reference)
 *
 * ```ts
 * import { ClientLogo, ReviewGate, SiteAsset } from "@beep/oip-web/content"
 *
 * const client = ClientLogo.make({
 *   aspectRatio: "4/1",
 *   id: "client",
 *   logo: SiteAsset.make({ alt: "Client", src: "/oip/client.svg" }),
 *   review: ReviewGate.make({ note: "Approved.", status: "approved" }),
 *   website: "https://example.com"
 * })
 *
 * console.log(client.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClientLogo extends S.Opaque<ClientLogo, { readonly brand: unique symbol }>()(
  S.Struct({
    aspectRatio: CssAspectRatio,
    id: S.String,
    logo: SiteAsset,
    review: ReviewGate,
    website: S.optionalKey(HttpsUrl),
  }).pipe(
    $I.annoteSchema("ClientLogo", {
      description: "Client logo reference for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create press item summary)
 *
 * ```ts
 * import { ExternalLink, PressItem } from "@beep/oip-web/content"
 *
 * const press = PressItem.make({
 *   body: "Coverage summary.",
 *   date: "2026-05-14",
 *   dateLabel: "May 14, 2026",
 *   headline: "Patent coverage",
 *   publication: "Publication",
 *   source: ExternalLink.make({ href: "https://example.com", label: "Read" })
 * })
 *
 * console.log(press.publication)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressItem extends S.Opaque<PressItem, { readonly brand: unique symbol }>()(
  S.Struct({
    body: S.String,
    date: PressDate,
    dateLabel: S.String,
    headline: S.String,
    publication: S.String,
    source: ExternalLink,
  }).pipe(
    $I.annoteSchema("PressItem", {
      description: "Press item summary for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Create contact content instance)
 *
 * ```ts
 * import { ContactContent, ReviewGate } from "@beep/oip-web/content"
 *
 * const contact = ContactContent.make({
 *   email: "hello@example.com",
 *   lede: "Reach out.",
 *   notice: ["No attorney-client relationship is formed by this website."],
 *   officePhone: "+16125550100",
 *   review: ReviewGate.make({ note: "Approved.", status: "approved" }),
 *   title: "Contact"
 * })
 *
 * console.log(contact.email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContactContent extends S.Opaque<ContactContent, { readonly brand: unique symbol }>()(
  S.Struct({
    email: EmailString.check(
      S.isLowercased({
        arbitraryConstraint: { patterns: [{ source: "^[a-z][a-z0-9]{0,15}@example\\.com$", flags: "" }] },
      })
    ),
    lede: S.String,
    notice: S.Array(S.String),
    officePhone: S.NonEmptyString,
    review: ReviewGate,
    title: S.String,
  }).pipe(
    $I.annoteSchema("ContactContent", {
      description: "Public contact and legal notice content for the OIP home page.",
    })
  )
) {}

/**
 * **Example** (Instantiate from site content)
 *
 * ```ts
 * import { OipSiteContent, oipSiteContent } from "@beep/oip-web/content"
 *
 * const content = OipSiteContent.make(oipSiteContent)
 * console.log(content.metadata.siteName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OipSiteContent extends S.Opaque<OipSiteContent, { readonly brand: unique symbol }>()(
  S.Struct({
    about: S.NonEmptyArray(AboutPanel),
    clients: S.NonEmptyArray(ClientLogo),
    contact: ContactContent,
    hero: HeroContent,
    matters: S.NonEmptyArray(MatterItem),
    metadata: SiteMetadataContent,
    nav: S.NonEmptyArray(NavItem),
    practices: S.NonEmptyArray(PracticeArea),
    press: S.NonEmptyArray(PressItem),
    socials: S.Array(SocialLink).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("OipSiteContent", {
      description: "Complete content contract for the OIP public site.",
    })
  )
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(this);
}

/**
 * Decodes unknown input into {@link OipSiteContent}.
 *
 * **Example** (Decode content to Result)
 *
 * ```ts
 * import * as Result from "effect/Result";
 * import { decodeOipSiteContentResult, oipSiteContent } from "@beep/oip-web/content"
 *
 * const result = decodeOipSiteContentResult(oipSiteContent)
 * console.log(Result.isSuccess(result))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeOipSiteContentResult: {
  (options?: AST.ParseOptions): (input: unknown) => Result.Result<OipSiteContent, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Result.Result<OipSiteContent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, OipSiteContent.decodeUnknownResult);

/**
 * Decodes unknown input into {@link OipSiteContent} in an Effect workflow.
 *
 * **Example** (Decode content in Effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { decodeOipSiteContent, oipSiteContent } from "@beep/oip-web/content"
 *
 * const program = decodeOipSiteContent(oipSiteContent)
 * Effect.runPromise(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeOipSiteContent: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<OipSiteContent, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<OipSiteContent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, OipSiteContent.decodeUnknownEffect);
