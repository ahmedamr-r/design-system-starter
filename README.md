# Design system starter

A design token library built one prompt at a time with a coding agent. It goes with the series [Build a design system with a coding agent](https://ahmedamr.com/writing/why-design-system-in-code) on ahmedamr.com. Each part of the series that builds something ends at a git tag here.

## Run it

Needs Node 22 or later.

```bash
npm install
npm run build   # tokens/ → dist/tokens.css
npm run check   # the rules in AGENTS.md, checked
npm run demo    # build, then open the side-by-side demo
```

## What is inside at `part-3-tokens`

```
tokens/
  primitives/   raw values: colour ramps, sizes, fonts
  semantics/    jobs (color.fill.brand), each pointing at a primitive
  components/   button.json only: one brand restyles buttons on their own
  brands/       one file per brand, re-pointing semantics
  modes/        empty until part four
  locales/      empty until part five
scripts/
  build.js      Style Dictionary 5, keeping every reference as var()
  check.js      six checks that fail with a plain message
.github/
  workflows/
    check.yml   runs the build and the check on every pull request
demo/           the same card for Harbor, Grove, and Grove inside Harbor
prompts/        the prompt behind each commit
AGENTS.md       how to work here, and the rules for tokens
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
| Add primitive tokens | [01-primitives](prompts/3-tokens/01-primitives.md) |
| Add semantic tokens | [02-semantics](prompts/3-tokens/02-semantics.md) |
| Build CSS that keeps references | [03-references](prompts/3-tokens/03-references.md) |
| Add brands as one file each | [04-brands](prompts/3-tokens/04-brands.md) |
| Add a side-by-side demo and a check script | [05-demo-and-check](prompts/3-tokens/05-demo-and-check.md) |
| Add the token rules | [06-token-rules](prompts/3-tokens/06-token-rules.md) |
| Add a component layer for Button | [07-component-layer](prompts/3-tokens/07-component-layer.md) |

To follow along from scratch, start an empty folder and give your agent the prompts in order. In your own repository each prompt would be its own branch and pull request. Here each one is a single commit, so you can compare your agent's work with mine.

## Add a brand

Copy `tokens/brands/harbor.json` to `tokens/brands/<name>.json`, re-point its tokens, then run `npm run build && npm run check`. Use it with `data-brand="<name>"` on any element.

## License

MIT
