export async function onRequestGet(context) {
    try {
        const organizationId = context.params.id;

        if (!organizationId) {
            return Response.json(
                {
                    success: false,
                    error: "Organization ID is required."
                },
                { status: 400 }
            );
        }

        const result = await context.env.DB
            .prepare(`
                SELECT
                    id,
                    organization_id,
                    title,
                    slug,
                    content,
                    status,
                    created_at,
                    updated_at
                FROM pages
                WHERE organization_id = ?
                  AND status = 'published'
                ORDER BY title ASC
            `)
            .bind(organizationId)
            .all();

        return Response.json({
            success: true,
            organization_id: Number(organizationId),
            pages: result.results
        });

    } catch (error) {
        console.error(error);

        return Response.json(
            {
                success: false,
                error: "Could not load organization pages."
            },
            { status: 500 }
        );
    }
}
