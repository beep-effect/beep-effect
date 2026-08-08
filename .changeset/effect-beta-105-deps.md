---
{}
---

No release: move the workspace to `effect` 4.0.0-beta.105 (and the matching
`@effect/*` betas), refresh the `.repos/effect` subtree to effect-smol main,
and absorb the breaking renames.

Two Schema constructors were renamed upstream and every call site moved with
them: `S.TaggedErrorClass` is now `S.TaggedError` (identical
`(identifier?)(tag, fields, annotations?)` shape), and `S.Error(options?)` is
now `S.ErrorInstance(options?)`. The `@beep/schema` `TaggedErrorClass` wrapper
keeps its public name and delegates to `S.TaggedError`; call sites in packages
below `@beep/schema` in the dependency graph (`@beep/identity`, `@beep/utils`)
and standalone scripts use `S.TaggedError` directly, since importing the
wrapper there would cycle. The eventual migration of the wrapper itself to
plain `S.TaggedError` is deliberately deferred.

The rest of the bump is routine: framer-motion 13, next 16.3.1-canary.7,
storybook 10.5.7, drizzle-orm rc bump, grafana/otel-lgtm 0.30.1, and assorted
minor/patch moves recorded in the lockfile.
