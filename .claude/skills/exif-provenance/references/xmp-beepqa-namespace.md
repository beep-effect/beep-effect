# XMP-beepQA namespace — field spec

Namespace URI: `https://ns.beep.sh/qa/1.0/` (prefix `beepQA`).
Source of truth: `BeepQaProvenance` in
`packages/drivers/exiftool/src/Exiftool.models.ts`; the CLI encodes
`CaptureProvenance` (`@beep/qa-capture`) into it at extract time.

| Field | Type (schema) | Meaning |
|---|---|---|
| `sessionId` | string (uuid) | CaptureSession id this artifact came from |
| `scenarioName` | string | Harness scenario (or Lane B marker label) active at capture |
| `actionId` | string | Witness sequence ref(s) — the event window that triggered extraction, e.g. `seq:141-158` |
| `commitSha` | string (optional) | HEAD at record time; suffix `-dirty` when the tree was dirty |
| `capturedAtEpochMs` | finite number | Epoch ms of the source frame instant (event clock) |
| `sourceVideo` | string (optional) | Session-relative path of the source recording, e.g. `video/capture.webm` |
| `clockOffsetMs` | finite number (optional) | ClockSync offset used for the epoch→video mapping (+ method suffix, e.g. `-beacon`) |
| `toolVersions` | string (optional) | Compact `ffmpeg=7.x;exiftool=13.55;beep-qa=<ver>` |

Rules:

- Values are strings on the wire (XMP convention); the schema owns real
  types. Decode on read-back — never string-compare timestamps.
- Falsification rounds carry `scenarioName` prefixed `falsification:` so
  round-F evidence can never masquerade as product evidence.
- No secrets, no absolute paths. Session-relative paths only.
- Field additions = minor version in the URI path only if semantics change
  (`/1.1/` reserved); pure additions keep `/1.0/` (XMP readers ignore
  unknown properties — open-record semantics).

Video containers carry the same payload as flat tags:
`BEEP_QA_SESSION_ID`, `BEEP_QA_SCENARIO_NAME`, `BEEP_QA_ACTION_ID`,
`BEEP_QA_COMMIT_SHA`, `BEEP_QA_CAPTURED_AT_EPOCH_MS`, `BEEP_QA_SOURCE_VIDEO`,
`BEEP_QA_CLOCK_OFFSET_MS`, `BEEP_QA_TOOL_VERSIONS`.
