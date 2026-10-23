# How to work in this repository

This is a design token library. Token files are JSON in the W3C Design Tokens format under `tokens/`, and `npm run build` turns them into CSS custom properties in `dist/tokens.css`. These rules are for anyone changing it, person or agent.

## How to work

1. One job per prompt. Ask before starting a second one.
2. Work on a branch and open a pull request. Never push to main.
3. Run `npm run build` and `npm run check` before saying you are done, and fix anything they print.
4. After writing or changing a file, explain it in two sentences a designer would follow.
5. When a rule here is unclear, ask instead of guessing.

## Where things go

- `tokens/primitives/`, `tokens/semantics/` and `tokens/components/` are the token layers.
- `tokens/brands/`, `tokens/modes/` and `tokens/locales/` are the switches. Each holds one file per option that differs from the default, and each file re-points tokens that already exist. The defaults, no brand, light and the default type, are what the tokens already hold, so they have no file. The README in each folder says which attribute picks its files.
- `tokens/contrast-pairs.json` lists each text and focus colour, the surfaces and fills the demo puts it on, and the contrast ratio it must reach there.
- `demo/copy.json` holds the words on the demo's card, in English and in each other language the demo shows.
- `scripts/build.js` writes `dist/tokens.css`, and the list of brands it built: `dist/brands.json` and `dist/brands.d.ts`. `scripts/check.js` checks the rules. A change to how either works is its own job. `scripts/lib/resolve.js` works out the colour a token comes to in `dist/tokens.css`, for any script that needs it.

## What each layer may point at

`npm run check` enforces part of the rules from here down. The last section says exactly which parts.

1. **Primitives** (`tokens/primitives/`) hold raw values: colours, sizes, fonts. Named for what they are (`color.blue.600`), never for where they are used.
2. **Semantics** (`tokens/semantics/`) name a job (`color.fill.brand`) and point at one primitive, or at one step of the brand ramp. They never hold a raw value. The brand ramp, `color.brand.50` to `color.brand.900` in `tokens/semantics/brand.json`, is the one set of semantics that names no job: each step points at the gray step with the same number, so with no brand the ramp is gray. The brand semantics, such as `color.fill.brand` and `color.text.link`, point at its steps.
3. **Components** (`tokens/components/<component>.json`) exist only for a component a brand restyles on its own, such as pill-shaped buttons in one brand. Each points at a semantic. Today that is Button alone.
4. **Brands** (`tokens/brands/<name>.json`) point every step of the brand ramp at the same step of one primitive ramp, such as `color.brand.600` at `color.blue.600`. Every brand semantic follows, in light and in dark. Anything else it sets points at a different semantic, such as a button's radius at `radius.pill`. A brand adds no new tokens.
5. **Modes** (`tokens/modes/dark.json`) re-point colour semantics at different primitives or steps of the brand ramp.
6. **Locales** (`tokens/locales/<code>.json`) re-point type semantics, and nothing else, at different primitives, such as `type.family` at `font.family.arabic`.

The rest of the rules for brands and modes are under Modes and brands, below, and for locales under Type and language.

Pages and components read semantics, or their own component tokens where those exist. Never a primitive, never a raw value. A page never reads a step of the brand ramp either: a step has no dark answer, so `color.brand.700` would stay dark on a dark page where `color.text.link` turns light. Before adding a component file, check whether a new semantic would do: a role every component can use beats a token only one can.

Line heights follow the same rule. The primitives are plain numbers, multiples of the font size, under `font.line-height` and named by the number times 100, so `font.line-height.150` is 1.5. A page reads a line-height semantic, such as `type.body.line-height`, so a locale or a brand can re-point it. The one raw line height a page may type is `1`, for a single line set tight, such as a tag or a price. A `font` shorthand counts as setting a line height: with a slash its line height must read a token, and without one it sets the line height back to normal, so a `line-height` that reads a token must follow it in the same rule. Check 20.

## Naming semantic colours

`color.<role>.<intent>[-<state>]`

- Roles: `surface`, `fill`, `text`, `border`.
- Intent is any name for a job, such as `default`, `subtle`, `brand`, `on-fill`, `link`, `focus`.
- A state is optional and comes last, such as `-hover` or `-subtle`.
- The one exception is the brand ramp, `color.brand.<step>`, where the step is a number such as `600`. It holds steps, not jobs.

Name the job, not the colour. `color.fill.brand`, never `color.fill.blue`.

## Modes and brands

Each rule ends with the check in the next section that enforces it, or with "by hand" when nothing checks it.

### Modes

- A mode file answers every colour semantic but the steps of the brand ramp, even where its answer is the same as light. It changes colour semantics only, and never re-points a primitive or a step of the ramp, so `color.gray.900` and each brand's ramp are the same in both modes. Checks 9 and 10.
- Light and dark are the only modes. Light is what the semantics hold, and `tokens/modes/dark.json` is the only mode file. The build writes a semantic whose two answers differ as `light-dark(light, dark)`, and the browser picks one where the colour is used, from the `color-scheme` that `data-mode` sets on that element or an ancestor. `:root` has `light dark`, so a page that sets no mode follows the reader's setting. Check 11.
- Anything that paints a surface or a fill also sets its text colour, and an element with a `data-mode` paints its own surface. A colour an element inherits was worked out on the ancestor that set it, in that ancestor's mode and brand, so it can be the wrong one. By hand.

### Brands

- A brand file picks one hue: it points every step of the brand ramp at the same step of one primitive ramp, and sets no other colour. Besides the ramp it sets only what `tokens/brands/_template.json` lists, today the button's radius. Check 4.
- A new brand starts as a copy of `tokens/brands/_template.json`, which lists every token a brand may set, each at its value with no brand and with what it paints in light and in dark. A file whose name starts with an underscore is not a brand, to the build or the check. For brands to set another token, add it to the template first. The copying is by hand; check 4 fails a brand that sets anything the template leaves out.
- No code names a brand. The build finds each brand in `tokens/brands/`, and anything that needs the list reads it from the build: `dist/brands.json` lists each brand the build wrote a block for, in file-name order, as `{ "id", "displayName", "hue" }`, and `dist/brands.d.ts` has a `Brand` type listing the ids. The id is the file name, the display name is the id with a capital letter, and the hue is the primitive ramp the brand ramp points at, such as `blue`, or `null` when its steps point at more than one. A brand file that sets nothing is in neither. The demo builds its panels from `dist/brands.json`. Check 8 covers `scripts/`, `.github/`, `demo/` and the root config files; anywhere else is by hand.

### Contrast

- Every text and focus colour is in `tokens/contrast-pairs.json`, with each surface and fill the demo puts it on and the ratio it must reach there: 4.5 for text, 3 for a focus ring. Check 13 makes sure each has a pair, and check 14 that every pair reaches its ratio, for every brand and no brand, in light and in dark. That the surfaces listed are all of them is by hand.

### What a client may change in their own brand

On their own, in their brand file:

- The hue: which primitive ramp the ten steps point at. Check 4 keeps it step for step on one ramp, and check 14 fails a hue that falls short of a ratio.
- The button's corners, at any radius in `tokens/semantics/shape.json`, such as `radius.pill`. Check 2 makes them point at a semantic; that it is a radius is by hand.

A conversation first. Code owner review, below, holds a client to all but the last:

- A colour no primitive ramp has, such as their exact brand colour. It adds a ramp to `tokens/primitives/color.json`, ten steps at the lightness of the others, that every brand can then pick.
- Keeping a hue that falls short of a ratio, or one job at a different step, such as the main button in their exact colour. Either means moving a step in `tokens/semantics/` or `tokens/modes/dark.json`, which moves that job for every brand.
- Any token the template does not list, such as a font. Adding it to the template lets every brand set it.
- A lower ratio, or a mode other than light and dark. The ratios and the two modes are the same for every brand, and a third mode would change how the build works.
- A new name. The file name is the `data-brand` value and the id in `dist/brands.json`, so every page that uses the old name loses the brand.

`.github/CODEOWNERS` is what enforces this in each client's copy. It makes @ahmedamr-r the owner of every file but the brand files, the `.json` files in `tokens/brands/` whose names do not start with an underscore, so a pull request that changes a rule, a check, the template or a shared token waits for that review, and one that changes only brand files does not. It blocks a merge only once the ruleset on main turns on Require review from Code Owners, and only while @ahmedamr-r has write access to the copy. Renaming a brand file changes only brand files, so a new name is the one request above that passes without review: that stays by hand.

## Language and direction

Each rule ends with the check that enforces it, or with "by hand".

- `lang` and `dir` always go together. An element that sets one sets the other, starting with `<html lang="en" dir="ltr">`. Check 15 for the demo's HTML. In the demo's script both are set by one function, `setLanguage`, and that nothing sets one alone is by hand.
- The direction comes from the language, never typed. In HTML, `dir` is the direction `Intl.Locale` gives for the `lang` beside it, check 15. A script asks for it, `new Intl.Locale(lang).getTextInfo().direction`, and never writes `"ltr"` or `"rtl"`, check 16.
- Words that stay in another language keep their own `lang` and `dir`. The panel labels and the comparison links are English, so inside an Arabic panel each sets `lang="en" dir="ltr"`. By hand.
- The card's words are in `demo/copy.json`, one set per language, keyed by language code, and English is the full set. Every other language has every string English has, check 17. The price is not in it yet, and stays typed in the template. That a translation is right is by hand.
- The CSS does not name a side. Flex, grid and properties such as `padding-inline-start` follow `dir`, so one stylesheet works both ways, and no token needs a left and a right version. Use the start and the end: `margin-inline-start` for `margin-left`, `inset-inline-end` for `right`, `border-start-start-radius` for the top left corner, `text-align: start`, `float: inline-end`. A `margin`, `padding` or `inset` with four values whose left and right differ becomes `-block` and `-inline`. Check 18.
- The CSS never asks which way the page reads. It sets no `direction`, has no `[dir]` or `:dir()` selector, and flips nothing with a negative scale, such as `scaleX(-1)`. Check 18.
- A token's `$description` says start and end, never left and right, since in Arabic the start is on the right. Check 19.

## Type and language

Each rule ends with the check that enforces it, or with "by hand".

- A language whose type differs from the default gets one file in `tokens/locales/`, named by its language code, such as `ar.json`. The name must be a language `Intl.DisplayNames` knows, since it becomes the code in `:lang()`. Check 21.
- A locale file re-points type tokens that already exist, the semantics under `type`, and nothing else: no colour, no shape, no new token. Arabic sets `type.family` to `font.family.arabic` and `type.body.line-height` to `font.line-height.170`. Check 21. That each points at a primitive is by hand, since check 2 does not read locale files.
- The build writes each locale file as a `:lang(<code>)` block after the brands. `:lang(ar)` matches any element whose language is `ar` or starts with `ar-`, set on it or on an ancestor, so `lang="ar-EG"` reads `ar.json`. Coming after the brands, it wins over `[data-brand]` on an element that sets both. Check 6.
- The type tokens are declared on `[lang]` as well as on `:root` and `[data-brand]`, so an element that sets a language gets the default type back, unless a locale matches it: an English label in an Arabic panel is set in the default type. No other token is declared on `[lang]`, since there it would put a token a brand re-points, such as the button's radius, back to its value with no brand on anything inside the brand that sets a language. Check 6.
- Brands and modes never set type. A brand sets only what `tokens/brands/_template.json` lists, and it lists no type token, check 4. A mode sets only colour semantics, check 9.
- The card, and every element with a `lang`, reads the type family, weight and line height itself. A font an element inherits was worked out on the ancestor that set it, in that ancestor's language. By hand.
- The page loads each locale's font, in the weights the type tokens use. The demo imports only the Arabic letters of IBM Plex Sans Arabic, `arabic-400.css`, `arabic-500.css` and `arabic-600.css`, so Latin letters and digits keep the system face that comes after it in `font.family.arabic`. By hand.
- No italics and no capitals. Arabic has no capitals, and the Arabic family has no italic, so a browser would slant its letters on its own. Emphasis uses weight, such as `type.title.weight`, in every language. Check 22.

## What `npm run check` enforces

Each check fails with a plain message that names the file. They are numbered as in `scripts/check.js`.

1. Colour values appear only in `tokens/primitives/`. No semantic, component or brand token holds one, and no CSS file in `demo/` does.
2. Every step of the brand ramp points at a primitive, every other semantic at a primitive or a step of the ramp, and every component token at a semantic. A brand or mode token points at what the token it re-points would.
3. The CSS and HTML in `demo/` read no primitive and no step of the brand ramp.
4. A brand file sets only semantic and component tokens that already exist, and nothing `tokens/brands/_template.json` does not list. Its only colours are the steps of the brand ramp: it sets every step, each at the same step of one primitive ramp. A brand file that sets nothing fails here with the list of what it is missing; the build still finishes and writes no block for it.
5. In `dist/tokens.css`, every semantic and component token is still a `var()` reference, or `light-dark()` of two.
6. In `dist/tokens.css`, semantic and component tokens are declared on `:root` and `[data-brand]`, before the brand blocks. The type tokens, the semantics under `type`, are declared on `[lang]` as well, and no other token is. Every file in `tokens/locales/` that sets something has a `:lang(<code>)` block, named by its file name, and it comes after the brand blocks. A locale missing its `:lang()` block, built another way such as `[lang="ar"]`, or coming before a brand, fails.
7. Every semantic colour is named `color.<role>.<intent>`, with an optional `-<state>`, and its role is `surface`, `fill`, `text` or `border`. No word in the name is a ramp from `tokens/primitives/color.json`, and grey and gray count as the same word. The brand ramp, `color.brand.<step>` with a number for the step, is the one exception, and any other name under `color.brand` fails.
8. No file in `scripts/`, `.github/` or `demo/`, and no config file at the root, contains a brand name as a whole word, in any letter case. The brand names are the file names in `tokens/brands/`, leaving out any that starts with an underscore. Root config files are dotfiles and `.json`, `.js`, `.mjs`, `.cjs`, `.ts`, `.yml`, `.yaml` and `.toml` files, except `package-lock.json`.
9. A mode file sets only colour semantics that already exist. It holds no colour value, sets no primitive, and never touches a step of the brand ramp.
10. Every colour semantic but the steps of the brand ramp has an answer in `tokens/modes/dark.json`.
11. `tokens/modes/` holds no mode other than dark, since `light-dark()` has only a light answer and a dark one.
12. The CSS and HTML in `demo/` read only variables that `dist/tokens.css` writes. The message suggests the closest name the demo may read.
13. Every text and focus colour has a pair in `tokens/contrast-pairs.json`. They are each `color.text` semantic, `color.border.focus`, and any component token that points at one, such as `button.label`, whose pair also counts for the semantic it points at. Every token the file names exists.
14. Every pair in `tokens/contrast-pairs.json` reaches its ratio, for every brand and for no brand, in light and in dark. Both colours are worked out from `dist/tokens.css` the way a browser would, and measured with the WCAG formula on their hex values. Every pair that falls short prints on its own line, with its brand and mode. A brand file that sets nothing is not measured, and the check's title names it.
15. Every element in the HTML in `demo/` that has `lang` or `dir` has both, its `lang` is a code `Intl.Locale` can read, and its `dir` is the direction `Intl.Locale` gives for that language. Comments do not count.
16. No script in `demo/` types a direction: `ltr` or `rtl` in a string fails, in any letter case, and a script that sets `dir` must call `new Intl.Locale`. Comments do not count.
17. Every language in `demo/copy.json` has every string English has, not empty, and every item of each list. Each missing string prints on its own line, with the English beside it.
18. No CSS in the repository names a side, outside `node_modules` and the build folders, `dist/` and `.vite-build/`. That is every `.css` file, and the `<style>` blocks and `style` attributes in every HTML file. It fails `margin`, `padding`, `scroll-margin`, `scroll-padding` and `border` with `-left` or `-right`, the properties `left` and `right`, the four corner radii such as `border-top-left-radius`, `text-align`, `text-align-last`, `float` or `clear` set to `left` or `right`, and a `margin`, `padding` or `inset` with four values whose second and fourth differ. It also fails the `direction` property, a `[dir]` or `:dir()` selector, and a negative number in `scale` or in `scale()`, `scaleX()`, `scaleY()`, `scaleZ()` or `scale3d()`. Each problem prints on its own line with the file, the line and the logical property or value to use instead. Comments do not count.
19. No token's `$description` uses left or right for a side: a phrase such as "left and right", "on the right", "right-to-left" or "the left edge". Left on its own does not count, so "left out" passes. The message names the file, the line and the token.
20. Every line height in the CSS reads a token, or is `1`. It reads the same CSS as check 18. A `line-height` passes when it is `1`, `inherit`, `unset`, or exactly `var()` of a semantic or component token whose name ends in `line-height`, with no fallback. A `font` shorthand passes when it is `inherit` or `unset`, when the line height after its slash passes the same way, or, with no slash, when a `line-height` comes after it in the same rule. Each problem prints on its own line with the file, the line and the token to read instead. Comments do not count.
21. Every file in `tokens/locales/` is named for a language `Intl.DisplayNames` knows, such as `ar` or `ar-EG`, and sets only type tokens that exist, the semantics under `type`. A token that is not a type token, or a type token that does not exist, prints on its own line, with the closest type token for a misspelt one.
22. No CSS sets italics or capitals. It reads the same CSS as check 18. It fails `font-style` and the `font` shorthand with `italic` or `oblique`, `text-transform` with `uppercase` or `capitalize`, `font-variant`, `font-variant-caps` or the `font` shorthand with small caps or another capital form, such as `all-small-caps`, `petite-caps`, `unicase` or `titling-caps`, and `font-feature-settings` that turns on `smcp`, `c2sc`, `pcap`, `c2pc`, `unic` or `titl`. Each problem prints on its own line with the file and the line. Comments do not count.

Nothing checks the rest, so keep it by hand: that `tokens/contrast-pairs.json` lists every surface or fill the demo puts each colour on, that primitives are named for what they are, that a component file exists only when a brand restyles that component and a semantic would not do, that pages use no raw sizes or fonts (check 1 catches only colours, and check 20 only line heights), that anything that paints a surface or a fill sets its text colour and an element with a `data-mode` paints its own surface, that a new brand starts as a copy of the template, that a brand points the button's radius at a radius, that brand names stay out of any other list, config or code, that a client renames their brand only after a conversation, that the demo's script never sets `lang` without `dir`, that words in another language keep their own `lang` and `dir`, that a translation says what the English says, that no script sets a side through an element's `style`, that nothing but a token's `$description`, such as a README, uses left or right for a side, that a locale points each type token at a primitive, that the card and every element with a `lang` read the type family, weight and line height themselves, and that the page loads each locale's font in the weights the type tokens use. Code owner review, not this check, holds a client to the rest of what they may not change on their own.
