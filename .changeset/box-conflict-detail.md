---
"@beep/box": minor
---

Expose sanitized conflict detail on Box `item_name_in_use` errors. `BoxApiFailureContext` conflicts
are now `BoxApiFailureConflict` values carrying the provider `id` and `type` plus, when Box returns
them for a file, the content `sha1` and byte `size` as `Option`s. A single-object
`context_info.conflicts` (the file-upload shape) is normalized to a one-element array. The item
name, etag, and every other provider field are still dropped.
