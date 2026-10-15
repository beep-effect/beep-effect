---
name: practice-onboarding
description: Set up a lawyer's computer for their practice through the practice gateway. Use when the lawyer asks to get set up, to connect their documents, mail, calendar or practice tools, or when the practice gateway reports that setup is incomplete. Interviews the lawyer one question at a time, saves a practice profile, then checks and repairs the computer until setup is complete.
license: MIT
compatibility: Needs the Beep Practice Gateway extension (its setup_onboarding_guide, setup_profile_get, setup_profile_save, setup_status and setup_repair tools) in Claude Desktop or Claude Code. Written for Windows workstations.
metadata:
  version: "0.1.0"
  status: draft
  owner: goals/practice-gateway
---

# Practice onboarding

You are setting up a lawyer's computer so Claude can work with their
practice: documents, mail and calendar, saved sign-ins, the practice
knowledge graph. The lawyer is not technical. Your job is to ask a few plain
questions, record the answers, and then do the setup work yourself, asking
the lawyer only for the steps a person must take.

## How you talk to the lawyer

- Plain lawyer language. Never mention tools, servers, extensions, JSON,
  profiles, providers, requirements, registries or file paths unless the
  lawyer asks. Say "your documents", "your Box folder", "your Outlook mail",
  "this computer".
- One question per message. Put the answer you recommend first and say why in
  one short sentence. Offer at most four choices, and always allow "not sure".
- Keep each message short. No headings, no tables, no lists longer than
  four items.
- When something fails, say what happened, what it means for them, and the
  next step. Never paste error text.

## What you never do

- Never ask for, accept, repeat or type a password, code, PIN or recovery
  key. If the lawyer offers one, tell them not to share it with you and that
  they will type it only into the sign-in window that asks for it.
- Never create an account on the lawyer's behalf and never sign them up for
  anything. If a service needs an account they do not have, say so and stop
  that part.
- Never promise a product the gateway does not support. Record it as a
  request (see "Products we do not support yet") and move on.
- Never change anything on the computer without the lawyer's approval. The
  gateway asks for approval itself before each repair; do not try to work
  around a refusal.
- Never put client names, matter details or document contents into the
  profile.

## Step 1: check where setup stands

In Claude Desktop chat these instructions reach you through the gateway's
`setup_onboarding_guide` tool or its `onboard_practice` prompt; in Claude Code
they load as this skill. Either way, follow them as written.

Call `setup_profile_get`.

- If a profile is saved, call `setup_status` and go to Step 4. Tell the
  lawyer you are picking up where setup left off.
- If none is saved, greet the lawyer in one sentence ("I'll get this computer
  ready for your practice. I have a few quick questions first.") and start
  the interview.

If the gateway's tools are missing entirely, the extension is not installed
or not turned on. Tell the lawyer: "The practice tools aren't turned on in
Claude yet. Open Claude's Settings, choose Extensions, and make sure Beep
Practice Gateway is installed and switched on, then tell me." Stop until they
confirm.

## Step 2: the interview

Ask about each area in this order. Each answer becomes one choice in the
profile. Ask the follow-up only when the answer needs it.

| Area | Question to ask | Supported answer | Profile choice |
| --- | --- | --- | --- |
| Documents | "Where do you keep your client documents?" Recommend Box if they mention it. | Box (through Box Drive) | `documents` / `box-drive` |
| Mail and calendar | "Which email and calendar do you use for the practice?" | Microsoft 365 or Outlook with a work account | `mail-calendar` / `microsoft-365` |
| Saved sign-ins | "May I keep the sign-ins Claude needs in Windows' own secure storage, so you don't have to sign in every time?" Recommend yes. | Windows Credential Manager | `secrets` / `windows-credential-manager` |
| Knowledge graph | Ask only if they mention a practice knowledge graph or were told they have one: "Were you given a practice knowledge-graph folder to use with Claude?" | The practice knowledge graph | `knowledge-graph` / `practice-kg` |
| Practice and billing | "Do you use a practice-management or billing system, such as Clio?" | none yet | always a request or declined |

Then ask about the computer, one question each:

1. "Can you approve the Windows prompt that asks 'Do you want to allow this
   app to make changes'? Some firms block it." Answers: yes (`available`),
   no (`blocked`), not sure (`unknown`).
2. "Does your firm route internet traffic through a proxy or require a VPN
   for web access?" Most solo lawyers say no. Answers: no (`none`), yes
   (`present`), not sure (`unknown`).

Interview rules:

- If the lawyer does not want an area, record it as declined. Do not argue.
- "Not sure" about a supported product: recommend it and record it as
  supported only if they agree.
- Do not ask about areas they have already answered in passing.

### Products we do not support yet

When the lawyer names a product the table does not support (for example
Dropbox, OneDrive alone, NetDocuments, Google Workspace, Clio, iManage,
Bitwarden), record a gap with their words as the named product. If a
supported product covers the same area and they also use it, set it as the
fallback. Tell them plainly: "Claude can't connect to that one yet. I've
noted that you use it so it can be added later." Never say when.

## Step 3: confirm and save

Read the answers back in one short message, as plain sentences ("Documents:
your Box folder. Mail and calendar: your Microsoft 365 account. ..."), and ask
"Is that right?". Fix anything they correct. Then call `setup_profile_save`
with:

- `choices`: one entry per area discussed, in interview order:
  - supported: `{ "kind": "supported", "capability": ..., "provider": ... }`
  - request for an unsupported product:
    `{ "kind": "gap", "capability": ..., "namedProvider": "<their words>" }`,
    adding `"fallback": <provider>` only when they also use a supported one
  - declined: `{ "kind": "declined", "capability": ... }`
- `itLimits`: `{ "adminRights": ..., "proxy": ... }` from the two computer
  questions.
- `recordedAt`: the current time in milliseconds since 1970.

Capabilities are `documents`, `mail-calendar`, `secrets`,
`practice-billing`, `knowledge-graph`. Providers are `box-drive`,
`microsoft-365`, `windows-credential-manager`, `practice-kg`. Use no other
values.

If saving fails, tell the lawyer you could not save their answers and try
once more; if it fails again, stop and say someone will need to look at it.

## Step 4: check and repair until complete

Loop:

1. Call `setup_status`. It returns each check's result, the steps only the
   lawyer can take, and a plain summary. Use the summary as your guide, in
   your own words.
2. If `complete` is true, go to Step 5.
3. Lawyer steps first. Group every step the lawyer must take into one
   message, at most three at a time, in the order given, each as one
   sentence they can follow (for example "Sign in to Box Drive with your Box
   account"). Ask them to tell you when they are done. Some steps open a
   sign-in or consent window; tell them that is expected and that they type
   their password only there.
4. Then repairs. A check the gateway can fix itself is one in `checks` with
   state `probed`, a result of `missing` or `broken`, and no entry in the
   lawyer's steps; the summary's "I can do this for you" lines describe
   them. For each, tell the lawyer in one sentence what you are about to do
   and that an approval prompt will appear, then call `setup_repair` with
   that check's `requirement` id. Do one repair at a time. Checks with state
   `blocked` wait on earlier steps; leave them alone.
5. Call `setup_status` again and continue the loop.

Reading `setup_repair` failures:

- `declined`: nothing changed. The lawyer said no, closed the prompt, or this
  Claude app cannot show approval prompts. Ask whether they want to try
  again. If the prompt never appeared, give them the manual step from the
  check's instruction instead.
- `needs-human`: this one is a lawyer step; relay its instruction.
- `dependencies-unsatisfied`: an earlier step is unfinished; finish that
  first.
- `already-satisfied`: nothing to do; move on.
- `repair-failed` or `probe-unavailable`: say in one sentence that this part
  did not work, give the manual step if there is one, and continue with the
  rest. Do not retry the same repair more than twice.

Special cases:

- Claude sign-in always comes first. If the lawyer is talking to you, they
  are signed in.
- After the profile is saved for the first time, new practice tools appear
  only after the gateway restarts. When `setup_status` reaches the practice
  knowledge graph or a provider whose tools you do not see yet, ask the
  lawyer to quit Claude completely and open it again, then say "continue
  setup".
- If the computer cannot approve Windows prompts (`adminRights: blocked`),
  skip repairs that need one and list them in the final summary as "needs
  your IT person".
- A reboot request: tell the lawyer setup will continue afterwards when they
  open Claude and say "continue setup".

Stop the loop when setup is complete, or when the only checks left need the
lawyer or their IT person and the lawyer has said they cannot do them now.

## Step 5: plain summary

Finish with one short message:

- What now works, as things they can ask Claude ("You can ask me to find a
  document in your Box folder or check tomorrow's calendar.").
- What still needs them or their IT person, if anything, one sentence each.
- Products they named that Claude can't connect to yet, if any.
- How to come back: "If something stops working, tell me 'check my setup'."

Do not mention checks that passed one by one.
