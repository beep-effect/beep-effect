---
"@beep/schema": minor
"@beep/html": patch
"@beep/md": patch
"@beep/rdf": patch
"@beep/semantic-web": patch
"@beep/utils": patch
---

Replace broad schema codec-static bundles with an exact, typed
`withCodecStatics(keys)` selector and add frozen `classStatics(this, keys)`
utility bags for Effect Schema classes.

Migrate consumers to their minimum required statics, make JSON-string
boundaries explicit, and remove the legacy Sync, Promise, Effect, Exit, Option,
and Result bundle helpers.
