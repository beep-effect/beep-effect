# QA round 3 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 4 (2 required, 2 polish)

## Required findings

### R3-01 — P1 — Reload resets the visible conversation to the original branch without indicating the selected version

- lens: `affordance`
- repro: Edit the last user turn, submit the rewrite, wait for it to finalize, then reload; the rewritten haiku request is replaced visually by the original schema-first request and response.
- fix: Persist and restore the active branch/version identifier, and render the version selector as an interactive control with an explicit selected-version state.
- evidence:
  - `frame` `frames/marker-w21_00000.png` events 130
  - `frame` `frames/animation-w24_00002.png` events 140, 141, 142, 143, 144

### R3-02 — P1 — Streaming exposes two competing Stop controls

- lens: `affordance`
- repro: Submit either the rich-message prompt or the edited prompt and inspect the thinking state; a Stop button appears inside the assistant turn while another Stop button replaces Send in the composer.
- fix: Expose cancellation in one canonical location, preferably the composer action slot, and remove the duplicate turn-level Stop control.
- evidence:
  - `frame` `frames/marker-w8_00000.png` events 55
  - `frame` `frames/marker-w21_00000.png` events 130

## Polish findings

### R3-03 — P2 — Reload presents a completely blank white viewport

- lens: `overflow`
- repro: Reload the populated branched thread; immediately after the reload marker, the entire application shell disappears into a white frame.
- fix: Keep a background-matched application shell or loading skeleton mounted through restoration so navigation never exposes an unstyled blank viewport.
- evidence:
  - `frame` `frames/marker-w22_00000.png` events 139

### R3-04 — P2 — Newly created threads are visually indistinguishable in the sidebar

- lens: `visual-hierarchy`
- repro: Create a thread while the initial empty thread is present; the sidebar contains two rows labeled "New thread" with the same date and no distinguishing content.
- fix: Assign distinct temporary labels or derive a title from the draft promptly, while retaining a clear active-row treatment.
- evidence:
  - `frame` `frames/click-w3_00002.png` events 32, 34

REQUIRED FINDINGS: 2
