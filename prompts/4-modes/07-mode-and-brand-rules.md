Add the rules for modes and brands to AGENTS.md, after the token rules, and correct any older line they contradict. Keep them short:
- a mode file answers every colour semantic, changes colours only, and never re-points a primitive or a ramp step
- light and dark are the only modes, and the browser picks between them where a colour is used
- anything that paints a surface also sets its text colour, since a colour it inherits was worked out on the ancestor that set it
- a brand file picks one hue, step for step, and sets only what the template lists
- a new brand starts as a copy of the template, and no code names a brand
- every text and focus colour is in tokens/contrast-pairs.json, with the ratio it must reach
- what a client may change in their own brand, and what needs a conversation first

Say which of these the check enforces.
