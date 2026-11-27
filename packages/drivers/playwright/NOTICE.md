# Notice

`@beep/playwright` is a port of [effect-playwright](https://github.com/Jobflow-io/effect-playwright)
0.9.0 (commit `20c422c156f04d80fba74997bee0615b21833ba2`), an Effect-based Playwright library by
Jobflow GmbH, released under the MIT License.

The modules under `src/` and the suites under `test/` derive from the upstream files of the same
purpose (`playwright.ts`, `browser.ts`, `browser-context.ts`, `page.ts`, `frame.ts`,
`frame-locator.ts`, `locator.ts`, `common.ts`, `errors.ts`, `clock.ts`, `credentials.ts`,
`keyboard.ts`, `mouse.ts`, `touchscreen.ts`, `screencast.ts`, `tracing.ts`, `web-storage.ts`,
`webmcp.ts`, `playwright-spawner.ts`, `playwright-types.ts`, `utils.ts` and their tests). They were
changed to follow this repository's code laws: schema-backed errors, service classes with `Shape`
interfaces, per-module Effect imports, traced `Effect.fn` methods and the repository's JSDoc grammar.

The upstream copyright notice and permission notice are kept in [LICENSE](LICENSE):

```text
MIT License

Copyright (c) 2026 Jobflow GmbH
```

Not ported: the `@playwright/test` integration (`test.ts`), the `experimental` entry point and the
command-line helper.
