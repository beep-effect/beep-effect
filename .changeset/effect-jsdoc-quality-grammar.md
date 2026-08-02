---
"@beep/schema": patch
"@beep/html": patch
"@beep/utils": patch
"@beep/law-practice-domain": patch
"@beep/repo-cli": patch
"@beep/repo-docgen": patch
---

Port Effect v4's JSDoc section grammar into beep law and tooling. The inventory
gains section shape rules (order, uniqueness, non-empty, When-to-use prefix,
titled single-fence Examples, loose-fence ban, described-@see, forbidden
@remarks) plus a kind-aware Example presence rule scoped to tracked sources; the
ratchet gains a changed-files cleanup-on-touch gate; docgen gains a regression
fixture proving the section-carried example compile path. Pilot surfaces
(schema SemanticVersion/Duration/encoders, docgen Core, law-practice
ApplicationNumber) are converted to full section style, and branch-touched
modules migrate 127 legacy @example tags to titled Example sections.
