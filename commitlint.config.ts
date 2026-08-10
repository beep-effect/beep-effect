/**
 * Line-anchored, bullet-tolerant `git subtree ... --squash` marker.
 *
 * **Details**
 *
 * `git subtree pull --squash` writes a marker line into the commit message. When such a pull is
 * squash-merged by GitHub the marker lands in the **body**, bulleted (`* Squashed '...'`), followed
 * by the upstream log — lines that routinely exceed `body-max-line-length`. The `m` flag turns
 * `^`/`$` into line anchors so the marker is found in the body rather than only at message start,
 * and the optional `[ \t]*\*?[ \t]*` prefix tolerates the GitHub squash bullet.
 *
 * **Gotchas**
 *
 * Never add the `g` flag: a stateful `lastIndex` would make `.test` alternate between `true` and
 * `false` across calls. `[^'\n]+` (not `[^']+`) keeps the quoted directory operand from spanning a
 * newline and pairing quotes across unrelated lines.
 */
const SUBTREE_SQUASH_MARKER =
  /^[ \t]*\*?[ \t]*Squashed '[^'\n]+' (?:content from commit [0-9a-f]{7,40}|changes from [0-9a-f]{7,40}\.\.[0-9a-f]{7,40})[ \t\r]*$/mu;

/**
 * Repo commitlint configuration.
 *
 * **Details**
 *
 * Two ignore predicates, OR-ed by commitlint. The first is the original whole-message anchor that
 * matches a raw `git subtree ... --squash` commit (kept verbatim). The second matches a
 * GitHub-squash-merged subtree pull, where the marker is a bulleted **body** line.
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
  ],
  rules: {
    "body-max-line-length": [2, "always", 100],
  },
};
