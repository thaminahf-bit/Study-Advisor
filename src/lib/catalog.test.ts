import { describe, it, expect } from "vitest";
import {
getAllProgrammes,
getProgrammeById,
searchCatalog,
} from "./catalog";

describe("Study Advisor catalogue", () => {
it("loads all 14 programmes", () => {
expect(getAllProgrammes()).toHaveLength(14);
});

it("searches Arabic programme names", () => {
  const results = searchCatalog({
    query: "علم البيانات للمبتدئين",
  });

  expect(results.map((p) => p.id)).toContain("P09");
});

it("searches without case sensitivity", () => {
  const lower = searchCatalog({ query: "data science" });
  const upper = searchCatalog({ query: "DATA SCIENCE" });

  expect(upper.map((p) => p.id)).toEqual(
    lower.map((p) => p.id),
  );
});

it("combines field and scholarship filters", () => {
  const results = searchCatalog({
    field: "computing",
    scholarship: true,
  });

  expect(results).toHaveLength(0);
});

it("returns no results for an unmatched query", () => {
  expect(
    searchCatalog({ query: "underwater basket weaving" }),
  ).toEqual([]);
});

it("returns free programmes in QAR", () => {
  const results = searchCatalog({
    maxFee: 0,
    currency: "QAR",
  });

  expect(results.map((p) => p.id)).toEqual(["P04"]);
});

it("has unique programme IDs", () => {
const ids = getAllProgrammes().map((p) => p.id);
expect(new Set(ids).size).toBe(ids.length);
});

it("finds a programme by ID", () => {
expect(getProgrammeById("P01")?.name_en).toBe(
"Intro to Computer Science",
);
expect(getProgrammeById("UNKNOWN")).toBeUndefined();
});

it("searches by English programme name", () => {
expect(
searchCatalog({ query: "Data Science" }).map((p) => p.id),
).toContain("P09");
});

it("filters computing programmes", () => {
expect(
searchCatalog({ field: "computing" }).map((p) => p.id),
).toEqual(["P01", "P06", "P09", "P13"]);
});

it("filters programmes by country", () => {
expect(
searchCatalog({ country: "Qatar" }).map((p) => p.id),
).toEqual(["P04", "P08", "P11"]);
});

it("filters programmes with scholarships", () => {
expect(
searchCatalog({ scholarship: true }).map((p) => p.id),
).toEqual(["P02", "P05", "P08", "P12"]);
});

it("filters by teaching language", () => {
expect(
searchCatalog({ language: "ar" }).map((p) => p.id),
).toEqual(["P04", "P08", "P11"]);
});

it("filters by maximum duration", () => {
expect(
searchCatalog({ maxWeeks: 2 }).every((p) => p.weeks <= 2),
).toBe(true);
});

it("filters fees using the selected currency", () => {
const results = searchCatalog({
maxFee: 1000,
currency: "QAR",
});

expect(results.map((p) => p.id)).toEqual(["P04", "P11"]);
expect(results.every((p) => p.currency === "QAR")).toBe(true);

});
});