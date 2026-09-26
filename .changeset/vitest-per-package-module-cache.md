---
"@beep/libpff": patch
"@beep/box": patch
---

Give every package its own vitest `fsModuleCache` directory so a `bun.lock` change no longer wipes a shared
root cache while sibling test runs read it, and pin PATH in the libpff standard-root env-interpreter test so
a non-standard bash on the host PATH cannot leak in. Regenerate the Box SDK bindings for the updated SDK.
