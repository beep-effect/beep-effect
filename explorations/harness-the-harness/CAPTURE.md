# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-14

Origin: Notion Development Todo "Coding Agent Effectiveness & How the same
capabilities can be achieved for non technical agent setups in beep-effect
(law-practice)" (status Parking Lot, page id
`3f169573-788d-8084-8dd1-d56304810d5d`). The page is the long-form source; it
was revised in the same session to carry the framing below. This packet links
it rather than copying it.

The page's original thesis (2026-10-06): lawyers have chat/Cowork, not a
coding-agent setup. Coding agents improve their own environment over time
(durable instructions, skills, scripts, hooks, MCP, subagents, versioned
history, on-disk transcripts). Give non-technical professionals the same
compounding improvement without passing them the technical overhead. Runs on
the lawyer's workstation, existing DMS (Box) as system of record, no new
hosted infrastructure, Git bundles to Box for recovery, a gated improvement
loop (observe, attribute, propose, validate, approve, activate, measure,
roll back) whose policy sits outside the agent's writable area.

Operator, in session, verbatim:

> Well we would take a ~/YeeBois/references/effect/t3code approach. We
> wouldn't be replacing claude code .

> Yeah its more like how do we wrap claude code so it is less technical for
> lawyers & how do we harness the harness so to speak.

> I'm not even suggesting we necessarily build our own UI or anything
> ourselves (I'm not stating anything definitive ). Think about the
> practice-kg-mcp. It gives claude all of these tools....
>
> Like think of how difficult or overwhelming it would be for a lawyer (even
> with someone to teach them, video tutorials or guides) to set all of this
> up. Instead of having 20 mcp's to setup & dozens of various permissions /
> configs. What if through an extension or some sort of agent guided approach
> (using claude code / codex under the hood like t3code) we made 1 mcp & we
> had agents work behind the scenes or with computer use to help them get
> their secrets set or create a 1password account (TBH I'm the most concerned
> about how difficult this will be), or setup development dependencies (node,
> python, rust, CLIProxyAPI), or even worse enable bios virtualization?
>
> There are so many variables in creating a setup on a lawyers workstation
> (we can safely assume windows) like what we have here. Not to mention all
> the hiccups along the way.

> Well an "onboarding" or installer "guide" agent would help the lawyer, do
> what it can do itself, open links, fill in forms, let them click buttons &
> enter their password where 100% necessary. Let agents handle the rest.
>
> Like a /grill-with-docs workflow but where the agent walks through their
> requirements & needed / optional services & systems of record.
>
> Right now we support box & 1password.
>
> What if they use bitlocker or lastpass? What if they use netsuite instead of
> box?
>
> An agent workflow that can walk them through each, automating what can be.
>
> Giving claude the juice but without the need to someone who knows the game
> like me.

> [Windows Credential Manager] definitely this. Not so sure about LastPass or
> Bitwarden we should research what real attorneys & firms use.

> [Practice and billing] Yeah lets make sure we choose the most popular
> options for solo & small firms. We'll prioritize with that data.

> [NetSuite] Sorry meant netdoc

Agent notes from the same discussion (directions, not commitments):

- "Wrap": every developer surface gets a professional one (login button,
  matter picker, plain permission asks, "what changed / undo").
- "Harness the harness": Claude Code harnesses the model; our layer harnesses
  Claude Code: owns the extension points, runs it, decides which
  self-improvements are allowed. Hooks/settings/permissions never
  agent-writable.
- Setup is the product. Remove dependencies before automating their install
  (bundled runtimes, prebuilt binaries, no proxy, no virtualization).
- One gateway MCP fronting all providers; auth tokens in the OS store;
  policy in the gateway.
- Human-steps boundary: agents never create accounts or type credentials;
  irreducible human steps are consent, password/MFA, UAC, reboot, account
  creation where needed.
- SetupRequirement desired state + doctor loop (the `op-doctor` /
  `beep models check` pattern as a product).
- BitLocker is disk encryption (check it, don't store in it). NetDocuments,
  not NetSuite.
