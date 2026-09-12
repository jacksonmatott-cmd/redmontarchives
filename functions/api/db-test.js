export async function onRequestGet(context) {
    try {
        const result = await context.env.DB
            .prepare("SELECT 1 AS connected")
            .first();

        return Response.json({
            success: true,
            database: result
        });

    } catch (error) {
        return Response.json(
            {
                success: false,
                error: error.message
            },
            { status: 500 }
        );
    }
}
