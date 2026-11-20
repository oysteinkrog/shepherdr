import { expect, test } from "bun:test";
import { fuzzyScore } from "./fuzzy.js";

test("every word must be found; any case", () => {
  expect(fuzzyScore("shep", "Shepherdr")).not.toBeNull();
  expect(fuzzyScore("SHEP herdr", "Shepherdr")).not.toBeNull();
  expect(fuzzyScore("shep zebra", "Shepherdr")).toBeNull();
  expect(fuzzyScore("", "anything")).toBe(0);
});

test("letters in order but apart match, as fzf", () => {
  expect(fuzzyScore("shpdr", "Shepherdr")).not.toBeNull();
  expect(fuzzyScore("shep12", "SHEP-12")).not.toBeNull();
  expect(fuzzyScore("rdhs", "Shepherdr")).toBeNull();
});

test("one slip in a word of 4 letters or more still matches", () => {
  expect(fuzzyScore("shpeherdr", "Shepherdr")).not.toBeNull(); // swapped
  expect(fuzzyScore("shepxherdr", "Shepherdr")).not.toBeNull(); // extra letter
  expect(fuzzyScore("shepjerdr", "Shepherdr")).not.toBeNull(); // wrong letter
  expect(fuzzyScore("sheepdgo", "sheepdog")).not.toBeNull();
  // short words get no slip
  expect(fuzzyScore("hte", "the")).toBeNull();
  // two slips is too many
  expect(fuzzyScore("hsepjerdr", "Shepherdr")).toBeNull();
});

test("a whole word scores above scattered letters, a word start above the middle", () => {
  expect(fuzzyScore("herdr", "herdr app")).toBeGreaterThan(fuzzyScore("herdr", "her drawing room"));
  expect(fuzzyScore("app", "herdr app")).toBeGreaterThan(fuzzyScore("app", "unhappy"));
  expect(fuzzyScore("ga", "getAll")).toBeGreaterThan(fuzzyScore("ga", "megawatt"));
  // an exact hit beats one found only with a slip
  expect(fuzzyScore("sheep", "sheep")).toBeGreaterThan(fuzzyScore("sheep", "shepe"));
});

test("the first field counts more than the rest", () => {
  expect(fuzzyScore("voice", "Voice page", "other")).toBeGreaterThan(fuzzyScore("voice", "Other", "voice page"));
});

test("letters spread far apart in a long text are no match", () => {
  expect(fuzzyScore("abc", "a" + " x".repeat(40) + " b" + " y".repeat(40) + " c")).toBeNull();
  // but a tight hit later in the text is found
  expect(fuzzyScore("abc", "a" + " x".repeat(40) + " abc")).not.toBeNull();
});

test("empty and missing fields are skipped", () => {
  expect(fuzzyScore("x", null, undefined, "", "x")).not.toBeNull();
  expect(fuzzyScore("x", null, undefined, "")).toBeNull();
});
