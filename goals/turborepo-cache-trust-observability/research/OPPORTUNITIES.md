# Friction and opportunities

No implementation receipts yet. Record friction as it occurs: work, minimum
command/error/file evidence, impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

### Complete protocol checks at the supervisor boundary

While preparing accepted receipt import, source review found that
`Cache.protocol.runner.ts` checks transport-failure joins inside its worker but
only reruns the six-case observation validator in the outer supervisor. There
is no accepted importer yet, and promotion remains closed. Extracting the full
relationship validator for worker, supervisor and importer use would prevent
validation rules from diverging and make edited transport evidence testable at
the actual import boundary. This is a source-review finding, not a demonstrated
escape or a new native failure.

### Response header truncation does not provide receipt safety

Both direct-wire and proxy capture copied Content-Type response text into
conformance evidence, truncated to128characters. Two actual-server regressions
placed a synthetic credential, private path and artifact marker in parameters
and an invented subtype; both paths serialized the synthetic credential. Reuse
the registered MimeType schema to retain only a bounded canonical media type.
Drop parameters and unregistered subtypes before constructing receipts; preserve
the old receipt decode contract. Verify the two real capture paths and the
projection boundary before using them in a signed rollout.
