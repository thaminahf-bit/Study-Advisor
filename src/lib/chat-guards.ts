import type { Programme } from "@/lib/catalog";

export type AdvisorOutput = {
  message: string;
  choices: string[];
  programmeIds: string[];
};

export type StudentFacts = {
  interest?: string;
  budget?: string;
  englishLevel?: string;
  preferredCountry?: string;
  preferredLanguage?: string;
};

export function sanitizeAdvisorOutput(
  raw: AdvisorOutput,
  catalog: Programme[],
  facts: StudentFacts,
): AdvisorOutput {
  const validIds = new Set(catalog.map((programme) => programme.id));

  // Only recommend after learning the essential preferences.
  const hasEnoughInformation = Boolean(
    facts.interest?.trim() &&
    facts.budget?.trim() &&
    facts.englishLevel?.trim()
  );

  const programmeIds = hasEnoughInformation
    ? [...new Set(raw.programmeIds)].filter((id) => validIds.has(id))
    : [];

  const choices = raw.choices
    .filter((choice) => typeof choice === "string")
    .slice(0, 3)
    .map((choice) => [...choice].slice(0, 20).join(""));

  return {
    message:
      typeof raw.message === "string" && raw.message.trim()
        ? raw.message.slice(0, 2000)
        : "What would you like to study?",
    choices,
    programmeIds,
  };
}
