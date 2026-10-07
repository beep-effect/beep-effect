# Brief

## Problem and appetite

Moving remote skill bytes to disk can hide their origin from a downstream host.
The current schema kernel cannot establish what a real host actually does. Spend
at most two research days after host selection on one inert skill, two origins,
and one pinned host route. No implementation-ready goal is promised yet.

## Experiment sketch

1. Hold bytes and resource URI identical while varying host-assigned origin.
   Approval for originA must not grant originB. Also test distinct bytes.
2. Bind the entire approved resource URI/digest set. Change manifest or bytes;
   stale approval and tampered cached content must not pass silently.
3. Preserve remote origin across cache/restart and cache-to-local-discovery copy
   where supported. An offline route must verify retained bytes and receipt basis.
4. Decline dynamic resources in this bounded slice. Observe native installation
   separately from adapter simulation, and keep a cross-session synthetic canary.
5. Record activation conformance, content consistency/trust and invocation authority
   separately. No successful activation grants tools, hooks or nested skill consent.

## Rabbit holes and no-gos

No new host, runtime, permission platform, schema format, identity canonicalizer,
marketplace install, production payload, client data, credential extraction, real
exfiltration, background daemon or spend. Do not move Amendment J's QA first
consumer or the protocol-as-value shape frontier. Missing native support closes
with unsupported evidence; it does not justify building a host.

## Success and negative controls

The matrix records host/revision/route, exact fixture identity, observed gate and
unsupported cases. Each negative has a positive control. Predeclare cache state,
cleanup and reversal. A failure is a local observed route result, not a universal
vulnerability. A pass is neither trust in content nor a tool permission grant.
