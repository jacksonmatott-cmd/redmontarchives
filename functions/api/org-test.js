export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const name = body.name;
        const slug = body.slug;
        const description = body.description || null;

        if (!name || !slug) {
            return Response.json(
                {
                    error: "Name and slug are required."
                },
                { status: 400 }
            );
        }

        const result = await context.env.DB
            .prepare(`
                INSERT INTO organizations
                (name, slug, description)
                VALUES (?, ?, ?)
            `)
            .bind(name, slug, description)
            .run();

        return Response.json({
            success: true,
            organization_id: result.meta.last_row_id
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
