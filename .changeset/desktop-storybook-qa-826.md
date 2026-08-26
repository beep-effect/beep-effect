---
"@beep/professional-desktop": patch
"@beep/storybook": patch
"@beep/agents-client": patch
"@beep/documents-use-cases": patch
"@beep/documents-server": patch
"@beep/graph-3d": patch
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/editor": patch
"@beep/ui": patch
"@beep/ontology-client": patch
"@beep/ontology-ui": patch
---

2026-08-26 desktop/storybook QA remediation: harden the chat send path against
silently dropped dispatches (registry-dispatched composer handlers, defect
surfacing on assistant turns, draft-restoring dispatch confirmation), scope
vault onboarding to the vault surfaces, fix the dock kernel's axis-conflated
group minima so the chat panel's height floor actually clamps, retune the
default desktop layout and pre-paint the stored theme, auto-open the seeded
ontology tutorial with honest sessionless chrome, classify Box mirror probe
failures with actionable copy and a visible retry, prefer self-refreshing Box
CCG auth in the sidecar, make the Storybook runner continue past failing
chunks with all four story roots in the default catalog, deflake the dock
stories, add a usable Graph3D default alongside the labeled perf probe, and
close cheap a11y gaps (composer/viewer labels, tab aria-selected).
