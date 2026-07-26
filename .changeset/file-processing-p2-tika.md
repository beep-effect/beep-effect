---
"@beep/tika": patch
---

P2 Tika driver completion: default Tika Server HTTP engine with typed
`TikaServerEngineConfig` (`BEEP_TIKA_BASE_URL`, `BEEP_TIKA_TIMEOUT_MILLIS`,
`BEEP_TIKA_MAX_OUTPUT_BYTES`), shared response-decoding and error-translation
role files, new `output-budget` error reason, engine-version capture via
`GET /version`, stubbed-HTTP behavior coverage for every declared format
family, and an opt-in `BEEP_TEST_TIKA_URL` live integration lane. The tika-app
and P1 scaffold engines keep their existing behavior (messages parameterized,
not unified).
