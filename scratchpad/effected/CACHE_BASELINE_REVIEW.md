# Cache baseline review: effected port publish (2026-10-09)

Basis for the `standards/cache-qualification-baseline.json` re-record made when the
`@lab/effected` branch was published to `main`. No qualification is granted; the
re-record only records the reviewed legacy posture of the subjects below.

## @beep/scratchpad

`#docgen` drifted because the scratchpad manifest changed: the effected-port runner
scripts (`audit:effected`, `check:effected`, `lint:effected`, `test:effected`,
`coverage:effected`, `docgen:effected`) were added and the copied `@effected/*` kit's
third-party runtime dependencies were declared (octokit, pnpm catalogs, sigstore,
azure storage-blob and their peers). The `docgen` command, its inputs, outputs, env and
cache flag are unchanged; only the scripts digest and the dependency set moved.

## @beep/docket-intake, @beep/practice-identify, @beep/practice-mail-tagging

`#build` drifted because commit 405f8e7cc7 ("crispening ultra hella", 2026-10-06) gave
each no-emit app a `turbo.json` that extends the root and declares `build.outputs: []`
(the `create-package` app template now emits the same file). The build command and its
inputs are unchanged; the outputs declaration is now explicit and empty, as these apps
emit nothing.

## // (root)

The root package.json and turbo.json are unchanged against main. The root posture moved
because bun.lock gained the copied kit's third-party dependencies (declared by the
@beep/scratchpad workspace above); no root command, input, output, env or cache flag
changed.
