---
"@beep/law-practice-use-cases": major
---

Publish citation-engine-policy/v2 and require concurrentRegexProcesses to be at least
concurrentOperations so every admitted invocation can hold a native lane. No limit
field or default value changes. Policies with fewer regex slots than operation slots
and effective policy v1 payloads are now rejected.
