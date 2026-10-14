Study Advisor Chatbot

Tech Stack

- Next.js
- TypeScript
- Vercel AI SDK
- Groq ("openai/gpt-oss-20b")
- Zod
- Vitest

Getting Started

Prerequisites

- Node.js and npm
- A Groq API key for live model responses

Installation

Clone the repository:

git clone https://github.com/thaminahf-bit/Study-Advisor.git

cd study-advisor

Install dependencies:

npm install

Create a ".env.local" file in the project root and add:

GROQ_API_KEY=your_groq_api_key_here

STUDY_ADVISOR_MOCK_MODE=false


Run Locally

npm run dev

Open "http://localhost:3000" (http://localhost:3000).

Run Tests

npx vitest run


Catalogue

Programme recommendations are based on the predefined catalogue in "src/data/catalog.json".

Security

API keys must remain in local environment variables and must never be committed to the repository.
