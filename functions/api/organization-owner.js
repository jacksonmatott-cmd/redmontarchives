export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const slug = url.searchParams.get("organization");

        if (!slug) {
            return Response.json(
                {
                    authenticated: false,
                    owner: false,
                    error: "Organization is required."
                },
                { status: 400 }
            );
        }

        const cookieHeader = context.request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/redmont_session=([^;]+)/);

        if (!match) {
            return Response.json({
                authenticated: false,
                owner: false
            });
        }

        const sessionToken = match[1];

        const sessionTokenHash = await sha256Base64Url(sessionToken);

        const session = await context.env.DB.prepare(`
            SELECT user_id, expires_at
            FROM sessions
            WHERE session_token_hash = ?
        `)
            .bind(sessionTokenHash)
            .first();

        if (!session) {
            return Response.json({
                authenticated: false,
                owner: false
            });
        }

        if (new Date(session.expires_at) < new Date()) {
            return Response.json({
                authenticated: false,
                owner: false
            });
        }

        const organization = await context.env.DB.prepare(`
            SELECT id, owner_user_id
            FROM organizations
            WHERE slug = ?
        `)
            .bind(slug)
            .first();

        if (!organization) {
            return Response.json(
                {
                    authenticated: true,
                    owner: false,
                    error: "Organization not found."
                },
                { status: 404 }
            );
        }

        return Response.json({
            authenticated: true,
            owner: Number(organization.owner_user_id) === Number(session.user_id)
        });

    } catch (error) {
        console.error("Organization owner error:", error);

        return Response.json(
            {
                authenticated: false,
                owner: false,
                error: "Something went wrong."
            },
            { status: 500 }
        );
    }
}

async function sha256Base64Url(value) {
    const data = new TextEncoder().encode(value);

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    return bytesToBase64Url(new Uint8Array(hashBuffer));
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
