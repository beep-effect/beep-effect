---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

<!-- Adapted from mattpocock/skills (MIT) @ 84fdeff; beep-effect bindings: AskUserQuestion delivery + packet DECISIONS/manifest sync. -->

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, each question with your recommended answer. Then wait for the user's answers before the next round.

Deliver a round with the AskUserQuestion tool: up to 3 questions per call, recommended option first and labelled "(Recommended)"; page a larger frontier across consecutive calls within the round. In a harness without a question tool, format each question as:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, repo, tools, etc.), dispatch a sub-agent to find it — don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report — ask the rest of the frontier now. The _decisions_ are the user's — put each to them and wait.

When grilling inside an exploration or goal packet (e.g. the `/explore` align stage), close the loop after every settled round, not at the end: append a dated Question / Answer / Rationale entry (rejected options included) to the packet's `DECISIONS.md` for each resolution, and sync the manifest's `openQuestions` to the remaining frontier.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
