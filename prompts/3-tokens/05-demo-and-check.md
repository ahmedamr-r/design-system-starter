Add demo/index.html with the same pricing card three times, side by side: Harbor, Grove, and a Grove card inside a Harbor panel. The card shows a plan name with a "Most popular" tag, a short description, a price, three features with check marks, a main button and a link to compare plans. Its CSS reads semantic tokens only. Add npm run demo to build and open it.

Then write scripts/check.js for npm run check. It should print a plain message and fail when:
1. a colour value appears anywhere outside tokens/primitives
2. a semantic or brand token points at anything but a primitive
3. the demo CSS reads a primitive
4. a brand file sets a token that doesn't exist (suggest the closest name)
5. a semantic in dist/tokens.css is a raw value instead of var()
6. a semantic is declared without the [data-brand] scope
