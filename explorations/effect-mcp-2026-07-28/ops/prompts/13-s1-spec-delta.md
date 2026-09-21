# Lane 13-s1-spec-delta — MCP specification 2026-07-28 delta (web, grok /deep-research)

**Owns:** what the MCP specification says. Effect's implementation coverage belongs to 11-u2.

**Query:** What are the normative differences between Model Context Protocol specification
revisions 2025-06-18, 2025-11-25, and 2026-07-28? Start from the official changelog for each
revision and the SEPs it references, with URLs. Then, for 2026-07-28 specifically, detail the
spec's rules for: connection or session establishment and version negotiation; session identifiers;
per-request metadata and required HTTP headers; stdio transport framing and any compatibility
probing; multi-round-trip or input-required requests; subscriptions and change notifications;
tool output schemas and structured content; authorization; and anything removed or deprecated.
Quote the normative MUST/SHOULD language with the page URL for each.

**Post-run instructions:**
1. Write `${PKT}/research/${LANE_ID}.md` (the only writer of that file) with sections: (1)
   changelog and SEP index with URLs; (2) 2026-07-28 normative rules for the topics above, each with
   quoted MUST/SHOULD text and URL; (3) requirements a server application must satisfy that a
   protocol library typically leaves to the application (authorization, Origin validation, rate
   limiting, audit); (4) spec rules that bear on the working assumption "2026-07-28 only" for stdio
   and HTTP servers, for example whether clients are expected to probe or fall back; (5)
   UNVERIFIED items.
2. Keep the verbatim deep-research output in `${PKT}/research/${LANE_ID}.deep-research.md`.
3. Write the claims and summary files per the lane contract.
