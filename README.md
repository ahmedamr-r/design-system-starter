# Design system starter

A design token library built one prompt at a time with a coding agent. It goes with the series [Build a design system with a coding agent](https://ahmedamr.com/writing/why-design-system-in-code) on ahmedamr.com. Each part of the series that builds something ends at a git tag here.

## Run it

Needs Node 22 or later.

```bash
npm install
npm run build   # tokens/ → dist/tokens.css
npm run check   # the rules in AGENTS.md, checked
```

## What is inside at `part-2-setup`

```
tokens/
  primitives/   empty: raw values, named for what they are
  semantics/    empty: jobs, each pointing at a primitive
  components/   empty until a brand restyles one component on its own
  brands/       empty: one file per brand, picked with data-brand
  modes/        empty: one file per mode, picked with data-mode
  locales/      empty: one file per language, picked with lang
scripts/
  build.js      token files in, CSS variables out
  check.js      no checks yet
.github/
  workflows/
    check.yml   runs the build and the check on every pull request
prompts/        the prompt behind each commit
AGENTS.md       how to work here, for people and agents
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

To follow along from scratch, start an empty folder and give your agent the prompts in order. In your own repository each prompt would be its own branch and pull request. Here each one is a single commit, so you can compare your agent's work with mine.

## License

MIT
