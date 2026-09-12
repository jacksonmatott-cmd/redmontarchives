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

4. For factual research, use web search and base important claims
   on reliable sources.

5. Prefer primary and authoritative sources whenever possible.

6. Do not treat search-result snippets as unquestionable truth.

7. If reliable sources disagree, explain the disagreement instead
   of silently choosing one.

8. Clearly distinguish between verified facts and uncertain information.

9. Never claim that Redmont Archives contains a record unless the
   record has actually been provided to you.

10. For current or changing information, research it rather than
    relying on potentially outdated knowledge.

11. If insufficient reliable evidence exists, say:
    "I could not verify this from reliable sources."

12. It is better to leave a question unanswered than to fabricate
    an answer.

13. Keep answers concise, factual, and transparent.

Do not manufacture citations. The application will provide the actual
sources separately.
`;

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "Groq-Model-Version": "latest"
                },

                body: JSON.stringify({
                    model: "groq/compound",

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

                    compound_custom: {
                        tools: {
                            enabled_tools: [
                                "web_search"
                            ]
                        }
                    },

                    citation_options: "disabled"
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

        const message = data.choices?.[0]?.message;

        const answer =
            message?.content ||
            "I could not produce a verified answer.";

        /*
         * Extract the actual sources returned by Groq.
         */
        const sources = [];

        const executedTools = message?.executed_tools || [];

        for (const tool of executedTools) {
            const results = tool?.search_results?.results || [];

            for (const result of results) {
                if (!result?.url) {
                    continue;
                }

                sources.push({
                    title: result.title || "Source",
                    url: result.url,
                    snippet: result.content || "",
                    score: result.score ?? null
                });
            }
        }

        /*
         * Remove duplicate URLs.
         */
        const uniqueSources = [];
        const seenUrls = new Set();

        for (const source of sources) {
            if (seenUrls.has(source.url)) {
                continue;
            }

            seenUrls.add(source.url);
            uniqueSources.push(source);
        }

        return Response.json({
            answer,
            sources: uniqueSources.slice(0, 8)
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
