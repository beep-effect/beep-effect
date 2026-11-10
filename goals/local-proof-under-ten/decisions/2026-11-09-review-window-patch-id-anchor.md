---
title: "A diff-preserving merge of main keeps the review-window anchor; window length unchanged"
date: 2026-11-09
reversal: "Revert the anchor change and the AGENTS.md mergeable amendment; every push re-arms the 20-minute window again."
---

A push whose patch-id against the base is unchanged (a clean merge of `origin/main`) keeps the review-window anchor; a conflict resolution that touches PR lines re-arms it, and an unknown identity re-arms it. The window length stays 20 minutes. The lever (PERIL-09) amends the mergeable definition in the AGENTS.md Quality Operator laws, and the amendment lands in the same PR as the replay fixture (clean merge keeps, conflict touching PR lines re-arms). Rejected: re-arming on every push (measured 12 to 20 min after the last check on bound PRs) and shortening the window (assurance loss).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D12).
