# Crosswalk

Replacing me.

Crosswalk puts your datasets on a canvas so you can describe what you want done with them.
A command line tool reads the files on your machine and sends only column names and a profile of each column.
The constitution is in [`spec/`](spec/): [Mission](spec/Mission.md), [Tech](spec/Tech.md), and [Roadmap](spec/Roadmap.md).

Version 1 is the walking skeleton: accounts, projects, linking the command line tool, schema cards, and a canvas with draggable cards.

## Run it

You need Node 24 and pnpm.
Everything else is installed for you.

```sh
pnpm install
pnpm start
```

`pnpm start` builds the web app and serves it, with the API, at <http://localhost:8787>.
The database is created on first run in `apps/api/.data/`.

Then install the command line tool, once:

```sh
pnpm install-cli
```

## Use it

1. Open <http://localhost:8787>, create an account, and create a project.
2. In a terminal, run `crosswalk login` and confirm the code in the browser.
3. Open a terminal in a folder that holds datasets and run `crosswalk`.
   It lists what it found and every column name it will send, and asks before sending.
   A file, or a single workbook sheet, whose first row looks like data rather than column names is held back, because column names are sent.
   The other sheets of that workbook are still sent.
   Add a header row to what was held back and run `crosswalk` again.
4. The cards appear on the open canvas.
   Drag them where you want them.

Useful commands:

| Command                    | What it does                                                  |
| -------------------------- | ------------------------------------------------------------- |
| `crosswalk`                | Scan this folder and send its datasets to the linked project. |
| `crosswalk --show`         | Print exactly what would be sent, and send nothing.           |
| `crosswalk link`           | Choose which project this folder sends to.                    |
| `crosswalk status`         | Show the account and the project this folder is linked to.    |
| `crosswalk logout`         | Unlink this computer.                                         |
| `crosswalk --follow-links` | Also read files and folders that are links.                   |

The tool reads CSV, TSV, XLSX, XLS, Parquet, and Stata `.dta` files.
It never sends a cell value.

Files and folders that are links are not read unless you pass `--follow-links`.
Hidden folders and the tool folders `node_modules`, `__pycache__`, `site-packages`, and `crosswalk_out` are never read.
The summary names every folder it skipped and counts the links, so you can see when a folder holds more than datasets.
A file the server would refuse, for example one with more than 5,000 columns, is skipped and named, and the rest is still sent.

## Develop

```sh
pnpm dev
```

This runs the API on port 8787 and the web app with live reload on <http://localhost:3210>.
The web app forwards `/api` to the API, so the browser sees one origin.

| Command                       | What it does                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `pnpm lint`                   | Biome for TypeScript, Ruff for Python.                                            |
| `pnpm typecheck`              | Type checks every TypeScript package.                                             |
| `pnpm test`                   | Unit tests: Vitest and pytest.                                                    |
| `pnpm e2e`                    | Builds the app and runs the real server, browser, and command line tool together. |
| `pnpm reset-password <email>` | Sets a new password. Stop the server first.                                       |

After changing the command line tool, run `pnpm install-cli` again to update the installed `crosswalk` command.
After changing the database schema in `apps/api/src/db/schema.ts`, run `pnpm --filter @crosswalk/api db:generate`.

## Settings

All settings are environment variables, and none are required.

| Variable               | Default                  | Purpose                                                             |
| ---------------------- | ------------------------ | ------------------------------------------------------------------- |
| `CROSSWALK_PORT`       | `8787`                   | Port of the server.                                                 |
| `CROSSWALK_DATA_DIR`   | `apps/api/.data`         | Where the database and the signing secret are kept.                 |
| `CROSSWALK_PUBLIC_URL` | The server's own address | The address people open in a browser.                               |
| `GOOGLE_CLIENT_ID`     | Not set                  | Turns on Google sign-in, with the secret below.                     |
| `GOOGLE_CLIENT_SECRET` | Not set                  | The Google OAuth client secret.                                     |
| `CROSSWALK_SERVER`     | `http://localhost:8787`  | The server the command line tool talks to. `--server` overrides it. |

For Google sign-in, create an OAuth client in Google Cloud with the redirect address `<public URL>/api/auth/callback/google`.

## Layout

```
apps/api/           Hono server: accounts, projects, datasets, live events
apps/web/           Next.js web app: the canvas and every other screen
packages/contract/  Types and card geometry shared by the server and the web app
cli/                The crosswalk command, in Python
scripts/            The installer for the command line tool
spec/               Mission, Tech, and Roadmap
```

## Data rules

Crosswalk lives inside the Lex Machina project but never reads its data.
Its code and tests do not open `folder1/` or the `data/`, `outputs/`, and `legacy/` links, and every test uses made-up datasets.
