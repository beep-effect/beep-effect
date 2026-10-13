### sol-2-1
- file: scratchpad/effected/package-json/Person.ts:116
- class: bug   severity: required
- standard: D11; D9 and section 14’s verified-upstream-bug exception; Person.ts:7–13 requires unknown object-form keys to survive read/write cycles.   evidence: A read-only Bun probe decoded `JSON.parse('{"name":"Alice","__proto__":{"keep":1}}')` through `Person.FromValue`, rebuilt it with `Person.make({ ...decoded, name: "Bob" })`, and encoded through `Person.FromValue`. Both the reviewed lab source and pinned oracle returned `{"name":"Bob"}`; `Object.keys(decoded.rest ?? {})` was `[]`. Assigning `rest["__proto__"]` into `{}` invokes the inherited prototype setter instead of storing an own property. The round-1 fixes and recorded deviations address formatter sorting and top-level wire partitioning, not this Person partition.
- failure: Editing a modeled author field silently deletes the unknown `__proto__` JSON field. Unchanged encoding can conceal the loss by replaying the remembered original object.
- fix: Build the filtered unknown-key record with `R.fromEntries`, preserving entry order and `__proto__` as an own data property. Add a decode → modeled-field edit → encode regression asserting that the unknown key survives, and record the verified upstream bug under section 14 before changing behavior.

### sol-2-2
- file: scratchpad/effected/package-json/Funding.ts:55
- class: bug   severity: required
- standard: D11; D9 and section 14’s verified-upstream-bug exception; Funding.ts:8–17 requires wire fidelity and preservation of entry data.   evidence: A read-only Bun probe decoded `JSON.parse('{"url":"old","__proto__":{"keep":1}}')` through `Funding.FromValue`, rebuilt it with `Funding.make({ ...decoded, url: "new" })`, and encoded through `Funding.FromValue`. Both the reviewed lab source and pinned oracle returned `{"url":"new"}`; the decoded rest record had no own keys. The assignment at line 57 loses `__proto__` through the prototype setter. A control probe constructing the rest record with `R.fromEntries` encoded `{"url":"new","__proto__":{"keep":1}}`.
- failure: Updating a decoded funding URL silently drops an unknown JSON field. The same loss occurs when another edit forces canonical encoding instead of remembered-wire replay.
- fix: Construct `restOf`’s result with `R.fromEntries` over the filtered entries. Add a regression covering an own `__proto__` key through decode, URL edit, and encode; record this separate verified upstream partitioning bug under section 14.

### sol-2-3
- file: scratchpad/effected/package-json/Repository.ts:376
- class: bug   severity: required
- standard: D11; D9 and section 14’s verified-upstream-bug exception; Repository.ts:3–10 and the Repository/Bugs `rest` field descriptions require unknown-key fidelity.   evidence: Read-only Bun probes decoded `JSON.parse('{"url":"old","__proto__":{"keep":1}}')` separately through `Repository.FromValue` and `Bugs.FromValue`, rebuilt each instance with `url: "new"`, and encoded through its corresponding codec. Both codecs, in both the reviewed lab source and pinned oracle, returned `{"url":"new"}` with empty decoded rest keys. The Repository partition at lines 376–378, Bugs partition at lines 486–488, and shared fidelity helper at lines 129–134 all assign unknown keys into `{}`.
- failure: Editing a repository or bugs URL silently deletes the own `__proto__` field. Fixing only one partition leaves the other codec affected; leaving the shared helper unchanged also makes its fidelity comparison omit that key.
- fix: Use `R.fromEntries` for all three unknown-key partitions, preferably reusing the existing `restOf` helper in both decode branches. Add Repository and Bugs decode → edit → encode regressions and record the verified upstream bug under section 14.

### sol-2-4
- file: scratchpad/effected/package-json/Funding.ts:73
- class: bug   severity: required
- standard: D11; D9 and section 14’s verified-upstream-bug exception; Funding.ts:63–67 explicitly requires the fidelity guard to prevent replay from silently discarding an in-place edit.   evidence: A read-only Bun probe decoded `{ url: "https://fund.example", keep: 1, remove: 2 }` through `Funding.FromField`, then either deleted `entries[0].rest.remove` or replaced that entry’s rest with `{}`. Encoding through `Funding.FromField` returned `{"url":"https://fund.example","keep":1,"remove":2}` in both cases, in both the reviewed lab source and pinned oracle. The guard checks only keys still present in the current rest record; removed keys never participate, so the remembered object is judged faithful.
- failure: Removing funding extension fields is silently undone during serialization. Clearing all extension fields also reintroduces every original field.
- fix: Before permitting replay, compare the original wire’s unknown-key set with the current rest key set in both directions, retaining the existing value checks. Add regressions for deleting one key and clearing rest, preserving bare-field versus array encoding, and record the verified upstream bug under section 14.

REQUIRED: 4
BACKLOG: 0