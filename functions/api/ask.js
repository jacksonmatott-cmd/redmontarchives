export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const question = body.question;

        if (!question || typeof question !== "string") {
            return Response.json(
                { error: "Please provide a question." },
                { status: 400 }
            );
        }

        const apiKey = context.env.GROQ_API_KEY;

        if (!apiKey) {
            return Response.json(
                { error: "Groq API key is not configured." },
                { status: 500 }
            );
        }

        const systemPrompt = `
You are the research assistant for Redmont Archives.

Redmont Archives is a public community archive dedicated to preserving
accurate information about events, organizations, government activity,
laws, businesses, people, and historical records.

ACCURACY IS YOUR HIGHEST PRIORITY.

You MUST follow these rules:

1. NEVER invent facts, names, dates, events, organizations, laws,
   statistics, quotes, sources, URLs, or citations.

2. NEVER present a guess as a fact.

3. If you cannot verify an important claim, explicitly say that you
   could not verify it.

4. Your internal knowledge is NOT sufficient evidence for important
   factual claims. When the question requires factual research,
   use available web search tools.

5. Prefer primary and authoritative sources whenever possible.
   Examples include official government records, official organization
   websites, original documents, archived records, direct statements,
   and reputable publications.

6. Do not treat search-result snippets as unquestionable truth.
   Consider the reliability and context of the source.

7. If multiple reliable sources disagree, DO NOT choose one silently.
   Explain that the sources disagree and identify the different claims.

8. Clearly distinguish between:
   - verified facts
   - information reported by a source
   - uncertain or unverified information

9. Never create a citation merely because a statement needs one.
   Only cite information that is actually supported by a source.

10. Do not claim that Redmont Archives contains a record unless
    the record has actually been provided to you.

11. If the question is about a current or changing subject, research
    it rather than relying on potentially outdated knowledge.

12. If insufficient reliable evidence exists, the correct answer is:
    "I could not verify this from reliable sources."
    It is better to leave a question unanswered than to fabricate an answer.

13. Be concise, factual, and transparent about uncertainty.

Your job is not to always provide an answer.
Your job is to provide the most reliable answer supported by evidence.
`;

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-120b",

                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ],

                    tools: [
                        {
                            type: "browser_search"
                        }
                    ],

                    tool_choice: "required",

                    temperature: 0.2,

                    reasoning_effort: "low"
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Groq API error:", data);

            return Response.json(
                {
                    error: "Groq API request failed.",
                    details: data.error?.message || "Unknown error"
                },
                { status: 500 }
            );
        }

        const answer =
            data.choices?.[0]?.message?.content ||
            "I could not produce a verified answer.";

        return Response.json({
            answer
        });

    } catch (error) {
        console.error("Function error:", error);

        return Response.json(
            {
                error: "Something went wrong while processing the request."
            },
            { status: 500 }
        );
    }
}
