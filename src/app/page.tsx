"use client";

import { useState } from "react";
import {
  getProgrammeById,
  type Programme,
} from "@/lib/catalog";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  choices: string[];
  programmeIds: string[];
};

type StudentFacts = {
  interest?: string;
  budget?: string;
  englishLevel?: string;
  preferredCountry?: string;
  preferredLanguage?: string;
};

type ChatResponse = {
  message?: string;
  choices?: string[];
  programmeIds?: string[];
  facts?: StudentFacts;
  error?: string;
};

function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your Study Advisor. 👋 I can help you find summer programmes that match your interests, budget, and English level.\n\nمرحباً! أنا مستشارك الدراسي. 👋 يمكنني مساعدتك في العثور على البرامج الصيفية التي تناسب اهتماماتك وميزانيتك ومستواك في اللغة الإنجليزية.\n\nLet's get started! What would you like to study?\n\nلنبدأ! ماذا تريد أن تدرس؟",
      choices: ["Computing", "Medicine", "Engineering"],
      programmeIds: [],
    },
  ]);

  const [input, setInput] = useState("");
  const [facts, setFacts] = useState<StudentFacts>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  const isArabic = latestUserMessage
    ? isArabicText(latestUserMessage.content)
    : false;

  async function sendMessage(text: string) {
    const content = text.trim();

    if (!content || loading) return;

    setError("");
    setInput("");
    setLoading(true);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      choices: [],
      programmeIds: [],
    };

    const updatedMessages: Message[] = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages
            .map(({ role, content }) => ({ role, content }))
            .slice(-30),
          facts,
        }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The advisor could not respond. Please try again.",
        );
      }

      setFacts(data.facts ?? facts);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          data.message ??
          (isArabicText(content)
            ? "هل يمكنك إخباري بالمزيد؟"
            : "Could you tell me a little more?"),
        choices: (data.choices ?? []).slice(0, 3).map(
          (choice) => [...choice].slice(0, 20).join(""),
        ),
        programmeIds: data.programmeIds ?? [],
      };

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function getRecommendedProgrammes(
    ids: string[] = [],
  ): Programme[] {
    return ids.flatMap((id) => {
      const programme = getProgrammeById(id);
      return programme ? [programme] : [];
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[85vh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Study Advisor | المستشار الدراسي
          </p>

          <h1 className="mt-1 text-2xl font-bold">
            Find your summer programme | ابحث عن برنامجك الصيفي
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Tell me what you are looking for, one step at a time.
            {" "}
            أخبرني بما تبحث عنه خطوة بخطوة.
          </p>
        </header>

        <section
          aria-label="Chat messages"
          aria-live="polite"
          className="flex-1 space-y-5 bg-slate-50 p-4 sm:p-6"
        >
          {messages.map((message) => {
            const programmes = getRecommendedProgrammes(
              message.programmeIds,
            );

            return (
              <div key={message.id} className="space-y-3">
                <div
                  className={`flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    dir="auto"
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                      message.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>

                {message.role === "assistant" &&
                  message.choices.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.choices.map((choice, index) => (
                        <button
                          key={`${message.id}-choice-${index}`}
                          type="button"
                          disabled={loading}
                          onClick={() => void sendMessage(choice)}
                          className="rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}

                {programmes.length > 0 && (
                  <div className="grid gap-3">
                    {programmes.map((programme) => (
                      <article
                        key={programme.id}
                        className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {programme.id} · {programme.field}
                        </p>

                        <h2 className="mt-1 text-base font-bold">
                          {programme.name_en}
                        </h2>

                        <p
                          dir="rtl"
                          className="mt-1 text-right text-sm text-slate-600"
                        >
                          {programme.name_ar}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500">
                              Country
                            </p>
                            <p className="font-medium">
                              {programme.country}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Duration
                            </p>
                            <p className="font-medium">
                              {programme.weeks}{" "}
                              {programme.weeks === 1
                                ? "week"
                                : "weeks"}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">Fee</p>
                            <p className="font-medium">
                              {programme.fee === 0
                                ? "Free"
                                : `${programme.fee.toLocaleString()} ${programme.currency}`}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">
                              Scholarship
                            </p>
                            <p className="font-medium">
                              {programme.scholarship
                                ? "Available"
                                : "Not listed"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Minimum IELTS:{" "}
                          {programme.min_ielts ?? "Not specified"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div
              role="status"
              className="text-sm text-slate-500"
            >
              {isArabic
                ? "جارٍ إعداد الإجابة..."
                : "Your advisor is thinking..."}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="flex gap-2 border-t border-slate-200 bg-white p-4 sm:p-5"
        >
          <input
            dir="auto"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              isArabic
                ? "اكتب إجابتك..."
                : "Type your answer..."
            }
            aria-label="Your message"
            maxLength={4000}
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isArabic ? "إرسال" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}