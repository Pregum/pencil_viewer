# Pencil design check (`pen-audit`)

A GitHub Action that checks the `.pen` files in a pull request.

It does two things, in order of importance:

1. **Validates every `.pen` file** against the same zod schema Pencil Viewer uses to open them.
   A file that fails here would fail to open in the viewer, so this is a real defect and the
   check fails by default.
2. **Reports Five UI States coverage** for each screen it finds — whether the design covers the
   ideal, empty, loading, error and partial states. This is a heuristic based on frame names,
   so it is advisory and does not fail the check unless you ask it to.

The result is written to the job summary and posted as a single pull request comment that is
updated in place on every run.

No API keys, no external services, no language model. The check is deterministic: the same
files always produce the same report.

## Usage

```yaml
name: Design check

on:
  pull_request:
    paths: ['**/*.pen']

permissions:
  contents: read
  pull-requests: write

jobs:
  design:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Pregum/pencil_viewer/tools/pen-audit@main
```

`pull-requests: write` is what lets the action post the comment. Without it the report still
appears in the job summary, and the run does not fail.

There is no release tag yet, so pin to `@main` for now. Once a tag exists, pin to it instead.

## Inputs

| Input                 | Default               | What it does                                                                                        |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| `paths`               | `**/*.pen`            | Glob patterns, one per line. Supports `**`, `*` and `?`.                                            |
| `changed-only`        | `true`                | On a pull request, check only the files that pull request touches.                                  |
| `fail-on-parse-error` | `true`                | Fail the check when a file does not validate.                                                       |
| `min-coverage`        | _(empty)_             | Fail when any screen covers fewer than this percentage of the five states. Empty means report only. |
| `comment`             | `true`                | Post the report as a pull request comment.                                                          |
| `locale`              | `en`                  | Report language: `en`, `ja` or `zh`.                                                                |
| `working-directory`   | `.`                   | Directory to search, relative to the workspace.                                                     |
| `token`               | `${{ github.token }}` | Used to list changed files and write the comment.                                                   |

## Outputs

| Output             | What it holds                               |
| ------------------ | ------------------------------------------- |
| `invalid-count`    | Number of files that failed validation.     |
| `screen-count`     | Number of screens analysed.                 |
| `average-coverage` | Mean state coverage across all screens.     |
| `lowest-coverage`  | Lowest state coverage of any single screen. |
| `failed`           | `true` when the check failed.               |

Coverage outputs are empty strings when no screens were found.

## Enforcing state coverage

Start with the default and let the table sit in the pull request for a while. When the team is
ready to hold a line, add a threshold:

```yaml
- uses: Pregum/pencil_viewer/tools/pen-audit@main
  with:
    min-coverage: '60'
    locale: ja
```

## How screens are detected

The action reads top-level frames wider and taller than 100 units, strips a `WF:` or `Screen:`
prefix and a trailing state suffix from the frame name, and groups the remainder as one screen.
So `WF: Login`, `WF: Login - Empty` and `WF: Login - Error` count as three states of one screen.
Recognised suffixes come from `src/analysis/uiStates.ts` and cover English, Japanese and Chinese.

## Forks

A pull request from a fork gets a read-only token, so the comment cannot be written. The action
detects this, writes the report to the job summary, and carries on rather than failing.

## Development

The action source is TypeScript under `src/`, bundled into a single committed file so the
runner can execute it without installing anything.

```bash
npm run build:action     # rebuild tools/pen-audit/dist/pen-audit.mjs
npx vitest run tests/penAudit.test.ts
```

The bundle is checked into the repository because a JavaScript action runs the file it finds in
the checkout. CI rebuilds it and fails if the committed copy has drifted, so always run
`npm run build:action` after touching `src/`.

To try it without GitHub Actions:

```bash
INPUT_PATHS='public/samples/*.pen' INPUT_COMMENT=false INPUT_LOCALE=ja \
  node tools/pen-audit/dist/pen-audit.mjs
```
