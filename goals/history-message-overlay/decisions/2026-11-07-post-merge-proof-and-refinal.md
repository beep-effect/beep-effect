---
title: "Post-merge publication proven; #2858 re-finals the closeout"
date: 2026-11-07
kind: checkpoint
lane: "git-history-rewrite"
pullRequest: 2858
reversal: "Revert #2858; the overlay ref stays published and can be deleted with git push origin :refs/notes/history"
---

History Notes Publish run 42339731476 on 12ba0fe044 published refs/notes/history at b40fd076d8 (identical to the pre-merge scratch write). sync plus check with require-published: 940 of 940 notes match. #2785 merged before its until-ready monitor recorded merge-ready, so completion refresh reported unsatisfied; #2858 fixes the 14 semantic-delta findings #2785 put on main (lane names rendered as docs/ paths, a bare upstream man-page path) and is the goal's final PR.
