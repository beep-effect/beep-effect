# Architecture proof public layer

The app now registers its actual composed server layer with it.layer. The private
scoped builder is removed. The single app execution, fixed proof ID and complete
encoded create/projection oracle are unchanged; no database or startup timeout
is invented for in-memory services. Package audit and docgen pass.
