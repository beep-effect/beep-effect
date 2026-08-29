# OIP Web Browser Smoke — 2026-07-14

Driver-run browser smoke against the production build (`next start`, fresh
`bun run --cwd apps/oip-web build` output) via the Claude preview browser.

## Desktop (1280×800 default viewport)

- Full page renders: skip-link, primary navigation (ABOUT / PRACTICE /
  MATTERS / PRESS / CONTACT), dark-mode toggle, hero ("Thirty years as patent
  counsel for people who build machines") with Contact + RECENT MATTERS CTAs,
  About (The farm / The engineering / The law), Practice Areas (Patents,
  Post-Grant, Trademarks & Trade Dress, Licensing & Technology Transfer),
  contact form (name/email/technology/message + Send note + EMAIL DIRECTLY),
  legal notices (informational-purposes + no-attorney-client-relationship),
  footer with OIP branding and 9 social links.
- Console: zero errors, zero warnings.

## Mobile (375×812)

- Same full structure renders; text wraps responsively (hero heading reflows
  to narrow lines, notice paragraphs reflow); no layout truncation observed in
  the accessibility tree.
- Console: zero errors, zero warnings.

## Notes

- Verification method: accessibility-tree snapshots + console inspection.
  Pixel screenshots were skipped: the capture pipeline timed out (autoplaying
  hero video), while the renderer itself was healthy (snapshots responsive,
  console clean).
- No form submission was performed (would hit the live contact API).
