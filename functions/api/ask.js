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
                            content:
                                "You are a research assistant. Accuracy is your highest priority. Never invent facts, names, dates, events, laws, organizations, statistics, quotes, or sources. Use web search when needed to verify factual claims. Never present guesses or speculation as facts. If something cannot be verified, clearly say that you could not verify it."
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
