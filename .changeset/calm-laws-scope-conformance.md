---
"@beep/mcp-kit": patch
---

Allow conformance hosts to pass their enclosing public layer tester so HTTP and
stdio registrations share the fixture owner and setup failures release scoped
resources. Standalone hosts retain the default registration behavior.
