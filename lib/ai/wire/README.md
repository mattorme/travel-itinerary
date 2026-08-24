# Wire schemas

These are **not** the domain schemas. They exist because OpenAI strict-mode JSON
Schema is far more restrictive than idiomatic Zod:

- every property must appear in `required` (use `nullable` instead of optional)
- `additionalProperties` must be `false` on every object
- no `anyOf`/`oneOf` at the root, no refinements, no defaults, no transforms
- deeply nested structures cost output tokens and degrade adherence

Piping a rich domain schema through `zodTextFormat` produces either an invalid
schema or — worse — one that validates but does not constrain.

So each stage gets a purpose-built, flat wire schema plus an explicit
`fromWire()` mapper into the domain model. The mappers are unit-tested; the
schemas stay small on purpose. Stage 4's entire contract is
`{ slot_id, place_id, reason }` — the model never writes a place name.
