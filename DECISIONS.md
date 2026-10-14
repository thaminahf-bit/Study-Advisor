Technical Decisions

Learning the SDK:

I used the official "Vercel AI SDK documentation" (https://ai-sdk.dev/docs/introduction) to learn how to integrate language models, define tools, validate structured inputs, and control multi-step tool execution. I also referred to the Next.js documentation for model configuration and server-side API routes.

Main Decisions:

1. Model integration and provider choice

I chose the Vercel AI SDK to keep model integration within a consistent interface. I initially explored Gemini but encountered quota and availability issues during development. I switched to Groq and used "openai/gpt-oss-20b", which allowed me to continue testing. I kept the API key in an environment variable rather than hardcoding it into the application.

2. Catalogue search and tool calling

I used the supplied JSON catalogue as the source of truth. The server filters programmes using deterministic catalogue-search functions before sending verified results to the model. I defined "searchCatalog" as a tool for verifying programme details and "saveStudentFact" for recording explicitly stated student preferences. I also added a "json" tool to obtain structured final responses because the model's output format was not always consistent.

3. Preference collection and recommendation logic

The chatbot collects a student's field of interest, budget, and English level before recommending programmes. I preserve student facts between requests and support actions such as changing the field, increasing the budget, and exploring scholarships. I chose deterministic filtering for core eligibility checks instead of relying on the model alone.

4. Validation and response safeguards

I used Zod to validate incoming requests and model output. Server-side safeguards restrict responses to three choices, each no longer than 20 characters, and limit recommendations to programme IDs returned by the verified search. If the model fails or returns unusable output, the application falls back to verified catalogue results. I also added mock mode to support testing without live model calls.

5. Bilingual support and testing

I implemented English and Arabic responses, including translated prompts and choice labels. I manually tested both languages, preference persistence, budget flexibility, scholarship searches, and changing the field of interest. I also wrote automated tests for catalogue search and chat safeguards without requiring real model calls.

Trade-offs

Using a hosted model provides conversational flexibility but introduces API quotas, network dependencies, and potential usage costs. Deterministic filtering is more predictable but requires explicit rules for interpreting interests and budgets. I chose a hybrid approach: deterministic catalogue filtering and server-side validation for safety, with the language model for conversational recommendations.

What I Would Improve With More Time

I would expand automated tests for tool-calling behaviour, Arabic language consistency, malformed model responses, and provider failures. I would also improve currency-aware budget comparisons, make fallback recommendations explain when they do not satisfy the original budget, and strengthen error handling and observability for production use.
