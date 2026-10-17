Give each brand a ramp. Add tokens/semantics/brand.json with color.brand.50 to color.brand.900, each pointing at the gray step with the same number, so with no brand the ramp is gray. Change each brand file to point those ten steps at the same steps of its own ramp, blue for Harbor and green for Grove, instead of re-pointing semantics. Grove keeps its button radius.

Point the brand semantics at steps of the ramp, in tokens/semantics/color.json for light and tokens/modes/dark.json for dark:

| Semantic | Light | Dark |
| --- | --- | --- |
| color.fill.brand | 600 | 600 |
| color.fill.brand-hover | 700 | 700 |
| color.fill.brand-subtle | 50 | 800 |
| color.text.brand | 700 | 300 |
| color.text.link | 700 | 400 |
| color.border.focus | 600 | 400 |

The ramp steps are not semantics a mode answers. Update the check so a semantic points at a primitive or a ramp step, a brand file points every step at the same step of one primitive ramp and sets no other colour, a mode file never touches the ramp, the demo never reads a ramp step, and the naming check knows color.brand.<step> is the ramp. Run the check and tell me what changed.
