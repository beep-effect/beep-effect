---
"@beep/openclaw": minor
"@beep/identity": patch
---

Add the `@beep/openclaw` driver (OpenClaw workstation agent, phase P1): a
desired-intent Effect schema for our deployment intent, a versioned render
adapter emitting canonical `openclaw.json` for the pinned OpenClaw version
(`2026.7.1-2`), an `onepassword-cli`-style CLI process wrapper (version,
read-only doctor, `config validate`, `config schema`, `secrets reload`,
gateway health call, channels status, agent turn), a `systemctl --user`
service-control wrapper, HTTP liveness/readiness probes, and an integration
acceptance suite that validates rendered output against the real pinned
binary (positive + negative fixtures) plus a lossy schema-export guard for
declared extension surfaces. Registers the `$OpenclawId` identity composer
in `@beep/identity`.
