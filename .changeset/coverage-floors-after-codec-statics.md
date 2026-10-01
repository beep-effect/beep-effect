---
"@beep/govinfo": patch
"@beep/obs": patch
"@beep/shared-domain": patch
---

Test-only: restore the coverage floors the codec-statics retirement left under the
baseline on main (govinfo transport error mapping, ObsError.fromUnknown, and the
throwing-probe arm of isIdentityComposer).
