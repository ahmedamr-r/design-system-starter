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
