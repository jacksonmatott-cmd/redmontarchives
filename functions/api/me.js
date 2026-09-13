export async function onRequestGet(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken = getCookie(
            cookieHeader,
            "redmont_session"
        );

        if (!sessionToken) {
            return Response.json({
                authenticated: false,
                user: null
            });
        }

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

        if (!session) {
            return Response.json({
                authenticated: false,
                user: null
            });
        }

        const expiresAt =
            new Date(session.expires_at);

        if (expiresAt <= new Date()) {

            await context.env.DB
                .prepare(`
                    DELETE FROM sessions
                    WHERE id = ?
                `)
                .bind(session.id)
                .run();

            return Response.json({
                authenticated: false,
                user: null
            });
        }

        return Response.json({
            authenticated: true,
            user: {
                id: session.user_id,
                username: session.username
            }
        });

    } catch (error) {

        console.error("Session check error:", error);

        return Response.json(
            {
                authenticated: false,
                user: null
            },
            { status: 500 }
        );
    }
}

function getCookie(cookieHeader, name) {

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {

        const trimmed = cookie.trim();

        if (trimmed.startsWith(name + "=")) {
            return decodeURIComponent(
                trimmed.substring(name.length + 1)
            );
        }
    }

    return null;
}

async function sha256Base64Url(value) {

    const digest = await crypto.subtle.digest(
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
