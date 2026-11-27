# Roadmap

Every phase ends with a **replace-me check**: a task I have already done by hand, redone through Crosswalk.

## v1: the walking skeleton (built)

v1 is Phases 0 to 3.
It runs on my laptop only and produces no output file.
It proved the plumbing: accounts, the link between the terminal and the browser, and a canvas that shows real datasets.

### Phase 0: Foundations

- [x] Check that the `crosswalk` name is free for the CLI package and the command.
      It is taken on PyPI, so the package is `crosswalk-cli` and the command stays `crosswalk`.
- [x] Create the repository at `projects/Crosswalk/` with pnpm workspaces, uv, Biome, Ruff, and strict TypeScript.
- [x] `pnpm start` runs the server, the web app, and the embedded database with one command.
- [x] Add a CI workflow for lint, type checks, tests, and build.
- [x] Design tokens: palette, type scale, spacing, and borders, recorded in `apps/web/DESIGN.md`.

### Phase 1: Accounts and projects

- [x] Database schema and migrations with Drizzle on PGlite.
- [x] Sign up, log in, and log out with email and password.
- [x] Google sign-in, shown only when the Google credentials are set.
      Built, but not yet tried with real Google credentials.
- [x] One account for the same email, whichever way it signs in.
- [x] Create, rename, open, and delete named projects.
- [x] A project is only visible to its owner.

### Phase 2: The CLI link and schemas

- [x] One-line installer that sets up `uv` and the `crosswalk` command, on macOS first: `pnpm install-cli`.
- [x] Linking a computer with the device authorization flow, and the token stored in the keychain.
- [x] Folder scan for CSV, TSV, XLSX, XLS, Parquet, and `.dta`, including subfolders.
- [x] A schema card per dataset, and a full profile per column.
- [x] Linked devices listed in the web app, with a way to unlink one.

### Phase 3: The canvas

- [x] A canvas per project with pan and zoom.
- [x] Dataset cards that arrive live, do not overlap, and show a column's profile.
- [x] Draggable cards whose positions are saved.
- [x] Every canvas action also works from the keyboard.
- [x] An end-to-end test that runs the real CLI against the real server in a real browser.
- [ ] **v1 gate:** I do it by hand with my own files, from a clean start.

## v2: the first output file

v2 is Phases 4 to 7.
It is done when I can open a folder, run one command, describe a joined file by drawing or by typing, and get that file.
v2 has no AI matching: every match is exact or a normalized ID.

### Phase 4: One terminal action

- [ ] `crosswalk` becomes one long-running command that never asks a question in the terminal.
- [ ] It links the computer through the browser when needed, with no separate login command.
- [ ] The approval page: pick or create the project, see every dataset with every column name, and send.
- [ ] The header check, with a way to say which row holds the headers.
- [ ] A "not read" list on the approval page: other file types, links, and files that could not be opened.
- [ ] The folder's choices are remembered, so a second start goes straight to the canvas.
- [ ] The canvas shows whether the folder's command is connected.
- [ ] Remove the `login`, `link`, and `status` commands and the terminal prompt.
- [ ] **Replace-me check:** my professor gets their own files onto a canvas by typing one word.

### Phase 5: The Plan, lines, and the output area

- [ ] The Plan schema in Zod, exported as JSON Schema, with three example Plans written by hand.
- [ ] The fixed output area: columns, what one row is, and which rows are kept.
- [ ] Match lines between cards: numbered, colour coded, with a match kind and a nuance note.
- [ ] Output columns added from a card, wearing their match's number and colour, with the line drawn on hover, focus, or selection.
- [ ] Choose the main dataset, and what happens to rows that find no match.
- [ ] Row rules: keep rows where a rule holds, and keep rows found in another dataset.
- [ ] The Plan read back in plain language.
- [ ] Everything that can be drawn can also be done from the keyboard.
- [ ] **Replace-me check:** I draw one of my past join tasks and my professor reads the plain-language Plan correctly.

### Phase 6: Templates and the first output

- [ ] The runtime library, with readers that keep identifiers as text.
- [ ] Templates: read, clean, exact match, normalized ID match with a collision check, bring columns across, row rules, remove duplicates, write.
- [ ] The formula language for computed columns: parser, evaluator, and tests.
- [ ] The compiler, with a test that the same Plan always gives the same script.
- [ ] Run from the canvas: the synthetic-data run, the dry run, and the estimate screen.
- [ ] The output in a new folder with its script and run record, and inputs opened read-only.
- [ ] Run status and the result shown in the output area: rows, columns, and the match rate of each match.
- [ ] A clear message when no template fits, and a recorded template request.
- [ ] **Replace-me check:** an identifier join and a filtered subset that I built by hand come out identical through Crosswalk.

### Phase 7: Keys and chat

- [ ] AI keys in account settings, one per provider, encrypted at rest.
- [ ] Chat that edits the Plan through tool calls, using the user's Anthropic key.
- [ ] Proposed matches and output columns drawn dashed, with accept and reject.
- [ ] Match suggestions and column role tags from the small model as lines are drawn.
- [ ] The chat writes formulas, shown to the user before they are accepted.
- [ ] The chat asks a question when a request is ambiguous instead of guessing.
- [ ] A whole task done by typing only, with nothing drawn.
- [ ] **v2 gate:** my professor types a request the way they would email it to me, accepts the proposed lines, and gets the right file.

## v3: AI matching

### Phase 8: Name matching and accuracy

- [ ] Name match template: clean, match exactly, retrieve candidates, AI picks only from candidates.
- [ ] Time-aware match template.
- [ ] AI classify and AI extract templates, with their prompts shown and editable through the nuance note.
- [ ] AI client with retries, bounded concurrency, and a versioned, checkpointed cache.
- [ ] The key handed to the linked CLI for one run and held in memory only.
- [ ] Model registry, limited to the providers the user has keys for.
- [ ] Confidential columns and datasets, sending a column as tokens, and the outbound gate, with tests that try to leak a value.
- [ ] The estimate screen lists the columns each AI step would send and asks for each.
- [ ] Every row ends as a match or no match, with the source and confidence recorded and nothing withheld.
- [ ] The auditor: seeded sampling across AI matches, exact matches, and unmatched rows.
- [ ] Audit choices on the estimate screen with their cost: deep, wide, custom, by hand, none.
- [ ] Accuracy shown in the output area and saved in the run record.
- [ ] **Replace-me check:** I run a name match on files of my own, read the accuracy, and then check it with a by-hand audit of the same run.

## v4: the rest of the job

### Phase 9: Reshaping and summaries

- [ ] Templates: split a multi-value cell into rows and collapse it back, wide to long and back, one row per year between two dates, stack files.
- [ ] Templates: group and summarize, counts by category, top N, seeded sample.
- [ ] "What one row is" in the output area drives these.
- [ ] **Replace-me check:** a firm-year panel I built by hand comes out identical.

### Phase 10: Analysis

- [ ] Coverage and summary tables written to a workbook.
- [ ] Regressions with pyfixest and statsmodels, with a results table.
- [ ] Windows before and after a date.
- [ ] Charts with matplotlib.
- [ ] Export to `.dta` so work can continue in Stata.
- [ ] **Replace-me check, and the goal:** my professor completes a real request end to end without contacting me.

## v5: other people

### Phase 11: Deployment and the research group

- [ ] Choose a host that scales to zero and a hosted Postgres.
- [ ] Deploy on merge to `main`.
- [ ] Email verification and password reset.
- [ ] Shared projects.
- [ ] Saved plans that can be reused on new datasets.
- [ ] Windows and Linux installers.
- [ ] A short guide written for someone who has never used a terminal.

### Phase 12: Paid product

- [ ] Public sign-up.
- [ ] Credits, so a user never needs an AI key.
- [ ] Billing and usage limits.
- [ ] Stata `.do` target for models.
- [ ] R target.
- [ ] A privacy page that states exactly what leaves the user's machine.

## Later

- A desktop app that starts the command for users who will not open a terminal.
- More audit options, such as two judges that must agree.
- A public library of plans for common datasets.
- Re-running a plan when a source file changes.

## Open decisions

These are my recommendations.
Each one is written into the spec as if decided, and should be confirmed or changed before the phase it belongs to.

1. **The AI key is handed to the user's CLI for a run.**
   You asked for keys on the account.
   I chose to send the key to the linked CLI rather than route every AI call through the server, so cell values never pass through Crosswalk.
   The cost is that a key leaves the server, to a machine the same user already linked.
2. **Chat uses the user's own Anthropic key.**
   Until credits exist, a user with no Anthropic key can draw but cannot chat.
3. **The formula language is small on purpose.**
   Arithmetic, comparisons, `if`, text and date functions.
   Anything it cannot express becomes a template request, not a bigger language.
4. **Template requests are only recorded.**
   Nothing reviews them automatically; I read them and decide what to build.
5. **The old commands are removed.**
   `login`, `link`, and `status` go away in Phase 4, since one command does everything.
6. **Linking Google to an email account.**
   An account made with email and password is not verified yet, because no email is sent.
   Before public sign-up, email accounts must be verified, or someone could sign up with another person's address and wait for them to arrive through Google.
7. **PGlite on the laptop.**
   It allows one server process at a time, which is fine until deployment.
8. **Python is the only script language until Phase 12.**
9. **Credits route values through our server.**
   That is the one case where values pass through Crosswalk, and it needs its own privacy terms first.
