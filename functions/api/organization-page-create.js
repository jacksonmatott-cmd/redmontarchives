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

        const body =
            await context.request.json();

        const organizationId =
            Number(body.organizationId);

        const title =
            String(body.title || "").trim();

        const slug =
            String(body.slug || "").trim();

        const content =
            String(body.content || "").trim();

        if (
            !organizationId ||
            !title ||
            !slug ||
            !content
        ) {
            return Response.json(
                {
                    error:
                        "Organization, title, slug, and content are required."
                },
                { status: 400 }
            );
        }

        const organization =
            await context.env.DB.prepare(`
                SELECT id, owner_user_id
                FROM organizations
                WHERE id = ?
            `)
            .bind(organizationId)
            .first();

        if (!organization) {
            return Response.json(
                { error: "Organization not found." },
                { status: 404 }
            );
        }

        if (
            Number(organization.owner_user_id) !==
            Number(session.user_id)
        ) {
            return Response.json(
                { error: "Only the organization owner can create pages." },
                { status: 403 }
            );
        }

        const result =
            await context.env.DB.prepare(`
                INSERT INTO pages
                (
                    organization_id,
                    title,
                    slug,
                    content,
                    status
                )
                VALUES (?, ?, ?, ?, 'published')
            `)
            .bind(
                organizationId,
                title,
                slug,
                content
            )
            .run();

        return Response.json({
            success: true,
            page_id: result.meta.last_row_id
        });

    } catch (error) {
        console.error(
            "Create organization page error:",
            error
        );

        return Response.json(
            {
                success: false,
                error: "Unable to create page."
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
