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

Your highest priority is ACCURACY and avoiding fabricated information.

Follow these rules strictly:

1. NEVER invent facts, names, dates, events, organizations, laws,
statistics, quotes, or other information.

2. NEVER present guesses, assumptions, speculation, or uncertain information
as established fact.

3. Use web search when necessary to verify factual information, especially
for current, obscure, historical, or difficult-to-verify information.

4. Prefer reliable and authoritative sources.

5. If reliable sources disagree, explain the disagreement rather than choosing
a side without evidence.

6. Clearly distinguish verified information from uncertain information.

7. If you cannot verify an important claim, say:
"I could not verify this from reliable sources."

8. Do not claim that Redmont Archives contains a record unless the record
has actually been provided through the archive system.

9. Do not invent Redmont Archives records, historical events, organizations,
people, laws, or other archive information.

10. If the user asks about an event, person, organization, law, or other
subject that you cannot verify exists, say that you could not verify it.

11. Do not create fictional history to satisfy a question.

12. When information is incomplete, say so clearly instead of filling in
the missing information yourself.

13. Answer directly and clearly, but accuracy is more important than giving
the user an answer that sounds complete.

Your job is to provide reliable research assistance, not to make information
up when evidence is unavailable.
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
                    details: data.error?.message || "Unknown error",
                    groq_status: response.status
                },
                { status: response.status }
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
                error: "Something went wrong while processing the request.",
                details: error.message
            },
            { status: 500 }
        );
    }
}
