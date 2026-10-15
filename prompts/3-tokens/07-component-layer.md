Grove wants pill-shaped buttons. Cards, tags and inputs stay as they are.

Add a component layer for Button only, in tokens/components/button.json: background, background on hover, label colour and radius, each pointing at a semantic token. Make the demo button read these tokens. Then set Grove's button radius to the pill radius in tokens/brands/grove.json.

Update the check so component tokens may only point at semantics, and add the component layer to AGENTS.md.
