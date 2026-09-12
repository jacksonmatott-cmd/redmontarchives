export async function onRequestGet(context) {
    try {
        const result = await context.env.DB
            .prepare(`
                SELECT id, name, slug, description, created_at
                FROM organizations
                ORDER BY name ASC
            `)
            .all();

        return Response.json({
            success: true,
            organizations: result.results
        });

    } catch (error) {
        console.error("Organizations API error:", error);

        return Response.json(
            {
                success: false,
                error: "Could not load organizations."
            },
            { status: 500 }
        );
    }
}
