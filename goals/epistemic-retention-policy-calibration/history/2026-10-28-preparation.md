# Packet preparation — 2026-10-28

User requested the next goal packet for retention policy calibration using the
merged report, with production activation gated on evidence and explicit approval.

Baseline source checkout HEAD:
`732e11fd6dc417e5954b22fbbd856a026299ea50` (PR #2322 squash).
The checkout was clean before preparation. Only this new packet is authored.
Predecessor status remains completed-retained; no implementation, production
composition, source authority or policy value changes are part of preparation.

The packet starts paused, all phases pending. It supplies the compact launcher,
normative contract, phase plan, evidence/approval contract, source ledger,
manifest and reflection template. P0 must independently freeze the protocol
and data-access scope. No dataset access or calibration execution has begun.

Preparation verification is recorded after running packet checks. Future
calibration delivery still requires exact-head hosted/merge/completion proof;
packet preparation is not evidence that calibration itself has completed.

Verified during preparation:

- Launcher: 2,684 characters (maximum 4,000).
- Manifest JSON, source paths, local Markdown links and lifecycle/phase
  consistency passed. README/manifest paused; P0–P4 pending.
- Whitespace checked for every new file, including untracked content.
- Reflection lint: zero blocking and zero advisory findings.
- Goal doctor: 254 packets, zero new/inherited blocking findings; 28 existing
  fleet advisories, none on this new packet. These include a legacy completion-
  metadata advisory on the predecessor; this preparation does not rewrite that
  retained packet or treat its local completion metadata as new-head proof.
- Actual baseline CLI still composes RetentionCalibrationRegistry.inert.
- Only this packet is added; no code, policy values, production wiring, commits,
  pushes or PR publication were performed for this preparation.
