import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { SERVER_URL } from "../playwright.config";
import { Terminal, waitForOutput } from "./cli";

const PASSWORD = "a long enough password";
let counter = 0;

function newEmail(): string {
  counter += 1;
  return `researcher${Date.now()}${counter}@example.com`;
}

async function signUp(page: Page, email = newEmail()): Promise<string> {
  await page.goto("/signup/");
  await page.getByLabel("Name").fill("Ada Researcher");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  return email;
}

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByLabel("New project").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  const link = page.getByRole("link", { name });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const id = new URL(href ?? "", SERVER_URL).searchParams.get("id");
  expect(id).toBeTruthy();
  return id as string;
}

/** Runs `crosswalk login` and confirms the code in the browser, like a person would. */
async function linkTerminal(page: Page, terminal: Terminal): Promise<void> {
  const login = terminal.start(["login", "--no-browser"]);
  const [, url] = await waitForOutput(login.output, /Open (http\S+)/);
  const [, shown] = await waitForOutput(login.output, /^\s+([A-Z0-9]{4}-[A-Z0-9]{4})\s*$/m);
  await page.goto(url as string);
  await expect(page.getByText(shown as string, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Link this computer" }).click();
  await expect(page.getByText("The computer is linked.")).toBeVisible();
  const result = await login.done;
  expect(result.output).toContain("Linked to ");
  expect(result.code).toBe(0);
}

/** The page's own error message. Next.js keeps an empty alert of its own for route changes. */
function problem(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

const FIRMS = [
  "firm_id,firm_name,first_year",
  "001001,Northwind Traders,2019",
  "001002,Contoso Ltd,2020",
  "020003,Fabrikam Inc,2021",
  "",
].join("\n");
const CASES = [
  "case_ref\tfiled_on\tamount",
  "AB-1001\t2020-01-05\t12.5",
  "CD-2002\t2021-03-09\t",
  "",
].join("\n");

test.describe("accounts", () => {
  test("a visitor is sent to log in and comes back to where they were going", async ({ page }) => {
    await page.goto("/devices/");
    await expect(page).toHaveURL(/\/login\/\?next=%2Fdevices%2F$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("sign up, log out, and log in again", async ({ page }) => {
    const email = await signUp(page);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(problem(page)).toContainText("do not match an account");

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  });

  test("sign up explains a short password and a taken email", async ({ page }) => {
    const email = await signUp(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("link", { name: "Create an account" }).click();

    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(problem(page)).toContainText("already an account");
    await expectNoAccessibilityViolations(page);
  });

  test("Google sign-in is hidden until it is configured", async ({ page }) => {
    await page.goto("/login/");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
  });
});

test.describe("projects", () => {
  test("create, rename, and delete", async ({ page }) => {
    await signUp(page);
    await expect(page.getByText("You have no projects yet.")).toBeVisible();

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText("Give the project a name.")).toBeVisible();

    await createProject(page, "Supplier panel");
    await expect(page.getByText(/0 datasets, changed just now/)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Rename Supplier panel" }).click();
    await page.getByLabel("New name for Supplier panel").fill("Buyer panel");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("link", { name: "Buyer panel" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Buyer panel" }).click();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByRole("link", { name: "Buyer panel" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Buyer panel" }).click();
    await page.getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByText("You have no projects yet.")).toBeVisible();
  });

  test("a project that does not exist says so", async ({ page }) => {
    await signUp(page);
    await page.goto("/project/?id=not-a-project");
    await expect(page.getByRole("heading", { name: "That project does not exist" })).toBeVisible();
  });

  test("an unknown address shows the not-found page", async ({ page }) => {
    const response = await page.goto("/nowhere/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "There is no page here" })).toBeVisible();
  });
});

test.describe("the command line tool and the canvas", () => {
  test("link a computer, send datasets, and arrange them", async ({ page }) => {
    await signUp(page);
    const projectId = await createProject(page, "Litigation");
    const terminal = new Terminal(SERVER_URL);
    terminal.write("firms.csv", FIRMS);
    terminal.write("nested/cases.tsv", CASES);
    terminal.write("notes.txt", "not a dataset");

    // Before linking, the tool says what to do.
    const early = await terminal.run(["--yes"]);
    expect(early.code).toBe(1);
    expect(early.output).toContain("crosswalk login");

    await linkTerminal(page, terminal);

    // The empty canvas teaches the three steps, and is live.
    await page.goto(`/project/?id=${projectId}`);
    await expect(
      page.getByRole("heading", { name: "Put your datasets on this canvas" }),
    ).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    await expect(page.getByText("Cards appear here on their own.")).toBeVisible();
    await expectNoAccessibilityViolations(page);

    // --show prints what would be sent and sends nothing.
    const preview = await terminal.run(["--show"]);
    expect(preview.code).toBe(0);
    const body = JSON.parse(preview.output) as { datasets: { key: string }[] };
    expect(body.datasets.map((dataset) => dataset.key)).toEqual(["firms.csv", "nested/cases.tsv"]);
    for (const value of ["Northwind", "Contoso", "001001", "AB-1001", "2020-01-05"]) {
      expect(preview.output).not.toContain(value);
    }

    // Send. The cards appear on the open canvas with no reload.
    expect((await terminal.run(["link", "--project", projectId])).code).toBe(0);
    const sent = await terminal.run(["--yes"]);
    expect(sent.output).toContain("No cell values are sent.");
    expect(sent.output).toContain("Sent. 2 new cards, 0 updated.");
    expect(sent.output).toContain(`/project/?id=${projectId}`);
    expect(sent.code).toBe(0);

    const firms = page.getByRole("article", { name: "Dataset firms.csv" });
    const cases = page.getByRole("article", { name: "Dataset cases.tsv" });
    await expect(firms).toBeVisible();
    await expect(cases).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Put your datasets on this canvas" }),
    ).toHaveCount(0);
    await expect(page.getByText("2 new datasets from the terminal")).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(firms.getByText("3 rows, 3 columns")).toBeVisible();

    // A column shows its profile, and no cell value is on the page.
    await firms.getByRole("button", { name: /firm_id/ }).hover();
    const entry = page.getByRole("tooltip");
    await expect(entry).toContainText("6 digits, some with leading zeros.");
    await expect(entry).toContainText("3, all different");
    await expect(page.getByText("Northwind")).toHaveCount(0);
    await page.mouse.move(5, 300);
    await expect(entry).toHaveCount(0);

    // The cards do not overlap.
    const firmsBox = await firms.boundingBox();
    const casesBox = await cases.boundingBox();
    if (firmsBox === null || casesBox === null) {
      throw new Error("The cards have no position.");
    }
    const apart =
      firmsBox.x + firmsBox.width <= casesBox.x ||
      casesBox.x + casesBox.width <= firmsBox.x ||
      firmsBox.y + firmsBox.height <= casesBox.y ||
      casesBox.y + casesBox.height <= firmsBox.y;
    expect(apart).toBe(true);
    await expectNoAccessibilityViolations(page);

    // Drag a card, reload, and it is where it was left.
    const saved = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.ok(),
    );
    await page.mouse.move(firmsBox.x + 60, firmsBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(firmsBox.x + 160, firmsBox.y + 120, { steps: 8 });
    await page.mouse.move(firmsBox.x + 260, firmsBox.y + 270, { steps: 8 });
    await page.mouse.up();
    await saved;
    const moved = await firms.boundingBox();
    // The card follows the pointer, less the few pixels it takes to tell a drag from a click.
    expect(Math.abs((moved?.x ?? 0) - firmsBox.x - 200)).toBeLessThan(20);
    expect(Math.abs((moved?.y ?? 0) - firmsBox.y - 250)).toBeLessThan(20);

    const stored = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${id}/datasets`);
      const data = (await response.json()) as { datasets: { key: string; x: number; y: number }[] };
      return data.datasets;
    }, projectId);
    const storedFirms = stored.find((dataset) => dataset.key === "firms.csv");
    const storedCases = stored.find((dataset) => dataset.key === "nested/cases.tsv");

    await page.reload();
    await expect(firms).toBeVisible();
    const after = await page.evaluate(async (id) => {
      const response = await fetch(`/api/projects/${id}/datasets`);
      const data = (await response.json()) as { datasets: { key: string; x: number; y: number }[] };
      return data.datasets;
    }, projectId);
    expect(after.find((dataset) => dataset.key === "firms.csv")).toEqual(storedFirms);
    // On screen, the two cards keep the same offset from each other after the reload.
    const firmsAfter = await firms.boundingBox();
    const casesAfter = await cases.boundingBox();
    const scale = (firmsAfter?.width ?? 0) / firmsBox.width;
    const expectedX = ((storedFirms?.x ?? 0) - (storedCases?.x ?? 0)) * scale;
    const expectedY = ((storedFirms?.y ?? 0) - (storedCases?.y ?? 0)) * scale;
    expect(Math.abs((firmsAfter?.x ?? 0) - (casesAfter?.x ?? 0) - expectedX)).toBeLessThan(2);
    expect(Math.abs((firmsAfter?.y ?? 0) - (casesAfter?.y ?? 0) - expectedY)).toBeLessThan(2);

    // Sending again updates the cards in place and keeps the moved one where it is.
    terminal.write("firms.csv", FIRMS.replace("first_year", "first_year,sector"));
    const again = await terminal.run(["--yes"]);
    expect(again.output).toContain("Sent. 0 new cards, 2 updated.");
    await expect(firms.getByText("3 rows, 4 columns")).toBeVisible();
    const afterUpdate = await firms.boundingBox();
    expect(Math.abs((afterUpdate?.x ?? 0) - (firmsAfter?.x ?? 0))).toBeLessThan(2);

    // The keyboard moves a card too, and the move is saved.
    const keyboardSave = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.ok(),
    );
    await page
      .getByRole("group", { name: /^Dataset cases\.tsv\. Press Enter to select it/ })
      .focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await keyboardSave;

    // The arrow keys inside a card walk its columns instead of moving it.
    await firms.getByRole("button", { name: /firm_id/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(firms.getByRole("button", { name: /firm_name/ })).toBeFocused();
    await expect(page.getByRole("tooltip")).toContainText("firm_name");

    // Remove a card, with a way back.
    await cases.getByRole("button", { name: "Remove cases.tsv from the canvas" }).click();
    await cases.getByRole("button", { name: "Keep" }).click();
    await expect(cases).toBeVisible();
    await cases.getByRole("button", { name: "Remove cases.tsv from the canvas" }).click();
    await cases.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(cases).toHaveCount(0);
    await expect(firms).toBeVisible();

    // The linked computer is listed and can be unlinked.
    await page.getByRole("link", { name: "Linked devices" }).click();
    await expect(page.getByText(/linked .*, last used /)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: /^Unlink / }).click();
    await page.getByRole("button", { name: "Unlink", exact: true }).click();
    await expect(page.getByText("No computer is linked yet.")).toBeVisible();

    const refused = await terminal.run(["--yes"]);
    expect(refused.code).toBe(1);
    expect(refused.output).toContain("crosswalk login");
  });

  test("a refused code links nothing", async ({ page }) => {
    await signUp(page);
    const terminal = new Terminal(SERVER_URL);
    const login = terminal.start(["login", "--no-browser"]);
    const [, url] = await waitForOutput(login.output, /Open (http\S+)/);
    await page.goto(url as string);
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: "Refuse" }).click();
    await expect(page.getByText("The request was refused.")).toBeVisible();
    const result = await login.done;
    expect(result.code).toBe(1);
    expect(result.output).toContain("refused in the browser");
  });

  test("a code that is not waiting is explained, and one can be typed by hand", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/device/?user_code=ZZZZ9999");
    await expect(problem(page)).toContainText("not waiting to be confirmed");
    await page.getByRole("button", { name: "Type a code" }).click();

    const terminal = new Terminal(SERVER_URL);
    const login = terminal.start(["login", "--no-browser"]);
    const [, shown] = await waitForOutput(login.output, /^\s+([A-Z0-9]{4}-[A-Z0-9]{4})\s*$/m);
    await page.getByLabel("Code from the terminal").fill((shown as string).toLowerCase());
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Link this computer" }).click();
    await expect(page.getByText("The computer is linked.")).toBeVisible();
    expect((await login.done).code).toBe(0);
  });

  test("the tool links a folder by asking which project", async ({ page }) => {
    await signUp(page);
    await createProject(page, "Only project");
    const terminal = new Terminal(SERVER_URL);
    terminal.write("firms.csv", FIRMS);
    await linkTerminal(page, terminal);

    const status = await terminal.run(["status"]);
    expect(status.output).toContain("this folder is not linked");

    const empty = new Terminal(SERVER_URL);
    const nothing = await empty.run(["--yes"]);
    expect(nothing.output).toContain("No datasets were found in this folder.");
  });
});
