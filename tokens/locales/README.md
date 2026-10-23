# Locales

One file per language whose type differs from the default, named by its language code, such as `ar.json`. The name must be a language `Intl.DisplayNames` knows, such as `ar` or `ar-EG`. A locale file re-points type semantics that already exist, the tokens under `type` (family, weights, sizes, line heights), and nothing else: no colour, no shape and no tokens of its own. A language that reads well in the default type needs no file.

`ar.json` is the first. It points `type.family` at `font.family.arabic`, IBM Plex Sans Arabic with the system face after it, and `type.body.line-height` at `font.line-height.170`, 1.7, for the dots and marks above and below Arabic letters.

The `lang` attribute picks it, on the page or on any element. The build writes each file as a `:lang(<code>)` block after the brands, and `:lang(ar)` matches any language that is `ar` or starts with `ar-`, so `lang="ar"` and `lang="ar-EG"` both read `ar.json`. The type tokens are declared on every element with a `lang` too, so an English label inside an Arabic panel gets the default type back. An element that sets `lang` reads the type family, weight and line height itself, since a font it inherits was worked out in its ancestor's language.

The page loads the font. The demo imports only the Arabic letters of `@fontsource/ibm-plex-sans-arabic`, in the three weights the type tokens use, so Latin letters and digits keep the system face.

Arabic has no capitals, and IBM Plex Sans Arabic has no italic, so no CSS sets italics or capitals. Emphasis uses weight.

Direction is not set here. `dir="rtl"` moves things to the other side, and components handle that with logical properties such as `padding-inline-start`, so no token needs a left and a right version.

`npm run check` holds these files to the rules: check 21 for the name and what a file sets, check 6 for the `:lang()` blocks and `[lang]`, and check 22 for italics and capitals. The rules are under Type and language in `AGENTS.md`.
