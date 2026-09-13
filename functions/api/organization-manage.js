export async function onRequestPost(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken =
            getCookie(cookieHeader, "redmont_session");

        if (!sessionToken) {
            return Response.json(
                {
                    error: "Login required."
                },
                { status: 401 }
            );
        }

        const sessionHash =
            await sha256Base64Url(sessionToken);

        const session =
            await context.env.DB
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
                .bind(sessionHash)
                .first();

        if (!session) {
            return Response.json(
                {
                    error: "Login required."
                },
                { status: 401 }
            );
        }

        if (
            new Date(session.expires_at) <= new Date()
        ) {
            return Response.json(
                {
                    error: "Your session has expired."
                },
                { status: 401 }
            );
        }

        const body =
            await context.request.json();

        const organizationId =
            Number(body.organizationId);

        const action =
            typeof body.action === "string"
                ? body.action.trim()
                : "";

        const pageId =
            body.pageId !== undefined
                ? Number(body.pageId)
                : null;

        if (
            !Number.isInteger(organizationId) ||
            organizationId <= 0
        ) {
            return Response.json(
                {
                    error: "Invalid organization."
                },
                { status: 400 }
            );
        }

        if (!action) {
            return Response.json(
                {
                    error: "Management action is required."
                },
                { status: 400 }
            );
        }

        /*
         * Verify that the organization exists
         * and that the logged-in user owns it.
         */
        const organization =
            await context.env.DB
                .prepare(`
                    SELECT
                        id,
                        name,
                        slug,
                        owner_user_id
                    FROM organizations
                    WHERE id = ?
                `)
                .bind(organizationId)
                .first();

        if (!organization) {
            return Response.json(
                {
                    error: "Organization not found."
                },
                { status: 404 }
            );
        }

        if (
            Number(organization.owner_user_id) !==
            Number(session.user_id)
        ) {
            return Response.json(
                {
                    error:
                        "Only the organization owner can perform this action."
                },
                { status: 403 }
            );
        }

        /*
         * ---------------------------------------------------------
         * DELETE PAGE
         * ---------------------------------------------------------
         */
        if (action === "delete_page") {

            if (
                !Number.isInteger(pageId) ||
                pageId <= 0
            ) {
                return Response.json(
                    {
                        error: "Invalid page."
                    },
                    { status: 400 }
                );
            }

            const page =
                await context.env.DB
                    .prepare(`
                        SELECT
                            id,
                            title
                        FROM pages
                        WHERE id = ?
                          AND organization_id = ?
                    `)
                    .bind(
                        pageId,
                        organizationId
                    )
                    .first();

            if (!page) {
                return Response.json(
                    {
                        error:
                            "That page does not belong to this organization."
                    },
                    { status: 404 }
                );
            }

            await context.env.DB
                .prepare(`
                    DELETE FROM pages
                    WHERE id = ?
                      AND organization_id = ?
                `)
                .bind(
                    pageId,
                    organizationId
                )
                .run();

            return Response.json({
                success: true,
                action: "delete_page",
                page: {
                    id: page.id,
                    title: page.title
                }
            });
        }

        /*
         * ---------------------------------------------------------
         * DELETE ORGANIZATION
         * ---------------------------------------------------------
         */
        if (action === "delete_organization") {

            await context.env.DB
                .prepare(`
                    DELETE FROM organizations
                    WHERE id = ?
                      AND owner_user_id = ?
                `)
                .bind(
                    organizationId,
                    session.user_id
                )
                .run();

            return Response.json({
                success: true,
                action: "delete_organization"
            });
        }

        return Response.json(
            {
                error:
                    "Unknown management action."
            },
            { status: 400 }
        );

    } catch (error) {

        console.error(
            "Organization management error:",
            error
        );

        return Response.json(
            {
                error:
                    "Unable to complete organization management action."
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
