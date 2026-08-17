You are a research lane in a 16-lane parallel study. Your output is a CITED report file, not a chat answer.

OUTPUT CONTRACT (obey exactly):
- Write your report to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x2-agent-tool-surfaces.md
- TURN BUDGET DISCIPLINE: CREATE that file within your FIRST 5 turns with a heading skeleton, then APPEND as you go. Never save writing for the end.
- Final chat message = pointer only.
- Inline citations (URL + date) on every non-obvious claim. x.com posts are first-class evidence. Label `UNVERIFIED` where you could not confirm.

TOPIC: What can an AI AGENT actually DRIVE in CAD today (2026-08-17) — the tool-surface inventory.

This is the "can a coding agent call it" question, not the "is it a nice product" question.

Cover:
- Every MCP server for CAD you can find: FreeCAD MCP servers (there are several competing ones — compare), Blender MCP, Onshape MCP, Zoo/KittyCAD MCP, OpenSCAD MCP, Fusion 360 MCP, Rhino/Grasshopper MCP, KiCad/EDA MCP. For each: repo URL, stars, last commit, transport (stdio/http), tool list, maturity, license.
- Headless/scriptable CAD engines an agent can call without a GUI: CadQuery, build123d, OpenSCAD, FreeCAD headless (`freecadcmd`), OCCT/pythonocc, Manifold, replicad, JSCAD, Fornjot, truck (Rust), OpenCascade.js.
- Agent frameworks purpose-built for CAD (multi-agent CAD papers with released code, CAD-Coder, CAD-Agent, etc.).
- The "verification" problem: how do these systems check that generated geometry is valid/manifold/matches intent? Name concrete validators (OCCT BRepCheck, Manifold's guarantees, mesh checks, screenshot-VLM loops).

For each item: integration rung (MCP > REST/gRPC > CLI/headless > embeddable library > file-format-only), language, license, whether it runs FULLY OFFLINE, and one sentence on production-readiness.

End with a ranked "if you are building an agentic CAD system in TypeScript/Effect on Linux in 2026, these are the surfaces worth binding to, in order" list — and an explicit list of surfaces that are traps (abandoned, GPL-contaminating for a proprietary desktop app, cloud-only, or demo-quality).
