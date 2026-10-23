# How to work in this repository

This is a design token library. Token files are JSON in the W3C Design Tokens format under `tokens/`, and `npm run build` turns them into CSS custom properties in `dist/tokens.css`. These rules are for anyone changing it, person or agent.

## How to work

1. One job per prompt. Ask before starting a second one.
2. Work on a branch and open a pull request. Never push to main.
3. Run `npm run build` and `npm run check` before saying you are done, and fix anything they print.
4. Look at every visual change in English and in Arabic before saying it is done, and say in the pull request what you looked at in each direction. Both directions, under Language and direction, says what counts as a visual change and what to look at.
5. After writing or changing a file, explain it in two sentences a designer would follow.
6. When a rule here is unclear, ask instead of guessing.

## Where things go

- `tokens/primitives/`, `tokens/semantics/` and `tokens/components/` are the token layers.
- `tokens/brands/`, `tokens/modes/` and `tokens/locales/` are the switches. Each holds one file per option that differs from the default, and each file re-points tokens that already exist. The defaults, no brand, light and the default type, are what the tokens already hold, so they have no file. The README in each folder says which attribute picks its files.
- `tokens/contrast-pairs.json` lists each text and focus colour, the surfaces and fills the demo puts it on, and the contrast ratio it must reach there. Disabled text is the one colour it leaves out; Contrast, below, says why.
- `demo/copy.json` holds the words on the demo's card, in English and in each other language the demo shows. The card's numbers, the price and the trial length, are data in `demo/demo.js`.
- `.github/pull_request_template.md` is what every pull request starts from, with a line for what was looked at in English and one for Arabic.
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
- A state is optional and comes last. The states are one short list: `-hover`, `-pressed`, `-selected` and `-disabled`, as in `color.fill.brand-pressed`. `-subtle`, the soft version of a fill or a text, as in `color.fill.brand-subtle`, is kept too. Check 7.
- Disabled replaces the intent: `color.fill.disabled`, `color.text.disabled` and `color.border.disabled`, never `color.fill.brand-disabled`. A disabled control looks the same whatever it would have done, so it is gray in every brand. Check 7.
- No other word names a state. Check 7 fails the common ones, each with the word to use instead: `-active` and `-down` are `-pressed` (or `-selected`, for the current tab or item), `-hovered` is `-hover`, `-checked` and `-current` are `-selected`, `-inactive` is `-disabled`, and `-rest`, `-normal`, `-focus` and the like are left out, since the name without a state is the control at rest and a focused control keeps its colours and shows the ring, `color.border.focus`. It holds component colour tokens, such as `button.background-pressed`, to the same words. That a state word it does not list is not used is by hand.
- Never fade a disabled control with opacity. It reads the disabled tokens instead, which stay the same on any surface and in any brand, where opacity lets the brand colour and the card behind show through. By hand.
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
- Disabled text, `color.text.disabled`, has no pair, and check 13 does not ask for one. WCAG sets no contrast minimum for a control that cannot be used, its text and edges included: 1.4.3 leaves out the text of an inactive control, and 1.4.11 its edges. Check 13.

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
- The card's words are in `demo/copy.json`, one set per language, keyed by language code, and English is the full set. Every other language has every string English has, check 17. The numbers are not in it: see Numbers, below. That a translation is right is by hand.
- The CSS does not name a side. Flex, grid and properties such as `padding-inline-start` follow `dir`, so one stylesheet works both ways, and no token needs a left and a right version. Use the start and the end: `margin-inline-start` for `margin-left`, `inset-inline-end` for `right`, `border-start-start-radius` for the top left corner, `text-align: start`, `float: inline-end`. A `margin`, `padding` or `inset` with four values whose left and right differ becomes `-block` and `-inline`. Check 18.
- The CSS never asks which way the page reads. It sets no `direction`, has no `[dir]` or `:dir()` selector, and flips nothing with a negative scale, such as `scaleX(-1)`. The one exception is the icon rule, below. Check 18.
- A token's `$description` says start and end, never left and right, since in Arabic the start is on the right. Check 19.

### Icons

- An icon that points somewhere is named for where it leads, forward or back, never left or right, and its name ends in `-forward` or `-back`, such as `arrow-forward` or `chevron-back`. Forward is the way the text reads, so in English it points right and in Arabic left: a name with a side in it is wrong in one of them. The name alone decides whether the icon turns. Check 23 fails a name with left or right in it, and one with forward or back anywhere but the end, such as `forward-arrow`. That an icon which points somewhere has such a name is by hand.
- Each icon is drawn the way it points in English, so a forward arrow points right. By hand.
- One rule turns them around, the icon rule in `demo/demo.css`. It is the only CSS that asks which way the text reads, and the only CSS that flips something with a negative scale:

  ```css
  [data-icon$="-forward"]:dir(rtl),
  [data-icon$="-back"]:dir(rtl) {
    scale: -1 1;
  }
  ```

  `:dir()` reads the direction from the nearest `dir`, so no page and no script checks it. The rule sets nothing but the turn. Any other rule that asks for the direction or flips something fails, a second copy of the icon rule included. Check 18.
- These turn around, so their names end in `-forward` or `-back`: arrows and chevrons that lead to the next or the previous thing, such as the arrow after the card's main button, a back link, next and previous in a list or a carousel, and the mark between the steps of a breadcrumb. Check 23 for the names; which icons belong here is by hand.
- These never turn, so their names hold no forward or back: icons that point up or down; icons of a thing rather than a way, such as the tick, a close cross, a plus or a magnifying glass; a clock, and circular arrows that go round the way a clock does, such as refresh, since clocks run the same way in Arabic; media controls, such as play and skip, which follow the tape, not the text, so they are named without forward or back, `skip-next` rather than `fast-forward`, which would turn; an arrow that points both ways; and logos, letters and digits. The card's tick has no `data-icon`, so nothing turns it. By hand.

### Both directions

The checks read files, so they cannot see a tag that sits at the wrong end of the card or an arrow that turned the wrong way. Someone has to look, in both directions, every time.

- A visual change is any change that can change what the demo shows: a token file, `scripts/build.js`, or anything in `demo/`. A change to this file, a check, a README or a workflow and nothing else is not one. By hand.
- Before a visual change is done, run `npm run demo` and look at what it changed in the English panels, which read left to right, and in the Arabic panels, which read right to left. Each case comes in English and then in Arabic right after it, and the light panel with no brand once more in Egyptian Arabic, so look at all three. By hand.
- In the Arabic panels, look for what no check can see: the words start at the start edge, the card is the English card mirrored, with the tag and the button's arrow at the opposite ends and the arrow pointing the way the text reads, padding and corners follow, the Arabic letters are set in IBM Plex Sans Arabic at its own line height, the price and the trial length are in that panel's digits, and the English labels and links inside still read left to right. In the English panels, look that nothing moved that should not have. By hand.
- The pull request says what was looked at in each direction, on the line for English and the line for Arabic in `.github/pull_request_template.md`: which panels, in light and in dark, and what was seen. Neither line is left empty or filled in without looking. Whoever could not look, such as an agent with no browser, writes that on the line, and a reviewer looks before the merge. A pull request with no visual change writes "Not a visual change" on both lines. By hand.
- `demo/copy.json` always holds a language that reads right to left, so the demo always has panels in that direction to look at. Dropping the Arabic set, or every language that reads right to left, to get a change through fails. Check 25. English, the other direction, is held by check 17. The demo shows every language in `demo/copy.json`, and that its script leaves none out is by hand.

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

## Numbers

Each rule ends with the check that enforces it, or with "by hand".

- A number is data, never words. The copy writes no digit, in any script: the card's price is an amount and a currency code, `{ amount: 24, currency: 'USD' }`, and the trial length is a number, `14`, both in `demo/demo.js`. A string marks where a number goes, as `{days}` in `Start a {days}-day trial`. Check 24. A digit typed in the copy is in one language's digits and is never formatted for the others.
- The price slot in the template, the element with `data-price`, stays empty. `demo/demo.js` formats the price and puts it there. Check 24.
- Every number is formatted with `Intl.NumberFormat` for the language of the panel it sits in, never the page's, so the digits, the separators and the side the currency symbol goes on come from that language. A price uses `style: 'currency'` with the currency code, and `trailingZeroDisplay: 'stripIfInteger'`, so a whole amount has no decimals and one with cents keeps them. By hand.
- The digits come from the language, never from a choice in code. `ar` writes 0 to 9, and `ar-EG` writes Arabic-Indic digits, `٠` to `٩`, since those are the digits the Unicode locale data (CLDR) that `Intl` reads gives each by default. To ask for other digits, the `lang` asks: `ar-EG-u-nu-latn` is Egyptian Arabic with 0 to 9. No script swaps one digit for another. By hand.
- A price is split with `formatToParts`, and the currency symbol goes in a `<bdi>` of its own, so a Latin symbol such as `US$` inside Arabic does not pull the digits next to it into its own direction. By hand.
- These stay left to right inside Arabic, and nothing reverses them: a number, its digits and its decimal and thousands separators, in either set of digits; a price's amount and a Latin currency symbol; phone numbers, email addresses, web addresses and code; and words and names in a Latin script, such as a product name. The browser keeps a number and a run of Latin words in order on its own; a phone number, an email address, code and anything a user typed need the next two rules. By hand.
- Anything a user typed goes in a `<bdi>`, such as a name, a team or a search: its direction is not known until it arrives, and the `<bdi>` keeps it from moving the punctuation and numbers around it. By hand.
- Phone numbers, email addresses and code keep `dir="ltr"` on their own element, such as a `<span>` around a phone number or a `<code>`, in every language, typed by a user or not: they read left to right whatever the text around them reads. `dir` on an element sets it apart the way `<bdi>` does, so they need no `<bdi>` as well. Since `lang` and `dir` go together, check 15, the element also sets the `lang` its words are in, such as `lang="en"` for code with English words, or `lang="zxx"`, the code for no language, for a phone number or an email address. `Intl.Locale` gives `ltr` for both, so check 15 passes and a script sets it with `setLanguage`, without typing a direction, check 16. That every phone number, email address and piece of code has its own element is by hand.
- Logos never flip. A logo, a wordmark or a brand's mark is drawn one way and stays that way in every language: no negative scale, no name ending in `-forward` or `-back`, and no CSS that asks for the direction. Check 18 fails a flip outside the icon rule and check 23 a name the icon rule would turn; that a logo has neither is by hand.

## What `npm run check` enforces

Each check fails with a plain message that names the file. They are numbered as in `scripts/check.js`.

1. Colour values appear only in `tokens/primitives/`. No semantic, component or brand token holds one, and no CSS file in `demo/` does.
2. Every step of the brand ramp points at a primitive, every other semantic at a primitive or a step of the ramp, and every component token at a semantic. A brand or mode token points at what the token it re-points would.
3. The CSS and HTML in `demo/` read no primitive and no step of the brand ramp.
4. A brand file sets only semantic and component tokens that already exist, and nothing `tokens/brands/_template.json` does not list. Its only colours are the steps of the brand ramp: it sets every step, each at the same step of one primitive ramp. A brand file that sets nothing fails here with the list of what it is missing; the build still finishes and writes no block for it.
5. In `dist/tokens.css`, every semantic and component token is still a `var()` reference, or `light-dark()` of two.
6. In `dist/tokens.css`, semantic and component tokens are declared on `:root` and `[data-brand]`, before the brand blocks. The type tokens, the semantics under `type`, are declared on `[lang]` as well, and no other token is. Every file in `tokens/locales/` that sets something has a `:lang(<code>)` block, named by its file name, and it comes after the brand blocks. A locale missing its `:lang()` block, built another way such as `[lang="ar"]`, or coming before a brand, fails.
7. Every semantic colour is named `color.<role>.<intent>`, with an optional `-<state>`, and its role is `surface`, `fill`, `text` or `border`. No word in the name is a ramp from `tokens/primitives/color.json`, and grey and gray count as the same word. The brand ramp, `color.brand.<step>` with a number for the step, is the one exception, and any other name under `color.brand` fails. A state is `-hover`, `-pressed`, `-selected` or `-disabled`, and `-subtle` is kept. A semantic or component colour with another common state word in its name, such as `-active`, `-down`, `-hovered`, `-checked`, `-inactive`, `-rest` or `-focus`, fails with the word to use instead and the name to give it; `focus` as the whole intent, as in `color.border.focus`, is a job and passes. `-disabled` after an intent fails, since disabled replaces the intent, and `-hover`, `-pressed` or `-selected` anywhere but at the end fails. Every problem prints on its own line.
8. No file in `scripts/`, `.github/` or `demo/`, and no config file at the root, contains a brand name as a whole word, in any letter case. The brand names are the file names in `tokens/brands/`, leaving out any that starts with an underscore. Root config files are dotfiles and `.json`, `.js`, `.mjs`, `.cjs`, `.ts`, `.yml`, `.yaml` and `.toml` files, except `package-lock.json`.
9. A mode file sets only colour semantics that already exist. It holds no colour value, sets no primitive, and never touches a step of the brand ramp.
10. Every colour semantic but the steps of the brand ramp has an answer in `tokens/modes/dark.json`.
11. `tokens/modes/` holds no mode other than dark, since `light-dark()` has only a light answer and a dark one.
12. The CSS and HTML in `demo/` read only variables that `dist/tokens.css` writes. The message suggests the closest name the demo may read.
13. Every text and focus colour has a pair in `tokens/contrast-pairs.json`. They are each `color.text` semantic but disabled text, `color.border.focus`, and any component token that points at one, such as `button.label`, whose pair also counts for the semantic it points at. Every token the file names exists.
14. Every pair in `tokens/contrast-pairs.json` reaches its ratio, for every brand and for no brand, in light and in dark. Both colours are worked out from `dist/tokens.css` the way a browser would, and measured with the WCAG formula on their hex values. Every pair that falls short prints on its own line, with its brand and mode. A brand file that sets nothing is not measured, and the check's title names it.
15. Every element in the HTML in `demo/` that has `lang` or `dir` has both, its `lang` is a code `Intl.Locale` can read, and its `dir` is the direction `Intl.Locale` gives for that language. Comments do not count.
16. No script in `demo/` types a direction: `ltr` or `rtl` in a string fails, in any letter case, and a script that sets `dir` must call `new Intl.Locale`. Comments do not count.
17. Every language in `demo/copy.json` has every string English has, not empty, and every item of each list. Each missing string prints on its own line, with the English beside it.
18. No CSS in the repository names a side, outside `node_modules` and the build folders, `dist/` and `.vite-build/`. That is every `.css` file, and the `<style>` blocks and `style` attributes in every HTML file. It fails `margin`, `padding`, `scroll-margin`, `scroll-padding` and `border` with `-left` or `-right`, the properties `left` and `right`, the four corner radii such as `border-top-left-radius`, `text-align`, `text-align-last`, `float` or `clear` set to `left` or `right`, and a `margin`, `padding` or `inset` with four values whose second and fourth differ. It also fails the `direction` property, a `[dir]` or `:dir()` selector, and a negative number in `scale` or in `scale()`, `scaleX()`, `scaleY()`, `scaleZ()` or `scale3d()`. The icon rule is the one exception: a rule whose selectors are exactly `[data-icon$="-forward"]:dir(rtl)` and `[data-icon$="-back"]:dir(rtl)`, in either order, and that sets nothing but `scale: -1 1` or `transform: scaleX(-1)`. The first such rule passes, and a second fails as a copy. Each problem prints on its own line with the file, the line and the logical property or value to use instead. Comments do not count.
19. No token's `$description` uses left or right for a side: a phrase such as "left and right", "on the right", "right-to-left" or "the left edge". Left on its own does not count, so "left out" passes. The message names the file, the line and the token.
20. Every line height in the CSS reads a token, or is `1`. It reads the same CSS as check 18. A `line-height` passes when it is `1`, `inherit`, `unset`, or exactly `var()` of a semantic or component token whose name ends in `line-height`, with no fallback. A `font` shorthand passes when it is `inherit` or `unset`, when the line height after its slash passes the same way, or, with no slash, when a `line-height` comes after it in the same rule. Each problem prints on its own line with the file, the line and the token to read instead. Comments do not count.
21. Every file in `tokens/locales/` is named for a language `Intl.DisplayNames` knows, such as `ar` or `ar-EG`, and sets only type tokens that exist, the semantics under `type`. A token that is not a type token, or a type token that does not exist, prints on its own line, with the closest type token for a misspelt one.
22. No CSS sets italics or capitals. It reads the same CSS as check 18. It fails `font-style` and the `font` shorthand with `italic` or `oblique`, `text-transform` with `uppercase` or `capitalize`, `font-variant`, `font-variant-caps` or the `font` shorthand with small caps or another capital form, such as `all-small-caps`, `petite-caps`, `unicase` or `titling-caps`, and `font-feature-settings` that turns on `smcp`, `c2sc`, `pcap`, `c2pc`, `unic` or `titl`. Each problem prints on its own line with the file and the line. Comments do not count.
23. No icon is named left or right. The names are every `data-icon` in the HTML that check 18 reads, `data-icon` set in a script in `demo/`, the value in every `[data-icon]` selector in the CSS, and the name of every `.svg` file outside `node_modules` and the build folders. A name is split into words at hyphens, other punctuation and capitals, so `arrowLeft` and `arrow_left` count. It fails a name with the word `left` or `right`, and a name with `forward` or `back` that does not end in `-forward` or `-back`, such as `forward-arrow`, since the icon rule would never turn it. Each problem prints on its own line with the file, the line and the name to use, such as `arrow-back` for `arrow-left`. Comments do not count.
24. No string in `demo/copy.json` writes a digit, in any script, such as `0` to `9` or Arabic-Indic `٠` to `٩`, in any language and any item of a list. Keys that start with `$` are notes and do not count. The demo's HTML has a price slot, an element with `data-price`, and it holds nothing but white space: no text and no element. Each problem prints on its own line: a digit with the language, the string's name and its text, and a price slot with the file, the line and what it holds. Comments do not count.
25. `demo/copy.json` holds at least one language that reads right to left, by the direction `Intl.Locale` gives for its code, with a set of strings. Keys that start with `$` are notes and do not count. The message lists each language it holds and the way it reads.

Nothing checks the rest, so keep it by hand: that `tokens/contrast-pairs.json` lists every surface or fill the demo puts each colour on, that no state word the check does not list is used, that no disabled control is faded with opacity, that primitives are named for what they are, that a component file exists only when a brand restyles that component and a semantic would not do, that pages use no raw sizes or fonts (check 1 catches only colours, and check 20 only line heights), that anything that paints a surface or a fill sets its text colour and an element with a `data-mode` paints its own surface, that a new brand starts as a copy of the template, that a brand points the button's radius at a radius, that brand names stay out of any other list, config or code, that a client renames their brand only after a conversation, that the demo's script never sets `lang` without `dir`, that words in another language keep their own `lang` and `dir`, that a translation says what the English says, that no script sets a side through an element's `style`, that nothing but a token's `$description`, such as a README, uses left or right for a side, that a locale points each type token at a primitive, that the card and every element with a `lang` read the type family, weight and line height themselves, that the page loads each locale's font in the weights the type tokens use, that every icon which points somewhere has a name ending in `-forward` or `-back` and is drawn the way it points in English, that an icon which should never turn has no forward or back in its name, that every number is formatted with `Intl.NumberFormat` for the language of the panel it sits in, with no decimals when it is whole, that the digits come from the `lang` and no script swaps them, that a price's currency symbol has a `<bdi>` of its own, that anything a user typed is in a `<bdi>`, that every phone number, email address and piece of code has an element of its own with `dir="ltr"`, that no logo flips, that every visual change was looked at in English and in Arabic before it was done, that its pull request says what was looked at in each direction, and that the demo's script shows every language in `demo/copy.json`. Code owner review, not this check, holds a client to the rest of what they may not change on their own.
