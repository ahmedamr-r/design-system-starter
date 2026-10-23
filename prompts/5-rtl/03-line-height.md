The demo sets line height as a raw 1.5, and a switch can only change a value that is a token. Add line heights to the font primitives as plain numbers, one step for now, 150 for 1.5. Add type.body.line-height to the semantics, pointing at 150, and make the demo read it wherever it set 1.5. A line height of 1, for a single line set tight such as a tag or a price, stays as it is.

Add a check that fails when CSS sets any other line height without reading a token, and add the rule to AGENTS.md. Nothing should look different, so tell me how you checked.
