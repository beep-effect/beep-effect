/**
 * The Todox homepage: a standard product site with one live demonstration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContactForm } from "@/components/ContactForm";
import { Hero } from "@/components/Hero";
import { SessionDemo } from "@/components/SessionDemo";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/Wordmark";
import { contact, faq, footer, howItWorks, pillars, skills, trust, whyTodox } from "@/content/copy";

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path
      d="M4 10.5 8 14.5 16 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Renders the homepage.
 *
 * **Example** (Render the home page)
 *
 * ```ts
 * import Home from "@/app/page"
 *
 * const page = Home()
 * console.log(page.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />

        <section className="section" id="product" aria-labelledby="product-title">
          <div className="frame">
            <div className="section__head">
              <h2 className="display display--l" id="product-title">
                {pillars.heading}
              </h2>
              <p className="lede">{pillars.intro}</p>
            </div>
            <ol className="pillars">
              {pillars.items.map((item) => (
                <li className="pillar" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section demo" id="how-it-works" aria-labelledby="how-title">
          <div className="frame">
            <div className="section__head">
              <h2 className="display display--l" id="how-title">
                {howItWorks.heading}
              </h2>
              <p className="lede">{howItWorks.intro}</p>
            </div>
            <ol className="steps">
              {howItWorks.steps.map((step) => (
                <li className="step" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <SessionDemo />
          </div>
        </section>

        <section className="section" id="skills" aria-labelledby="skills-title">
          <div className="frame skills__grid">
            <div>
              <div className="section__head">
                <h2 className="display display--l" id="skills-title">
                  {skills.heading}
                </h2>
                <p className="lede">{skills.intro}</p>
              </div>
              <dl className="tiers">
                {skills.tiers.map((tier) => (
                  <div className="tier" key={tier.title}>
                    <dt>{tier.title}</dt>
                    <dd>{tier.body}</dd>
                  </div>
                ))}
              </dl>
              <p className="skills__note">{skills.note}</p>
            </div>
            <pre className="code">
              <span className="code__path">skills/tax-loss-harvesting-review/SKILL.md</span>
              {skills.snippet}
            </pre>
          </div>
        </section>

        <section className="section" id="why-todox" aria-labelledby="why-title">
          <div className="frame">
            <div className="section__head">
              <h2 className="display display--l" id="why-title">
                {whyTodox.heading}
              </h2>
              <p className="lede">{whyTodox.intro}</p>
            </div>
            <p className="compare-hint" aria-hidden="true">
              SCROLL SIDEWAYS FOR THE FULL TABLE →
            </p>
            <div className="compare-wrap" data-scroll-x>
              <table className="compare">
                <thead>
                  <tr>
                    {whyTodox.columns.map((column, index) => (
                      <th scope="col" key={column === "" ? `col-${index}` : column}>
                        {column === "" ? <span className="sr-only">Dimension</span> : column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {whyTodox.rows.map(([dimension, notetaker, todox]) => (
                    <tr key={dimension}>
                      <th scope="row">{dimension}</th>
                      <td>{notetaker}</td>
                      <td>{todox}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section" id="trust" aria-labelledby="trust-title">
          <div className="frame trust">
            <div className="section__head">
              <h2 className="display display--l" id="trust-title">
                {trust.heading}
              </h2>
            </div>
            <ul className="trust__list">
              {trust.points.map((point) => (
                <li key={point}>
                  <CheckIcon />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="faq" aria-labelledby="faq-title">
          <div className="frame">
            <div className="section__head">
              <h2 className="display display--l" id="faq-title">
                {faq.heading}
              </h2>
            </div>
            <div className="faq">
              {faq.items.map((item, index) => (
                <details key={item.question} open={index === 0}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section contact" id="request-demo" aria-labelledby="contact-title">
          <div className="frame contact__grid">
            <div className="section__head">
              <h2 className="display display--l" id="contact-title">
                {contact.heading}
              </h2>
              <p className="lede">{contact.intro}</p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="frame">
          <Wordmark href="#top" />
          <div className="footer__row">
            <p className="footer__q">{footer.qualification}</p>
            <p>{footer.line}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
