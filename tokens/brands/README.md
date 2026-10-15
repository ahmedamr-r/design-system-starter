# Brands

One file per brand, named for it, such as `harbor.json`. A brand file re-points semantic tokens at other primitives, and component tokens at other semantics. It adds no tokens of its own.

`data-brand="harbor"` on any element picks that file for the element and everything inside it. Adding a brand should only ever mean adding a file here.
