# Sources

## Repo Sources

- `AGENTS.md` / `CLAUDE.md` - repository law and tool routing.
- `goals/README.md` - packet standard and completion gate.
- `goals/codex-security-findings-2026-08-04/**` - prior packet structure,
  sanitation, triage, and post-merge closure precedent.
- `standards/ARCHITECTURE.md` and `standards/architecture/**` - ownership and
  shared-kernel doctrine.
- Live source and package barrels named by each finding - current-HEAD truth.

## External Source

The operator's signed-in Codex Cloud Security UI supplied native CSV exports
across September 8-9 at `https://chatgpt.com/codex/cloud/security/findings/`.
The cumulative 13-record capture is not a current all-status UI export:

- The earlier 12-record export supplies unchanged historical rows.
- The latest open-findings export contains two rows. Only its previously unseen
  CSF-013 row was appended; the other identity was already captured.
- The mechanical union preserved every original field in the earlier rows.
  Canonical `beep codex findings ingest --refresh --expected-count 13` then
  preserved twelve triage records and appended CSF-013 without rejection.
- Original exports remain in the operator download directory. The cumulative working CSV is
  ignored under `.beep/`; full report bodies are ignored under packet `raw/`.
  No raw CSV, report, email, or signed artifact URL is tracked.
- `severity` and `codexStatus` are historical capture metadata. Live closure
  receipts, rather than those fields, establish current resolution.

| Native export filename | SHA-256 |
| --- | --- |
| `codex-security-findings-2026-09-09T04-40-30.335Z.csv` | `c519b645fb19070a75dbf9ecc30792a628c0b6ab7795844f0f21a1dadb984436` |
| `codex-security-findings-2026-09-09T05-56-21.863Z.csv` | `ee2c59fbb9b9ac679fa95e79535d5935b325452407b4115bf9d195282b2cce08` |

## Notes

- Full report bodies are local ignored evidence under `raw/`.
- Tracked CSF files intentionally omit signed artifact URLs, raw developer-local
  paths, author email addresses, auth values, and unsanitized report text.
