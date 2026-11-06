# Immutable Claude source recovery boundary

This offline audit changes tests/documentation only; the reviewed runtime candidate remains 120a9a37410daba54e78227fbcdb7365641174a4. It does not authorize a model retry or modify the original failed pilot. The private source request binding hashes the complete serialized admission, including evidence epoch, socket path and ingress route. The source evidence digest also includes that request binding and the original observation identity/times.

| Condition after source.json exists, before accepted intake | Current producer behavior |
| --- | --- |
| Worker reports accepting=false | Refuses admission before replayed facts or trace; source and fence remain intact. |
| Same request, accepting=true, same epoch resumes | Replays immutable metadata/facts; no native probe or model process is spawned again. |
| Worker reports a new epoch while the original request is supplied | Refuses admission because the current epoch differs. |
| Caller rewrites request to match the new epoch | Refuses attempted-unknown because immutable attempted/source request binding differs. |
| Caller changes ingress route or socket path | Refuses attempted-unknown after valid fixture context, without changing source identity or invoking the CLI. |
| Socket is replaced at the same path between producer invocations, same accepted context | Each invocation pins the then-current owned socket; producer can replay metadata without a native rerun. |

The tests use an owned private HTTP fixture, mutable typed launch context and a replaced same-path socket. They prove the producer decisions and byte-identical retained-source/trace behavior; they do not prove a real worker restart's journal retention, epoch policy, launch-fact acceptance, evidence window or backend delivery. A worker restart does not inherently mean a new evidence epoch: control pause/resume and evidence retirement are separate public contracts. The actual current worker context, retained launch facts and intake window must still qualify every replay. Native HTTP intake correlates launch facts at the current journal epoch; the producer cannot bypass that validation. A lost acknowledgment can also leave intake acceptance unknown.

Across-epoch or changed-transport recovery is not implemented. A separate reviewed metadata re-admission design would preserve the original source/fence/digest and make the old observation provenance explicit, bind a new current admission separately, qualify the current root/route/epoch and launch-fact/window rules, and provide idempotent receipt/rejection evidence. It must not rewrite the original immutable source identity, fabricate process-start facts, relax current-window validation or silently rerun a model. No such path is authorized by these tests.
