export async function onRequestGet(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken =
            getCookie(cookieHeader, "redmont_session");

        const requestedOrganization =
            context.request.url
                ? new URL(context.request.url)
                    .searchParams
                    .get("organization")
                : null;

        /*
         * OPTION 1:
         * Logged-in users may access AI requests.
         */
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

                    return Response.json({
                        allowed: true,
                        reason: "authenticated",
                        user: {
                            id: session.user_id,
                            username: session.username
                        }
                    });

                }
            }
        }

        /*
         * OPTION 2:
         * Anonymous users may access AI when they are
         * operating inside a valid organization context.
         */
        if (requestedOrganization) {

            const organization =
                await context.env.DB
                    .prepare(`
                        SELECT
                            id,
                            name,
                            slug
                        FROM organizations
                        WHERE slug = ?
                    `)
                    .bind(requestedOrganization)
                    .first();

            if (organization) {

                return Response.json({
                    allowed: true,
                    reason: "organization",
                    organization: {
                        id: organization.id,
                        name: organization.name,
                        slug: organization.slug
                    }
                });

            }
        }

        /*
         * Nobody else gets AI access.
         */
        return Response.json(
            {
                allowed: false,
                reason: "login_or_organization_required",
                message:
                    "AI access requires a Redmont Archives account or an organization context."
            },
            { status: 401 }
        );

    } catch (error) {

        console.error("AI access check error:", error);

        return Response.json(
            {
                allowed: false,
                reason: "server_error",
                message: "Unable to verify AI access."
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

        if (trimmed.startsWith(name + "=")) {

            return decodeURIComponent(
                trimmed.substring(name.length + 1)
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
