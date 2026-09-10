---
"@beep/todox": patch
"@beep/oip-web": patch
---

Strip the coverage lane's `--js-float16array` flag from `process.execArgv` at
`next.config.ts` load time so Next.js build workers never receive it through
`NODE_OPTIONS`, where V8 rejects it. Transitional: a no-op once the job-wide
node wrapper is removed from `heavy.yml`.
