# OIP web resource and assertion repair

The saved browser-patch finding is reproduced with an injected synchronous
assertion failure before waitFor begins. The original test never attaches its
Promise finally and fails a follow-up descriptor-restoration check. The repaired
case passes both the expected failure and the restoration check.

Browser and fetch patches now register ownership immediately. Browser completion
callbacks unmount the serial test's DOM before restoring their spies; finally
blocks preserve restoration even if DOM cleanup throws. Native browser timers,
idle callbacks, interval rotation, DOM polling, and the existing serial suite
remain unchanged. The original scrollY descriptor is restored as well.

The two immutable ConfigProvider helpers use direct Effect.provide instead of
manually building a layer inside a new scope. Native contact Effect tests acquire
fetch spies with Effect.acquireRelease. Web entrypoint cases retain their actual
Request, FormData, redirect and page behavior, with test-owned fetch guards.

An AST check preserves all 147 original assertions, all 57 registrations, all
schema arbitrary calls and the four existing run-floor calls. Thirty Boolean
and Option assertions now use public Effect Vitest utilities. No production
source change is included in this package batch.
