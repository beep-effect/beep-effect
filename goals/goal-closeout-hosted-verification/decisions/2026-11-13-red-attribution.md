---
title: "Red attribution: the redAttribution block, its causes, fix PRs and bypass-caused reds"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Delete the redAttribution key, narrow causes to inherited/mixed, drop missing coverage and the fix-PR read, and rewrite the attribution files."
---

Agent decision (`research/design-pr-a.md` DN-4, DN-5, DN-16, DN-24), with critic fixes applied.

- DN-16: a red is attributed in decision frontmatter as `redAttribution: { finalPullRequest, reds: [{ context, attribution, fixPullRequest }] }`, and only on `kind: decision`. Frontmatter decodes with `onExcessProperty: "error"`, so a misspelt key is rejected.
- DN-4: the causes `inherited`, `introduced` and `mixed` all verify; `unknown` cannot attribute. A claim also covers a required context that never reported a run on the head (`checkRunId: None`), recorded with `observed: missing`. Without this, a bypass-merged final with such a context could never verify. A context whose run is still `pending` cannot be attributed.
- DN-5: the fix PR must exist and be open or merged. This takes one `pulls/{n}` read per distinct fix PR. A missing PR, or one closed without merging, leaves its red unattributed; a failed read is a transient unknown.
- DN-24: a red caused by the bypass merge itself counts as `inherited` when main was red for that context at the merge. Its fix PR is then the episode's `unblocks-main` PR. Otherwise the red is `introduced`, and its fix PR is the first later PR in which the same context passed on a tree containing the merge commit.

Conflicting claims for one context never attribute (fail closed). Gaps still win over attributions.

Reverse: delete the `redAttribution` key, narrow the causes to `inherited` and `mixed`, drop `missing` coverage and the fix-PR read, and rewrite the attribution files.
