const GITHUB_SUGGESTION_COMMIT = /^Update [^\n]+\n\nCo-authored-by: [^\n]*\[bot\]/u;
const SUBTREE_SQUASH_MARKER =
  /^[ \t]*\*?[ \t]*Squashed '[^'\n]+' (?:content from commit [0-9a-f]{7,40}|changes from [0-9a-f]{7,40}\.\.[0-9a-f]{7,40})[ \t\r]*$/mu;

/**
 * Repo commitlint configuration.
 *
 * **Details**
 *
 * Three ignore predicates, OR-ed by commitlint. The first is the original whole-message anchor that
 * matches a raw `git subtree ... --squash` commit (kept verbatim). The second matches a
 * GitHub-squash-merged subtree pull, where the marker is a bulleted **body** line
 * (`* Squashed '...'`) followed by the upstream log, whose lines routinely exceed
 * `body-max-line-length`; its `m` flag makes `^` and `$` line anchors, and an optional prefix
 * tolerates the bullet. The third matches GitHub's "apply suggestion" commit (`Update <path>` plus
 * a bot co-author trailer), which the repository cannot shape; the squash-merge title is linted
 * server-side.
 *
 * `footer-max-line-length` is 150 while header and body stay at 100: GitHub appends a
 * `Co-authored-by` trailer to every squash whose commits have another author, and for a GitHub App
 * that single line runs past 100 characters and nobody can shape it.
 *
 * **Gotchas**
 *
 * The second predicate deliberately keys on the marker line **alone**. An earlier version also
 * required a `git-subtree-dir:` trailer as a second signal, on the assumption that both always
 * co-occur. They do not: when GitHub squash-merges a subtree pull it composes the body from the
 * branch's sub-commit *subjects* and drops their bodies, so the trailer never survives. Commit
 * `fb56ab60bf` on `main` is exactly that shape — bulleted marker line, no trailer — and the
 * conjunction let its 88-character marker line reach `body-max-line-length`. Marker prose alone is
 * a narrow enough signal: the pattern demands a quoted directory operand plus a real hex commit id
 * or hex range, which ordinary prose about squashing does not produce.
 *
 * Never add the `g` flag to the marker patterns: a stateful `lastIndex` would make `.test`
 * alternate between `true` and `false` across calls. The marker's quoted directory operand is
 * `[^'\n]+`, not `[^']+`, so it cannot span a newline and pair quotes across unrelated lines.
 *
 * Custom `ignores` are appended to commitlint's default wildcards (`@commitlint/is-ignored`), so
 * merge-commit ignoring stays active. Never set `defaultIgnores: false` here. This module is loaded
 * by `@commitlint/load`, not by the Effect runtime — keep it a plain object literal with no Effect
 * imports.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    (message: string) =>
      /^Squashed '[^']+' (?:content from commit [0-9a-f]+|changes from [0-9a-f]+\.\.[0-9a-f]+)(?:\n|$)/u.test(message),
    (message: string) => SUBTREE_SQUASH_MARKER.test(message),
    (message: string) => GITHUB_SUGGESTION_COMMIT.test(message),
  ],
  rules: {
    "body-max-line-length": [2, "always", 100],
    "footer-max-line-length": [2, "always", 150],
  },
};
