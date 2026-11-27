# Tech

## Guiding choices

- Crosswalk is its own project.
  Its stack was chosen to match the one I already know from nilaygautam.com, and it depends on nothing in that site.
- It is a hosted web app with accounts, plus a command line tool on the user's machine.
  Until the deployment phase, the whole thing runs on one laptop, started with one command.
- Favor quality, simplicity, robustness, and long term maintainability over development speed.
- Nothing runs 24/7.
  Every server-side workload scales to zero.
- Each side uses the language its ecosystem is best at: TypeScript for the web, Python for the CLI and the data work.
- Deterministic by construction.
  Tested templates do the work, and no generated code is ever run.

## System overview

```
 Browser                       Crosswalk server                 User's machine
 ---------------------         ----------------------           ---------------------------
 Canvas  <-- one Plan -->      Accounts and projects            crosswalk CLI (stays running)
 Chat                          Plan store                       - reads headers and profiles
 Output area                   AI planning and suggestions      - compiles the Plan with templates
 Estimate and consent          AI keys, encrypted               - runs the script in its own Python
                                                                - calls AI providers directly
        <-- schema cards, plan, run requests, status, results -->   - files never leave here
```

There are three parts.

1. **Web app.**
   The canvas, the chat, the output area, accounts, and saved projects.
2. **Server.**
   Stores accounts, projects, Plans, and the user's AI keys.
   Talks to the AI models that help build a Plan.
3. **CLI.**
   One long-running command on the user's machine, in the folder with the datasets.
   It is the only part that ever opens a file, and the only part that runs anything.

## Stack

| Layer                 | Choice                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Web language          | TypeScript (strict)                                                                                    |
| Web framework         | Next.js (App Router, React 19), built as a static export                                               |
| Canvas                | React Flow (`@xyflow/react`)                                                                           |
| Client state          | Zustand, holding the Plan                                                                              |
| Styling               | Tailwind CSS v4, with the tokens recorded in `apps/web/DESIGN.md`                                      |
| API                   | Hono on Node, serving the API and the static web build from one process                                |
| Validation            | Zod, with the Plan schema exported as JSON Schema for the CLI                                          |
| Database              | Postgres with Drizzle: embedded PGlite on a laptop, hosted Postgres later                              |
| Auth                  | Better Auth: email and password, Google sign-in, and the device authorization flow for linking the CLI |
| Live updates          | Server-sent events to an open canvas, and one long-lived connection from the server to a running CLI   |
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
| E2E tests             | Playwright driving the real server, a real browser, and the real CLI                                   |
| Hosting               | None yet. Decided in the deployment phase.                                                             |
| CI/CD                 | GitHub Actions                                                                                         |

### Database

- The schema and queries are written once, for Postgres, with Drizzle.
- On a laptop the database is PGlite, which is Postgres running inside the server process and storing its files in a local folder.
  There is no Docker and no database to install.
- When Crosswalk is deployed, the same schema and migrations point at a hosted Postgres, and only the connection changes.

### Accounts

- Email and password works with no outside service.
- Google sign-in is switched on by setting a Google OAuth client ID and secret.
  Without them the Google button is not shown.
- An account signed up by email and the same email signing in through Google are one account.
- A user has named **projects**.
  A project is one canvas, its datasets, its Plan, and its one output.

### AI keys

- A user adds one key per AI provider in their account settings.
  Providers supported first: Anthropic, OpenAI, and TypeSafe.
- Keys are encrypted at rest with a key that is not stored in the database.
- A key is never sent to a browser after it is saved.
  The account page shows only the provider and the last four characters.
- For a run, the server hands the needed key to the user's own linked CLI over its authenticated connection.
  The CLI holds it in memory for that run and never writes it to disk.
- AI calls then go from the user's machine straight to the provider, so cell values never pass through Crosswalk's server.
- The model registry offers only models from providers the user has a key for, and a plan that needs AI cannot be confirmed until one is added.
- Later, credits will let a user skip keys altogether.
  Credit calls are made through Crosswalk's server, which is the one case where values pass through it, and that needs its own privacy terms first.

## The Plan

The Plan is the single source of truth.
The canvas draws it, the chat edits it, and the CLI compiles it into a script.

A Plan is a JSON document validated by one Zod schema.
It describes the output file, not a sequence of operations.

| Part           | Holds                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datasets       | Name, columns, types, profiles, and which columns are confidential.                                                                                           |
| Matches        | Each links a column on one dataset to a column on another, with a number, a colour, a match kind, a nuance note, and what to do with rows that find no match. |
| Output columns | An ordered list. Each is a source column, a formula, or the result of an AI step, and records which match it came through.                                    |
| Output rows    | The main dataset, what one row is, which rows are kept, the order, and any sample.                                                                            |
| Analysis       | Optional tables, models, and charts made from the output.                                                                                                     |
| Run choices    | The audit, the models, and which columns each AI step may send.                                                                                               |

- Every part has a status, `proposed` or `confirmed`, and records who created it: the user or the AI.
- The Plan is language-neutral.
  It says what the file is, never how to build it in a particular language.
- One project has exactly one Plan and one output.

### How the canvas shows it

- A **match** is a line between two cards, always drawn, in its own colour with its number.
- An **output column** is a row in the fixed output area, wearing the number and colour of the match it came through.
  Its line back to the source column is drawn while that column is hovered, focused, or selected.
- A formula or AI column starts in the output area and has no line.
- A `proposed` part is drawn dashed, with accept and reject.
- The output area cannot be moved.
  It sits at the edge the canvas leads into and is always in view.

Because the canvas is only a view of the Plan, no AI is needed to read it.
Drawing a line writes a match or an output column.
The chat changes the Plan by calling tools such as `add_match`, `add_output_column`, `set_rows`, and `ask_user`, and its changes arrive as proposed parts.

## Templates

A template is a tested piece of the runtime that does one job.
Compiling a Plan means choosing templates and filling in their settings.
No AI takes part in compiling.

| Family    | Templates                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read      | Read a file or a sheet, with the header row, rows to skip, and column types as settings.                                                              |
| Clean     | Trim and case, pad with zeros, strip punctuation or legal suffixes, parse a date, take a year, split one cell into several rows.                      |
| Match     | Exact, normalized ID with a collision check, name match, time-aware.                                                                                  |
| Enrich    | Bring columns across a match. Classify each row into fixed categories with AI. Extract a field with AI.                                               |
| Rows      | Keep rows where a rule holds, keep rows found in another dataset, top N, seeded sample, remove duplicates.                                            |
| Reshape   | One row per value of a multi-value cell, collapse back, wide to long and back, one row per year between two dates, stack files with the same columns. |
| Summarize | Group and count, sum, average, or count distinct. Counts by category spread across columns.                                                           |
| Analyze   | Coverage and summary tables, cross tabulations, regressions with fixed effects and clustered errors, windows before and after a date, charts.         |
| Write     | CSV, XLSX, `.dta`, and the run record.                                                                                                                |

### What an AI may set

- **Settings.**
  Each template declares its settings and their allowed values, and anything outside them is refused.
- **Formulas.**
  A computed column is a formula in a small expression language: arithmetic, comparisons, `if`, text and date functions, and references to columns.
  A formula is parsed into a syntax tree and evaluated by the runtime.
  It is never executed as code, and it cannot open a file, reach the network, or loop.
- **Prompts.**
  An AI matching or classifying template has a fixed prompt with marked places for the user's nuance note and for instructions the planning model writes.
  The prompt text is part of the Plan, shown to the user, and part of the cache key.

### When no template fits

- The chat says what it cannot do and why, and proposes the nearest thing it can.
- The request is recorded, with the Plan around it, as a template request.
- New templates ship in a release of the runtime, with tests.
  Nothing is ever patched in at run time.

### Determinism

- The same Plan and the same runtime version always compile to the same script, byte for byte.
- A deterministic step always gives the same output for the same input.
- An AI step gives the same output on a second run because its answers are cached.
  The cache key covers the model, the prompt text, the template version, and the row.

## Where AI is used, and where it is not

| Job                                                  | How it is done                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Turn the canvas into a Plan                          | No AI. The canvas is the Plan.                                       |
| Tag column roles, suggest a match as a line is drawn | Small fast model, one short structured call.                         |
| Understand a typed request and propose Plan parts    | Large model with tool calls that edit the Plan.                      |
| Write a formula or a prompt                          | Large model. The user reads it before confirming.                    |
| Compile the Plan into a script                       | No AI. Templates and settings.                                       |
| Match or classify rows at run time                   | A model from a provider the user has a key for, called from the CLI. |
| Judge a sample of matches in an accuracy audit       | A second model, different from the matcher, called from the CLI.     |
| Draw the audit sample and score it                   | No AI. Seeded sampling and arithmetic.                               |
| Estimate time and cost                               | No AI. Counted locally by the CLI.                                   |
| Choose the run-time model                            | No AI. A rule over the model registry, which the user can override.  |

Model names are configuration, not code.
The planning models in the first two AI rows are paid for with the user's own Anthropic key until credits exist.

### Model registry

The registry is one versioned file that lists each run-time model Crosswalk supports, with its provider, price per token, typical speed, and which templates it has been tested on.
Each model is also tagged `strong` or `fast`, which is what the deep and wide audits choose from.
The chooser picks the cheapest model that has passed the template's test set, among the providers the user has keys for.
Prices are updated from the providers' published pricing, never guessed.

## The CLI

### One command

- One installer command sets up `uv` and installs the `crosswalk` command.
  `uv` downloads its own Python, so the user needs neither Python nor an editor.
- The user opens a terminal in the folder with their files and runs `crosswalk`.
  Nothing else is ever typed in the terminal, and the command never asks a question there.
- If the computer is not linked yet, the command opens the browser on a page that links it.
  The token is stored in the operating system's keychain.
- The command then opens the browser on the folder's approval page and stays running.
- Stopping the command, or closing the terminal, disconnects the folder.
  The canvas shows whether a folder is connected.

### Approving what is sent

The approval page lists every dataset the command found, with its row count and every column name, and has one button to send them.

- Nothing is sent before the user presses it.
- The page is where the user picks or creates the project, and marks a dataset confidential.
- Anything in the folder that was not read is listed with the reason: a file type Crosswalk does not read, a file or folder that is a link, a file that could not be opened.
- The command looks inside subfolders.
- The choice is remembered for the folder, so the next start goes straight to the canvas and only new or changed files need approving.

### Header check

Every reader treats the first row of a file as its column names, and column names are sent.
A file whose first row is really data would leak cell values that way.

- The command checks each file's first row before offering it.
  Names that look like values, such as numbers, dates, or names with the same shape as the rows beneath them, mark the file as suspect.
- A suspect file is held back and shown on the approval page with the reason.
  The user can say which row holds the headers, or that the file has none, in which case its columns are named by position.

### What is sent to the server

| What            | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| Schema cards    | File names, sheet names, row counts, and column names.                   |
| Column profiles | Inferred type, null rate, uniqueness, and value shape.                   |
| Run status      | Step reached, row counts, match rates, time, cost, and the audit result. |

Value shape describes form, not content, for example "six digits", "date as MM-DD-YYYY", or "several lines per cell".
A profile is computed from the first 100,000 rows of a file, and the row count is always the real one.
No cell value is ever sent to the server.

### Confidential data and AI steps

Cell values leave the machine only for an AI step, and only to the AI provider.

- Before a run, the estimate screen lists each AI step with exactly the columns it would send, and the run cannot start until the user agrees to each.
- A column marked `confidential` is refused by the CLI's outbound gate, whatever the Plan says.
- A dataset marked confidential when it is added has every column marked.
- A column can be sent as tokens: a keyed hash of the cleaned value.
  The same value gets the same token everywhere in the project.
  The key and the token-to-value map stay on the user's machine.
- A step that compares names needs real values, so it cannot use a confidential or tokenized column.
  The Plan is refused at confirm time with an explanation.
- The outbound gate is the one place these rules are enforced, and every AI call passes through it.

This is the same idea as the pointer tokens in `src/lex_machina_vault`, made general.

### Running a Plan

1. The user confirms the Plan and presses Run on the canvas.
2. The server sends the Plan to the folder's running command.
3. The command compiles the Plan into a script with its templates.
4. The command runs the script on synthetic data built from the profiles, to catch crashes before touching real data.
5. The command does a dry run on the real data: it runs every deterministic step, counts the rows that still need AI, and reports the estimated time and cost for the run and for each audit option.
6. The estimate screen shows that, the columns each AI step would send, and the audit choices.
   The user agrees.
7. The command runs the script.
   Outputs go to a new `crosswalk_out/<run>/` folder, and inputs are opened read-only.
8. The chosen audit runs, and the result is shown in the output area and saved with the output.

The script is saved next to its output, so anyone can read what was done.
It is thin: it imports the runtime and calls templates with the Plan's settings.

## The runtime

The runtime is a versioned Python library that ships with the CLI.
It holds the templates, and it is where the accumulated judgment lives.

- **Readers** for each file format, which keep identifiers as text so leading zeros survive.
- **Templates**, as listed above, each with its own test set built from synthetic data.
- **Formula evaluator** for computed columns.
- **Cell tools** for columns that hold several values per cell, which keep every derived column aligned.
- **AI client** with retries, bounded concurrency, results consumed in order, and a versioned cache that is saved in checkpoints so an interrupted run resumes without paying twice.
- **Outbound gate** that enforces confidential and tokenized columns.
- **Auditor**, described below.
- **Run record**: input hashes, the Plan, template versions, models, token counts, cost, row counts at every step, and the audit result.

A change to a template or a prompt bumps its version, which invalidates the matching cache entries.

### Match decisions

A match template gives every row one of two answers, `match` or `no_match`.
There is no uncertain answer, no threshold that withholds a match, and no approval step.
Each decision records its source (exact rule or AI), the model, and the AI's confidence, as columns in the output.

### The auditor

The auditor is modeled on how accuracy was checked by hand in this repo: `scripts/evaluation/sample_final_audit.py` draws the sample and `scripts/evaluation/score_company_group_holdout.py` scores it.

| Audit     | Sample size                     | Judge                        |
| --------- | ------------------------------- | ---------------------------- |
| `deep`    | 10% of matches, at most 100     | A `strong` model             |
| `wide`    | 20% of matches, at most 1,000   | A `fast` model               |
| `custom`  | A share and a cap the user sets | A model the user picks       |
| `by_hand` | Chosen by the user              | The user, in a verdict sheet |
| `none`    | None                            | None                         |

There is no default.
The user chooses on the estimate screen, where each option shows its sample size and cost.

- **Sampling.**
  Seeded, without replacement, over unique keys rather than rows, so a name that appears a thousand times is judged once.
  The sample is split across three groups: matches chosen by AI, matches made by exact rules, and rows left unmatched.
  The seed and the sampled keys are written to the run record.
- **Judging.**
  The judge is a different model from the matcher when the user's providers allow it.
  It sees the row, the chosen match, and the candidate list, and answers `correct` or `incorrect`.
  For an unmatched row it answers whether any candidate should have been chosen.
  A by-hand reviewer may also answer `uncertain`, which is left out of the score and counted separately.
- **Scoring.**
  Accuracy, match precision, and the missed-match rate among unmatched rows, each with its sample size, and the same numbers per group.
  Every disagreement is listed with both answers.
- **Naming.**
  The result is called accuracy.
  The report states which audit produced it, the sample size, and the judge.
- **No feedback.**
  The auditor never changes the output it audited, and its sample is never used to tune a prompt or a template.
- **By hand.**
  The verdict sheet is a file in the output folder that the user fills in, and the score appears once it is complete.

## Script languages

The Plan is language-neutral, so one Plan can compile to more than one target.

| Target                 | Status | Notes                                                                           |
| ---------------------- | ------ | ------------------------------------------------------------------------------- |
| Python                 | First  | The default. The CLI provides the runtime.                                      |
| Stata `.do` for models | Later  | Stata is licensed, so the CLI detects a local install and cannot bundle one.    |
| R                      | Later  | The CLI provisions R, and each template needs an R version with the same tests. |

The target is inferred from the conversation and the user's profile.
A user who never mentions a language gets Python and is not asked.
A target is only offered once every template a Plan needs exists and is tested for it.

## Repo layout

```
projects/Crosswalk/
  apps/
    web/               # Next.js canvas, chat, and output area, static export
    api/               # Hono server: accounts, projects, plans, AI planning, CLI link
  packages/
    contract/          # dataset card types and card geometry, shared by web and api
    plan/              # Zod schema for the Plan, shared by web and api
  cli/                 # Python CLI: link, scan, profile, compile, run
  runtime/             # Python runtime library: templates, formulas, AI client, auditor
  registry/            # model registry
  spec/                # this constitution
```

Crosswalk lives at `projects/Crosswalk/` inside the Lex Machina project, because that project is where the job being replaced is done.
It is self-contained, with its own git repository, dependencies, and tests, so the folder can be moved anywhere.
The Lex Machina project's rules still apply to it: Crosswalk's code and tests never read `folder1/` or the `data/`, `outputs/`, and `legacy/` links, and its tests use synthetic data only.

## Hosting

- Crosswalk is not hosted yet.
  `pnpm start` builds the web app and serves it with the API and the embedded database at `localhost:8787`.
  `pnpm dev` does the same with live reload, with the web app on port 3210 forwarding `/api` to the server.
- One Hono process serves both the API and the static web build, so there is one origin and no CORS.
- That single process is also what gets deployed later, as one container, on a host that scales to zero.
  The host and the database provider are chosen in the deployment phase.

## Security and privacy

- The user's files never leave their machine.
- The server stores accounts, projects, schema cards, profiles, Plans, run summaries, audit results, and encrypted AI keys.
  It never stores or receives a cell value.
- Cell values go only to an AI provider, only for an AI step, only for the columns the user agreed to, and directly from the user's machine.
- An AI key is given only to a CLI linked to the same account, for one run, and is held in memory.
- The approval page shows what will be sent before it is sent, and the estimate screen shows what a run will do before it runs.
- A script is compiled on the user's machine from templates that shipped with the CLI.
  No code arrives from the server, so there is nothing generated to distrust.
- Whether a dataset's license allows sending values to an AI provider is the user's call.
  Crosswalk shows the columns and asks, and does not guess.

## CI/CD

- Every pull request runs Biome, Ruff, type checks, Vitest, pytest, a build, and the Playwright suite with the real CLI.
- Deploying on merge is added in the deployment phase.
- A tagged release publishes the CLI and the runtime.

## Quality bars

- **Same answer as by hand.**
  For each template, a reference task done by hand must produce the same output through Crosswalk.
- **Deterministic:** compiling the same Plan twice gives the same script, and a test checks it for every example Plan.
- **Estimates:** the cost shown before a run is within 15% of the actual cost.
- **Resumable:** stopping a run at any point and starting it again loses no paid answers.
- **Audits agree with people:** on the template test sets, an AI-judged accuracy is within 5 points of the by-hand accuracy, or that judge model is not offered for that template.
- **Nothing leaks:** no test can make a cell value appear in anything sent to the server, or a confidential value appear in anything sent to a provider.
- **Aligned:** every derived column on a multi-value cell has the same number of slots as its source, checked on every run.
- **Accessible:** WCAG 2.2 AA, and everything that can be done by drawing can also be done from the keyboard and from the chat.
- **Zero tolerance:** no lint warnings, and no failing or flaky tests on `main`.
