Add primitive tokens in tokens/primitives/. A primitive is a raw value named for what it is, never for where it's used.

- color.json: ramps for gray, blue, green and red, steps 50 to 900. Gray also gets 0 (white) and 950. Make the steps even in perceived lightness, so 600 is equally dark in every hue. Write colours in the format's OKLCH form, with a hex fallback.
- size.json: one scale for spacing and corners, in px: 0, 2, 4, 6, 8, 12, 16, 24, 32, and full (9999px).
- font.json: one sans-serif family, sizes 14, 16, 20 and 24, weights 400, 500 and 600.

Every token needs a $value and a $type. Run the build and show me part of the CSS.
