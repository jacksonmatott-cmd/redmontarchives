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
                `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Organization Not Found | Redmont Archives</title>
                    <link rel="stylesheet" href="/styles.css">
                </head>

                <body>

                    <header>
                        <div class="container nav">

                            <a class="brand" href="/">
                                <span class="mark">RA</span>
                                <span>Redmont Archives</span>
                            </a>

                        </div>
                    </header>

                    <main>

                        <section class="section">

                            <div class="container">

                                <div class="eyebrow">
                                    ORGANIZATION
                                </div>

                                <h1>
                                    Organization not found
                                </h1>

                                <p>
                                    The organization you're looking for could not
                                    be found in the Redmont Archives.
                                </p>

                                <br>

                                <a href="/">
                                    ← Return to archive
                                </a>

                            </div>

                        </section>

                    </main>

                </body>
                </html>
                `,
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
            `)
            .bind(organization.id)
            .all();

        const pageHTML = pages.results.map(page => `
            <article class="card">

                <b>
                    ORGANIZATION PAGE
                </b>

                <h3>
                    ${escapeHTML(page.title)}
                </h3>

                <p>
                    ${escapeHTML(page.content)}
                </p>

            </article>
        `).join("");

        const html = `
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>${escapeHTML(organization.name)} | Redmont Archives</title>

    <meta
        name="description"
        content="${escapeHTML(
            organization.description ||
            "Organization archive on Redmont Archives."
        )}"
    >

    <link rel="stylesheet" href="/styles.css">

</head>

<body>

<header>

    <div class="container nav">

        <a class="brand" href="/">
            <span class="mark">RA</span>
            <span>Redmont Archives</span>
        </a>

        <nav>

            <a href="/">
                Archive
            </a>

            <a href="/#categories">
                Categories
            </a>

            <a href="/#about">
                About
            </a>

        </nav>

    </div>

</header>

<main>

    <section class="hero">

        <div class="container hero-inner">

            <div class="eyebrow">
                ORGANIZATION ARCHIVE
            </div>

            <h1>
                ${escapeHTML(organization.name)}
            </h1>

            <p>
                ${escapeHTML(
                    organization.description ||
                    "No organization description has been published."
                )}
            </p>

            <div class="quick">

                <a href="/create-page.html?organization=${encodeURIComponent(organization.slug)}">
                    Create Page
                </a>

            </div>

        </div>

    </section>

    <section class="section">

        <div class="container">

            <div class="heading">

                <div>

                    <div class="eyebrow">
                        PUBLISHED INFORMATION
                    </div>

                    <h2>
                        Organization records
                    </h2>

                </div>

                <span>
                    ${pages.results.length}
                    ${pages.results.length === 1 ? "page" : "pages"}
                </span>

            </div>

            ${
                pageHTML
                    ? `<div class="grid">${pageHTML}</div>`
                    : `
                        <div class="none">
                            No published information is available yet.
                        </div>
                    `
            }

        </div>

    </section>

    <section class="section alt">

        <div class="container">

            <div class="eyebrow">
                REDMONT ARCHIVES
            </div>

            <h2>
                Organization information
            </h2>

            <p>
                Information published here represents the organization's
                public archive within Redmont Archives.
            </p>

        </div>

    </section>

</main>

<footer>

    <div class="container foot">

        <span>
            © 2026 Redmont Archives
        </span>

        <span>
            Organization Archive
        </span>

    </div>

</footer>

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
            `
            <!DOCTYPE html>
            <html lang="en">

            <head>

                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <title>Error | Redmont Archives</title>

                <link rel="stylesheet" href="/styles.css">

            </head>

            <body>

                <header>

                    <div class="container nav">

                        <a class="brand" href="/">
                            <span class="mark">RA</span>
                            <span>Redmont Archives</span>
                        </a>

                    </div>

                </header>

                <main>

                    <section class="section">

                        <div class="container">

                            <div class="eyebrow">
                                ERROR
                            </div>

                            <h1>
                                Unable to load organization
                            </h1>

                            <p>
                                Please try again later.
                            </p>

                            <br>

                            <a href="/">
                                ← Return to archive
                            </a>

                        </div>

                    </section>

                </main>

            </body>

            </html>
            `,
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
