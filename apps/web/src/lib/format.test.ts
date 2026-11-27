import { describe, expect, it } from "vitest";
import { errorMessage } from "./api";
import { formatShare, formatUserCode, plural, profileLines, safeNextPath, timeAgo } from "./format";

describe("plural", () => {
  it("groups thousands and agrees with the count", () => {
    expect(plural(1, "row")).toBe("1 row");
    expect(plural(0, "row")).toBe("0 rows");
    expect(plural(37702, "row")).toBe("37,702 rows");
  });
});

describe("formatShare", () => {
  it("never rounds a small share to zero or a large one to all", () => {
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(0.0004)).toBe("under 1%");
    expect(formatShare(0.333)).toBe("33%");
    expect(formatShare(0.9996)).toBe("over 99%");
    expect(formatShare(1)).toBe("100%");
  });
});

describe("profileLines", () => {
  const base = { name: "firm_id", nullRate: 0, distinctCount: 3, uniqueRate: 1 };

  it("describes shape, emptiness, and uniqueness", () => {
    expect(
      profileLines({ ...base, type: "text", shape: "6 digits, some with leading zeros" }),
    ).toEqual(["6 digits, some with leading zeros.", "0% empty.", "Every value is different."]);
  });

  it("counts different values when they repeat", () => {
    expect(
      profileLines({
        ...base,
        type: "integer",
        shape: "whole numbers, 4 digits",
        nullRate: 0.25,
        distinctCount: 21,
        uniqueRate: 0.01,
      }),
    ).toEqual(["Whole numbers, 4 digits.", "25% empty.", "21 different values."]);
  });

  it("says so when a column is empty", () => {
    expect(profileLines({ ...base, type: "empty", shape: "no values", nullRate: 1 })).toEqual([
      "Every cell in this column is empty.",
    ]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it("reads naturally at every scale", () => {
    expect(timeAgo(ago(5), now)).toBe("just now");
    expect(timeAgo(ago(60), now)).toBe("1 minute ago");
    expect(timeAgo(ago(60 * 12), now)).toBe("12 minutes ago");
    expect(timeAgo(ago(3600 * 3), now)).toBe("3 hours ago");
    expect(timeAgo(ago(86400 * 2), now)).toBe("2 days ago");
    expect(timeAgo(ago(86400 * 65), now)).toBe("2 months ago");
    expect(timeAgo(ago(86400 * 800), now)).toBe("2 years ago");
  });

  it("treats a moment in the future as now", () => {
    expect(timeAgo(ago(-30), now)).toBe("just now");
  });
});

describe("formatUserCode", () => {
  it("splits a code into two groups", () => {
    expect(formatUserCode("abcd1234")).toBe("ABCD-1234");
    expect(formatUserCode("ABCD-1234")).toBe("ABCD-1234");
    expect(formatUserCode("abc")).toBe("ABC");
  });
});

describe("safeNextPath", () => {
  it("only allows paths inside the app", () => {
    expect(safeNextPath("/device/?user_code=ABCD1234")).toBe("/device/?user_code=ABCD1234");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/.//evil.example")).toBe("/");
    expect(safeNextPath("/./../\\evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("refuses an address a browser reads as another site once it drops tabs and newlines", () => {
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
    expect(safeNextPath("/\r/evil.example")).toBe("/");
    expect(safeNextPath("\t//evil.example")).toBe("/");
  });

  it("keeps the query and the fragment of a path inside the app", () => {
    expect(safeNextPath("/project/?id=p1#card")).toBe("/project/?id=p1#card");
  });
});

describe("errorMessage", () => {
  it("prefers the most specific sentence", () => {
    expect(errorMessage({ error: "bad", error_description: "The code has expired." }, 400)).toBe(
      "The code has expired.",
    );
    expect(errorMessage({ message: "Invalid email or password" }, 401)).toBe(
      "Invalid email or password",
    );
    expect(errorMessage(null, 500)).toBe("Something went wrong (500).");
  });
});
