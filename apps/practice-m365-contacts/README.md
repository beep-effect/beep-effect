# Practice contact seeding

This contact-only job censuses explicit CSV inputs, plans creates against every
mailbox contact folder, exports the pre-seed mailbox, applies tagged contacts, and
provides guarded per-run or category-wide rollback. It never patches contacts.

```sh
bun run apps/practice-m365-contacts/src/bin.ts dry-run --offline --csv <input.csv>
bun run apps/practice-m365-contacts/src/bin.ts dry-run --offline --census --csv <input.csv> --vcf <input.vcf>
```

Inputs are repeatable. Byte-identical files are parsed once. VCF is census-only.
The mailbox comes exclusively from `M365_APP_ONLY_MAILBOX` in `contacts.env`.
Journal and lock files live in the XDG state directory, outside the checkout.
Reports contain counts and run ids only.

Follow [the grant and seeding runbook](../../docs/runbooks/practice-m365-contacts-seeding.md)
for the required export, dry run, smoke, apply and rollback order.
