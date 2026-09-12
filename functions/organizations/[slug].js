export async function onRequestGet(context) {
    const slug = context.params.slug;

    try {
        const organization = await context.env.DB
            .prepare(`
                SELECT id, name, slug, description, created_at
                FROM organizations
                WHERE slug = ?
            `)
            .bind(slug)
            .first();

        if (!organization) {
            return new Response(
                "<h1>Organization not found</h1><p>This organization does not exist in Redmont Archives.</p>",
                {
                    status: 404,
                    headers: {
                        "Content-Type": "text/html; charset=UTF-8"
                    }
                }
            );
        }

        const pages = await context.env.DB
            .prepare(`
                SELECT id, title, slug, content, created_at, updated_at
                FROM pages
                WHERE organization_id = ?
                  AND status = 'published'
                ORDER BY title ASC
            `)
            .bind(organization.id)
            .all();

        const pageHTML = pages.results.map(page => `
            <article>
                <h2>${escapeHTML(page.title)}</h2>
                <p>${escapeHTML(page.content)}</p>
            </article>
        `).join("");

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(organization.name)} | Redmont Archives</title>
</head>

<body>

    <header>
        <h1>Redmont Archives</h1>
        <a href="/">← Return to Archive</a>
    </header>

    <main>

        <p>ORGANIZATION ARCHIVE</p>

        <h1>${escapeHTML(organization.name)}</h1>

        <p>
            ${escapeHTML(
                organization.description ||
                "No organization description has been published."
            )}
        </p>

        <hr>

        <h2>Published Information</h2>

        ${
            pageHTML ||
            "<p>No published pages are available yet.</p>"
        }

    </main>

</body>
</html>
        `;

        return new Response(html, {
            headers: {
                "Content-Type": "text/html; charset=UTF-8"
            }
        });

    } catch (error) {

        console.error(error);

        return new Response(
            "<h1>Server Error</h1><p>Unable to load this organization.</p>",
            {
                status: 500,
                headers: {
                    "Content-Type": "text/html; charset=UTF-8"
                }
            }
        );
    }
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
