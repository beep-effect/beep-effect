# Knowledge classifier runtime-totality probe

Source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Run as Bun eval from the repository root. The path input is a synthetic example. Success proves runtime behavior only, not legitimate domain states.

```ts
import { classifyKnowledgeRef } from "./packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts";
import * as O from "effect/Option";
const rows=[];
for(const kind of ["repo-path","host-path","goal-uri","upstream"] as const)
for(const resolutionStatus of ["resolved","missing","identity-mismatch","producer-owned","not-applicable"] as const)
for(const surface of ["live","archival"] as const)
for(const patternContext of [false,true])
for(const pairingAmbiguous of [false,true])
for(const ungoverned of [false,true])
for(const anchorPresent of [false,true])
for(const tokenPresent of [false,true]) {
const input={kind,surface,resolutionStatus,anchor:anchorPresent?O.some("home-absolute" as const):O.none(),token:tokenPresent?O.some("/home/example/beep-effect"):O.none(),patternContext,pairingAmbiguous,ungoverned};
rows.push({kind,resolutionStatus,surface,patternContext,pairingAmbiguous,ungoverned,anchorPresent,tokenPresent,result:classifyKnowledgeRef(input)});
}
console.log(JSON.stringify({count:rows.length,note:"Presence abstraction with one concrete anchor and token; acceptance does not prove domain legitimacy",rows},null,2));
```

Observed exit: 0. Cases: 1280. Result counts: `{"actionable-host-path": 45, "ambiguous-ref-pairing": 688, "archival-provenance": 10, "audit-pattern-literal": 20, "broken-target": 48, "external-mirror-reference": 5, "identity-mismatch": 48, "producer-owned-target": 48, "ungoverned-syntax": 320, "verified": 48}`. Original stdout SHA-256: `ead2a23bab2c88e87a3e924b27cd53d4e75babc5fe84254c78fffc6a5dc4baa3`.
