AI Coding Tools

I used ChatGPT to understand the Vercel AI SDK, explore implementation approaches, troubleshoot errors, and refine the Next.js API route. I also referred to the official Next.js, Groq, and Vercel AI SDK documentation.

One AI Mistake I Identified

An AI suggestion was to add a special fallback for Medicine when no programme matched the student's budget. I realized this would only work for Medicine, not other fields, so I decided not to use it. Instead, I kept the fallback logic general so it could work across all study fields. I also addressed inconsistent model outputs using Zod validation, JSON tool responses, and deterministic fallbacks.

My Own Work and Verification

I integrated and developed the code into the Next.js project, configured the Groq provider, and tested the application locally in English and Arabic. I checked recommendation behaviour, budget flexibility, scholarship searches, and changing the student's field of interest. I also used automated tests to verify catalogue functionality and response safeguards.
I also developed parts of mock code for validation and verification.
