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
- `tokens/brands/`, `tokens/modes/` and `tokens/locales/` are the switches. Each holds one file per option, and each file re-points tokens that already exist. The README in each folder says which attribute picks its files.
- `scripts/build.js` writes `dist/tokens.css`, and `scripts/check.js` checks the rules. A change to how either works is its own job.

## What each layer may point at

`npm run check` enforces part of the rules from here down. The last section says exactly which parts.

1. **Primitives** (`tokens/primitives/`) hold raw values: colours, sizes, fonts. Named for what they are (`color.blue.600`), never for where they are used.
2. **Semantics** (`tokens/semantics/`) name a job (`color.fill.brand`) and point at one primitive. They never hold a raw value.
3. **Components** (`tokens/components/<component>.json`) exist only for a component a brand restyles on its own, such as pill-shaped buttons in one brand. Each points at a semantic. Today that is Button alone.
4. **Brands** (`tokens/brands/<name>.json`) re-point semantics at different primitives, and component tokens at different semantics. A brand adds no new tokens.
5. **Modes** (`tokens/modes/dark.json`) re-point colour semantics at different primitives and never touch a primitive, so `color.gray.900` is the same colour in both modes. Dark answers every colour semantic, even where it is the same as light. Light is what the semantics hold, and dark is the only mode file: the build writes a semantic whose two answers differ as `light-dark(light, dark)`, and `data-mode` sets `color-scheme`, which picks one. `:root` has `light dark`, so a page that sets no mode follows the reader's setting.

Pages and components read semantics, or their own component tokens where those exist. Never a primitive, never a raw value. Before adding a component file, check whether a new semantic would do: a role every component can use beats a token only one can.

An element with a `data-mode`, and every card, sets its own background and text colour from the semantics. A colour an element inherits was worked out on the ancestor that set it, in that ancestor's mode.

## Naming semantic colours

`color.<role>.<intent>[-<state>]`

- Roles: `surface`, `fill`, `text`, `border`.
- Intent is any name for a job, such as `default`, `subtle`, `brand`, `on-fill`, `link`, `focus`.
- A state is optional and comes last, such as `-hover` or `-subtle`.

Name the job, not the colour. `color.fill.brand`, never `color.fill.blue`.

## Brands

A brand is one file in `tokens/brands/`. The build finds it there. Never add a brand name to any script, list or config.

## What `npm run check` enforces

Each check fails with a plain message that names the file. They are numbered as in `scripts/check.js`.

1. Colour values appear only in `tokens/primitives/`. No semantic, component or brand token holds one, and no CSS file in `demo/` does.
2. Every semantic points at a primitive, and every component token at a semantic. A brand or mode token points at what the token it re-points would.
3. The CSS in `demo/` reads no primitive.
4. A brand file sets only semantic and component tokens that already exist.
5. In `dist/tokens.css`, every semantic and component token is still a `var()` reference, or `light-dark()` of two.
6. In `dist/tokens.css`, semantic and component tokens are declared on `:root` and `[data-brand]`, before the brand blocks.
7. Every semantic colour is named `color.<role>.<intent>`, with an optional `-<state>`, and its role is `surface`, `fill`, `text` or `border`. No word in the name is a ramp from `tokens/primitives/color.json`, and grey and gray count as the same word.
8. No file in `scripts/` or `.github/`, and no config file at the root, contains a brand name as a whole word, in any letter case. The brand names are the file names in `tokens/brands/`. Root config files are dotfiles and `.json`, `.js`, `.mjs`, `.cjs`, `.ts`, `.yml`, `.yaml` and `.toml` files, except `package-lock.json`.
9. A mode file sets only colour semantics that already exist. It holds no colour value and sets no primitive.
10. Every colour semantic has an answer in `tokens/modes/dark.json`.
11. `tokens/modes/` holds no mode other than dark, since `light-dark()` has only a light answer and a dark one.
12. The CSS and HTML in `demo/` read only variables that `dist/tokens.css` writes. The message suggests the closest name the demo may read.

Nothing checks the rest, so keep it by hand: that primitives are named for what they are, that a component file exists only when a brand restyles that component and a semantic would not do, that pages use no raw sizes or fonts (check 1 catches only colours), that an element with a `data-mode` and every card set their own background and text colour, and that brand names stay out of any other list or config.
