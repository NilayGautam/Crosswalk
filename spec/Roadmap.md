# Roadmap

## v1: the walking skeleton

v1 is Phases 0 to 3.
It runs on my laptop only.
It produces no output file yet.
It proves the plumbing that everything else rides on: accounts, the link between the terminal and the browser, and a canvas that shows real datasets.

v1 is done when this works from a clean start, with no help:

1. I sign up and log in.
2. I create a project.
3. I install the CLI, log it in with a short code, and link a folder to the project.
4. I run `crosswalk` in that folder, and a card for each dataset appears on the open canvas without a refresh.
5. I drag the cards around, reload the page, and they are where I left them.

Out of v1: arrows, chat, privacy marks, scripts, AI matching, audits, and deployment.
Nothing but column names and profiles leaves the machine in v1, so the privacy marks can wait.

## Phase 0: Foundations

- [x] Check that the `crosswalk` name is free for the CLI package and the command.
      It is taken on PyPI, so the package is `crosswalk-cli` and the command stays `crosswalk`.
- [x] Create the repository at `projects/Crosswalk/` with pnpm workspaces, uv, Biome, Ruff, and strict TypeScript.
- [x] `pnpm dev` starts the server, the web app, and the embedded database with one command.
- [x] Add a CI workflow for lint, type checks, tests, and build.
- [x] Design tokens: palette, type scale, spacing, and borders.

## Phase 1: Accounts and projects

- [x] Database schema and migrations with Drizzle on PGlite.
- [x] Sign up, log in, and log out with email and password.
- [x] Google sign-in, shown only when the Google credentials are set.
      Built, but not yet tried with real Google credentials.
- [x] One account for the same email, whichever way it signs in.
- [x] Create, rename, open, and delete named projects.
- [x] A project is only visible to its owner.
- [x] Playwright tests for sign up, log in, log out, and the project list.

## Phase 2: The CLI link and schemas

- [x] One-line installer that sets up `uv` and the `crosswalk` command, on macOS first: `pnpm install-cli`.
- [x] `crosswalk login` with the device authorization flow, and the token stored in the keychain.
- [x] A page in the web app where the user confirms the short code.
- [x] `crosswalk link` to tie a folder to a project.
- [x] Folder scan for CSV, TSV, XLSX, XLS, Parquet, and `.dta`.
- [x] A schema card per dataset: file name, row count, and column names.
- [x] A full profile per column: inferred type, null rate, uniqueness, and value shape.
- [x] Profiling that stays fast on large files.
- [x] The CLI prints what it will send and waits for consent.
- [x] Running `crosswalk` again updates the cards instead of duplicating them.
- [x] `crosswalk logout` and a list of linked devices in the web app, with a way to revoke one.
- [x] pytest tests for every file format, using synthetic files only.

## Phase 3: The canvas

- [x] A canvas per project, built on React Flow, with pan and zoom.
- [x] A dataset card that lists its columns with each column's type.
- [x] The column profile shown on hover or focus.
- [x] Cards appear live when the CLI sends them.
- [x] New cards are placed where they do not overlap existing ones.
- [x] Cards are draggable.
- [x] Card positions are saved per project and restored on reload.
- [x] Remove a card from the canvas.
- [x] An empty canvas explains how to install and link the CLI.
- [x] Every canvas action also works from the keyboard.
- [x] One end-to-end test that runs the real CLI against the real server and checks the cards in a real browser.
- [ ] **v1 gate:** the five steps at the top of this file work from a clean start, done by me by hand with my own files.
      The automated end-to-end test already does all five.

## Phase 4: The Plan and arrows

- [ ] The Plan schema in Zod, exported as JSON Schema.
- [ ] Draw an arrow from one column to another, and pick a step kind and match kind.
- [ ] A nuance note on every arrow.
- [ ] A privacy mark on every column: open, pseudonymous, or hidden.
- [ ] A side panel that shows the Plan in plain language.
- [ ] **Replace-me check:** I can draw one of my past join tasks and the plain-language Plan reads correctly to my professor.

## Phase 5: Privacy marks in the CLI

- [ ] The one question per dataset: may its values be shared?
- [ ] Suggested privacy marks for columns that look like identifiers or personal data.
- [ ] The pseudonymizer, with its key and token map kept on the user's machine.
- [ ] The outbound gate that enforces the marks, with tests that try to leak a hidden value.
- [ ] Sample rows sent according to the marks.

## Phase 6: Deterministic scripts

- [ ] Runtime readers that keep identifiers as text.
- [ ] Recipes for exact match and normalized ID match with a collision check.
- [ ] Filter, reshape, and aggregate steps, including splitting cells that hold several values.
- [ ] The compiler: built-in steps to a Python script through templates, with no AI.
- [ ] Policy check, synthetic-data run, and dry run in the CLI.
- [ ] Outputs in a new folder with a manifest, and inputs opened read-only.
- [ ] `crosswalk run <script>` to repeat a run with no web session.
- [ ] **Replace-me check:** an identifier join and a filtered subset that I built by hand come out identical through Crosswalk.

## Phase 7: Chat and suggestions

- [ ] Column role tagging and match kind suggestions from the small model as arrows are drawn.
- [ ] Chat that edits the Plan through tool calls.
- [ ] Proposed steps drawn as dashed arrows, with accept and reject.
- [ ] The chat can ask a question when a request is ambiguous instead of guessing.
- [ ] A whole task done by typing only, with nothing drawn.
- [ ] **Replace-me check:** my professor types a request the way they would email it to me, and the proposed Plan is right or one correction away.

## Phase 8: AI matching and audits

- [ ] Name match recipe: clean, match exactly, retrieve candidates, AI picks only from candidates.
- [ ] Time-aware match recipe.
- [ ] AI client with retries, bounded concurrency, and a versioned, checkpointed cache.
- [ ] Model registry and the rule that chooses a model.
- [ ] Time and cost estimate from the dry run, shown before any paid call, with the audit's cost included.
- [ ] API key prompt in the CLI, stored in the keychain.
- [ ] Every row ends as a match or no match, with the source and confidence recorded and nothing withheld.
- [ ] The auditor: seeded sampling across AI matches, exact matches, and unmatched rows.
- [ ] Deep audit (10% up to 100, strong model) and wide audit (20% up to 1,000, fast model), started automatically when a run ends.
- [ ] By-hand audit with `crosswalk audit` and `crosswalk score`.
- [ ] The audit report in the manifest and in the web app, labeled as AI-judged or measured.
- [ ] **Replace-me check:** I run a name match on files of my own, read the automatic audit, and then check it with a by-hand audit of the same run.

## Phase 9: Analysis

- [ ] Summary tables and coverage reports written to a workbook.
- [ ] Panel builder, for example one row per company per year from dated events.
- [ ] Event windows before and after a date.
- [ ] Regressions and statistics with pyfixest and statsmodels, with a results table.
- [ ] Charts with matplotlib.
- [ ] Export to `.dta` so work can continue in Stata.
- [ ] `custom` steps written by the large model, constrained to the runtime and checked.
- [ ] **Replace-me check, and the goal:** my professor completes a real request end to end without contacting me.

## Phase 10: Deployment and the research group

- [ ] Choose a host that scales to zero and a hosted Postgres.
- [ ] Deploy on merge to `main`.
- [ ] Shared projects.
- [ ] Saved recipes: a confirmed Plan fragment that can be reused on new datasets.
- [ ] Windows and Linux installers.
- [ ] A short guide written for someone who has never used a terminal.

## Phase 11: Public product

- [ ] Public sign-up, with email verification and password reset.
- [ ] Crosswalk credits, so a user without their own AI key can still run AI steps.
- [ ] Billing and usage limits.
- [ ] Stata `.do` target for models.
- [ ] R target.
- [ ] Target inference from the conversation, with Python as the silent default.
- [ ] A privacy page that states exactly what leaves the user's machine under each mark.

## Later

- A desktop app that wraps the CLI for users who will not open a terminal.
- More audit options, such as two judges that must agree.
- Running scripts on Crosswalk's servers for datasets whose columns are all open.
- A public library of recipes for common datasets.
- Scheduled re-runs when a source dataset is updated.

## Open decisions

These are my recommendations.
Each one is written into the spec as if decided, and should be confirmed or changed before the phase it belongs to.

1. **Linking Google to an email account.**
   An account made with email and password is not verified in v1, because no email is sent.
   Google sign-in with the same address joins that account.
   Before public sign-up, email accounts must be verified first, or someone could sign up with another person's address and wait for them to arrive through Google.
2. **PGlite on the laptop.**
   This laptop has no Docker and no Postgres, and PGlite needs neither.
   It allows one server process at a time, which is fine for v1.
3. **No email is sent in v1.**
   Email verification and password reset need an email service, so they wait for Phase 11.
   On a laptop a forgotten password is reset from the command line.
4. **The default audit is deep.**
   10% of matches up to 100, judged by a strong model, unless the user picks another.
5. **An AI-judged audit is not called accuracy.**
   It is reported as AI-judged agreement, and only a by-hand audit is called measured accuracy.
6. **A pseudonymous column cannot be name-matched.**
   AI matching needs real values, so those columns must be marked open.
7. **Python is the only script language until Phase 11.**
   Stata and R are separate targets, because each needs its own tested recipes.
8. **Crosswalk credits route open values through our servers.**
   Hidden and pseudonymous columns stay protected by the marks, but credits still need their own privacy terms before Phase 11.
