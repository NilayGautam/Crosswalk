# Tech

## Guiding choices

- Crosswalk is its own project.
  Its stack was chosen to match the one I already know from nilaygautam.com, and it depends on nothing in that site.
- v1 runs entirely on one laptop, started with one command, with nothing to install beyond Node and the CLI.
- Favor quality, simplicity, robustness, and long term maintainability over development speed.
- Nothing runs 24/7.
  Every server-side workload scales to zero.
- Each side uses the language its ecosystem is best at: TypeScript for the web, Python for the CLI and the data work.
- Prefer tested recipes to generated code, and deterministic code to AI calls.

## System overview

```
 Browser                       Crosswalk server                 User's machine
 ---------------------         ----------------------           ---------------------------
 Canvas  <-- one Plan -->      Plan store                       crosswalk CLI
 Chat                          AI planning and suggestions      - reads headers and profiles
                               Script compiler                  - applies the privacy marks
                               Audit reports                    - runs scripts in its own Python
        <--- schema cards, plan, script, status, audits --->    - holds the user's AI key
                                                                - holds the pseudonym key
```

There are three parts.

1. **Web app.**
   The canvas, the chat, accounts, and saved projects.
2. **Server.**
   Stores plans, talks to the AI models that help build a plan, and compiles a confirmed plan into a script.
3. **CLI.**
   Runs on the user's machine, in the folder with the datasets.
   It reads the files, applies the privacy marks, and runs the scripts.
   Nothing reaches the server or an AI model without passing through it.

## Stack

| Layer                 | Choice                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Web language          | TypeScript (strict)                                                                                    |
| Web framework         | Next.js (App Router, React 19), built as a static export                                               |
| Canvas                | React Flow (`@xyflow/react`)                                                                           |
| Client state          | React Flow for the canvas in v1. Zustand holds the Plan from Phase 4.                                  |
| Styling               | Tailwind CSS v4, with Crosswalk's own design tokens                                                    |
| API                   | Hono on Node, serving the API and the static web build from one process                                |
| Validation            | Zod, with the Plan schema exported as JSON Schema for the CLI                                          |
| Database              | Postgres with Drizzle: embedded PGlite on a laptop, hosted Postgres later                              |
| Auth                  | Better Auth: email and password, Google sign-in, and the device authorization flow for linking the CLI |
| Live updates          | Server-sent events from the Hono server to an open canvas                                              |
| Planning models       | Claude, through the Anthropic API                                                                      |
| CLI language          | Python 3.12 or newer                                                                                   |
| CLI distribution      | `uv`, installed by a one-line installer                                                                |
| Data runtime          | Polars and DuckDB, with pandas where a format reader needs it                                          |
| File formats          | CSV, TSV, XLSX, XLS, Parquet, Stata `.dta`                                                             |
| Name matching         | RapidFuzz for candidate retrieval                                                                      |
| Statistics and charts | statsmodels, pyfixest, matplotlib                                                                      |
| Package manager       | pnpm for the web, uv for Python                                                                        |
| Lint and format       | Biome for TypeScript, Ruff for Python                                                                  |
| Unit tests            | Vitest for TypeScript, pytest for Python                                                               |
| E2E tests             | Playwright for the web, and a full CLI run against synthetic data                                      |
| Hosting               | None in v1. Decided in the deployment phase.                                                           |
| CI/CD                 | GitHub Actions                                                                                         |

### Database

- The schema and queries are written once, for Postgres, with Drizzle.
- On a laptop the database is PGlite, which is Postgres running inside the server process and storing its files in a local folder.
  There is no Docker and no database to install.
- When Crosswalk is deployed, the same schema and migrations point at a hosted Postgres, and only the connection changes.

### Accounts

- Email and password works with no outside service.
- Google sign-in is switched on by setting a Google OAuth client ID and secret.
  Without them the Google button is not shown, so v1 works before those exist.
- An account signed up by email and the same email signing in through Google are one account.
- A user has named **projects**.
  Each project has one canvas, its datasets, and its saved card positions.

## The Plan

The Plan is the single source of truth.
The canvas draws it, the chat edits it, and the compiler turns it into a script.

- A Plan is a JSON document validated by one Zod schema.
- It holds **datasets** (name, columns, types, profile) and **steps**.
- Step kinds: `join`, `enrich`, `filter`, `reshape`, `aggregate`, `analyze`, `chart`, `custom`.
- Every column carries a **privacy mark**: `open`, `pseudonymous`, or `hidden`.
- A linking step names its two columns, its **match kind**, and a free-text nuance note.
- A step that uses AI matching names its **audit**: `deep`, `wide`, `by_hand`, or `off`.
- Every step has a status, `proposed` or `confirmed`, and records who created it: the user or the AI.
- The Plan is language-neutral.
  It says what to do, never how in a particular language.

Because the canvas is only a view of the Plan, no AI is needed to read the canvas.
Drawing an arrow writes a step.
The chat changes the Plan by calling tools such as `add_step`, `update_step`, and `ask_user`, and its changes arrive as proposed steps drawn with dashed lines.

## Where AI is used, and where it is not

| Job                                                         | How it is done                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Turn the canvas into a Plan                                 | No AI. The canvas is the Plan.                                     |
| Tag column roles, suggest a match kind as an arrow is drawn | Small fast model, one short structured call.                       |
| Understand a typed request and propose steps                | Large model with tool calls that edit the Plan.                    |
| Compile a built-in step into code                           | No AI. A template that calls the tested runtime.                   |
| Write a `custom` step or an unusual analysis                | Large model, constrained to the runtime's functions, then checked. |
| Match rows at run time, for example names                   | The user's chosen provider and key, called from the CLI.           |
| Judge a sample of matches in an accuracy audit              | A second model, different from the matcher, called from the CLI.   |
| Draw the audit sample and score it                          | No AI. Seeded sampling and arithmetic.                             |
| Estimate time and cost                                      | No AI. Counted locally by the CLI.                                 |
| Choose the run-time model                                   | No AI. A rule over the model registry.                             |

Model names are configuration, not code.
The defaults are the current small Claude model for suggestions and the current large Claude model for planning and custom code.

### Model registry

The registry is one versioned file that lists each run-time model Crosswalk supports, with its provider, price per token, typical speed, and which match kinds it has been tested on.
Each model is also tagged `strong` or `fast`, which is what the deep and wide audits choose from.
The chooser picks the cheapest model that has passed the recipe's test set for that match kind, and the user can override it.
Prices are updated from the providers' published pricing, never guessed.

Providers supported first: Anthropic, OpenAI, and TypeSafe.

## The CLI

### Install and link

- One installer command sets up `uv` and installs the `crosswalk` command.
- `uv` downloads its own Python, so the user needs neither Python nor an editor.
- `crosswalk login` uses the device authorization flow: the CLI shows a short code, the user confirms it in the browser, and the CLI stores a token in the operating system's keychain.
- `crosswalk link` ties the current folder to one project, and remembers the choice in a small file in that folder.
- `crosswalk` on its own scans the folder and sends the schema cards to the linked project, where they appear on the open canvas without a refresh.
- `crosswalk --show` prints exactly what would be sent and sends nothing.
- Folders that are links are skipped unless `--follow-links` is given, so a link into a protected data folder is never read by accident.
- Profiles are computed from the first 100,000 rows of a file, and the row count is always the real one.
- The server address is a setting, and in v1 it is `localhost`.

### What it reads

Running `crosswalk` in a folder finds the supported files and builds a **schema card** for each one.

| What is sent        | Contents                                                                   | Which columns                                           |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Headers and profile | Column names, inferred type, null rate, uniqueness, value shape, row count | All                                                     |
| Sample rows         | The first few rows, to show the AI what the values look like               | Open as values, pseudonymous as tokens, hidden left out |

Value shape describes form, not content, for example "six digits", "date as MM-DD-YYYY", or "several lines per cell".
The CLI prints exactly what it is about to send and waits for the user to accept.

### Privacy marks and pseudonyms

- When a dataset is first scanned, the CLI asks once whether its values may be shared.
  Yes marks every column `open`, and no marks every column `hidden`.
- The CLI suggests `pseudonymous` for columns that look like identifiers and `hidden` for columns that look personal, and the user confirms on the canvas.
- A pseudonym is a keyed hash of the cleaned value, prefixed with the column's kind.
  The same value gets the same token in every dataset in the project, so exact joins on tokens work.
- The key and the token-to-value map are stored on the user's machine and never sent.
- Tokens are turned back into values only inside the CLI, when it writes the output file.
- The marks are enforced in one place, the CLI's outbound gate, which every message to the server and every AI call passes through.
- A pseudonymous column can be joined exactly, counted, and grouped.
  It cannot be name-matched, because an AI cannot compare tokens.
  A step that needs real values from a column that is not `open` is refused at confirm time, with an explanation.

This is the same idea as the pointer tokens in `src/lex_machina_vault`, made general.

### Running a script

1. The server sends the confirmed script and its Plan.
2. The CLI runs a policy check on the script.
   Scripts are thin glue over the runtime, so the check is an allowlist: only the runtime and a short list of libraries may be imported, with no shell access and no network access outside the runtime's AI client.
3. The CLI runs the script on synthetic data built from the profiles, to catch crashes before touching real data.
4. The CLI does a dry run on the real data: it runs every deterministic step, counts the rows that still need AI, and prints the estimated time and cost, with the audit's cost included.
5. The user accepts, and enters an API key if one is needed.
   The key is stored in the keychain and never sent to Crosswalk.
6. The script runs with `uv run`, with its dependencies pinned in the script header.
7. Outputs go to a new `crosswalk_out/<run>/` folder.
   Inputs are opened read-only.
8. If the run used AI matching, the accuracy audit starts on its own and its report is saved with the output and shown in the web app.

Every script is saved next to its output and can be run again later with `crosswalk run <script>`, with no web session.

## The runtime

The runtime is a versioned Python library that ships with the CLI.
It holds the recipes, and it is where the accumulated judgment lives.

- **Readers** for each file format, which keep identifiers as text so leading zeros survive.
- **Match recipes**, one per match kind: exact, normalized ID with a collision check, name match, and time-aware.
- **Cell tools** for columns that hold several values per cell, which keep every derived column aligned.
- **AI client** with retries, bounded concurrency, results consumed in order, and a versioned cache that is saved in checkpoints so an interrupted run resumes without paying twice.
- **Pseudonymizer** and the outbound gate that enforces the privacy marks.
- **Auditor**, described below.
- **Manifest**: input hashes, the Plan, recipe versions, model, token counts, cost, row counts at every step, and the audit result.
- **Analysis helpers** for summary tables, panels, regressions, and charts.

Each recipe has its own test set built from synthetic data.
A change to a recipe or a prompt bumps its version, which invalidates the matching cache entries.

### Match decisions

A match recipe gives every row one of two answers, `match` or `no_match`.
There is no uncertain answer, no threshold that withholds a match, and no approval step.
Each decision records its source (exact rule or AI), the model, and the AI's confidence, as columns in the output.

### The auditor

The auditor is modeled on how accuracy was checked by hand in this repo: `scripts/evaluation/sample_final_audit.py` draws the sample and `scripts/evaluation/score_company_group_holdout.py` scores it.

| Audit     | Sample size                   | Judge                        |
| --------- | ----------------------------- | ---------------------------- |
| `deep`    | 10% of matches, at most 100   | A `strong` model             |
| `wide`    | 20% of matches, at most 1,000 | A `fast` model               |
| `by_hand` | Chosen by the user            | The user, in a verdict sheet |
| `off`     | None                          | None                         |

- **Sampling.**
  Seeded, without replacement, over unique keys rather than rows, so a name that appears a thousand times is judged once.
  The sample is split across three groups: matches chosen by AI, matches made by exact rules, and rows left unmatched.
  The seed and the sampled keys are written to the manifest.
- **Judging.**
  The judge is a different model from the matcher when the registry has one.
  It sees the row, the chosen match, and the candidate list, and answers `correct` or `incorrect`.
  For an unmatched row it answers whether any candidate should have been chosen.
  The judge is forced to answer, and a by-hand reviewer may also answer `uncertain`, which is left out of the score and counted separately.
- **Scoring.**
  Match precision, the missed-match rate among unmatched rows, overall accuracy, each with its sample size, and the same numbers per group.
  Every disagreement is listed with both answers.
- **Honest labels.**
  A `deep` or `wide` result is reported as AI-judged agreement.
  Only a `by_hand` result is reported as measured accuracy.
- **No feedback.**
  The auditor never changes the output it audited, and its sample is never used to tune a prompt or a recipe.
- **By hand.**
  `crosswalk audit` writes a verdict sheet, and `crosswalk score` reads it back and produces the same report.

## Script languages

The Plan is language-neutral, so one Plan can compile to more than one target.

| Target                 | Status | Notes                                                                         |
| ---------------------- | ------ | ----------------------------------------------------------------------------- |
| Python                 | v1     | The default. The CLI provides the runtime.                                    |
| Stata `.do` for models | Later  | Stata is licensed, so the CLI detects a local install and cannot bundle one.  |
| R                      | Later  | The CLI provisions R, and each recipe needs an R version with the same tests. |

The target is inferred from the conversation and the user's profile.
A user who never mentions a language gets Python and is not asked.
A target is only offered once every recipe a Plan needs exists and is tested for it.

## Repo layout

```
projects/Crosswalk/
  apps/
    web/               # Next.js canvas and chat, static export
    api/               # Hono server: plans, AI planning, compiler, CLI link
  packages/
    contract/          # dataset card types and card geometry, shared by web and api
    plan/              # Zod schema for the Plan, shared by web and api
    compiler/          # Plan to script, one module per target
  cli/                 # Python CLI: login, scan, profile, run
  runtime/             # Python runtime library: recipes, AI client, manifest
  registry/            # model registry
  spec/                # this constitution
```

Crosswalk lives at `projects/Crosswalk/` inside the Lex Machina project, because that project is where the job being replaced is done.
It is self-contained, with its own git repository, dependencies, and tests, so the folder can be moved anywhere.
The Lex Machina project's rules still apply to it: Crosswalk's code and tests never read `folder1/` or the `data/`, `outputs/`, and `legacy/` links, and its tests use synthetic data only.

## Hosting

- v1 is not hosted.
  `pnpm start` builds the web app and serves it with the API and the embedded database at `localhost:8787`.
  `pnpm dev` does the same with live reload, with the web app on port 3210 forwarding `/api` to the server.
- One Hono process serves both the API and the static web build, so there is one origin and no CORS.
- That single process is also what gets deployed later, as one container, on a host that scales to zero.
  The host and the database provider are chosen in the deployment phase.

## Security and privacy

- Data may leave the machine when no license or privacy rule forbids it, and the privacy marks are the user's statement of what is allowed.
- `hidden` values never leave the machine.
  `pseudonymous` values leave only as tokens.
  Both rules are enforced by the CLI's outbound gate and covered by tests that try to break them.
- The pseudonym key, the token map, and run-time AI keys stay on the user's machine.
- The server stores schema cards, Plans, scripts, sample rows as marked, run summaries, and audit reports.
- Rows sent to an AI provider at run time go straight from the CLI to that provider, under the user's own key and terms.
- The CLI shows what it will send before sending it, and what a script will do before running it.
- Generated scripts are treated as untrusted until they pass the policy check.
- Whether a dataset's license allows sharing is the user's call.
  Crosswalk asks the question and records the answer, and does not guess.

## CI/CD

- Every pull request runs Biome, Ruff, type checks, Vitest, pytest, a build, Playwright, and one full CLI run against synthetic data.
- Deploying on merge is added in the deployment phase.
- A tagged release publishes the CLI and the runtime.

## Quality bars

- **Same answer as by hand.**
  For each recipe, a reference task done by hand must produce the same output through Crosswalk.
- **Estimates:** the cost shown before a run is within 15% of the actual cost.
- **Resumable:** stopping a run at any point and starting it again loses no paid answers.
- **Audits agree with people:** on the recipe test sets, the AI-judged score is within 5 points of the by-hand score, or the judge model is not offered for that match kind.
- **Marks hold:** no test can make a `hidden` value or an untokenized `pseudonymous` value appear in anything the CLI sends.
- **Aligned:** every derived column on a multi-value cell has the same number of slots as its source, checked on every run.
- **Accessible:** WCAG 2.2 AA, and every canvas action is also possible from the keyboard and from the chat.
- **Zero tolerance:** no lint warnings, and no failing or flaky tests on `main`.
