/**
 * Launch content for the OIP public website.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Result } from "effect";
import { decodeOipSiteContentResult, ReviewStatus } from "./OipContent.model.ts";
import type { OipSiteContent, ReviewGate } from "./OipContent.model.ts";

const needsReview = (note: string): typeof ReviewGate.Encoded => ({
  note,
  status: ReviewStatus.Enum.needs_review,
});

const approved = (note: string): typeof ReviewGate.Encoded => ({
  note,
  status: ReviewStatus.Enum.approved,
});

const rawOipSiteContent = {
  metadata: {
    siteUrl: "https://oip.law",
    siteName: "OIP - Oppold IP Law",
    title: "Patent counsel for the people who build the machines | Thomas J. Oppold",
    description:
      "Patent counsel for agricultural equipment and the people who build the machines. Patent prosecution, litigation, IPR, trademark, and licensing, USPTO registered.",
    linkedInUrl: "https://www.linkedin.com/in/thomas-oppold-b92939/",
    ogImage: "/oip/oip-og.png",
  },
  nav: [
    { href: "#about", label: "About" },
    { href: "#practice", label: "Practice" },
    { href: "#matters", label: "Matters" },
    { href: "#press", label: "Press" },
    { href: "#contact", label: "Contact" },
  ],
  hero: {
    headline: "Thirty years as patent counsel for people who build machines",
    lede: "Patent counsel for the people who build the machines.",
    primaryCta: { href: "#contact", label: "Contact" },
    secondaryCta: { href: "#matters", label: "Recent matters" },
    portrait: {
      src: "/oip/hero/portrait.png",
      alt: "Thomas J. Oppold",
      width: 700,
      height: 1245,
      credit: "Portrait - Thomas J. Oppold",
    },
    clips: [
      {
        video: {
          src: "/oip/hero-vid.mp4",
          alt: "",
          credit: "OIP launch media",
        },
        poster: {
          src: "/oip/hero-vid-poster.jpg",
          alt: "",
          credit: "OIP launch media",
        },
      },
    ],
  },
  about: [
    {
      id: "farm",
      title: "The farm",
      image: {
        src: "/oip/about/farm.jpg",
        alt: "A Midwest cornfield rising into a clear summer sky.",
        width: 1200,
        height: 800,
      },
      body: 'Tom grew up on a grain and livestock farm in Lincoln County, South Dakota where he learned how to "farmer fix" almost anything to keep it working and where he learned the value of hard work, family, friends.',
    },
    {
      id: "engineering",
      title: "The engineering",
      image: {
        src: "/oip/about/engineering.jpg",
        alt: "A welder working over structural steel under industrial light.",
        width: 1200,
        height: 800,
      },
      body: "Tom has a BS in Agricultural Engineering from South Dakota State University. From 1989-1995, Tom worked as a structural engineer for Pitt-Des Moines, Inc. designing plate steel, structural steel and concrete structures, becoming adept at CAD and gaining invaluable in-field fabrication and construction experience.",
    },
    {
      id: "law",
      title: "The law",
      image: {
        src: "/oip/about/tom-portrait.png",
        alt: "Portrait of Thomas J. Oppold.",
        width: 645,
        height: 505,
      },
      body: 'Tom obtained his law degree from Drake University in 1997. Within two years of graduating law school, Tom successfully tried his first patent infringement case, Carlson v. Chief Automotive, and successfully argued in favor of the plaintiff in the "landmark" en banc Federal Circuit decision Midwest Ind. v. Karavan Trailers. While currently focusing primarily on patent prosecution before the USPTO and foreign patent offices, Tom continues to be involved in litigation.',
    },
  ],
  practices: [
    {
      id: "patents",
      title: "Patents",
      body: "Preparation, filing & prosecution of patent applications before the USPTO and international and foreign patent offices",
    },
    {
      id: "post-grant",
      title: "Post-Grant Patent Proceedings",
      body: "Inter Partes Review (IPR) proceedings, Post Grant Review (PGR), Ex Parte Reexaminations",
    },
    {
      id: "trademarks",
      title: "Trademarks & Trade Dress",
      body: "Trademark prosecution, TTAB opposition proceedings, trademark and trade dress clearance and validity analysis",
    },
    {
      id: "licensing",
      title: "Licensing & Technology Transfer",
      body: "Drafting and negotiating intellectual property license agreements, assignment agreements and technology transfer agreements",
    },
  ],
  matters: [
    {
      id: "midwest-karavan",
      eyebrow: "1999 - Federal Circuit en banc",
      caption: "Appellate - trade dress",
      title: "Midwest Industries v. Karavan Trailers",
      body: "Argued the Federal Circuit appeal for Midwest Industries. The en banc court confirmed that Federal Circuit law governs patent-preemption analysis for state-law trade-dress claims around watercraft-trailer winch-post designs.",
      citation: "175 F.3d 1356 (Fed. Cir. 1999) (en banc)",
      source: {
        href: "https://www.courtlistener.com/c/F.3d/175/1356/",
        label: "Read the opinion at CourtListener",
      },
      figure: {
        src: "/oip/matter-figs/midwest-karavan.png",
        alt: "Patent figure showing a personal watercraft trailer with arcuate winch posts.",
        width: 900,
        height: 600,
        credit: "U.S. Patent 5,518,261",
      },
      review: needsReview("Public docket citation exists; final matter framing needs Tom review before launch."),
    },
    {
      id: "gramm-deere",
      eyebrow: "2014 to 2026 - district court, PTAB, Federal Circuit",
      caption: "Litigation - PTAB - appellate",
      title: "Gramm / Headsight v. Deere and Company",
      body: "A long-running patent dispute involving combine header-height control, with work spanning trial, inter partes review, retrial, and Federal Circuit appeal.",
      citation: "N.D. Ind. 3:14-cv-00575 - S.D. Iowa 3:22-cv-00010 - CAFC 24-1598",
      source: {
        href: "https://www.courtlistener.com/?type=r&q=%22Headsight%22+%22Deere%22+%22header+height%22",
        label: "View the dockets at CourtListener",
      },
      figure: {
        src: "/oip/matter-figs/gramm-deere.png",
        alt: "Patent figure showing combine harvester header-height control modules.",
        width: 900,
        height: 600,
        credit: "U.S. Patent 6,202,395",
      },
      review: needsReview("Public docket citation exists; final matter framing needs Tom review before launch."),
    },
    {
      id: "precision-planting",
      eyebrow: "1999 to present - USPTO",
      caption: "Prosecution portfolio",
      title: "Precision Planting prosecution portfolio",
      body: "Long-running prosecution work around planting equipment, seed metering, downforce control, trench closers, and row-unit control architecture.",
      source: {
        href: "https://patents.google.com/?assignee=Precision+Planting",
        label: "Browse the assignee portfolio at Google Patents",
      },
      figure: {
        src: "/oip/matter-figs/precision-planting.png",
        alt: "Patent figure showing an air-seeder row-unit assembly.",
        width: 900,
        height: 600,
        credit: "U.S. Patent 10,925,203",
      },
      review: needsReview("Client relationship and attorney-of-record framing require confirmation before launch."),
    },
  ],
  clients: [
    {
      id: "precision-planting",
      aspectRatio: "660/128",
      logo: { src: "/oip/clients/precision-planting.svg", alt: "Precision Planting", credit: "Client mark" },
      website: "https://www.precisionplanting.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "headsight",
      aspectRatio: "258/86",
      logo: { src: "/oip/clients/headsight.png", alt: "Headsight", credit: "Client mark" },
      website: "https://headsight.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "genesis-attachments",
      aspectRatio: "242/52",
      logo: { src: "/oip/clients/genesis-attachments.svg", alt: "Genesis Attachments", credit: "Client mark" },
      website: "https://www.genesisattachments.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "superior-industries",
      aspectRatio: "200/71",
      logo: { src: "/oip/clients/superior-industries.svg", alt: "Superior Industries", credit: "Client mark" },
      website: "https://superior-ind.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "skyline-displays",
      aspectRatio: "5000/2140",
      logo: { src: "/oip/clients/skyline-displays.png", alt: "Skyline Displays", credit: "Client mark" },
      website: "https://skyline.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "par-aide",
      aspectRatio: "200/209",
      logo: { src: "/oip/clients/par-aide.png", alt: "Par Aide", credit: "Client mark" },
      website: "https://www.paraide.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "cray",
      aspectRatio: "513/60",
      logo: { src: "/oip/clients/cray.svg", alt: "Cray", credit: "Client mark" },
      website: "https://www.hpe.com/us/en/compute/hpc/cray.html",
      review: needsReview("Confirm Cray link target (now HPE) before launch."),
    },
    {
      id: "kingdom-ag-concepts",
      aspectRatio: "176/62",
      logo: { src: "/oip/clients/kingdom-ag-concepts.png", alt: "Kingdom Ag Concepts", credit: "Client mark" },
      website: "https://www.shredselect.com/",
      review: needsReview("Confirm Kingdom Ag Concepts link target (Shred Select) before launch."),
    },
    {
      id: "eastpoint-sports",
      aspectRatio: "508/144",
      logo: { src: "/oip/clients/eastpoint-sports.png", alt: "EastPoint Sports", credit: "Client mark" },
      website: "https://www.eastpointsports.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
    {
      id: "bioenergy-life",
      aspectRatio: "300/124",
      logo: { src: "/oip/clients/bioenergy-life.png", alt: "Bioenergy Life Science", credit: "Client mark" },
      website: "https://www.bioenergylifescience.com/",
      review: needsReview("Confirm permission or publication comfort before launch."),
    },
  ],
  press: [
    {
      date: "2015-09-05",
      dateLabel: "September 5, 2015",
      publication: "Twin Cities Business",
      headline: "A Sea Change in Patent Law",
      body: "Quoted on the America Invents Act's effects on small inventors, PTAB inter partes review, and trade-secret strategy after Alice.",
      source: {
        href: "https://tcbmag.com/a-sea-change-in-patent-law/",
        label: "Read at Twin Cities Business",
      },
    },
    {
      date: "2014-12-15",
      dateLabel: "December 15, 2014",
      publication: "Minnesota Lawyer",
      headline: "Larkin Hoffman firm profile",
      body: "Identified as Chair of the firm's Intellectual Property and Technology Practice Group.",
      source: {
        href: "https://minnlawyer.com/2014/12/15/larkin-hoffman/",
        label: "Read at Minnesota Lawyer",
      },
    },
    {
      date: "2018-12-10",
      dateLabel: "December 10, 2018",
      publication: "REJournals",
      headline: "Larkin Hoffman adds to board of directors",
      body: "Reporting on election to the firm's Board of Directors.",
      source: {
        href: "https://rejournals.com/minneapolis-larkin-hoffman-adds-to-board-of-directors/",
        label: "Read at REJournals",
      },
    },
  ],
  socials: [
    {
      platform: "instagram",
      href: "https://www.instagram.com/oip.law/",
      label: "OIP on Instagram",
      active: true,
    },
    {
      platform: "x",
      href: "https://x.com/opiplaw",
      label: "OIP on X",
      active: true,
    },
    {
      platform: "linkedin",
      href: "https://www.linkedin.com/company/oppold-ip-law",
      label: "Oppold IP Law on LinkedIn",
      active: true,
    },
    {
      platform: "youtube",
      href: "https://www.youtube.com/@oip-law",
      label: "OIP on YouTube",
      active: true,
    },
    {
      platform: "threads",
      href: "https://www.threads.com/@oip.law",
      label: "OIP on Threads",
      active: true,
    },
    {
      platform: "tiktok",
      href: "https://www.tiktok.com/@oip.law",
      label: "OIP on TikTok",
      active: true,
    },
    {
      platform: "reddit",
      href: "https://www.reddit.com/user/opiplaw/",
      label: "OIP on Reddit",
      active: true,
    },
    {
      platform: "discord",
      href: "https://discord.gg/xjU9Kaqfg",
      label: "Join the OIP Discord",
      active: true,
    },
    {
      platform: "pinterest",
      href: "https://www.pinterest.com/opiplaw/",
      label: "OIP on Pinterest",
      active: true,
    },
  ],
  contact: {
    email: "toppold@oip.law",
    officePhone: "+16122010409",
    title: "Send Tom an email.",
    lede: "",
    notice: [
      // "Thomas J. Oppold is licensed to practice law in Iowa and Minnesota and registered to practice before the United States Patent and Trademark Office.",
      "Information on this site is for general informational purposes only and is not legal advice.",
      "Sending an email does not create an attorney-client relationship; an engagement begins only on countersignature of a written engagement letter following a conflicts check.",
      // "Past results do not guarantee future outcomes.",
    ],
    review: needsReview("Confirm contact email, jurisdictions, and notice text before launch."),
  },
} satisfies typeof OipSiteContent.Encoded;

/**
 * Decoded OIP launch content.
 *
 * **Example** (Access site content metadata)
 *
 * ```ts
 * import { oipSiteContent } from "@beep/oip-web/content"
 *
 * console.log(oipSiteContent.metadata.siteName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const oipSiteContent = Result.getOrThrow(decodeOipSiteContentResult(rawOipSiteContent));

/**
 * Review gate statuses that must be closed before public launch.
 *
 * **Example** (Check launch review gates)
 *
 * ```ts
 * import { launchReviewGates } from "@beep/oip-web/content"
 *
 * console.log(launchReviewGates.contact.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const launchReviewGates = {
  clientLogos: needsReview("Every client mark needs permission or publication comfort before launch."),
  contact: oipSiteContent.contact.review,
  matters: needsReview("Named matters need final public framing review before launch."),
  metadata: approved("SEO and JSON-LD content mirrors the launch draft and is safe to validate technically."),
  socials: approved("Firm social profiles confirmed live and approved for public launch."),
} as const;
