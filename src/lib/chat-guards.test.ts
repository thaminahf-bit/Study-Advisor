import { describe, expect, it } from "vitest";
import { getAllProgrammes } from "@/lib/catalog";
import { sanitizeAdvisorOutput } from "@/lib/chat-guards";

const completeFacts = {
  interest: "computing",
  budget: "4000 GBP",
  englishLevel: "IELTS 6",
};

describe("sanitizeAdvisorOutput", () => {
  it("removes programme IDs that are not in the catalogue", () => {
    const result = sanitizeAdvisorOutput(
      {
        message: "Here are some programmes.",
        choices: [],
        programmeIds: ["P01", "FAKE999"],
      },
      getAllProgrammes(),
      completeFacts,
    );

    expect(result.programmeIds).toEqual(["P01"]);
  });

  it("does not recommend before essential facts are known", () => {
    const result = sanitizeAdvisorOutput(
      {
        message: "I can help!",
        choices: [],
        programmeIds: ["P01"],
      },
      getAllProgrammes(),
      { interest: "computing" },
    );

    expect(result.programmeIds).toEqual([]);
  });

  it("limits choices to three", () => {
    const result = sanitizeAdvisorOutput(
      {
        message: "Choose one.",
        choices: ["One", "Two", "Three", "Four"],
        programmeIds: [],
      },
      getAllProgrammes(),
      {},
    );

    expect(result.choices).toHaveLength(3);
  });

  it("limits each choice to 20 characters", () => {
    const result = sanitizeAdvisorOutput(
      {
        message: "Choose one.",
        choices: ["This choice is much too long"],
        programmeIds: [],
      },
      getAllProgrammes(),
      {},
    );

    expect(result.choices[0].length).toBeLessThanOrEqual(20);
  });
});
