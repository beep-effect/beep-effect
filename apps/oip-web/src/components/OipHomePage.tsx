/**
 * OIP public home page components.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cn } from "@beep/ui/lib/utils";
import { A } from "@beep/utils";
import {
  DiscordLogoIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  PinterestLogoIcon,
  RedditLogoIcon,
  ThreadsLogoIcon,
  TiktokLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react/ssr";
// import * as P from "effect/Predicate";
import Image from "next/image";
import { BackToTop } from "./BackToTop";
import { ContactForm } from "./ContactForm";
import { HeroVideo } from "./HeroVideo";
// import { MattersCarousel } from "./MattersCarousel";
import { ThemeModeToggle } from "./ThemeModeToggle";
import type { Icon } from "@phosphor-icons/react";
// import type { ReactNode } from "react";
import type { ContactSubmissionStatus } from "../contact";
import type { OipSiteContent, SocialPlatform } from "../content";

const sectionShell = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12";
const monoLabel = "font-[family-name:var(--font-oip-mono)] text-xs font-medium uppercase tracking-[0.16em]";
const displayClass = "font-[family-name:var(--font-oip-display)]";
const ctaClass =
  "inline-flex h-12 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--oip-gold)]";

function Lockup({ className = "", width = 176 }: { readonly className?: string; readonly width?: number }) {
  return (
    <Image
      src="/oip/oip-lockup-horizontal.svg"
      alt="OIP - Oppold IP Law"
      width={width}
      height={Math.round(width * (100 / 320))}
      priority
      className={className}
    />
  );
}

// function ExternalAnchor({
//   children,
//   className,
//   href,
// }: {
//   readonly children: ReactNode;
//   readonly className?: string;
//   readonly href: string;
// }) {
//   return (
//     <a className={className} href={href} target="_blank" rel="noopener noreferrer">
//       {children}
//     </a>
//   );
// }

function Nav({ content }: { readonly content: OipSiteContent }) {
  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--oip-paper)] focus:px-4 focus:py-2 focus:text-[var(--oip-heading)]"
        href="#main-content"
      >
        Skip to main content
      </a>
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-[color-mix(in_oklab,var(--oip-on-soil)_20%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_82%,transparent)] backdrop-blur-md">
        <div className={`${sectionShell} flex h-14 items-center gap-2`}>
          <div className="flex flex-1 justify-start">
            <a href="/" aria-label="Oppold IP Law — home" className="flex shrink-0 items-center">
              <Image
                src="/oip/oip-mark.svg"
                alt=""
                width={64}
                height={64}
                priority
                className="h-8 w-auto brightness-0 invert sm:hidden"
              />
              <Image
                src="/oip/oip-lockup-horizontal.svg"
                alt=""
                width={320}
                height={96}
                priority
                className="hidden h-9 w-auto brightness-0 invert sm:block"
              />
            </a>
          </div>
          <ul className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-3" aria-label="Primary navigation">
            {A.map(content.nav, (item) => (
              <li key={item.href}>
                <a
                  className="block px-2 py-2 font-[family-name:var(--font-oip-mono)] text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--oip-on-soil)] opacity-80 transition-opacity hover:opacity-100 sm:px-3"
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-1 justify-end">
            <ThemeModeToggle />
          </div>
        </div>
      </nav>
    </>
  );
}

function Hero({ content }: { readonly content: OipSiteContent }) {
  const { hero } = content;

  return (
    <section
      className="relative isolate grid min-h-[720px] overflow-hidden bg-[var(--oip-soil)] pt-14 text-[var(--oip-on-soil)] lg:grid-cols-[1.08fr_0.92fr]"
      aria-labelledby="hero-title"
    >
      <div className="relative z-10 flex min-h-[650px] flex-col justify-center px-5 py-10 sm:px-8 sm:py-14 lg:pl-[max(3rem,calc((100vw-80rem)/2+3rem))] lg:pr-14">
        <div className="max-w-[41rem] 2xl:max-w-[32rem]">
          <h1
            id="hero-title"
            className={`${displayClass} max-w-3xl text-5xl leading-[1.05] sm:text-6xl lg:text-7xl 2xl:text-[4.75rem]`}
          >
            {hero.headline}
          </h1>
          <p className={`${displayClass} mt-6 max-w-xl text-2xl italic leading-9 text-[var(--oip-cream-muted)]`}>
            {hero.lede}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              className={`${ctaClass} border-[var(--oip-gold)] bg-[var(--oip-gold)] text-[var(--oip-soil)] hover:border-[var(--oip-gold-bright)] hover:bg-[var(--oip-gold-bright)]`}
              href={hero.primaryCta.href}
            >
              {hero.primaryCta.label}
            </a>
            <a
              className="font-[family-name:var(--font-oip-mono)] text-sm font-medium uppercase tracking-[0.12em] text-[var(--oip-gold)]"
              href={hero.secondaryCta.href}
            >
              {hero.secondaryCta.label}
            </a>
          </div>
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden bg-[var(--oip-soil)] lg:min-h-full lg:[clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">
        <HeroVideo
          clips={A.map(hero.clips, (clip) => ({
            poster: clip.poster.src,
            mp4: clip.video.src,
            webm: clip.video.src.replace(/\.mp4$/, ".webm"),
          }))}
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(31,29,26,0.58),rgba(91,26,26,0.12),rgba(31,29,26,0.38))]" />
      </div>

      <Image
        className="pointer-events-none absolute bottom-0 left-1/2 z-20 hidden h-[78%] w-auto max-w-[42%] object-contain opacity-95 2xl:block"
        src={hero.portrait.src}
        alt={hero.portrait.alt}
        width={hero.portrait.width ?? 700}
        height={hero.portrait.height ?? 1245}
        sizes="(min-width: 1536px) 28vw, 1px"
      />
    </section>
  );
}

function About({ content }: { readonly content: OipSiteContent }) {
  return (
    <section className="bg-[var(--oip-paper)] py-20 text-[var(--oip-body)]" id="about" aria-labelledby="about-title">
      <div className={sectionShell}>
        <h2 id="about-title" className="sr-only">
          About Thomas J. Oppold's practice
        </h2>
        <div className="grid gap-7 lg:grid-cols-3">
          {A.map(content.about, (panel) => {
            const isPortraitPanel = panel.id === "law";

            return (
              <article key={panel.id} className="flex flex-col gap-5">
                <figure
                  className={cn(
                    "overflow-hidden rounded-lg border border-[var(--oip-rule)]",
                    isPortraitPanel ? "bg-[var(--oip-portrait-ground)]" : "bg-[var(--oip-figure-ground)]"
                  )}
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      className={cn(isPortraitPanel ? "object-contain object-bottom px-7 pt-7" : "object-cover")}
                      src={panel.image.src}
                      alt={panel.image.alt}
                      fill
                      quality={60}
                      sizes="(min-width: 1024px) 31vw, 90vw"
                    />
                  </div>
                </figure>
                <div>
                  <h3 className={`${displayClass} text-4xl leading-tight text-[var(--oip-heading)]`}>{panel.title}</h3>
                  <p className="mt-4 text-base leading-7 text-[var(--oip-body)]">{panel.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Practice({ content }: { readonly content: OipSiteContent }) {
  return (
    <section
      className="bg-[var(--oip-paper)] py-20 text-[var(--oip-body)]"
      id="practice"
      aria-labelledby="practice-title"
    >
      <div className={sectionShell}>
        <header className="max-w-3xl">
          <h2 id="practice-title" className={`${displayClass} text-5xl leading-tight text-[var(--oip-heading)]`}>
            Practice Areas
          </h2>
        </header>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {A.map(content.practices, (practice) => (
            <article key={practice.id} className="rounded-lg border border-[var(--oip-rule)] bg-[var(--oip-card)] p-5">
              <h3 className={`${displayClass} min-h-[3.5rem] text-2xl leading-8 text-[var(--oip-heading)]`}>
                {practice.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--oip-body)]">{practice.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// function Matters({ content }: { readonly content: OipSiteContent }) {
//   return (
//     <section
//       className="bg-[var(--oip-soil)] py-20 text-[var(--oip-on-soil)]"
//       id="matters"
//       aria-labelledby="matters-title"
//     >
//       <div className={sectionShell}>
//         <header className="max-w-3xl">
//           <p className={`${monoLabel} text-[var(--oip-gold)]`}>Selected matters</p>
//           <h2 id="matters-title" className={`${displayClass} mt-4 text-5xl leading-tight`}>
//             Public records, practical machinery.
//           </h2>
//         </header>
//         <MattersCarousel>
//           {A.map(content.matters, (matter) => (
//             <a
//               key={matter.id}
//               href={matter.source.href}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="group flex h-full min-h-[34rem] flex-col overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--oip-on-soil)_18%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_80%,black)] text-[var(--oip-on-soil)] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--oip-gold)]"
//             >
//               <figure className="min-w-0 border-b border-[color-mix(in_oklab,var(--oip-on-soil)_18%,transparent)] bg-[var(--oip-figure-ground)]">
//                 <Image
//                   className="aspect-[4/3] w-full object-contain p-5"
//                   src={matter.figure.src}
//                   alt={matter.figure.alt}
//                   width={matter.figure.width ?? 900}
//                   height={matter.figure.height ?? 600}
//                   sizes="(min-width: 1024px) 31vw, 84vw"
//                 />
//                 {P.isString(matter.figure.credit) ? (
//                   <figcaption className="overflow-wrap-anywhere border-t border-[var(--oip-rule)] px-5 py-3 font-[family-name:var(--font-oip-mono)] text-sm font-semibold leading-6 tracking-[0.04em] text-[var(--oip-figure-caption)]">
//                     {matter.figure.credit}
//                   </figcaption>
//                 ) : null}
//               </figure>
//               <div className="grid min-w-0 gap-3 p-5">
//                 <p className={`${monoLabel} min-h-8 text-[var(--oip-gold)]`}>{matter.eyebrow}</p>
//                 <p className={`${monoLabel} text-[var(--oip-cream-muted)]`}>{matter.caption}</p>
//                 <h3 className={`${displayClass} text-3xl leading-tight`}>{matter.title}</h3>
//                 <p className="text-sm leading-7 text-[var(--oip-cream-muted)]">{matter.body}</p>
//                 {P.isString(matter.citation) ? (
//                   <p className="font-[family-name:var(--font-oip-mono)] text-xs leading-6 text-[var(--oip-gold)]">
//                     {matter.citation}
//                   </p>
//                 ) : null}
//                 <span className="mt-2 font-[family-name:var(--font-oip-mono)] text-xs uppercase tracking-[0.12em] text-[var(--oip-gold)]">
//                   {matter.source.label}
//                 </span>
//               </div>
//             </a>
//           ))}
//         </MattersCarousel>
//       </div>
//     </section>
//   );
// }

// function Clients({ content }: { readonly content: OipSiteContent }) {
//   return (
//     <section className="bg-[var(--oip-paper)] py-14 text-[var(--oip-body)]" id="clients" aria-label="Selected clients">
//       <div className={sectionShell}>
//         <p className={`${monoLabel} text-center text-[var(--oip-burgundy)]`}>Counsel of record for selected matters</p>
//         <ul className="mt-8 grid grid-cols-2 items-center gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
//           {A.map(content.clients, (client) => {
//             const logo = (
//               <img
//                 src={client.logo.src}
//                 alt={client.logo.alt}
//                 loading="lazy"
//                 decoding="async"
//                 className="max-h-12 w-full max-w-40 object-contain opacity-[0.86] transition-opacity hover:opacity-100"
//                 style={
//                   {
//                     aspectRatio: client.aspectRatio,
//                     filter: "var(--oip-client-logo-filter)",
//                   } satisfies CSSProperties
//                 }
//               />
//             );
//             return (
//               <li key={client.id} className="flex min-h-16 items-center justify-center">
//                 {P.isString(client.website) ? (
//                   <a
//                     href={client.website}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     aria-label={`${client.logo.alt} (opens in a new tab)`}
//                     className="flex w-full items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--oip-gold)]"
//                   >
//                     {logo}
//                   </a>
//                 ) : (
//                   logo
//                 )}
//               </li>
//             );
//           })}
//         </ul>
//       </div>
//     </section>
//   );
// }

// function Press({ content }: { readonly content: OipSiteContent }) {
//   return (
//     <section className="bg-[var(--oip-paper)] py-20 text-[var(--oip-body)]" id="press" aria-labelledby="press-title">
//       <div className={sectionShell}>
//         <header className="max-w-3xl">
//           <p className={`${monoLabel} text-[var(--oip-burgundy)]`}>Selected press</p>
//           <h2 id="press-title" className={`${displayClass} mt-4 text-5xl leading-tight text-[var(--oip-heading)]`}>
//             In the trade and legal press.
//           </h2>
//         </header>
//         <ul className="mt-10 grid gap-5">
//           {A.map(content.press, (item) => (
//             <li key={item.source.href} className="border-t border-[var(--oip-rule)] pt-5">
//               <article className="grid gap-4 md:grid-cols-[14rem_1fr_auto] md:items-start">
//                 <p className="font-[family-name:var(--font-oip-mono)] text-xs uppercase tracking-[0.12em] text-[var(--oip-muted)]">
//                   <time dateTime={item.date}>{item.dateLabel}</time>
//                   <br />
//                   {item.publication}
//                 </p>
//                 <div>
//                   <h3 className={`${displayClass} text-3xl leading-tight text-[var(--oip-heading)]`}>
//                     <ExternalAnchor className="hover:text-[var(--oip-burgundy)]" href={item.source.href}>
//                       {item.headline}
//                     </ExternalAnchor>
//                   </h3>
//                   <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--oip-body)]">{item.body}</p>
//                 </div>
//                 <ExternalAnchor
//                   className="font-[family-name:var(--font-oip-mono)] text-xs font-medium uppercase tracking-[0.12em] text-[var(--oip-burgundy)]"
//                   href={item.source.href}
//                 >
//                   {item.source.label}
//                 </ExternalAnchor>
//               </article>
//             </li>
//           ))}
//         </ul>
//       </div>
//     </section>
//   );
// }

function Contact({
  content,
  initialSubmittedAt,
  status,
}: {
  readonly content: OipSiteContent;
  readonly initialSubmittedAt: number;
  readonly status: ContactSubmissionStatus | undefined;
}) {
  const { contact } = content;
  const mailto = `mailto:${contact.email}?subject=oip.law%20-%20new%20matter`;
  const officePhoneHref = `tel:${contact.officePhone}`;

  return (
    <section
      className="bg-[var(--oip-contact-ground)] py-20 text-[var(--oip-on-soil)]"
      id="contact"
      aria-labelledby="contact-title"
    >
      <div className={`${sectionShell} grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start`}>
        <div>
          <p className={`${monoLabel} text-[var(--oip-on-burgundy-accent)]`}>Contact</p>
          <h2 id="contact-title" className={`${displayClass} mt-4 text-5xl leading-tight`}>
            {contact.title}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[color-mix(in_oklab,var(--oip-on-soil)_88%,transparent)]">
            {contact.lede}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              className={`${ctaClass} border-[var(--oip-on-soil)] bg-[var(--oip-on-soil)] text-[var(--oip-contact-ground)] hover:border-white hover:bg-white`}
              href={mailto}
            >
              {contact.email}
            </a>
            <a
              className={`${ctaClass} border border-[color-mix(in_oklab,var(--oip-on-soil)_42%,transparent)] text-[var(--oip-on-soil)] hover:border-white hover:text-white`}
              href={officePhoneHref}
            >
              {contact.officePhone}
            </a>
            {/*<span className={`${monoLabel} text-[var(--oip-on-burgundy-accent)]`}>Iowa and Minnesota Bars</span>*/}
          </div>
        </div>
        <div className="grid gap-5">
          <ContactForm email={contact.email} initialSubmittedAt={initialSubmittedAt} status={status} />
          <aside className="rounded-lg border border-[color-mix(in_oklab,var(--oip-on-soil)_22%,transparent)] bg-[color-mix(in_oklab,var(--oip-soil)_22%,transparent)] p-6">
            <p className={`${monoLabel} text-[var(--oip-on-burgundy-accent)]`}>Notice</p>
            <div className="mt-4 grid gap-4 text-sm leading-7 text-[color-mix(in_oklab,var(--oip-on-soil)_88%,transparent)]">
              {A.map(contact.notice, (line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

const socialIcon: Record<SocialPlatform, Icon> = {
  instagram: InstagramLogoIcon,
  linkedin: LinkedinLogoIcon,
  x: XLogoIcon,
  youtube: YoutubeLogoIcon,
  threads: ThreadsLogoIcon,
  tiktok: TiktokLogoIcon,
  reddit: RedditLogoIcon,
  discord: DiscordLogoIcon,
  pinterest: PinterestLogoIcon,
};

function SocialLinks({ socials }: { readonly socials: OipSiteContent["socials"] }) {
  const visible = A.filter(socials, (social) => social.active);
  if (!A.matchToBoolean(visible)) {
    return null;
  }

  return (
    <ul aria-label="OIP social media" className="flex flex-wrap items-center gap-1 md:justify-end">
      {A.map(visible, (social) => {
        const Glyph = socialIcon[social.platform];

        return (
          <li key={social.platform}>
            <a
              aria-label={social.label}
              className="inline-flex size-11 items-center justify-center rounded-md text-[var(--oip-on-soil)] transition-colors hover:text-[var(--oip-gold)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--oip-gold)]"
              href={social.href}
              rel="me noopener noreferrer"
              target="_blank"
            >
              <Glyph aria-hidden size={20} weight="regular" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Footer({ content }: { readonly content: OipSiteContent }) {
  return (
    <footer className="bg-[var(--oip-soil)] py-10 text-[var(--oip-on-soil)]">
      <div className={`${sectionShell} grid gap-8 md:grid-cols-[1fr_auto] md:items-end`}>
        <div>
          <h2 id="footer-title" className="sr-only">
            Site footer
          </h2>
          <Lockup className="h-auto w-64 brightness-0 invert md:w-[18.75rem]" />
          <p className={`${displayClass} mt-4 text-xl italic text-[var(--oip-cream-muted)]`}>
            Patent counsel for the people who build the machines.
          </p>
        </div>
        <div className="grid gap-4 text-left md:justify-items-end md:text-right">
          <SocialLinks socials={content.socials} />
          <p className="text-sm text-[var(--oip-cream-muted)]">Copyright 2026 Oppold IP Law</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Renders the OIP public home page.
 *
 * **Example** (Rendering OipHomePage with content)
 *
 * ```tsx
 * import { OipHomePage } from "@beep/oip-web/components/OipHomePage"
 * import { oipSiteContent } from "@beep/oip-web/content"
 *
 * const page = <OipHomePage contactStatus={undefined} content={oipSiteContent} initialContactSubmittedAt={0} />
 * console.log(page.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OipHomePage({
  contactStatus,
  content,
  initialContactSubmittedAt,
}: {
  readonly contactStatus: ContactSubmissionStatus | undefined;
  readonly content: OipSiteContent;
  readonly initialContactSubmittedAt: number;
}) {
  return (
    <div className="min-h-screen bg-[var(--oip-paper)] text-[var(--oip-body)]">
      <Nav content={content} />
      <main id="main-content">
        <Hero content={content} />
        <About content={content} />
        <Practice content={content} />
        {/*<Matters content={content} />*/}
        {/*<Clients content={content} />*/}
        {/*<Press content={content} />*/}
        <Contact content={content} initialSubmittedAt={initialContactSubmittedAt} status={contactStatus} />
      </main>
      <Footer content={content} />
      <BackToTop />
    </div>
  );
}
