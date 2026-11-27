# Mission

## Why this exists

Crosswalk exists to replace the routine part of a research assistant's job.
A researcher describes what they want done to their datasets, confirms a plan they can see, and gets the finished file, without writing code and without waiting on an RA.

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
- Some columns are licensed or private, and must be hidden or disguised before anything is shared.
- Raw inputs are never overwritten, and every output can say exactly how it was made.

## Who it is for

- **First:** my professor and me.
  The goal is reached when my professor finishes a real request without contacting me.
- **Then:** our research group.
- **Finally:** any researcher, as a public product with sign-up and billing.

Users range from people who have never opened a terminal to people who want to read every line of the script.
Crosswalk must serve both without asking either to configure anything.

## How it works

1. **Install the CLI and link it.**
   The user installs one command line tool and links it to their web account once.
2. **Open a terminal in the data folder and run `crosswalk`.**
   The CLI reads each dataset's column headers and a local profile of each column, and sends them to the web session.
3. **See the datasets as cards on a canvas.**
   Each card lists the dataset's columns.
   The user marks which columns are open, pseudonymous, or hidden.
4. **Describe the task, in any order, by drawing or by chatting.**
   The user can draw an arrow from one column to another and pick what it means.
   The user can also type what they want and never draw anything.
   The chat can ask about arrows, suggest new ones, and draw them itself.
5. **Confirm the plan.**
   Anything the AI inferred appears as a dashed, proposed step with a plain-language explanation.
   Nothing runs until the user confirms it.
6. **Review the estimate.**
   Before any paid AI call, the CLI shows the estimated run time and API cost, computed locally from the real row counts.
7. **Run.**
   The confirmed script is sent to the CLI, which already has everything needed to run it.
   If the script needs an AI model, the CLI asks for the user's own API key and keeps it on their machine.
8. **Get the output.**
   The constructed file and a manifest that records how the output was made.
9. **Get the accuracy audit.**
   When a run used AI matching, an audit starts on its own when the run finishes and reports how accurate the matches are.

## Core ideas

### One plan, two editors

The canvas and the chat both edit the same plan.
The plan is structured data, not a picture, so the canvas never has to be interpreted by an AI.
AI is used to suggest steps and to understand what the user typed, and every suggestion lands in the plan as a proposal the user can see.

### Match kinds

Every arrow that links two columns has a match kind, chosen first, and an optional note describing the nuance.

| Match kind    | When to use it                                                                                |
| ------------- | --------------------------------------------------------------------------------------------- |
| Exact         | The two columns hold the same values in the same format.                                      |
| Normalized ID | The same identifier in different formats, checked against a second field to catch collisions. |
| Name match    | Company, person, or organization names that are written differently.                          |
| Time-aware    | The link only holds in certain years or within a window around a date.                        |
| Custom        | Anything else, described in the user's own words.                                             |

Each built-in match kind is a tested recipe, not code written fresh by an AI each time.
A name match always runs the same way: clean the names, match exactly where possible, retrieve a short list of candidates for the rest, let the AI pick only from that list, and cache every answer.

### Every row gets an answer

A match recipe ends with one of two answers for each row: a match, or no match.
There is no uncertain pile and no approval step.
The AI's confidence is kept as a column, so a user can filter on it later, but it holds nothing back.
Experience on the Lex Machina work showed that human approval queues cost far more time than they were worth.

### Accuracy audits

Trust comes from measuring, not from approving.
When a run that used AI matching finishes, an audit runs automatically on a random sample of the results and reports the accuracy.

| Audit   | Sample                          | Checked by                             |
| ------- | ------------------------------- | -------------------------------------- |
| Deep    | 10% of the matches, up to 100   | A strong AI model                      |
| Wide    | 20% of the matches, up to 1,000 | A fast, cheap AI model                 |
| By hand | A sample size the user picks    | The user, filling in a verdict per row |
| Off     | None                            | Nobody                                 |

- The sample is random with a fixed seed, so the same audit can be drawn again.
- It is drawn from separate groups: matches the AI chose, matches made by exact rules, and rows left unmatched.
  Sampling the unmatched rows is what catches matches the AI missed.
- The AI judge is a different model from the one that made the matches whenever possible.
- The report gives the share of matches that are right, the share of unmatched rows that should have matched, and a list of every disagreement.
- A report from an AI judge is labeled as AI-judged.
  Only a by-hand audit is called measured accuracy.
- Audit results are never fed back into the run that was audited.
  Tuning on the audit sample would make the number meaningless.

### Privacy marks

Every column has one of three marks.

| Mark         | What it means                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Open         | Values may be sent to Crosswalk and to AI models.                                                                                      |
| Pseudonymous | Each value is replaced by a stable token before it leaves the machine. The same value always gets the same token, so joins still work. |
| Hidden       | Values never leave the machine. Used for columns that need no processing or must stay private.                                         |

When a dataset is added, the CLI asks one question: may values from this dataset be shared?
Yes makes every column open, and no makes every column hidden.
The user then changes individual columns on the canvas.
The key that turns tokens back into values stays on the user's machine.

### Language is inferred, not asked

Scripts can be generated for more than one language.
Crosswalk infers the right one from how the user talks and what they ask for.
A non-technical user is never asked and never told, and gets the default.

## Principles

- **The user decides what leaves the machine.**
  Data may be shared when no license or privacy rule forbids it, and the privacy marks are how the user says so.
  A hidden column's values are never sent, and a pseudonymous column is only ever sent as tokens.
- **Measure, do not approve.**
  No human approval queues.
  Every AI matching run ends with an accuracy audit unless the user turns it off.
- **Confirm before run.**
  No step executes that the user has not seen and accepted.
- **Deterministic before fuzzy before AI.**
  Exact matches come first.
  AI chooses from candidates it is shown and never invents an identifier.
- **Raw inputs are never overwritten.**
  Every output goes to a new file in a new folder.
- **No surprise spending.**
  Time and cost are estimated from real counts before any paid call, and paid answers are cached so an interrupted run resumes for free.
- **Reproducible.**
  Every output has a manifest with input hashes, the plan, recipe versions, the model used, and the cost.
- **Tested recipes over generated code.**
  The more of a script that comes from the tested runtime, and the less that is written fresh, the better.
- **Simple for the least technical user.**
  If my professor needs me to explain a screen, the screen is wrong.

## Non-goals

- Not a data warehouse or a hosting service for datasets.
- Not a spreadsheet or a general notebook.
- Not a place to edit cell values on the web.
- No scraping or crawling of external sources in v1.
- No uncertain piles, review queues, or approval columns.

## Success looks like

- My professor completes a real join, enrichment, or panel request from start to finish without contacting me.
- A script that Crosswalk produces for a task I have already done by hand gives the same output as my hand-written pipeline.
- No value from a hidden column ever leaves the user's machine, and no pseudonymous value leaves as anything but a token.
- Every AI matching run reports an accuracy number, and a by-hand audit of the same run agrees with it.
- The cost estimate shown before a run is within a small margin of the actual cost.
- A new user goes from install to a first output file in under fifteen minutes.
