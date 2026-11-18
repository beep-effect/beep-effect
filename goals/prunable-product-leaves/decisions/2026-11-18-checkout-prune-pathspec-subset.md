---
title: "Checkout prune pathspecs are git globs without escapes or trailing slashes"
date: 2026-11-18
lane: "feat/prunable-seam-1b"
reversal: "Widen CheckoutPrunePathspec to accept backslash escapes and trailing slashes, each read as git reads it."
---

The contract makes each entry path a repository-relative git :(glob) pathspec. CheckoutPrunePathspec accepts the subset whose meaning is unambiguous: no leading slash and no pathspec magic prefix; forward slashes and no backslash escapes; no empty, . or .. segment and no trailing slash (a directory is named without its slash and covers everything under it); and ** only as a whole segment, which is the only form git's glob magic gives a meaning. Matching uses @beep/glob with git's options (wildcards match dot files; braces, extglobs, a leading ! and a leading # are ordinary characters) plus git's literal-prefix rule. Each row of the table in packages/tooling/library/repo-cli-kit/test/checkout-prune.test.ts was checked against git ls-files with the same pathspec. An entry with packageName must name a literal directory, because it is the workspace's last-known directory. An unknown key in the file or in an entry fails the decode, so a misspelled list never reads as an empty one.
