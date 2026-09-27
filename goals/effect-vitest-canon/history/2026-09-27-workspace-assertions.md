# Workspace assertion phase

Replace five direct Option checks with native assertNone/assertSome helpers,
retaining their exact operands, absence polarity and expected numeric parent 12.
The branded parent ID safely widens to number for the existing literal oracle.
Keep the complete strict encoded append-input equality, including its Option
field, unchanged. All three package audits and docgen pass after this change.
