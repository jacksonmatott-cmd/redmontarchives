export async function onRequestPost(context) {
    try {
        const cookieHeader =
            context.request.headers.get("Cookie") || "";

        const sessionToken =
            getCookie(cookieHeader, "redmont_session");

        if (!sessionToken) {
            return Response.json(
                {
                    error: "Login required.",
                    redirect: "/login.html"
                },
                { status: 401 }
            );
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
            return Response.json(
                {
                    error: "Login required.",
                    redirect: "/login.html"
                },
                { status: 401 }
            );
        }

        if (
            new Date(session.expires_at) <=
            new Date()
        ) {
            return Response.json(
                {
                    error: "Your session has expired.",
                    redirect: "/login.html"
                },
                { status: 401 }
            );
        }

        const body =
            await context.request.json();

        const name =
            typeof body.name === "string"
                ? body.name.trim()
                : "";

        const description =
            typeof body.description === "string"
                ? body.description.trim()
                : "";

        const requestedSlug =
            typeof body.slug === "string"
                ? body.slug.trim().toLowerCase()
                : "";

        if (!name) {
            return Response.json(
                {
                    error:
                        "Organization name is required."
                },
                { status: 400 }
            );
        }

        if (name.length > 100) {
            return Response.json(
                {
                    error:
                        "Organization name is too long."
                },
                { status: 400 }
            );
        }

        if (description.length > 1000) {
            return Response.json(
                {
                    error:
                        "Organization description is too long."
                },
                { status: 400 }
            );
        }

        const slug =
            requestedSlug ||
            createSlug(name);

        if (
            !/^[a-z0-9-]+$/.test(slug) ||
            slug.length < 2 ||
            slug.length > 100
        ) {
            return Response.json(
                {
                    error:
                        "Organization slug must contain only lowercase letters, numbers, and hyphens."
                },
                { status: 400 }
            );
        }

        const existingOrganization =
            await context.env.DB
                .prepare(`
                    SELECT id
                    FROM organizations
                    WHERE slug = ?
                `)
                .bind(slug)
                .first();

        if (existingOrganization) {
            return Response.json(
                {
                    error:
                        "An organization with that slug already exists."
                },
                { status: 409 }
            );
        }

        /*
         * Create the organization with the logged-in
         * user as the permanent owner.
         */
        const result =
            await context.env.DB
                .prepare(`
                    INSERT INTO organizations (
                        name,
                        slug,
                        description,
                        owner_user_id
                    )
                    VALUES (?, ?, ?, ?)
                `)
                .bind(
                    name,
                    slug,
                    description,
                    session.user_id
                )
                .run();

        const organizationId =
            result.meta.last_row_id;

        /*
         * Automatically enroll the creator as
         * an active member.
         */
        await context.env.DB
            .prepare(`
                INSERT INTO organization_members (
                    organization_id,
                    user_id,
                    status
                )
                VALUES (?, ?, 'active')
            `)
            .bind(
                organizationId,
                session.user_id
            )
            .run();

        return Response.json(
            {
                success: true,

                organization: {
                    id: organizationId,
                    name,
                    slug,
                    description,
                    owner_user_id:
                        session.user_id
                }
            },
            { status: 201 }
        );

    } catch (error) {

        console.error(
            "Create organization error:",
            error
        );

        return Response.json(
            {
                error:
                    "Unable to create organization."
            },
            { status: 500 }
        );
    }
}

function createSlug(value) {

    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100);

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
