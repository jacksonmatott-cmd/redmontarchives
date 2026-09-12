export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const organizationId = Number(body.organization_id);
        const title = body.title?.trim();
        const slug = body.slug?.trim().toLowerCase();
        const content = body.content?.trim();

        if (
            !Number.isInteger(organizationId) ||
            organizationId <= 0 ||
            !title ||
            !slug ||
            !content
        ) {
            return Response.json(
                {
                    error: "Organization ID, title, slug, and content are required."
                },
                { status: 400 }
            );
        }

        const slugPattern = /^[a-z0-9-]+$/;

        if (!slugPattern.test(slug)) {
            return Response.json(
                {
                    error: "Page slug may only contain lowercase letters, numbers, and hyphens."
                },
                { status: 400 }
            );
        }

        const organization = await context.env.DB
            .prepare(`
                SELECT id, name
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

        const existing = await context.env.DB
            .prepare(`
                SELECT id
                FROM pages
                WHERE organization_id = ?
                  AND slug = ?
            `)
            .bind(organizationId, slug)
            .first();

        if (existing) {
            return Response.json(
                {
                    error: "That page slug is already in use by this organization."
                },
                { status: 409 }
            );
        }

        const result = await context.env.DB
            .prepare(`
                INSERT INTO pages (
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
            page: {
                id: result.meta.last_row_id,
                organization_id: organizationId,
                organization_name: organization.name,
                title,
                slug,
                content,
                status: "published"
            }
        });

    } catch (error) {
        console.error("Create page error:", error);

        return Response.json(
            {
                error: "Unable to create organization page."
            },
            { status: 500 }
        );
    }
}
