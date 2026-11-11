[![Archont561 — Geospatial tooling, made boring on purpose: locked environments, tested harnesses, agent-readable docs, and the repo management that keeps them honest.](assets/banner.svg)](https://archont561.github.io/)

<div align="center">

[![Portfolio: start here](assets/badges/nav-portfolio.svg)](https://archont561.github.io/)
[![Field notes](assets/badges/nav-docs.svg)](https://archont561.github.io/docs/)
[![Packages: 23 published](assets/badges/nav-packages.svg)](https://archont561.github.io/packages/)
[![GitHub: 23 repositories](assets/badges/nav-github.svg)](https://github.com/Archont561?tab=repositories)
[![llms.txt: agent-readable index](assets/badges/nav-llms.svg)](https://archont561.github.io/llms.txt)

</div>

## `> ls --principles`

- **lock** — same lockfile, same result (Pixi + Conda lockfiles, SHA-pinned actions)
- **test** — test behaviour, not lines (Gherkin specs, property tests, a 90% floor)
- **document** — docs ship with the code (llms.txt and .md routes for agents)
- **ship** — small commits, green gate first (conventional commits, no force-push)
- **enforce** — if a machine can check it, it does (ast-grep, Alint, Vale, commitlint)


I build open-source tools that make geospatial and scientific software reproducible,
and I care most about the unglamorous part: the lockfile, the test harness, the CI gate,
the review comment. Everything here is a public fact about the code — this profile
publishes no name, location, employer, availability, or proficiency score.

```toml
# pixi.toml — reproducible environment definition
[workspace]
name = "archont561"
channels = ["conda-forge", "archont561"]

[package]
role = "Student · open-source contributor"
focus = ["Geospatial systems", "Reproducible environments", "Testing infrastructure", "Repo management"]
principle = "Lock it, test it, document it, then ship it."
review-style = "Reproducible or it did not happen."
```

## `> ls --infrastructure` — shipped and maintained

Each card opens the project's page in the [portfolio](https://archont561.github.io/); the last one
lists every repository. Stack and registry chips come from the captured snapshot.

<p align="center">
  <a href="https://archont561.github.io/docs/projects/qgis-sdk/"><img src="assets/cards/qgis-sdk.svg" width="49%" alt="qgis-sdk: Python-first SDK and TypeScript bridge for typed, testable QGIS 4 plugins."></a>
  <a href="https://archont561.github.io/docs/projects/qgis-agent-harness/"><img src="assets/cards/qgis-agent-harness.svg" width="49%" alt="qgis-agent-harness: Harness for evaluating GIS-agent artefacts with a shared QGIS runtime and oracle."></a>
</p>

<p align="center">
  <sub><code>qgis-sdk</code>: <a href="https://github.com/Archont561/qgis-sdk">repo</a> · <a href="https://archont561.github.io/docs/projects/qgis-sdk/">docs</a> &nbsp;|&nbsp; <code>qgis-agent-harness</code>: <a href="https://github.com/Archont561/qgis-agent-harness">repo</a> · <a href="https://archont561.github.io/docs/projects/qgis-agent-harness/">docs</a></sub>
</p>

<p align="center">
  <a href="https://archont561.github.io/docs/projects/pixi-sandbox/"><img src="assets/cards/pixi-sandbox.svg" width="49%" alt="pixi-sandbox: Cloneable, verifiable environment packs for Pixi projects."></a>
  <a href="https://archont561.github.io/docs/projects/bun-test-utils/"><img src="assets/cards/bun-test-utils.svg" width="49%" alt="bun-test-utils: Typed fixtures and test extensions for the Bun test runner."></a>
</p>

<p align="center">
  <sub><code>pixi-sandbox</code>: <a href="https://github.com/Archont561/pixi-sandbox">repo</a> · <a href="https://archont561.github.io/docs/projects/pixi-sandbox/">docs</a> &nbsp;|&nbsp; <code>bun-test-utils</code>: <a href="https://github.com/Archont561/bun-test-utils">repo</a> · <a href="https://archont561.github.io/docs/projects/bun-test-utils/">docs</a></sub>
</p>

<p align="center">
  <a href="https://archont561.github.io/docs/projects/playtest/"><img src="assets/cards/playtest.svg" width="49%" alt="playtest: Playwright-style testing for Rust."></a>
  <a href="https://archont561.github.io/docs/"><img src="assets/cards/all-projects.svg" width="49%" alt="Every project: Field notes, architecture and install guides for all 23 repositories, plus search and llms.txt."></a>
</p>

<p align="center">
  <sub><code>playtest</code>: <a href="https://github.com/Archont561/playtest">repo</a> · <a href="https://archont561.github.io/docs/projects/playtest/">docs</a> &nbsp;|&nbsp; <code>all-projects</code>: <a href="https://github.com/Archont561/archont561.github.io">repo</a> · <a href="https://archont561.github.io/docs/">docs</a></sub>
</p>

## `> cat contribution.log`

```diff
+ [ACTIVE] 🗺️ Packaging: cross-platform Conda recipes for geospatial pipelines.
+ [ACTIVE] 🧪 Testing: typed fixtures and BDD harnesses for Bun and pytest.
+ [ACTIVE] 📚 Docs: agent-readable exports (llms.txt and `.md` routes) on the portfolio.
+ [OPEN] 📦 Upstreaming: geospatial recipes toward conda-forge, one PR at a time.
+ [OPEN] 🧹 Hygiene: keep every repository titled, licensed, and CI-gated.
- [DONE] 📐 Split repository-scoped detail out of this profile README.
   [WONT] Résumé claims, availability statements, or animated stat widgets.
```

| Ecosystem | Namespace | Released |
| :--- | :--- | :---: |
| **npm** | `@archont561` | 4 |
| **PyPI** | `Archont561` | 5 |
| **crates.io** | `Archont561` | 2 |
| **Conda** | `archont561/archont561` | 12 |


## `> man archont561` — FAQ

<details name="faq">
<summary><b>📚 Which other projects are there?</b></summary>

Every project, with its source repository; each name opens its page in the portfolio.

| Project | What it is | Source |
| --- | --- | --- |
| [qgis-sdk](https://archont561.github.io/docs/projects/qgis-sdk/) | Python-first SDK and TypeScript bridge for typed, testable QGIS 4 plugins. | [GitHub](https://github.com/Archont561/qgis-sdk) |
| [qgis-agent-harness](https://archont561.github.io/docs/projects/qgis-agent-harness/) | Harness for evaluating GIS-agent artefacts with a shared QGIS runtime and oracle. | [GitHub](https://github.com/Archont561/qgis-agent-harness) |
| [pixi-sandbox](https://archont561.github.io/docs/projects/pixi-sandbox/) | Cloneable, verifiable environment packs for Pixi projects. | [GitHub](https://github.com/Archont561/pixi-sandbox) |
| [bun-test-utils](https://archont561.github.io/docs/projects/bun-test-utils/) | Typed fixtures and test extensions for the Bun test runner. | [GitHub](https://github.com/Archont561/bun-test-utils) |
| [playtest](https://archont561.github.io/docs/projects/playtest/) | Playwright-style testing for Rust. | [GitHub](https://github.com/Archont561/playtest) |
| [universe](https://archont561.github.io/docs/projects/universe/) | Rust toolkit for self-hosted universes of software, data, models, and skills. | [GitHub](https://github.com/Archont561/universe) |
| [PyShellForge](https://archont561.github.io/docs/projects/pyshellforge/) | Python DSL and AST-based compiler that emits clean, readable shell scripts. | [GitHub](https://github.com/Archont561/PyShellForge) |
| [ODM-conda](https://archont561.github.io/docs/projects/odm-conda/) | Modular, Pixi-managed conda packaging for OpenDroneMap components. | [GitHub](https://github.com/Archont561/ODM-conda) |
| [CloudCompare-conda](https://archont561.github.io/docs/projects/cloudcompare-conda/) | Cross-platform Conda packaging for point-cloud and mesh processing. | [GitHub](https://github.com/Archont561/CloudCompare-conda) |

</details>

<details name="faq">
<summary><b>📦 Where are the packages published?</b></summary>

Packages are discovered from each account rather than listed by hand: the npm org, the
PyPI and crates.io users, the NuGet owner, the Maven Central namespace, the R-universe
registry, and the prefix.dev channels. Reserved names are counted apart from releases, and
a `0.0.0` stub or a registered but unbuilt package is never presented as a published package.

<!-- registry:start -->
```text
npm            @archont561             published 4   (reserved names: 5)
PyPI           Archont561              published 5   (reserved names: 4)
crates.io      Archont561              published 2   (reserved names: 6)
NuGet          Archont561              published 0   (reserved names: 1)
Maven Central  io.github.archont561    published 0   (reserved names: 1)
R-universe     archont561              published 0   (reserved names: 1)
Conda          archont561/archont561   packages 12
Conda          archont561/geospatial   packages 0
latest         universe 0.1.0 · Conda · 2026-11-11
source         npm, PyPI, crates.io, NuGet, Maven Central, R-universe, and prefix.dev APIs, captured 2026-11-11
```
<!-- registry:end -->

[![npm @archont561: 4 published](assets/badges/registry-npm.svg)](https://www.npmjs.com/org/archont561)
[![PyPI Archont561: 5 published](assets/badges/registry-pypi.svg)](https://pypi.org/user/Archont561/)
[![crates.io Archont561: 2 published](assets/badges/registry-crates.svg)](https://crates.io/users/Archont561)
[![NuGet Archont561: 1 reserved](assets/badges/registry-nuget.svg)](https://www.nuget.org/profiles/Archont561)
[![Maven Central io.github.archont561: 1 reserved](assets/badges/registry-maven.svg)](https://central.sonatype.com/namespace/io.github.archont561)
[![R-universe archont561: 1 reserved](assets/badges/registry-r-universe.svg)](https://github.com/Archont561/archont561.r-universe.dev)
[![Conda archont561/archont561: 12 packages](assets/badges/registry-conda-archont561.svg)](https://prefix.dev/channels/@archont561/archont561)
[![Conda archont561/geospatial: open channel](assets/badges/registry-conda-geospatial.svg)](https://prefix.dev/channels/@archont561/geospatial)

Conda channels install from `https://prefix.dev/archont561/archont561` and `https://prefix.dev/archont561/geospatial`.

The [packages page](https://archont561.github.io/packages/) of the portfolio goes deeper:
versions, licences, platforms, and install commands.

</details>

<details name="faq">
<summary><b>🧭 What does “maintained” mean here?</b></summary>

Counts are captured from the GitHub REST API by `bun run tools capture`, so they are refreshed
rather than hand-tuned. No badge service is involved.

<!-- repo-hygiene:start -->
```text
public repositories   23  (authored: 23, forks: 0, archived: 2)
topic metadata        20/23 repositories
primary languages     Python 14 · Rust 3 · TypeScript 2 · Astro 1
source                GitHub REST, captured 2026-11-11
```
<!-- repo-hygiene:end -->

Archived repositories stay visible on purpose: retiring work cleanly is part of
maintaining it.

</details>

<details name="faq">
<summary><b>🧰 Which toolchain is behind all this?</b></summary>

- 🔒 **Reproducibility** — Pixi and Conda lockfiles · conda-forge style recipes · SHA-pinned GitHub Actions
- 🧪 **Testing** — pytest-bdd and Gherkin specs in every repository · typed Bun test extensions
- 🗺️ **Geospatial** — QGIS runtime and SDK tooling · point-cloud and ODM packaging
- 🧭 **Repo management** — dependency automation, link and structure gates, deliberate archives
- 📝 **Docs as code** — Fumadocs with `llms.txt` and parallel `.md` routes for agents
- 🤝 **Contribution** — issue-first, changelog-per-release, no push without a green gate

</details>

<details name="faq">
<summary><b>🩺 How healthy is this profile repo?</b></summary>

[![CI](https://github.com/Archont561/Archont561/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Archont561/Archont561/actions/workflows/ci.yml)
[![Codecov coverage](https://codecov.io/gh/Archont561/Archont561/graph/badge.svg)](https://codecov.io/gh/Archont561/Archont561)
[![Profile refresh](https://github.com/Archont561/Archont561/actions/workflows/refresh.yml/badge.svg?branch=main)](https://github.com/Archont561/Archont561/actions/workflows/refresh.yml)

[![Coverage gate: at least 90%](assets/badges/health-coverage.svg)](https://github.com/Archont561/Archont561/blob/main/codecov.yml)
[![polyglot-clean-code v0.1.0 presets](assets/badges/health-clean-code.svg)](https://github.com/Archont561/Archont561/blob/main/docs/concepts/rule-register.md)
[![Linted and formatted with Biome](assets/badges/health-biome.svg)](https://github.com/Archont561/Archont561/blob/main/biome.json)
[![Conventional Commits enforced by commitlint](assets/badges/health-commits.svg)](https://github.com/Archont561/Archont561/blob/main/.commitlintrc.json)
[![Git hooks by lefthook](assets/badges/health-hooks.svg)](https://github.com/Archont561/Archont561/blob/main/lefthook.yml)
[![Bun 1.4.2](assets/badges/health-bun.svg)](https://github.com/Archont561/Archont561/blob/main/package.json)
[![MIT license](assets/badges/health-license.svg)](https://github.com/Archont561/Archont561/blob/main/LICENSE)

Every check runs through `bun run tools <cmd>` (citty commands discovered from `tools/commands/`), so
lefthook, CI, and a local shell run the same code:

```text
lint        Biome · tsc · ast-grep · Alint · Vale    polyglot-clean-code v0.1.0 pedantic presets
            knip · dependency-cruiser · secretlint   unused code, import layering, leaked secrets
            actionlint · zizmor                      valid, injection-free workflows
links       lychee                                   repo links and anchors on every push; every link daily
test        bun-test-utils scenarios                 fails under 90% lines or functions; Codecov gates PRs
readme      --check                                  README.md and assets/ must match their sources
commitlint  Conventional Commits                     commit-msg hook, every pull request and its title
refresh     daily at 04:17 UTC                       captures registries and commits only on drift
```

Bun, actionlint, zizmor and lychee come from `pixi.lock`; everything else from `bun.lock`.

</details>

<details name="faq">
<summary><b>🛠️ How is this README made?</b></summary>

The terminal framing borrows from a free GitSkins community template by
[@Avijit010325](https://github.com/Avijit010325)
([community templates](https://www.gitskins.com/community-templates)); all text, links,
and claims were rewritten to public repository facts. The portal, project and principles cards are hand-drawn
animated SVGs, the footer banner is [figlet](https://www.npmjs.com/package/figlet) art, and
the badges are rendered offline by [badge-maker](https://www.npmjs.com/package/badge-maker);
all of them are committed under `assets/`, so only the three live status badges call a service.
GitHub serves them as images, which cannot react to hover or know they scrolled into view,
so the spotlight tours the project cards on its own and the terminal replays its command.
`bun run tools capture` records live GitHub and registry facts in `data/snapshot.json` through
clients generated from each registry's OpenAPI or GraphQL schema, and
`bun run tools readme` renders `templates/profile.ejs` with them and `data/profile.json`.
Edit those, never this file. The portfolio itself lives in
[Archont561/archont561.github.io](https://github.com/Archont561/archont561.github.io).

</details>

<details name="faq">
<summary><b>📮 How do I get in touch?</b></summary>

No contact channel is published here. The entry point for every project is an issue in
its repository, and contributions that arrive with a failing test and a lockfile update
are the kind most likely to be merged quickly.

</details>

---

<div align="center">

[![Portfolio: archont561.github.io](assets/badges/connect-portfolio.svg)](https://archont561.github.io/)
[![Package directory](assets/badges/connect-packages.svg)](https://archont561.github.io/packages/)
[![GitHub: Archont561](assets/badges/connect-github.svg)](https://github.com/Archont561)
[![Contact: open an issue in the project repository](assets/badges/connect-issues.svg)](https://github.com/Archont561?tab=repositories)

</div>
