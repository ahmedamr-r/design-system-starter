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

`npm run check` enforces everything from here down.

1. **Primitives** (`tokens/primitives/`) hold raw values: colours, sizes, fonts. Named for what they are (`color.blue.600`), never for where they are used.
2. **Semantics** (`tokens/semantics/`) name a job (`color.fill.brand`) and point at one primitive. They never hold a raw value.
3. **Components** (`tokens/components/<component>.json`) exist only for a component a brand restyles on its own, such as pill-shaped buttons in one brand. Each points at a semantic. Today that is Button alone.
4. **Brands** (`tokens/brands/<name>.json`) re-point semantics at different primitives, and component tokens at different semantics. A brand adds no new tokens.

Pages and components read semantics, or their own component tokens where those exist. Never a primitive, never a raw value. Before adding a component file, check whether a new semantic would do: a role every component can use beats a token only one can.

## Naming semantic colours

`color.<role>.<intent>[-<state>]`

- Roles: `surface`, `fill`, `text`, `border`.
- Intent says what it is for: `default`, `subtle`, `brand`, `on-fill`, `link`, `focus`.
- States come last: `-hover`, `-subtle`.

Name the job, not the colour. `color.fill.brand`, never `color.fill.blue`.

## Brands

A brand is one file in `tokens/brands/`. The build finds it there. Never add a brand name to any script, list or config.
