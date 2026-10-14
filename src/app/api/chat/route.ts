import { generateText, stepCountIs, tool } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

import { getAllProgrammes, searchCatalog } from "@/lib/catalog";
import {
  sanitizeAdvisorOutput,
  type StudentFacts,
} from "@/lib/chat-guards";

// --------------------------------------------------
// 1. Request and response validation
// --------------------------------------------------

const factsSchema = z.object({
  interest: z.string().optional(),
  budget: z.string().optional(),
  englishLevel: z.string().optional(),
  preferredCountry: z.string().optional(),
  preferredLanguage: z.string().optional(),
});

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(30),
  facts: factsSchema.optional(),
});

const responseSchema = z.object({
  message: z.string().min(1).max(2000),
  choices: z.array(z.string().max(20)).max(3),
  programmeIds: z.array(z.string()).max(3),
});

const modelOutputSchema = z.object({
  message: z.string().min(1).max(2000),
  choices: z.array(z.string().max(200)).max(10),
  programmeIds: z.array(z.string()).max(10),
});

type BudgetInfo = {
  amount?: number;
  currency?: string;
  flexible: boolean;
  needsAmount: boolean;
};

type OptionAction =
  | "increase-budget"
  | "change-field"
  | "scholarships";

// --------------------------------------------------
// 2. Language and response helpers
// --------------------------------------------------

function detectArabic(message: string): boolean {
  return /[\u0600-\u06FF]/.test(message);
}

function clipChoices(choices: string[]): string[] {
  return choices
    .filter((choice) => typeof choice === "string")
    .slice(0, 3)
    .map((choice) => [...choice].slice(0, 20).join(""));
}

function isGreeting(message: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|salam|assalamu alaikum)[!.?,\s]*$/i.test(
    message.trim(),
  );
}

function getNextQuestion(
  facts: StudentFacts,
  isArabic: boolean,
) {
  if (!facts.interest?.trim()) {
    return {
      message: isArabic
        ? "ما المجال الذي ترغب في دراسته؟"
        : "What would you like to study?",
      choices: isArabic
        ? ["الحاسوب", "الطب", "الهندسة"]
        : ["Computing", "Medicine", "Engineering"],
    };
  }

  if (!facts.budget?.trim()) {
    return {
      message: isArabic
        ? "ما ميزانيتك القصوى للبرنامج؟ يمكنك إدخال المبلغ فقط."
        : "What's your maximum budget? You can enter just the amount.",
      choices: isArabic
        ? ["1000 ر.ق", "3000 ر.ق", "ميزانية مرنة"]
        : ["1000 QAR", "3000 QAR", "Flexible"],
    };
  }

  if (!facts.englishLevel?.trim()) {
    return {
      message: isArabic
        ? "ما مستواك في اللغة الإنجليزية؟"
        : "What is your English level?",
      choices: isArabic
        ? ["مبتدئ", "متوسط", "متقدم"]
        : ["Beginner", "Intermediate", "Advanced"],
    };
  }

  return {
    message: isArabic
      ? "سأبحث عن البرامج المناسبة لك."
      : "I'll look for suitable programmes for you.",
    choices: [],
  };
}

function getOptionAction(message: string): OptionAction | undefined {
  const value = message.trim().toLowerCase();

  if (
    /^(increase budget|higher budget|raise budget|new budget|ميزانية أعلى|زيادة الميزانية)$/.test(
      value,
    )
  ) {
    return "increase-budget";
  }

  if (
    /^(change field|other field|different field|مجال آخر|تغيير المجال)$/.test(
      value,
    )
  ) {
    return "change-field";
  }

  if (
    /^(explore scholarships|scholarships|منح دراسية|استكشاف المنح)$/.test(
      value,
    )
  ) {
    return "scholarships";
  }

  return undefined;
}

// --------------------------------------------------
// 3. Interpret student interests
// --------------------------------------------------

function inferCatalogueField(
  interest: string,
): string | undefined {
  const value = interest.toLowerCase();

  const aliases: Record<string, string[]> = {
    computing: [
      "computing",
      "computer science",
      "computer",
      "technology",
      "programming",
      "data science",
      "robotics",
      "artificial intelligence",
      "machine learning",
      " ai ",
      "علوم الحاسوب",
      "علوم الكمبيوتر",
      "الحاسوب",
      "الكمبيوتر",
      "تقنية",
      "الذكاء الاصطناعي",
    ],
    medicine: [
      "medicine",
      "medical",
      "pre-med",
      "pre med",
      "الطب",
      "طبي",
    ],
    engineering: [
      "engineering",
      "engineer",
      "الهندسة",
      "هندسة",
    ],
    business: [
      "business",
      "economics",
      "entrepreneurship",
      "الأعمال",
      "الاقتصاد",
    ],
    design: [
      "design",
      "architecture",
      "art",
      "calligraphy",
      "التصميم",
      "الفنون",
      "العمارة",
      "الخط العربي",
    ],
    law: [
      "law",
      "legal",
      "international law",
      "القانون",
    ],
    science: [
      "science",
      "environment",
      "biology",
      "العلوم",
      "البيئة",
      "الأحياء",
    ],
    humanities: [
      "humanities",
      "writing",
      "literature",
      "العلوم الإنسانية",
      "الكتابة",
      "الأدب",
    ],
  };

  return Object.entries(aliases).find(([, words]) =>
    words.some((word) => value.includes(word)),
  )?.[0];
}

// --------------------------------------------------
// 4. Budget handling
// --------------------------------------------------

function parseBudget(budget: string): BudgetInfo {
  const value = budget.toLowerCase().replace(/,/g, "");

  const flexible =
    /flexible|no limit|any budget|open budget|مرنة|مفتوحة|أي ميزانية|ميزانية مرنة/.test(
      value,
    );

  const amountMatch = value.match(/\d+(?:\.\d+)?/);
  const amount = amountMatch
    ? Number(amountMatch[0])
    : undefined;

  const currencyAliases: Record<string, string[]> = {
    USD: ["usd", "us dollar", "us dollars"],
    QAR: [
      "qar",
      "qatari riyal",
      "qatari riyals",
      "riyal",
      "riyals",
      "ر.ق",
      "ريال قطري",
      "ريال",
    ],
    GBP: [
      "gbp",
      "pound sterling",
      "british pound",
      "british pounds",
    ],
    EUR: ["eur", "euro", "euros"],
    CAD: ["cad", "canadian dollar", "canadian dollars"],
    MYR: ["myr", "malaysian ringgit", "ringgit"],
    NOK: ["nok", "norwegian krone", "norwegian kroner"],
  };

  let currency: string | undefined;

  for (const [code, aliases] of Object.entries(currencyAliases)) {
    if (aliases.some((alias) => value.includes(alias))) {
      currency = code;
      break;
    }
  }

  // Currency symbols and bare amounts do not trigger extra questions.
  if (!currency && value.includes("$")) currency = "USD";
  if (!currency && value.includes("£")) currency = "GBP";
  if (!currency && value.includes("€")) currency = "EUR";
  if (!currency && value.includes("﷼")) currency = "QAR";

  // A bare amount defaults to QAR.
  if (!currency && amount !== undefined && !flexible) {
    currency = "QAR";
  }

  return {
    amount,
    currency,
    flexible,
    needsAmount: amount === undefined && !flexible,
  };
}

function buildSearchFilters(facts: StudentFacts) {
  const field = inferCatalogueField(facts.interest ?? "");
  const budget = parseBudget(facts.budget ?? "");

  return {
    ...(field ? { field } : {}),
    ...(budget.currency ? { currency: budget.currency } : {}),
    ...(budget.currency && budget.amount !== undefined
      ? { maxFee: budget.amount }
      : {}),
    ...(facts.preferredCountry?.trim()
      ? { country: facts.preferredCountry.trim() }
      : {}),
  };
}

// --------------------------------------------------
// 5. No-match and recommendation responses
// --------------------------------------------------

function buildNoMatchResponse(
  isArabic: boolean,
  scholarshipSearch = false,
) {
  if (isArabic) {
    return {
      message: scholarshipSearch
        ? "لم نجد برامج بمنح تطابق تفضيلاتك وميزانيتك. يمكنك تغيير المجال أو زيادة الميزانية."
        : "لم نجد برنامجًا يطابق مجال اهتمامك وميزانيتك. يمكنك استكشاف المنح أو تغيير المجال.",
      choices: scholarshipSearch
        ? ["مجال آخر", "ميزانية أعلى"]
        : ["منح دراسية", "مجال آخر", "ميزانية أعلى"],
      programmeIds: [],
    };
  }

  return {
    message: scholarshipSearch
      ? "I couldn't find scholarship programmes matching your preferences and budget. You can change your field or increase your budget."
      : "I couldn't find a programme matching your field and budget. You can explore scholarships or change your field.",
    choices: scholarshipSearch
      ? ["Change field", "Increase budget"]
      : ["Explore scholarships", "Change field", "Increase budget"],
    programmeIds: [],
  };
}

// --------------------------------------------------
// 6. Chat API
// --------------------------------------------------

export async function POST(request: Request) {
  let requestIsArabic = false;

  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid chat request." },
        { status: 400 },
      );
    }

    const messages = parsed.data.messages;

    const latestUserMessage =
      [...messages]
        .reverse()
        .find((message) => message.role === "user")
        ?.content.trim() ?? "";

    const facts: StudentFacts = { ...parsed.data.facts };

    const optionAction = getOptionAction(latestUserMessage);

    const isArabicMessage =
      detectArabic(latestUserMessage) ||
      detectArabic(facts.interest ?? "") ||
      facts.preferredLanguage?.toLowerCase().startsWith("ar") === true;

    requestIsArabic = isArabicMessage;
    const isArabic = isArabicMessage;

    // ------------------------------------------------
    // A. Handle follow-up buttons as real actions
    // ------------------------------------------------

    if (optionAction === "increase-budget") {
      delete facts.budget;

      return Response.json({
        message: isArabic
          ? "ما ميزانيتك الجديدة؟ يمكنك إدخال المبلغ والعملة إن رغبت."
          : "What's your new maximum budget? You can enter the amount and currency, if you wish.",
        choices: isArabic
          ? ["1000 ر.ق", "3000 ر.ق", "ميزانية مرنة"]
          : ["1000 QAR", "3000 QAR", "Flexible"],
        programmeIds: [],
        facts,
      });
    }

    if (optionAction === "change-field") {
      delete facts.interest;

      return Response.json({
        message: isArabic
          ? "ما المجال الآخر الذي ترغب في دراسته؟"
          : "Which other subject would you like to study?",
        choices: isArabic
          ? ["الحاسوب", "الطب", "الهندسة"]
          : ["Computing", "Medicine", "Engineering"],
        programmeIds: [],
        facts,
      });
    }

    // ------------------------------------------------
    // B. Collect interest, budget and English level
    //    one question at a time
    // ------------------------------------------------

    if (!facts.interest?.trim()) {
      if (!latestUserMessage || isGreeting(latestUserMessage)) {
        const next = getNextQuestion(facts, isArabic);

        return Response.json({
          message: isArabic
            ? `مرحبًا! ${next.message}`
            : `Hi! ${next.message}`,
          choices: clipChoices(next.choices),
          programmeIds: [],
          facts,
        });
      }

      facts.interest = latestUserMessage;

      // A field change can preserve the other collected facts.
      if (!facts.budget?.trim()) {
        const next = getNextQuestion(facts, isArabic);

        return Response.json({
          message: next.message,
          choices: clipChoices(next.choices),
          programmeIds: [],
          facts,
        });
      }

      if (!facts.englishLevel?.trim()) {
        const next = getNextQuestion(facts, isArabic);

        return Response.json({
          message: next.message,
          choices: clipChoices(next.choices),
          programmeIds: [],
          facts,
        });
      }
    }

    // If there is no budget, the latest answer is the budget.
    const budgetWasMissing = !facts.budget?.trim();

    if (budgetWasMissing) {
      facts.budget = latestUserMessage;
    }

    const budgetInfo = parseBudget(facts.budget ?? "");

    if (budgetInfo.needsAmount) {
      return Response.json({
        message: isArabic
          ? "ما ميزانيتك القصوى؟ يمكنك إدخال مبلغ مثل 2000 أو كتابة ميزانية مرنة."
          : "What's your maximum budget? Enter an amount such as 2000, or choose a flexible budget.",
        choices: isArabic
          ? ["1000 ر.ق", "3000 ر.ق", "ميزانية مرنة"]
          : ["1000 QAR", "3000 QAR", "Flexible"],
        programmeIds: [],
        facts,
      });
    }

    // Do not mistake the budget answer for English proficiency.
    if (budgetWasMissing && !facts.englishLevel?.trim()) {
      const next = getNextQuestion(facts, isArabic);

      return Response.json({
        message: next.message,
        choices: clipChoices(next.choices),
        programmeIds: [],
        facts,
      });
    }

    // The budget already existed, so the latest answer can be English level.
    if (!facts.englishLevel?.trim()) {
      facts.englishLevel = latestUserMessage;
    }

    if (
      !facts.interest?.trim() ||
      !facts.budget?.trim() ||
      !facts.englishLevel?.trim()
    ) {
      const next = getNextQuestion(facts, isArabic);

      return Response.json({
        message: next.message,
        choices: clipChoices(next.choices),
        programmeIds: [],
        facts,
      });
    }

    // ------------------------------------------------
    // C. Search the real catalogue
    // ------------------------------------------------

    const inferredField = inferCatalogueField(facts.interest);
    const filters = buildSearchFilters(facts);
    const exploreScholarships = optionAction === "scholarships";

    let matchingProgrammes = inferredField
      ? searchCatalog({
          ...filters,
          ...(exploreScholarships ? { scholarship: true } : {}),
        })
      : [];

    // If no scholarship matches the student's field, try other fields.
    // Keep budget and currency restrictions.
    if (
      exploreScholarships &&
      matchingProgrammes.length === 0
    ) {
      matchingProgrammes = searchCatalog({
        ...filters,
        field: undefined,
        scholarship: true,
      });
    }

    console.info("[StudyAdvisor] Search filters:", filters);
    console.info(
      "[StudyAdvisor] Search results:",
      matchingProgrammes.map((programme) => programme.id),
    );

    // ------------------------------------------------
    // D. Return no-match responses without calling AI
    // ------------------------------------------------

    if (matchingProgrammes.length === 0) {
      const noMatch = buildNoMatchResponse(
        isArabic,
        exploreScholarships,
      );

      return Response.json({
        ...noMatch,
        choices: clipChoices(noMatch.choices),
        facts,
      });
    }

    // ------------------------------------------------
    // E. Mock mode for tests
    // ------------------------------------------------

    if (process.env.STUDY_ADVISOR_MOCK_MODE === "true") {
      return Response.json({
        message: isArabic
          ? "وجدت برامج تطابق تفضيلاتك. إليك أفضل الخيارات المتاحة."
          : "I found programmes matching your preferences. Here are the available options.",
        choices: [],
        programmeIds: matchingProgrammes
          .slice(0, 3)
          .map((programme) => programme.id),
        facts,
      });
    }

    // ------------------------------------------------
    // F. Use the AI SDK when verified results exist
    // ------------------------------------------------

    let structuredModelOutput:
      | z.infer<typeof responseSchema>
      | undefined;

    const transcript = messages
      .slice(-6)
      .map(
        ({ role, content }) =>
          `${role}: ${content.slice(0, 500)}`,
      )
      .join("\n");

    try {
      const result = await generateText({
        model: groq("openai/gpt-oss-20b"),
        maxRetries: 0,
        maxOutputTokens: 500,
        stopWhen: stepCountIs(4),

        system: `
You are a concise study advisor for high-school students.
Reply in ${isArabic ? "Arabic" : "English"}.

Student facts:
${JSON.stringify(facts)}

Only recommend programmes in this verified list:
${JSON.stringify(
  matchingProgrammes.map((programme) => ({
    id: programme.id,
    name: isArabic ? programme.name_ar : programme.name_en,
    field: programme.field,
    country: programme.country,
    weeks: programme.weeks,
    fee: programme.fee,
    currency: programme.currency,
    min_ielts: programme.min_ielts,
    scholarship: programme.scholarship,
    teaching_language: programme.teaching_language,
  })),
)}

Rules:
- Never invent programmes, IDs, fees, or scholarships.
- Never recommend a programme outside the verified list.
- Do not ask for currency clarification. The server has interpreted the budget.
- Keep the answer concise and supportive.
- Use at most three choices, each no longer than 20 characters.
- Return the final response through the json tool.
        `,

        prompt: `
Recent conversation:
${transcript}

Provide a concise recommendation based on the verified programmes.
Use searchCatalog only if you need to verify a catalogue detail.
Use saveStudentFact if the student explicitly provides a new preference.
Return a final response with message, choices, and programmeIds.
        `,

        tools: {
          json: tool({
            description: "Return the final advisor response.",
            inputSchema: modelOutputSchema,
            execute: async (output) => {
              structuredModelOutput = responseSchema.parse({
                message: output.message.slice(0, 2000),
                choices: clipChoices(output.choices),
                programmeIds: output.programmeIds.slice(0, 3),
              });

              return { accepted: true };
            },
          }),

          searchCatalog: tool({
            description:
              "Search the official catalogue to verify programme options.",
            inputSchema: z.object({
              query: z.string().nullish(),
              field: z.string().nullish(),
              country: z.string().nullish(),
              currency: z.string().nullish(),
              maxFee: z.number().nonnegative().nullish(),
              maxWeeks: z.number().positive().nullish(),
              scholarship: z.boolean().nullish(),
              language: z.enum(["en", "ar"]).nullish(),
            }),
            execute: async (input) => {
              const results = searchCatalog({
                query: input.query ?? undefined,
                field: input.field ?? undefined,
                country: input.country ?? undefined,
                currency: input.currency ?? undefined,
                maxFee: input.maxFee ?? undefined,
                maxWeeks: input.maxWeeks ?? undefined,
                scholarship: input.scholarship ?? undefined,
                language: input.language ?? undefined,
              });

              return results.slice(0, 10).map((programme) => ({
                id: programme.id,
                name_en: programme.name_en,
                name_ar: programme.name_ar,
                field: programme.field,
                country: programme.country,
                weeks: programme.weeks,
                fee: programme.fee,
                currency: programme.currency,
                min_ielts: programme.min_ielts,
                scholarship: programme.scholarship,
                teaching_language: programme.teaching_language,
              }));
            },
          }),

          saveStudentFact: tool({
            description:
              "Save a preference explicitly provided by the student.",
            inputSchema: z.object({
              key: z.enum([
                "interest",
                "budget",
                "englishLevel",
                "preferredCountry",
                "preferredLanguage",
              ]),
              value: z.string().min(1).max(200),
            }),
            execute: async ({ key, value }) => {
              facts[key] = value.trim();

              return {
                saved: true,
                key,
                value: facts[key],
              };
            },
          }),
        },
      });

      // The model may return a JSON tool call or plain JSON text.
      if (!structuredModelOutput && result.text.trim()) {
        let candidate = result.text.trim();

        if (candidate.startsWith("```")) {
          candidate = candidate
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();
        }

        try {
          const output = modelOutputSchema.safeParse(
            JSON.parse(candidate),
          );

          if (output.success) {
            structuredModelOutput = responseSchema.parse({
              message: output.data.message.slice(0, 2000),
              choices: clipChoices(output.data.choices),
              programmeIds: output.data.programmeIds.slice(0, 3),
            });
          }
        } catch {
          // Use the deterministic response below if output is invalid.
        }
      }
    } catch (modelError) {
      console.error(
        "[StudyAdvisor] Model unavailable; using verified results:",
        modelError instanceof Error
          ? modelError.message
          : String(modelError),
      );
    }

    // ------------------------------------------------
    // G. Enforce server-side recommendation safety
    // ------------------------------------------------

    const allProgrammes = getAllProgrammes();

    const safeModelOutput = structuredModelOutput
      ? sanitizeAdvisorOutput(
          structuredModelOutput,
          allProgrammes,
          facts,
        )
      : undefined;

    // Only IDs returned by the deterministic, filtered search are valid.
    const allowedIds = new Set(
      matchingProgrammes.map((programme) => programme.id),
    );

    const programmeIds = (
      safeModelOutput?.programmeIds ?? []
    )
      .filter((id) => allowedIds.has(id))
      .slice(0, 3);

    // If the model's IDs were invalid or empty, use verified results.
    const finalProgrammeIds =
      programmeIds.length > 0
        ? programmeIds
        : matchingProgrammes
            .slice(0, 3)
            .map((programme) => programme.id);

    const message =
      safeModelOutput?.message ??
      (isArabic
        ? "وجدت برامج تطابق تفضيلاتك. إليك أفضل الخيارات المتاحة."
        : "I found programmes matching your preferences. Here are the available options.");

    return Response.json({
      message,
      choices: clipChoices(safeModelOutput?.choices ?? []),
      programmeIds: finalProgrammeIds,
      facts,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[StudyAdvisor] Chat API error:", errorMessage);

    const isQuotaError =
      /quota|resource_exhausted|too many requests|rate limit|tokens per minute|\b429\b/i.test(
        errorMessage,
      );

    if (isQuotaError) {
      return Response.json(
        {
          error: requestIsArabic
            ? "المستشار الدراسي مشغول حاليًا. يُرجى المحاولة لاحقًا."
            : "The study advisor is temporarily busy. Please try again shortly.",
        },
        {
          status: 429,
          headers: { "Retry-After": "5" },
        },
      );
    }

    return Response.json(
      {
        error: requestIsArabic
          ? "عذرًا، المستشار الدراسي غير متاح مؤقتًا. يُرجى المحاولة مرة أخرى."
          : "Sorry, the advisor is temporarily unavailable. Please try again.",
      },
      { status: 500 },
    );
  }
}