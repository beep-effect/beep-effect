# Fallow regex refactor checkpoint

The Fallow Advisory Envelopes failure at `3775253488` retained structural
complexity and duplication findings after the private test alias graph repair.
This checkpoint changes implementation structure, preserving program codecs,
source syntax admission and failure behavior.

- Split native-point grammar parsing into category/hex escapes, class units and
  ranges, repeat bounds, group headers and character/anchor operations.
- Separate canonical token and grammar-state validation from program assembly.
- Share ASCII hex decoding and interval case expansion.
- Measure render plans before constructing variable group/anchor output.
- Split the earlier translation candidate into cursor-owning grammar operations.
  It remains a candidate without execution authority.

Focused verification: 24 tests pass across CitationRegexTranslator,
CitationRegexProgram, CitationRegexAlphabet and CitationRegexCharacters.
Server test type checking passes. Package laws and scoped lint pass; the
unrelated PracticeKg flow advisory remains advisory. Fallow per-file complexity
health reports zero findings for RegexProgram and RegexTranslator under the
unchanged configured ceilings. The divergence audit retains 11 representation
laws, four fidelity questions and 15 unfinished proof rows, with no semantic waiver.

This does not close Fallow globally: the previous intermediate audit retained
64 findings and 23 duplicate groups before the final rendering/translator
refactors. Hosted checks on the next published head remain authoritative.
No native exhaustive qualification was run locally.
