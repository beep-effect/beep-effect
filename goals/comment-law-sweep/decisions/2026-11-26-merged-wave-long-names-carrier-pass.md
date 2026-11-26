---
title: "Prose names from merged waves get a carrier pass, else stay unchanged"
date: 2026-11-26
lane: "goals/comment-law-sweep-r1"
reversal: "If the comment law gains a baseline or allowlist, turn each kept-long name back into a short name plus its original comment as residue."
---

Earlier sweep waves packed removed comments into identifiers and test titles as whole sentences. A name of 44 or more characters, or a title of 120 or more, is flagged for review. Restoring the original comment is not possible once its deletion has merged: the comment law compares against the merge base, has no baseline and no allowlist, and counts a restored line as a new comment.

Each flagged site in merged code gets a carrier pass:
1. A test-file identifier moves its reason to the assertion message, or to the `it` title (120 characters or fewer), and is shortened.
2. A src identifier carrying a hazard moves it to an existing test that breaks on violation, or to one new small pinning test, and is shortened.
3. Anything left keeps its current long name unchanged and is listed in the PR body.

Rejected: shortening and dropping the reason, which loses the information; a decision file per hazard, since most are local hazards rather than choices and would fail the decision-file bar.

The same holds inside open waves, except that residue (the original comment) stays available there until the deletion merges.
