const MAX_QUERY_LENGTH = 1000;
const MAX_RECORDS = 50;
const MAX_CONTEXT_CHARACTERS = 50000;

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const query =
            typeof body.query === "string"
                ? body.query.trim()
                : "";

        const organizationSlug =
            typeof body.organization === "string"
                ? body.organization.trim().toLowerCase()
                : "";

        if (!query) {
            return Response.json(
                {
                    error: "A question is required."
                },
                { status: 400 }
            );
        }

        if (query.length > MAX_QUERY_LENGTH) {
            return Response.json(
                {
                    error: "Question is too long."
                },
                { status: 400 }
            );
        }

        if (!organizationSlug) {
            return Response.json(
                {
                    error: "Organization is required."
                },
                { status: 400 }
            );
        }

        /*
         * ---------------------------------------------------------
         * ACCESS CHECK
         * ---------------------------------------------------------
         */

        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken =
            getCookie(cookieHeader, "redmont_session");

        let authenticatedUser = null;

        if (sessionToken) {

            const sessionTokenHash =
                await sha256Base64Url(sessionToken);

            const session = await context.env.DB
                .prepare(`
                    SELECT
                        sessions.id,
                        sessions.user_id,
                        sessions.expires_at,
                        users.username
                    FROM sessions
                    JOIN users
                        ON users.id = sessions.user_id
                    WHERE sessions.session_token_hash = ?
                `)
                .bind(sessionTokenHash)
                .first();

            if (session) {

                const expiresAt =
                    new Date(session.expires_at);

                if (expiresAt > new Date()) {

                    authenticatedUser = {
                        id: session.user_id,
                        username: session.username
                    };

                } else {

                    await context.env.DB
                        .prepare(`
                            DELETE FROM sessions
                            WHERE id = ?
                        `)
                        .bind(session.id)
                        .run();

                }
            }
        }

        /*
         * ---------------------------------------------------------
         * ORGANIZATION LOOKUP
         * ---------------------------------------------------------
         */

        const organization = await context.env.DB
            .prepare(`
                SELECT
                    id,
                    name,
                    slug,
                    description
                FROM organizations
                WHERE slug = ?
            `)
            .bind(organizationSlug)
            .first();

        if (!organization) {
            return Response.json(
                {
                    error: "Organization not found."
                },
                { status: 404 }
            );
        }

        /*
         * A valid organization provides anonymous AI context.
         * Logged-in users are also allowed.
         */

        /*
         * ---------------------------------------------------------
         * FETCH PUBLISHED ORGANIZATION RECORDS
         * ---------------------------------------------------------
         */

        const records = await context.env.DB
            .prepare(`
                SELECT
                    id,
                    title,
                    slug,
                    content
                FROM pages
                WHERE organization_id = ?
                  AND status = 'published'
                ORDER BY title ASC
                LIMIT ?
            `)
            .bind(
                organization.id,
                MAX_RECORDS
            )
            .all();

        /*
         * Only published records belonging to this organization
         * are included in the AI context.
         */

        let contextText = "";

        for (const record of records.results) {

            const recordText = [
                `TITLE: ${record.title}`,
                `SLUG: ${record.slug}`,
                `CONTENT: ${record.content}`
            ].join("\n");

            if (
                contextText.length +
                recordText.length +
                2 >
                MAX_CONTEXT_CHARACTERS
            ) {
                break;
            }

            contextText += recordText + "\n\n";
        }

        /*
         * ---------------------------------------------------------
         * GROQ REQUEST
         * ---------------------------------------------------------
         */

        const apiKey =
            context.env.GROQ_API_KEY;

        if (!apiKey) {

            return Response.json(
                {
                    error:
                        "AI service is not configured yet."
                },
                { status: 503 }
            );
        }

        const model =
            context.env.GROQ_MODEL ||
            "openai/gpt-oss-20b";

        const systemPrompt = `
You are the Redmont Archives organization research assistant.

You are answering questions about exactly one organization:

${organization.name}

Use ONLY the published organization records supplied below.

Do not use outside knowledge to answer the question.

If the supplied records do not contain enough information to answer,
say that the organization's archive does not contain enough published
information to answer the question.

Do not invent facts.

Do not claim that unpublished, private, draft, or nonexistent records
exist.

Do not use information belonging to another organization.

Treat the supplied records as the authoritative published archive
for this organization.

Organization:
${organization.name}

Published organization records:
${contextText || "No published records are currently available."}
`;

        const groqResponse =
            await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization":
                            `Bearer ${apiKey}`
                    },

                    body: JSON.stringify({
                        model,

                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: query
                            }
                        ],

                        temperature: 0.2,

                        max_completion_tokens: 1000
                    })
                }
            );

        const groqData =
            await groqResponse.json();

        if (!groqResponse.ok) {

            console.error(
                "Groq API error:",
                groqData
            );

            return Response.json(
                {
                    error:
                        "The AI service could not complete the request."
                },
                { status: 502 }
            );
        }

        const answer =
            groqData?.choices?.[0]?.message?.content
            ?.trim();

        if (!answer) {

            return Response.json(
                {
                    error:
                        "The AI service returned an empty response."
                },
                { status: 502 }
            );
        }

        return Response.json({
            success: true,

            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug
            },

            question: query,

            answer,

            authenticated:
                Boolean(authenticatedUser),

            user:
                authenticatedUser
                    ? {
                        id: authenticatedUser.id,
                        username: authenticatedUser.username
                    }
                    : null
        });

    } catch (error) {

        console.error(
            "Organization AI error:",
            error
        );

        return Response.json(
            {
                error:
                    "Unable to process organization AI request."
            },
            { status: 500 }
        );
    }
}

function getCookie(cookieHeader, name) {

    const cookies =
        cookieHeader.split(";");

    for (const cookie of cookies) {

        const trimmed =
            cookie.trim();

        if (
            trimmed.startsWith(
                name + "="
            )
        ) {
            return decodeURIComponent(
                trimmed.substring(
                    name.length + 1
                )
            );
        }
    }

    return null;
}

async function sha256Base64Url(value) {

    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(value)
        );

    return bytesToBase64Url(
        new Uint8Array(digest)
    );
}

function bytesToBase64Url(bytes) {

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
