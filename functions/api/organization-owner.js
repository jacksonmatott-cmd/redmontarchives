export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const slug = url.searchParams.get("organization");

        if (!slug) {
            return Response.json(
                { authenticated: false, owner: false, error: "Organization is required." },
                { status: 400 }
            );
        }

        const sessionCookie = context.request.headers.get("Cookie") || "";

        const match = sessionCookie.match(/redmont_session=([^;]+)/);

        if (!match) {
            return Response.json({
                authenticated: false,
                owner: false
            });
        }

        const sessionToken = match[1];

        const encoder = new TextEncoder();
        const data = encoder.encode(sessionToken);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);

        const sessionTokenHash = Array.from(
            new Uint8Array(hashBuffer)
        )
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

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
        console.error(error);

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
