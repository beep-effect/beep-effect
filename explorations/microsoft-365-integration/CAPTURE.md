# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-18

Goal: figure out the best way to integrate with Microsoft Office 365.

Framing (from the builder): Most lawyers use M365. I need the agents we build —
librarians, researchers, patent drafters, etc. — to be able to read from and
interact with the M365 products for my dad's OIP (intellectual-property law)
org.

Right now I'm not sure what the best approach is. Two thoughts on the table:

- Create an `@beep/m365` driver.
  - Pros: I control it; Effect-native adapter (I get telemetry, observability,
    and logging); can be run through `effect/ai/McpServer`.
  - Cons: I have to own it and maintain it.

- Run an M365 MCP server as part of the professional-desktop app (deploy the
  MCP server as a sidecar or something).

At the end of the day I'm not really sure. Asked to ground in the
beep-effect3 `atlas-synthesis` exploration and the latest product docs, then
use deep research + a grilling session to resolve it.

Environment fact: the build account is **M365 Business professional + Copilot**
(Copilot license present). Confirm whether Tom's production tenant also carries
Copilot.

Scope direction: "Read-only doc ingest" is the right first slice, but we need
to architect it so that full read + write is available to use when the "true
assistant" becomes the focus.
