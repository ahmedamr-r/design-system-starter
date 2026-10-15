Change the build so semantic tokens stay references in the CSS: --color-fill-brand should come out as var(--color-gray-900), not as a hex value.

Put primitives on :root. Put semantics on :root and also on [data-brand], so a brand set on any element re-resolves them there.

Show me a few lines of dist/tokens.css before and after.
