export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);

        const organizationSlug =
            url.searchParams.get("organization");

        const query =
            url.searchParams.get("q")?.trim() || "";

        if (!organizationSlug) {
            return Response.json(
                {
                    error: "Organization is required."
                },
                { status: 400 }
            );
        }

        if (query.length > 200) {
            return Response.json(
                {
                    error: "Search query is too long."
                },
                { status: 400 }
            );
        }

        const organization = await context.env.DB
            .prepare(`
                SELECT
                    id,
                    name,
                    slug
                FROM organizations
                WHERE slug = ?
            `)
            .bind(organizationSlug)
            .first();

        if (!organization) {
            return Response.json(
                {
                    error: "Organization not found."
                },
                { status: 404 }
            );
        }

        /*
         * Only published pages are searchable.
         * Drafts are deliberately excluded.
         */
        let result;

        if (query) {

            const search = `%${query}%`;

            result = await context.env.DB
                .prepare(`
                    SELECT
                        id,
                        title,
                        slug,
                        content,
                        created_at,
                        updated_at
                    FROM pages
                    WHERE organization_id = ?
                      AND status = 'published'
                      AND (
                          title LIKE ?
                          OR content LIKE ?
                      )
                    ORDER BY title ASC
                    LIMIT 50
                `)
                .bind(
                    organization.id,
                    search,
                    search
                )
                .all();

        } else {

            result = await context.env.DB
                .prepare(`
                    SELECT
                        id,
                        title,
                        slug,
                        content,
                        created_at,
                        updated_at
                    FROM pages
                    WHERE organization_id = ?
                      AND status = 'published'
                    ORDER BY title ASC
                    LIMIT 50
                `)
                .bind(organization.id)
                .all();

        }

        return Response.json({
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug
            },

            query,

            results: result.results.map(page => ({
                id: page.id,
                title: page.title,
                slug: page.slug,
                content: page.content,
                created_at: page.created_at,
                updated_at: page.updated_at
            }))
        });

    } catch (error) {

        console.error(
            "Organization search error:",
            error
        );

        return Response.json(
            {
                error: "Unable to search organization records."
            },
            { status: 500 }
        );
    }
}
