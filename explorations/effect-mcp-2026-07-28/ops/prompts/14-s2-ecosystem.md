# Lane 14-s2-ecosystem — Clients that reach in-repo servers, and conformance tooling (web + X, grok /deep-research)

**Owns:** public evidence about MCP clients and tooling. In-repo client code belongs to 21-r2.

**Why it matters:** in-repo servers are launched by coding agents through `.mcp.json` (Claude Code,
Codex, grok CLI) and exercised by test harnesses. Whether those clients speak 2026-07-28, and what
they do against a server that only offers it, decides whether the working assumption "2026-07-28
only" breaks in-repo agent use.

**Query:** As of September 2026, how do Claude Code, OpenAI Codex CLI, xAI grok CLI, MCP Inspector,
and the official TypeScript and Python MCP SDKs handle MCP protocol version 2026-07-28 as clients,
over stdio and over Streamable HTTP? For each: the release or version where 2026-07-28 client
support landed, whether the client sends `server/discover` or `initialize` first, how it behaves
when a server rejects `initialize` or offers only 2026-07-28, and known interoperability bugs
reported by developers (including posts on X). Also: which official or community conformance test
suites can test an MCP server for 2026-07-28 compliance, and how they are run. Cite release notes,
changelogs, source, docs, and posts with URLs.

**Post-run instructions:**
1. Write `${PKT}/research/${LANE_ID}.md` (the only writer of that file) with sections: (1) client
   matrix: client | version with 2026-07-28 | stdio first message | HTTP first request | behavior
   against a 2026-07-28-only server | citation; (2) interoperability gotchas with citations; (3)
   conformance tooling that could prove a beep-effect server: how to run it, what it checks; (4)
   UNVERIFIED items. Treat version-string presence as weak evidence; prefer release notes, source,
   or documented behavior.
2. Keep the verbatim deep-research output in `${PKT}/research/${LANE_ID}.deep-research.md`.
3. Write the claims and summary files per the lane contract.
