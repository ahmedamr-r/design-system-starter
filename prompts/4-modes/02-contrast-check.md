Add a contrast check to npm run check, after the checks that are there. In tokens/contrast-pairs.json, list every text and focus-ring colour with each surface or fill the demo puts it on, and the ratio it must reach: 4.5:1 for text and 3:1 for the focus ring. Leave out card borders and dividers, which are decorative.

The check works out both colours of every pair the way the built CSS does, for each brand and for no brand, in light and in dark, and measures them with the WCAG formula on the hex values, without adding a package. Put the code that works out a token's colour in scripts/lib/resolve.js, so other scripts can use it later, and have it follow a reference through any number of tokens. Print every failure on its own line, however many there are, with the pair, the ratio, the brand and the mode, and fail when a text or focus colour has no pair.

Run it and show me what fails. Don't fix anything yet.
