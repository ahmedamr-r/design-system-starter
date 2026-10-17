# Design system starter

A design token library built one prompt at a time with a coding agent. It goes with the series [Build a design system with a coding agent](https://ahmedamr.com/writing/why-design-system-in-code) on ahmedamr.com. Each part of the series that builds something ends at a git tag here.

## Run it

Needs Node 24 or later.

```bash
npm install
npm run build   # tokens/ → dist/tokens.css
npm run check   # the rules in AGENTS.md, checked
npm run demo    # build, then open the side-by-side demo
```

The demo needs `npm run demo`, which builds the tokens and serves the page. Opened straight from the folder, it cannot read the list of brands it builds its panels from. It also needs a browser from 2024 or later, since dark mode is written with `light-dark()`.

## What is inside at `part-4-modes`

```
tokens/
  primitives/   raw values: colour ramps, sizes, fonts
  semantics/    jobs (color.fill.brand), each pointing at a primitive or a step
                of the brand ramp, which is gray until a brand picks a hue
  components/   button.json only: one brand restyles buttons on their own
  brands/       one file per brand, pointing the brand ramp at one hue, and
                _template.json, which every new brand is copied from
  modes/        dark.json, the dark answer for every colour semantic
  locales/      empty until part five
  contrast-pairs.json  each text and focus colour, where it sits, its ratio
scripts/
  build.js      Style Dictionary 5, keeping every reference as var() or
                light-dark(), and writing the list of brands
  check.js      fourteen checks that fail with a plain message
  lib/
    resolve.js  works out the colour a token comes to, for the contrast check
.github/
  CODEOWNERS    the owner reviews any change outside the brand files
  workflows/
    check.yml   runs the build and the check on every pull request
demo/           the same card for no brand and for each brand, in light and
                dark, and inside one another
prompts/        the prompt behind each step
AGENTS.md       how to work here, and the rules for tokens, modes and brands
```

## One prompt, one commit

### Part two, set up the repository and its switches

| Commit | Prompt |
| --- | --- |
| Scaffold the token repo | [01-scaffold](prompts/2-setup/01-scaffold.md) |
| Add the switch folders | [02-switch-folders](prompts/2-setup/02-switch-folders.md) |
| No commit, it creates the GitHub repository and pushes | [03-create-and-push](prompts/2-setup/03-create-and-push.md) |
| Check every pull request | [04-check-workflow](prompts/2-setup/04-check-workflow.md) |
| Write the first rules | [05-first-rules](prompts/2-setup/05-first-rules.md) |

### Part three, design tokens in layers

| Commit | Prompt |
| --- | --- |
| No commit, it only reads a product's styles | [00-inventory](prompts/3-tokens/00-inventory.md) |
| Add primitive tokens | [01-primitives](prompts/3-tokens/01-primitives.md) |
| Add semantic tokens | [02-semantics](prompts/3-tokens/02-semantics.md) |
| Build CSS that keeps references | [03-references](prompts/3-tokens/03-references.md) |
| Add brands as one file each | [04-brands](prompts/3-tokens/04-brands.md) |
| Add a side-by-side demo and a check script | [05-demo-and-check](prompts/3-tokens/05-demo-and-check.md) |
| Add the token rules | [06-token-rules](prompts/3-tokens/06-token-rules.md) |
| Add a component layer for Button | [07-component-layer](prompts/3-tokens/07-component-layer.md) |
| Check the naming pattern and brand names | [08-check-names](prompts/3-tokens/08-check-names.md) |

### Part four, modes and brands

| Commit | Prompt |
| --- | --- |
| Add dark mode as one file | [01-dark-mode](prompts/4-modes/01-dark-mode.md) |
| Check contrast for every brand and mode | [02-contrast-check](prompts/4-modes/02-contrast-check.md) |
| Give each brand a ramp | [03-brand-ramp](prompts/4-modes/03-brand-ramp.md) |
| Add a brand template | [04-brand-template](prompts/4-modes/04-brand-template.md) |
| Generate the list of brands | [05-brand-list](prompts/4-modes/05-brand-list.md) |
| Add Sun from the template | [06-new-client](prompts/4-modes/06-new-client.md) |
| Add the rules for modes and brands | [07-mode-and-brand-rules](prompts/4-modes/07-mode-and-brand-rules.md) |
| Make the owner review what a client may not change | [08-code-owners](prompts/4-modes/08-code-owners.md) |

To follow along from scratch, start an empty folder and give your agent the prompts in order. In your own repository each prompt would be its own branch and pull request. Here each one is a single commit, so you can compare your agent's work with mine.

## Add a brand

Every brand starts as a copy of `tokens/brands/_template.json`. The template lists every token a brand may set, today the ten steps of the brand ramp and the button's radius, each at its value with no brand and with a note on what it paints in light and in dark.

1. Copy it to `tokens/brands/<name>.json`. The file name is the brand's `data-brand` value, and a name that starts with an underscore is not a brand.
2. Point the ten steps, `color.brand.50` to `color.brand.900`, at the same steps of one primitive ramp, such as `color.blue.50` to `color.blue.900`. Every brand colour follows, in light and in dark.
3. Keep, change or delete the button's radius, such as `{radius.pill}` for pill-shaped buttons.
4. Run `npm run build && npm run check`. The check fails a brand that leaves out a step, mixes ramps, sets anything the template does not list, or falls short of a contrast ratio.

Use it with `data-brand="<name>"` on any element. The demo shows it from the next build, with no other change. A colour no primitive ramp holds, or a token the template does not list, is added for every brand first. AGENTS.md lists both among the changes a client talks through before making.

## License

MIT
