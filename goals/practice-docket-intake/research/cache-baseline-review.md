# Cache baseline review: the docket intake app and adapters

Slice 3 of this packet adds one workspace package and one dependency edge, and
the reviewed cache projection has to be re-recorded for both.

- `@beep/docket-intake` (`apps/docket-intake`) is new. Its `build`, `check`,
  `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test` tasks
  appear in the projection for the first time. Their commands are the
  generated service-app scripts from `beep create-package`, with no custom
  cache flag, input or output declaration.
- `@beep/law-practice-server` gains a dependency on `@beep/m365` for the new
  `DocketIntake` adapters. That moves the dependency digest of its `build`,
  `check`, `lint:deprecated-apis` and `test` tasks. Its commands, inputs,
  outputs and cache settings are unchanged.

Accept both in the legacy configuration baseline. This review grants no
runtime qualification: the scope, profile and epoch are carried over from the
previous record, and the qualification ledger is untouched.
