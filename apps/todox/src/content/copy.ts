/**
 * Public copy for the Todox site. Positioning follows the Todox Notion
 * workspace (product vision, battle card, skills series): a local-first,
 * provider-agnostic advisor runtime with evidence-backed memory. Competitors
 * are never named on the public page, no certification is claimed, and every
 * demonstration is labeled synthetic.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Page metadata strings.
 *
 * @category copy
 * @since 0.0.0
 */
export const meta = {
  title: "Todox — the AI runtime your firm controls",
  description:
    "Todox is a local-first advisor runtime for wealth-management firms: transparent, swappable models, advisor-authored skills, and evidence-backed client memory that keeps its history. Demonstrations use synthetic data.",
  socialLine: "Local-first AI for wealth-management firms, with evidence attached.",
} as const;

/**
 * Site navigation and calls to action.
 *
 * @category copy
 * @since 0.0.0
 */
export const nav = {
  links: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Skills", href: "#skills" },
    { label: "Why Todox", href: "#why-todox" },
    { label: "FAQ", href: "#faq" },
  ],
  primary: { label: "Request a demo", href: "#request-demo" },
  secondary: { label: "See how it works", href: "#how-it-works" },
} as const;

/**
 * Hero.
 *
 * @category copy
 * @since 0.0.0
 */
export const hero = {
  eyebrowless: true,
  headline: "The AI runtime your firm actually controls.",
  lede: "Todox is a local-first advisor runtime for wealth-management firms. Every claim carries its evidence, every change keeps its history, and every model is one you chose.",
  proofLine:
    "Runs on the advisor's machine · Works with the systems you already own · Demonstrations use synthetic data",
} as const;

/**
 * Product pillars.
 *
 * @category copy
 * @since 0.0.0
 */
export const pillars = {
  heading: "Infrastructure around your stack, not another tool on top of it.",
  intro:
    "Your CRM, planning, document, and custodial systems stay the source of record. Todox is the governed runtime where agents read context, propose work, cite evidence, and wait for a professional to decide.",
  items: [
    {
      title: "Local-first by default",
      body: "Client memory, workflows, and model choices live on the advisor's machine. Data leaves only when a policy your firm wrote says it can.",
    },
    {
      title: "Transparent, swappable models",
      body: "See which model reads your clients' context, and change it per workflow and per advisor. Bring the subscriptions your team already pays for instead of paying a wrapper's markup.",
    },
    {
      title: "Evidence-backed expert memory",
      body: "Every assertion is a typed record with its source span, who produced it, when it was observed, and what it superseded. When a client changes their mind, nothing gets overwritten.",
    },
    {
      title: "Skills your advisors write",
      body: "A workflow is a markdown file in a folder. Personal, team, and firm-wide skills promote through review, so tribal knowledge becomes infrastructure.",
    },
  ],
} as const;

/**
 * How it works: the four beats around the interactive session.
 *
 * @category copy
 * @since 0.0.0
 */
export const howItWorks = {
  heading: "From a client email to a reviewed meeting brief.",
  intro:
    "Below is one deterministic synthetic session, replayed end to end. Select any record to open its exact source span beside its receipt.",
  steps: [
    {
      title: "A source lands",
      body: "An approved email, note, or document enters the workspace with stable, addressable spans.",
    },
    {
      title: "Candidates post with evidence",
      body: "The runtime proposes claims, tasks, and drafts. Each one points at the span it came from.",
    },
    {
      title: "A professional decides",
      body: "Advisor or compliance review accepts, edits, or rejects. Rejected work stays on the record.",
    },
    {
      title: "The brief carries receipts",
      body: "The meeting packet lists what changed, what is open, and what was excluded, with a receipt on every line.",
    },
  ],
  syntheticLabel: "Synthetic demonstration — no client data. Producer: deterministic fixture, no live model ran.",
} as const;

/**
 * Skills section.
 *
 * @category copy
 * @since 0.0.0
 */
export const skills = {
  heading: "Your tribal knowledge becomes infrastructure.",
  intro:
    "A skill is a folder with a SKILL.md that teaches the agent how your firm does one thing. Anyone can write one. Drop it in the folder and the agent knows the workflow.",
  tiers: [
    { title: "Personal", body: "An individual advisor's specialty, such as their HNW estate-planning prep." },
    { title: "Team", body: "Shared by a group, such as a family-office onboarding process." },
    { title: "Firm-wide", body: "Promoted after compliance review, such as the official quarterly-review template." },
  ],
  snippet: `# Tax-loss harvesting review
When: an HNW client asks about sourcing cash from a taxable account.
Do:
1. Pull the household's realized gains year to date.
2. List candidate lots with unrealized losses above the threshold.
3. Flag wash-sale exposure across every linked account.
4. Draft the advisor's talking points. Never recommend a trade.`,
  note: "Skills follow an open, vendor-neutral format, so the work your firm puts into them is portable.",
} as const;

/**
 * Why Todox: notetaker versus runtime.
 *
 * @category copy
 * @since 0.0.0
 */
export const whyTodox = {
  heading: "Notetakers are becoming a feature of your CRM. Todox is the layer that survives that.",
  intro:
    "When the systems you already own ship their own meeting summaries, a standalone recorder has nowhere to go. A runtime routes around it.",
  columns: ["", "Typical AI notetaker", "Todox runtime"],
  rows: [
    ["Architecture", "Cloud, multi-tenant, one vendor's stack", "Local-first, provider-agnostic gateway"],
    ["Models", "Undisclosed and fixed", "Named, chosen per workflow, swappable"],
    ["Subscriptions", "Pay the vendor, who pays the model", "Reuse the subscriptions your advisors hold"],
    ["Memory", "Latest extracted row, one timestamp", "Claim + evidence + provenance + lifecycle"],
    ["Customization", "A session with the vendor's product team", "Drop a markdown skill file"],
    ["Leaving", "Migration means rebuilding", "Open interfaces, swappable connectors"],
  ],
} as const;

/**
 * Compliance posture.
 *
 * @category copy
 * @since 0.0.0
 */
export const trust = {
  heading: "Built to be defensible, not to wave a badge.",
  points: [
    "Every assertion about a client keeps its source span, confidence, assertion time, effective time, and supersession chain.",
    "Every action records which user, agent, model, tool, and credential produced it, and what it cost.",
    "Financial advice, recommendations, account actions, and client-facing communication require a professional's review under your firm's policy.",
    "Existing systems of record remain authoritative. Todox references them; it does not replace them.",
    "We do not claim certifications we have not earned. The posture is architectural and inspectable.",
  ],
} as const;

/**
 * FAQ.
 *
 * @category copy
 * @since 0.0.0
 */
export const faq = {
  heading: "Questions we expect.",
  items: [
    {
      question: "Is this another meeting recorder?",
      answer:
        "No. Todox starts with source-linked client context before the meeting and preserves reviewable work after it. Recording can be one input. It is not the product.",
    },
    {
      question: "Are you replacing our CRM or custodian?",
      answer:
        "No. Those systems stay authoritative for the records they own. Todox coordinates context, proposed work, review, and provenance around them through swappable connectors.",
    },
    {
      question: "Which models does it use?",
      answer:
        "The ones you choose. The gateway is provider-agnostic, model selection is visible, and it can differ per workflow and per advisor. Advisors can bring the subscriptions they already have.",
    },
    {
      question: "What does local-first mean in practice?",
      answer:
        "The workspace, memory, and runtime live on the advisor's machine by default. Bounded context is sent to an approved model only under the policy your firm sets, and the model, tool, actor, and review are recorded with the work.",
    },
    {
      question: "Can it act for the advisor?",
      answer:
        "Only inside a firm-defined policy and authorization boundary. Advice, recommendations, money movement, trades, tax conclusions, and unsupervised client communication stay outside it.",
    },
    {
      question: "How far along is the product?",
      answer:
        "Todox is in development. What you see on this page replays a deterministic synthetic fixture. Bring the systems you care about to a demo and we will show you the mechanism on them.",
    },
  ],
} as const;

/**
 * Demo request section.
 *
 * @category copy
 * @since 0.0.0
 */
export const contact = {
  heading: "Request a private demo.",
  intro:
    "Tell us about your firm and the systems you run. We will walk through the runtime on a synthetic book that looks like yours.",
  fields: {
    name: "Your name",
    firm: "Firm",
    email: "Work email",
    stack: "Systems you run (CRM, planning, custodian)",
  },
  submit: "Request a demo",
  wiringNote: "Requests are not yet delivered while this form is being connected.",
  heldNote:
    "Received on this page only. The request path is still being connected, so nothing was sent and nothing was stored.",
  stackPlaceholder: "e.g. your CRM, planning tool, document system, custodian",
} as const;

/**
 * Footer and required qualification.
 *
 * @category copy
 * @since 0.0.0
 */
export const footer = {
  qualification:
    "Todox.ai is a product in development. Demonstrations use synthetic data and do not provide financial, investment, tax, or legal advice. Product capabilities, integrations, controls, and availability remain subject to validation.",
  line: "© Todox",
} as const;
