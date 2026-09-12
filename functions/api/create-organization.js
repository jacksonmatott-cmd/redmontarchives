export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const name = body.name?.trim();
        const slug = body.slug?.trim().toLowerCase();
        const description = body.description?.trim() || "";

        if (!name || !slug) {
            return Response.json(
                {
                    error: "Organization name and slug are required."
                },
                { status: 400 }
            );
        }

        const slugPattern = /^[a-z0-9-]+$/;

        if (!slugPattern.test(slug)) {
            return Response.json(
                {
                    error: "Slug may only contain lowercase letters, numbers, and hyphens."
                },
                { status: 400 }
            );
        }

        const existing = await context.env.DB
            .prepare(`
                SELECT id
                FROM organizations
                WHERE slug = ?
            `)
            .bind(slug)
            .first();

        if (existing) {
            return Response.json(
                {
                    error: "That organization slug is already in use."
                },
                { status: 409 }
            );
        }

        const result = await context.env.DB
            .prepare(`
                INSERT INTO organizations (name, slug, description)
                VALUES (?, ?, ?)
            `)
            .bind(name, slug, description)
            .run();

        return Response.json({
            success: true,
            organization: {
                id: result.meta.last_row_id,
                name,
                slug,
                description
            }
        });

    } catch (error) {
        console.error("Create organization error:", error);

        return Response.json(
            {
                error: "Unable to create organization."
            },
            { status: 500 }
        );
    }
}
