export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const organizationId = body.organization_id;
        const title = body.title;
        const slug = body.slug;
        const content = body.content;

        if (!organizationId || !title || !slug || !content) {
            return Response.json(
                {
                    error: "Organization ID, title, slug, and content are required."
                },
                { status: 400 }
            );
        }

        const result = await context.env.DB
            .prepare(`
                INSERT INTO pages
                (organization_id, title, slug, content, status)
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
        console.error(error);

        return Response.json(
            {
                success: false,
                error: error.message
            },
            { status: 500 }
        );
    }
}
