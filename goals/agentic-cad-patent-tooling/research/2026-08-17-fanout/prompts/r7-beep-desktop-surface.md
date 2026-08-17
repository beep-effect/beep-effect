You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/r7-beep-desktop-surface.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file.ts:LINE`. Read real code. DO NOT build, install, run dev servers, or modify ANY file outside your report path. You are in a throwaway worktree snapshot; still, do not modify it — read-only.

TARGET: <repo-worktree-snapshot> (an isolated, detached git worktree snapshot of the beep-effect2 repo at HEAD — read this, never the original checkout) — a large Effect-v4 TypeScript monorepo (bun + turbo). Focus on `apps/professional-desktop` and the UI substrate packages it depends on.

The question being answered: **where exactly would a CAD viewer / figure-rendering surface plug in, and what contract must it satisfy?**

Answer with file:line evidence:
1. APP TOPOLOGY — `apps/professional-desktop`: entry point, routing, runtime/layer composition, how the React tree gets its Effect runtime. Is it Electron/Tauri/browser? Prove it.
2. THE DOCK / PANEL SUBSTRATE — how are workspace panels/views registered and laid out? Find the registry or factory. Show the exact steps and files a developer must touch to add a NEW panel type. This is the most important deliverable of this lane — make it a numbered, file-by-file recipe.
3. EXISTING VIEWERS — how are documents/PDFs/images currently rendered? Any existing three.js/canvas/WebGL usage anywhere in the repo (search broadly)? Any existing binary-asset or blob-storage handling?
4. ATOM/STATE LAYER — how does a panel get server/client state (`@effect/atom-react`, Atom.runtime, reactivity keys)? Show the canonical pattern with a real example file.
5. STYLING/UI KIT — which UI package, which primitives, theming, and the conventions a new panel must follow.
6. ASSET/FILE PIPELINE — how does a large binary (a STEP file, a mesh) get from disk/storage into a panel today? Is there an existing content-addressed store, upload path, or file service? If none exists, say so explicitly — that is a gap worth naming.
7. WORKER/WASM PRECEDENT — does the repo already load WASM or use web workers anywhere? Cite it. This determines how hard an OCCT.wasm integration would be.
8. CONSTRAINTS — the repo laws that would govern this work (schema-first, Effect service patterns, no raw React hooks, HashMap/HashSet only, portless dev servers). Cite `CLAUDE.md`/`AGENTS.md` and `standards/` where they bind.
9. VERDICT — the minimal viable insertion point for a CAD panel, as a concrete file plan.
