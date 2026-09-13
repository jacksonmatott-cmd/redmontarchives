export async function onRequestPost(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken = getCookie(
            cookieHeader,
            "redmont_session"
        );

        if (sessionToken) {
            const sessionTokenHash =
                await sha256Base64Url(sessionToken);

            await context.env.DB
                .prepare(`
                    DELETE FROM sessions
                    WHERE session_token_hash = ?
                `)
                .bind(sessionTokenHash)
                .run();
        }

        return new Response(
            JSON.stringify({
                success: true
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Set-Cookie":
                        "redmont_session=; " +
                        "Max-Age=0; " +
                        "Path=/; " +
                        "HttpOnly; " +
                        "Secure; " +
                        "SameSite=Lax"
                }
            }
        );

    } catch (error) {

        console.error("Logout error:", error);

        return Response.json(
            {
                error: "Unable to log out."
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
