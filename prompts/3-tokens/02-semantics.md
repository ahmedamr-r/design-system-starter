Add semantic tokens in tokens/semantics/. A semantic token names a job, like "the fill of the main button", and points at a primitive. It never holds a raw value.

Name colours color.<role>.<intent>, with an optional state at the end: color.fill.brand, color.fill.brand-hover, color.text.on-fill, color.border.focus. The roles are surface, fill, text and border.

Cover what a simple product card needs: page and card surfaces, body and secondary text, a main button with a hover state, a subtle brand tint for tags, a link, a border and a focus ring. Add radius, spacing and type roles too.

Point the brand roles at gray for now. Give every token a one-line $description saying where it's used.
