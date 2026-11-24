# P3 after the P2 merge: root cache review

P3 merges the P2 head (#3511) and adds `@beep/annotation`. The root task projection in `turbo.json`
gains one input, `packages/foundation/modeling/annotation/package.json`, the same package-manifest
input every other workspace package already contributes. `bun run beep cache audit` reports that as
`configuration-source-drift: turbo.json` with no blocking finding. The root baseline is re-recorded
for that hash under the checkout's Bun 1.4.5 profile. No command, cache flag, output or environment
changed, and no cache qualification is granted.
