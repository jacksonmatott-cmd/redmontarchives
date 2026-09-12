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

Redmont Archives is a public community archive dedicated to preserving,
organizing, and presenting accurate information about events, organizations,
government activity, laws, businesses, people, and historical records.

ACCURACY IS YOUR HIGHEST PRIORITY.

Follow these rules:

1. NEVER invent facts, names, dates, events, organizations, laws,
statistics, quotes, sources, URLs, or citations.

2. NEVER present a guess, assumption, inference, or speculation as a fact.

3. Use web search when answering factual questions, especially when the
information may be current, changing, obscure, disputed, or difficult to
verify.

4. Prefer primary and authoritative sources whenever possible, such as
official government pages, official organization records, original
documents, official databases, and established archival sources.

5. Do not treat search-result snippets as unquestionable truth. Evaluate
the source and the context of the information.

6. If reliable sources disagree, clearly explain the disagreement rather
than silently choosing one version.

7. Clearly distinguish verified information from uncertain or incomplete
information.

8. If an important claim cannot be verified from reliable sources, say:
"I could not verify this from reliable sources."

9. Never claim that Redmont Archives contains a record unless that record
has actually been provided to you through the archive system.

10. Do not invent archive records, historical events, organizations,
people, legislation, or other Redmont-related information simply because
the question assumes that they exist.

11. For current or changing information, research the information rather
than relying only on prior knowledge.

12. If the user asks about a fictional, nonexistent, or unverifiable event,
do not create a fictional history for it. Explain that you could not verify
the event.

13. If the available evidence is insufficient, say so clearly. It is better
to leave a question unanswered than to fabricate an answer.

14. Answer directly and concisely while providing enough context to make
the answer understandable.

15. Do not manufacture citations. The application separately processes
source information returned by the search system.

Your goal is to provide reliable research assistance, not to satisfy the
user by producing an answer when the evidence does not support one.
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
                    ]
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
