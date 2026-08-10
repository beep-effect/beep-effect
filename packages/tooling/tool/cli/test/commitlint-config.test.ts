import { findRepoRoot } from "@beep/repo-utils";
import isIgnored from "@commitlint/is-ignored";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";

type IgnorePredicate = (message: string) => boolean;

type CommitlintConfig = {
  readonly defaultIgnores?: boolean | undefined;
  readonly ignores: ReadonlyArray<IgnorePredicate>;
};

type CommitlintConfigModule = {
  readonly default: CommitlintConfig;
};

const TestLayer = NodeServices.layer;

const fixtureRoot = new URL("./fixtures/commitlint", import.meta.url).pathname;

const readFixtureText = Effect.fn("CommitlintConfigTest.readFixtureText")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(fixtureRoot, relativePath));
});

// `commitlint.config.ts` lives above this package's `rootDir`, so it is imported through a
// runtime dynamic import of a computed path: a static relative specifier would escape the
// package tsconfig and the repo's "no relative paths out of the package" test law. The dynamic
// specifier is not a literal, so TypeScript types the module as `any` and the annotation below
// narrows it without a cast.
const loadCommitlintConfig = Effect.fn("CommitlintConfigTest.loadCommitlintConfig")(function* () {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const configPath = path.join(repoRoot, "commitlint.config.ts");
  const configModule: CommitlintConfigModule = yield* Effect.promise(() => import(/* @vite-ignore */ configPath));
  return configModule.default;
});

const ignoreDecision = Effect.fn("CommitlintConfigTest.ignoreDecision")(function* (message: string) {
  const config = yield* loadCommitlintConfig();
  return {
    // Only the repo's own `ignores` entries.
    custom: A.some(config.ignores, (predicate) => predicate(message)),
    // What commitlint actually asks. `@commitlint/lint` forwards the config's `defaultIgnores`
    // as `defaults`, and `@commitlint/is-ignored` drops its wildcards only on an explicit
    // `false` — forwarding it here is what makes this a real end-to-end check rather than a
    // restatement of the custom predicates.
    effective: isIgnored(message, {
      defaults: config.defaultIgnores !== false,
      ignores: [...config.ignores],
    }),
  } as const;
});

const bareSubtreeSquash = "Squashed '.repos/effect/' changes from aaaaaaa..bbbbbbb\n\nbody";

const bulletedFullHexSubtreeSquash = [
  "chore(deps): update dependencies and compatibility (#437)",
  "",
  "* Squashed '.repos/effect/' content from commit 1bfce93e6d2bf0794c11733daf51c2390e7de375",
  "",
  "git-subtree-dir: .repos/effect",
  "git-subtree-split: 1bfce93e6d2bf0794c11733daf51c2390e7de375",
].join("\n");

const trailerWithoutMarker = ["chore(deps): update catalog (#587)", "", "git-subtree-dir: .repos/effect"].join("\n");

const ordinaryConventionalCommit = [
  "feat(cli): add a knowledge surface command",
  "",
  "Adds the command, its schema, and a regression test. The body wraps well",
  "under the hundred-character limit so `body-max-line-length` stays happy.",
].join("\n");

layer(TestLayer)("commitlint.config.ts ignores", (it) => {
  it.effect("ignores a GitHub-squash-merged subtree pull (the regression)", () =>
    Effect.gen(function* () {
      const message = yield* readFixtureText("subtree-squash-merge.txt");
      const decision = yield* ignoreDecision(message);

      expect(decision.custom).toBe(true);
      expect(decision.effective).toBe(true);
    })
  );

  it.effect("ignores a bare `git subtree --squash` message (pre-existing behavior)", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision(bareSubtreeSquash);

      expect(decision.custom).toBe(true);
      expect(decision.effective).toBe(true);
    })
  );

  it.effect("ignores the bulleted full-40-hex `content from commit` form", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision(bulletedFullHexSubtreeSquash);

      expect(decision.custom).toBe(true);
      expect(decision.effective).toBe(true);
    })
  );

  it.effect("does not ignore a body that merely uses the word `Squashed`", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision("feat(x): y\n\nSquashed some things during review");

      expect(decision.custom).toBe(false);
      expect(decision.effective).toBe(false);
    })
  );

  it.effect("does not ignore a marker-shaped line with a non-hex range", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision("feat(x): y\n\nSquashed 'not-a-hash' changes from zz..zz");

      expect(decision.custom).toBe(false);
      expect(decision.effective).toBe(false);
    })
  );

  it.effect("does not ignore an ordinary conventional commit", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision(ordinaryConventionalCommit);

      expect(decision.custom).toBe(false);
      expect(decision.effective).toBe(false);
    })
  );

  // `fb56ab60bf` on `main`: GitHub squash-merged a subtree pull, composed the body from the
  // branch's sub-commit subjects, and dropped their bodies — so the `git-subtree-dir:` trailer
  // never survived. Requiring the trailer as a second signal let this shape through to
  // `body-max-line-length`, which its 88-character marker line then failed.
  it.effect("ignores a GitHub squash whose body kept the marker but lost the trailer", () =>
    Effect.gen(function* () {
      const message = yield* readFixtureText("github-squash-no-trailer.txt");
      const decision = yield* ignoreDecision(message);

      expect(decision.custom).toBe(true);
      expect(decision.effective).toBe(true);
    })
  );

  it.effect("does not ignore a `git-subtree-dir` trailer without a marker line", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision(trailerWithoutMarker);

      expect(decision.custom).toBe(false);
      expect(decision.effective).toBe(false);
    })
  );

  it.effect("keeps commitlint's default wildcards active for merge commits", () =>
    Effect.gen(function* () {
      const decision = yield* ignoreDecision("Merge pull request #1 from a/b");

      // The custom predicates say nothing about merges; the default wildcards must still fire,
      // which is exactly what a future `defaultIgnores: false` would break.
      expect(decision.custom).toBe(false);
      expect(decision.effective).toBe(true);
    })
  );
});
