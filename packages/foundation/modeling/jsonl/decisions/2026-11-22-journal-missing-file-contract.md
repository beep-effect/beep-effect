---
title: Journal layer construction succeeds on a missing file, and only a vanished file reads as missing
date: 2026-11-22
reversal: Fail layer construction when the journal is missing, translate every NotFound into an empty journal, or create the file with a zero-byte writeAll.
governs:
  - src/Journal.ts#makeEngine
enforcedBy: []
---

Construction seeds `latest` from whatever is on disk and must never fail on a missing file. A journal that vanishes during the seed leaves no BOM width and the cursor, identity and `latest` at their empty start.
Only the vanished file is translated: `JournalNotFound` from the seed's own existence check, or a platform `NotFound` from the sample or tail read when the file is in fact gone. A `NotFound` for a journal that still exists, a permissions error or a bad handle is a real failure and propagates untranslated, never presented as an empty journal.
`create` opens with `O_APPEND`, which creates the file and writes nothing. A zero-byte `writeAll` would return 0 bytes, which its loop reports as a stalled write (`WriteZero`), failing a create that succeeded.
Rejected: failing the layer on a missing journal. Rejected: translating every `NotFound`. Rejected: a zero-byte write to touch the file.
