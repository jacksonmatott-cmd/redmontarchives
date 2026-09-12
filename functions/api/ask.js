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

        const apiKey = context.env.GEMINI_API_KEY;

        if (!apiKey) {
            return Response.json(
                { error: "Gemini API key is not configured." },
                { status: 500 }
            );
        }

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `You are the AI research assistant for Redmont Archives.

Redmont Archives is a public community archive focused on preserving and explaining records, events, organizations, laws, government activity, businesses, and other notable information.

Answer the user's question accurately and clearly.

When information may have changed or when the question asks about something on the internet, use Google Search to find current sources.

Distinguish clearly between established facts and uncertain information.

User question:
${question}`
                                }
                            ]
                        }
                    ],
                    tools: [
                        {
                            google_search: {}
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API error:", data);

            return Response.json(
                {
                    error: "Gemini API request failed.",
                    details: data.error?.message || "Unknown error"
                },
                { status: 500 }
            );
        }

        const answer =
            data.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("") || "I couldn't generate an answer.";

        const groundingMetadata =
            data.candidates?.[0]?.groundingMetadata || null;

        return Response.json({
            answer,
            groundingMetadata
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
