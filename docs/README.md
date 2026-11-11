<!-- Generated from templates/docs.ejs by `bun run tools readme`. Do not edit by hand. -->

# Documentation

Development documentation for the Archont561 profile repository. The profile itself is
rendered into the root `README.md`; the portfolio at
[archont561.github.io](https://archont561.github.io/) is the entry point for every project.

## Guides

| Document | Purpose |
| --- | --- |
| [Development setup](guides/development-setup.md) | How to install the toolchain, run the `bun run tools` commands, and work with the hooks, tests, and continuous integration of this repository. |

## Concepts

| Document | Purpose |
| --- | --- |
| [Rule register](concepts/rule-register.md) | Which polyglot-clean-code rules this repository enforces, which engine checks each one, and where it deviates from the presets. |

## Commands

Every command is `bun run tools <name>`, the repository's only automation entrypoint. The table lists what
`tools/index.ts` discovers in `tools/commands/`; `bun run tools <name> --help` shows the flags.

| Command | What it does |
| --- | --- |
| `agents` | Refresh the marked sections of AGENTS.md with agents-md |
| `capture` | Capture GitHub and registry facts (npm, PyPI, crates.io, NuGet, Maven Central, R-universe, prefix.dev) into data/snapshot.json |
| `check` | Run the full quality gate: lint, readme --check, links --offline, and test |
| `clients` | Regenerate the typed registry clients (Hey API for REST, gql.tada for prefix.dev GraphQL) |
| `commitlint` | Check Conventional Commit messages against .commitlintrc.json |
| `format` | Format TypeScript and JSON with Biome |
| `hooks` | Install the lefthook git hooks from lefthook.yml |
| `links` | Check every link in the README, AGENTS.md and docs with lychee (--offline: repo links and anchors only) |
| `lint` | Run Biome, tsc, ast-grep, Alint and Vale (polyglot-clean-code presets), then knip, dependency-cruiser, secretlint, actionlint and zizmor |
| `pr` | Lint the title, push the branch, and open a pull request with the rendered template (gh) |
| `readme` | Render README.md, docs/README.md, the PR template, the banner, and every badge from templates/ |
| `refresh` | Capture, render, and report drift; with --commit, commit and push it (used by refresh.yml) |
| `test` | Run bun test with coverage (fails under the 90% threshold) |

## For agents

[AGENTS.md](../AGENTS.md) holds the guidance for AI coding agents: commands, structure,
conventions, and hard-won lessons.
