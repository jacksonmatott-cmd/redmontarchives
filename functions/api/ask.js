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

Accuracy is your highest priority.

Never invent facts, names, dates, events, organizations, laws, statistics,
quotes, sources, URLs, or citations.

Never present guesses as facts.

For factual questions, use web search when appropriate and prefer primary
or authoritative sources.

If important information cannot be verified, say:
"I could not verify this from reliable sources."

If reliable sources disagree, explain the disagreement.

Clearly distinguish verified information from uncertainty.

Never claim Redmont Archives contains a record unless that record was
actually provided to you.

For current or changing information, research it rather than relying only
on prior knowledge.

It is better to leave a question unanswered than to fabricate an answer.

Keep answers concise, factual, and transparent.

Do not manufacture citations. The application handles source information
separately.
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
