---
"@beep/box": patch
---

Regenerate the Box model schemas against the installed `box-node-sdk` 10.17.0 and record that version
as the driver's SDK provenance. `File.sharedLink`, `FileFull.classification`, and `WebLink.sharedLink`
now accept `null`, and `CollaborationItem` is a union of the mini item types, matching the SDK. The
package audit no longer leaves the generated file dirty.
