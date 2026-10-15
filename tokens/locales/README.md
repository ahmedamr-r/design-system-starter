# Locales

One file per language whose type differs from the default, named by its language code, such as `ar.json`. A locale file re-points the type semantics (family, weight, size, line height) and adds no tokens of its own. A language that reads well in the default type needs no file.

The `lang` attribute picks it, on the page or on any element, so `lang="ar"` reads `ar.json`.

Direction is not set here. `dir="rtl"` moves things to the other side, and components handle that with logical properties such as `padding-inline-start`, so no token needs a left and a right version.
