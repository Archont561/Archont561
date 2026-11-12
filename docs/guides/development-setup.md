# Development setup

How to install the toolchain, run the `bun run tools` commands, and work with the hooks, tests,
and continuous integration of this repository.

## Install

[Pixi](https://pixi.sh) is the only prerequisite. `pixi.toml` and `pixi.lock` pin the
toolchain from conda-forge: Bun (the same version as `package.json` `packageManager`),
actionlint, zizmor, and lychee.

```sh
pixi install --locked
pixi shell
bun install --frozen-lockfile
```

`pixi.toml` has no tasks; automation stays behind `bun run tools <cmd>`. Outside `pixi shell`
the tools still find actionlint, zizmor, and lychee in `.pixi/envs/default`, so git hooks
work from any terminal once `pixi install` has run.

`bun install` runs the trusted postinstall scripts: Alint, Vale, and ast-grep download their
binaries (Alint verifies a SHA-256 checksum), and lefthook installs the git hooks. Lefthook
skips that step on CI; `bun run tools hooks` reinstalls them by hand.

## Tools

`bun run tools <cmd>` is a citty CLI and the only automation entry point. `tools/index.ts`
holds `runMain` and discovers every `tools/commands/*.ts` whose default export is
`defineCommand(...)`. Run `bun run tools --help` for the live list.

`package.json` has exactly one script, `"tools": "bun tools/index.ts"`: no per-command aliases
and no lifecycle scripts. Alint enforces this (`tools-single-script`), so new automation is
always a command, never a script, and docs, hooks, and workflows all spell it
`bun run tools <cmd>`.

```text
tools/
├── index.ts     runMain, command discovery
├── commands/    one thin citty command per file
├── lib/         all logic: capture, render, quality, the CLI plumbing
└── tests/       bun-test-utils suites mirroring commands/ and lib/
```

The [command table](../README.md#commands) in the docs index is generated from the commands
themselves.

## Maintenance checks

`bun run tools lint` runs five maintenance checks after the clean-code linters:

| Tool | Config | Catches |
| --- | --- | --- |
| knip | `knip.json` | Unused files, exports, types, and dependencies |
| dependency-cruiser | `.dependency-cruiser.json` | Import cycles, orphans, and layering breaks between `tools/lib`, `tools/commands`, `tools/tests`, and the generated clients |
| secretlint | `.secretlintrc.json` | Tokens and keys committed by mistake |
| actionlint | none | Workflow syntax, expressions, and runner labels |
| zizmor | none | Workflow security: template injection, credential persistence, unpinned actions |

`bun run tools links` runs lychee (`lychee.toml`) over the README, `AGENTS.md`, and `docs/`.
Links to this repository's own files and workflow badges are remapped to the working tree,
so `bun run tools links --offline` checks them and every anchor without the network. That
offline pass is part of `bun run tools check`; the full pass runs daily in `refresh.yml`.

actionlint, zizmor, and lychee ship no npm package, so Pixi installs them from conda-forge
(`tools/lib/toolchain.ts` resolves them). Renovate (`renovate.json`) proposes updates
for `bun.lock`, `pixi.lock` and the pinned actions once a release is seven days old. To
bump a Pixi pin by hand, edit `pixi.toml`, run `pixi update`, and commit both files.
Renovate leaves `packageManager` alone because conda-forge publishes Bun a little behind
upstream: when a Pixi tools PR moves Bun, set `packageManager` to the same version in that
PR, or the toolchain test fails.

The Renovate GitHub app must be installed on the repository for any of this to run.

## Adding a command

Create `tools/commands/<name>.ts` with `export default defineCommand({ ... })`. It becomes
`bun run tools <name>` with no registration step and no `package.json` entry. Keep the command thin: logic lives in `tools/lib/`. Add
`tools/tests/commands/<name>.test.ts` as a `test.scenario.prop` scenario built on
`tools/tests/fixtures.ts`, then run `bun run tools readme` so the command table in
`docs/README.md` picks it up.

## Imports

`tsconfig.json` maps `@/*` to the repository root, so modules import
`@/tools/lib/log.ts` instead of climbing directories. Biome's `noRestrictedImports` rejects
`../` imports; only `@/…` and same-directory `./…` imports pass.

## Registry clients

`capture` calls typed clients instead of hand-written requests. `bun run tools clients`
regenerates them, and the output is committed:

| Source | Generator | Description |
| --- | --- | --- |
| GitHub | Hey API | Official OpenAPI description, pinned to a commit |
| crates.io | Hey API | OpenAPI 3.1 description served by crates.io |
| npm, PyPI, NuGet, Maven Central, R-universe | Hey API | Local subset specs in `tools/lib/capture/specs/`; none of these registries publishes one |
| prefix.dev | gql.tada | Introspected GraphQL schema; queries are checked by `tsc` |

R-universe reads its registered names from the `packages.json` in the
`Archont561/archont561.r-universe.dev` repository through the GitHub client, and versions
from the universe once a package is built; until then the name counts as reserved.

`tools/lib/capture/http.ts` is the only hand-written HTTP code: a `fetch` with retries
that every client shares. Hey API needs the TypeScript 5–6 compiler API, so the repository
pins TypeScript 6.

## Tests

`bun run tools test` runs `bun test` over `tools/tests/` with
[`@archont561/bun-test-utils`](https://archont561.github.io/bun-test-utils/). Command
behaviour is specified as `test.scenario.prop` scenarios: fast-check generates the inputs
(registry contents, flags, exit codes) and each scenario runs against 25 of them. Set
`FC_NUM_RUNS=500` to explore more. `tools/tests/fixtures.ts` composes the project fixtures:

| Fixture | Provides |
| --- | --- |
| `registry` | A generated registry world served through `httpMock` behind `networkGuard` |
| `repo` | A temporary repository root with the files capture and render read |
| `proc` | Spies on `runner.exec` and `runner.capture`; nothing is spawned |
| `logs` | Recorded log output |
| `exitCode` | Restores `process.exitCode` |

## Hooks

| Hook | Runs |
| --- | --- |
| pre-commit | `bun run tools lint` and `bun run tools readme --check` |
| commit-msg | `bun run tools commitlint --edit` |
| pre-push | `bun run tools check` |

## Pull requests

Open them from a topic branch with `bun run tools pr`. It lints the title with commitlint (the
title becomes the squash commit), pushes the branch, which runs the pre-push `check`, and calls
`gh pr create` with the rendered template as the body: `--summary` fills "What and why" and the
branch's commit subjects are appended. A single-commit branch reuses its subject as the title;
otherwise pass `--title`. `--dry-run` prints the commands and the body without running them.

The template itself is `.github/PULL_REQUEST_TEMPLATE.md`, rendered from `templates/pr.ejs` by
`bun run tools readme`. The commit types come from `.commitlintrc.json` and the coverage floor
from `codecov.yml`. The title itself is linted again by `pull-request.yml` whenever a pull
request is opened, retitled, or pushed to, because it becomes the squash commit; Alint keeps
that step and its `edited` trigger from being removed. Alint also requires the generated header and rejects pull request templates in
any other location GitHub reads.

## Continuous integration

Workflow `run` steps are single lines that call `bun run tools <cmd>` (PCC-R02), and every
action is pinned to a full commit SHA (PCC-R05).

| Workflow | Trigger | Runs |
| --- | --- | --- |
| `ci.yml` | push, pull request | `lint`, `readme --check`, `test` with a Codecov upload over OIDC |
| `pull-request.yml` | pull request | `commitlint` over the commit range and the title |
| `refresh.yml` | daily, manual | `refresh --commit` |

`refresh.yml` captures package registries and portfolio design tokens (`tokens.css`), regenerating badges and cards so they stay in sync with the portfolio palette.

Codecov enforces 90% for the project and for each patch (`codecov.yml`); `bunfig.toml` applies
the same floor locally.
