export async function onRequestPost(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const match =
            cookieHeader.match(/redmont_session=([^;]+)/);

        if (!match) {
            return Response.json(
                { error: "Login required." },
                { status: 401 }
            );
        }

        const sessionToken = match[1];

        const sessionTokenHash =
            await sha256Base64Url(sessionToken);

        const session =
            await context.env.DB.prepare(`
                SELECT user_id, expires_at
                FROM sessions
                WHERE session_token_hash = ?
            `)
            .bind(sessionTokenHash)
            .first();

        if (!session) {
            return Response.json(
                { error: "Invalid session." },
                { status: 401 }
            );
        }

        if (new Date(session.expires_at) < new Date()) {
            return Response.json(
                { error: "Session expired." },
                { status: 401 }
            );
        }

        const user =
            await context.env.DB.prepare(`
                SELECT id, username
                FROM users
                WHERE id = ?
            `)
            .bind(session.user_id)
            .first();

        if (!user) {
            return Response.json(
                { error: "User account not found." },
                { status: 401 }
            );
        }

        /*
         * Main archive posting permission.
         *
         * Only the account named "kaelzvx"
         * is allowed to create main archive records.
         */
        if (user.username !== "kaelzvx") {
            return Response.json(
                {
                    error:
                        "You do not have permission to create main archive records."
                },
                { status: 403 }
            );
        }

        const body =
            await context.request.json();

        const title =
            String(body.title || "").trim();

        const category =
            String(body.category || "").trim();

        const content =
            String(body.content || "").trim();

        const validCategories = [
            "Government",
            "Legislation",
            "Business",
            "Elections",
            "People",
            "Events",
            "Organizations",
            "Other Records"
        ];

        if (!title || !category || !content) {
            return Response.json(
                {
                    error:
                        "Title, category, and content are required."
                },
                { status: 400 }
            );
        }

        const matchedCategory =
            validCategories.find(
                item =>
                    item.toLowerCase() ===
                    category.toLowerCase()
            );

        if (!matchedCategory) {
            return Response.json(
                {
                    error:
                        "Invalid archive category."
                },
                { status: 400 }
            );
        }

        const result =
            await context.env.DB.prepare(`
                INSERT INTO archive_records
                (
                    title,
                    category,
                    content,
                    author_user_id
                )
                VALUES (?, ?, ?, ?)
            `)
            .bind(
                title,
                matchedCategory,
                content,
                user.id
            )
            .run();

        return Response.json({
            success: true,
            record_id: result.meta.last_row_id
        });

    } catch (error) {
        console.error(
            "Archive post error:",
            error
        );

        return Response.json(
            {
                success: false,
                error:
                    "Unable to create archive record."
            },
            { status: 500 }
        );
    }
}

async function sha256Base64Url(value) {
    const data =
        new TextEncoder().encode(value);

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return bytesToBase64Url(
        new Uint8Array(hashBuffer)
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
