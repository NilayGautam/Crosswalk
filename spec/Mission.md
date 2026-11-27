# Mission

## Why this exists

Crosswalk exists to replace the routine part of a research assistant's job.
A researcher describes the file they want, confirms a plan they can see, and gets that file, without writing code and without waiting on an RA.

The name comes from the field itself.
A crosswalk is the table that maps one dataset's identifiers onto another's, and building those is most of the job.

## The job being replaced

A research assistant receives tabular datasets and is asked to do one of four things.

| Task      | What it means                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------- |
| Join      | Link two datasets on a shared key.                                                              |
| Enrich    | Add columns to one dataset from another, or from an AI model, without changing its rows.        |
| Analyze   | Summary tables, panels and reshaping, regressions and statistics, charts.                       |
| Construct | Build a new dataset by filtering, sampling, cherry-picking, or combining the three tasks above. |

The syntax of these tasks is easy.
The judgment is what takes an RA's time, and it is what Crosswalk has to carry:

- Keys rarely match exactly.
  Identifiers lose leading zeros, come in two lengths, or collide across exchanges, and names are spelled a dozen ways.
- Some cells hold several values, and every derived column must stay aligned with them.
- Relationships are only valid in certain years.
- Paid AI calls must be cached, resumable, and estimated before any money is spent.
- Nobody should trust an AI match until its accuracy has been measured on a sample.
- Some data is licensed or private, and must not be sent anywhere without the user saying so.
- Raw inputs are never overwritten, and every output can say exactly how it was made.

## Who it is for

- **First:** my professor and me.
  The goal is reached when my professor finishes a real request without contacting me.
- **Then:** our research group.
- **Finally:** any researcher, as a paid product.
  What people pay for is the simplicity: no code, no API plumbing, one command.

Users range from people who have never opened a terminal to people who want to read every line of the script.
Crosswalk must serve both without asking either to configure anything.

## How it works

1. **Install once and make an account.**
2. **Put the input files in a folder, open a terminal there, and run `crosswalk`.**
   This is the only thing ever typed in a terminal.
   The command stays running and does the rest of its work when the website asks it to.
3. **The browser opens.**
   The user logs in if needed, picks or creates a project, and sees the files that were found with every column name.
   Nothing is sent until the user approves it there.
4. **The datasets appear as cards on the canvas.**
5. **The user describes the output file, in any order, by drawing lines or by chatting.**
6. **The user confirms the plan.**
   Anything the AI proposed is dashed until it is accepted.
7. **The user reviews the estimate.**
   Run time, AI cost, exactly which columns each AI step would send, and which accuracy audit to run.
8. **Run.**
   The waiting command builds the file on the user's own machine.
9. **The output file appears in the folder**, with a record of how it was made and, when AI matching was used, its accuracy.

## Core ideas

### One canvas, one output

A project is one canvas, and a canvas leads to exactly one output file.
A second deliverable is a second project, which can use the same datasets.

### The output area

The output file is not a card and cannot be dragged.
It is a fixed area the whole canvas leads into, and it reads as a description of the file:

- **Its columns**, in order.
- **What one row is**, for example one row per case, or one row per firm per year.
- **Which rows are kept**, for example only S&P 500 firms.

The user thinks about the file they want, not about a sequence of operations.

### Lines

There are two kinds of line, and both are numbered and colour coded.

| Line        | Connects                                     | Says                                       | Drawn                            |
| ----------- | -------------------------------------------- | ------------------------------------------ | -------------------------------- |
| Match line  | A column on one card to a column on another  | These two columns identify the same thing. | Always.                          |
| Output line | A column on a card to a column in the output | This column is in the file.                | For the column being pointed at. |

Each match gets a number and a colour.
Every output column wears the number and colour of the match it came through, so a glance at the output area shows where each column came from.
Output lines are not all drawn at once, because a file with fifty columns would bury the canvas.

A column that comes from no dataset, such as a formula or a column an AI step fills in, starts in the output area.

Lines the AI proposes are dashed until the user accepts them.

### One plan, two editors

The canvas and the chat both edit the same plan.
The plan is structured data, not a picture, so the canvas never has to be interpreted by an AI.
The chat can ask about lines, propose new ones, and draw them itself.
A user who never wants to draw can describe the whole file in words.

### Match kinds

Every match line has a kind, chosen first, and an optional note describing the nuance.

| Match kind    | When to use it                                                                                |
| ------------- | --------------------------------------------------------------------------------------------- |
| Exact         | The two columns hold the same values in the same format.                                      |
| Normalized ID | The same identifier in different formats, checked against a second field to catch collisions. |
| Name match    | Company, person, or organization names that are written differently.                          |
| Time-aware    | The link only holds in certain years or within a window around a date.                        |

### Templates, not generated code

Crosswalk is deterministic.
Every step of a plan is carried out by a tested template, and no code written by an AI is ever run.

An AI may shape a plan in exactly three ways:

- **Settings.**
  Which template, which columns, which match kind, which rule.
- **Formulas.**
  A computed column is written as a formula, like one in a spreadsheet, that the user can read.
- **Prompts.**
  The instructions an AI matching or classifying step is given, including the user's nuance note.

The same plan always produces the same script.
When no template fits a request, Crosswalk says so plainly, does the part it can, and records the request so a template can be added.

### Every row gets an answer

A match ends with one of two answers for each row: a match, or no match.
There is no uncertain pile and no approval step.
The AI's confidence is kept as a column, so a user can filter on it later, but it holds nothing back.

### Accuracy audits

Trust comes from measuring, not from approving.
When a run that used AI matching finishes, an audit checks a random sample of the results and reports the accuracy.
The user chooses the audit each time, on the estimate screen, with its cost shown.

| Audit   | Sample                          | Checked by                             |
| ------- | ------------------------------- | -------------------------------------- |
| Deep    | 10% of the matches, up to 100   | A strong AI model                      |
| Wide    | 20% of the matches, up to 1,000 | A fast, cheap AI model                 |
| Custom  | A share and a cap the user sets | A model the user picks                 |
| By hand | A sample size the user picks    | The user, filling in a verdict per row |
| None    | None                            | Nobody                                 |

- The sample is random with a fixed seed, so the same audit can be drawn again.
- It is drawn from separate groups: matches the AI chose, matches made by exact rules, and rows left unmatched.
  Sampling the unmatched rows is what catches matches the AI missed.
- The AI judge is a different model from the one that made the matches whenever possible.
- The result is called accuracy, and the report always says which audit produced it.
- Audit results are never fed back into the run that was audited.

### Confidential data

The files never leave the user's machine.
The website only ever receives file names, column names, and a profile of each column.

Cell values go to exactly one place, and only when the user says so: an AI provider, during an AI step.
Before any AI step runs, Crosswalk shows exactly which columns it would send and asks.

- A column marked **confidential** is never sent.
  An AI step that needs it cannot run until the user removes the mark.
- A dataset can be marked confidential when it is added, which marks every one of its columns.
- A column can be sent **as tokens** instead of as values, when a step only needs to know which rows are the same.
  The key that turns tokens back into values stays on the user's machine.

### AI keys live on the account

A user adds their own key for each AI provider once, in their account, and it works on every project.
Crosswalk only offers the models of providers the user has added a key for.
Later, users will be able to buy credits instead and never handle a key.

### Language is inferred, not asked

Scripts can be produced for more than one language.
Crosswalk infers the right one from how the user talks and what they ask for.
A non-technical user is never asked and never told, and gets the default.

## Principles

- **One terminal action.**
  Open the folder, run `crosswalk`, and never type in the terminal again.
- **The files stay on the user's machine.**
  Values leave only for an AI step, only for the columns shown, and only after the user agrees.
- **Deterministic.**
  Templates, settings, formulas, and prompts.
  Never generated code.
- **Confirm before run.**
  No step executes that the user has not seen and accepted.
- **Deterministic before fuzzy before AI.**
  Exact matches come first.
  AI chooses from candidates it is shown and never invents an identifier.
- **Measure, do not approve.**
  No human approval queues.
- **Raw inputs are never overwritten.**
  Every output goes to a new file in a new folder.
- **No surprise spending.**
  Time and cost are estimated from real counts before any paid call, and paid answers are cached so an interrupted run resumes for free.
- **Reproducible.**
  Every output has a record with input hashes, the plan, template versions, the models used, and the cost.
- **Simple for the least technical user.**
  If my professor needs me to explain a screen, the screen is wrong.

## Non-goals

- Not a data warehouse or a hosting service for datasets.
- Not a spreadsheet or a general notebook.
- Not a place to edit cell values.
- No code written by an AI at run time.
- No uncertain piles, review queues, or approval columns.
- No scraping or crawling of external sources.

## Success looks like

- My professor completes a real join, enrichment, or panel request from start to finish without contacting me.
- A plan that reproduces a task I have already done by hand gives the same output as my hand-written pipeline.
- The same plan run twice produces the same script and the same output.
- No cell value ever leaves the user's machine except for an AI step the user approved, column by column.
- The cost estimate shown before a run is within a small margin of the actual cost.
- A new user goes from install to a first output file in under fifteen minutes.
