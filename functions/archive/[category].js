const categories = {
    government: "Government",
    legislation: "Legislation",
    business: "Business",
    elections: "Elections",
    people: "People",
    events: "Events"
};

export async function onRequestGet(context) {
    try {
        const categorySlug =
            String(context.params.category || "").toLowerCase();

        const category =
            categories[categorySlug];

        if (!category) {
            return new Response(
                "Archive collection not found.",
                {
                    status: 404,
                    headers: {
                        "Content-Type": "text/plain"
                    }
                }
            );
        }

        const result =
            await context.env.DB.prepare(`
                SELECT
                    id,
                    title,
                    content,
                    author_user_id,
                    created_at,
                    updated_at
                FROM archive_records
                WHERE category = ?
                ORDER BY created_at DESC
            `)
            .bind(category)
            .all();

        const records =
            result.results || [];

        let recordsHTML = "";

        for (const record of records) {
            recordsHTML += `
                <article class="card">
                    <b>${escapeHTML(category)}</b>

                    <h3>
                        ${escapeHTML(record.title)}
                    </h3>

                    <p>
                        ${escapeHTML(record.content)}
                    </p>

                    <small>
                        Published ${escapeHTML(record.created_at)}
                    </small>
                </article>
            `;
        }

        if (!recordsHTML) {
            recordsHTML = `
                <div class="none">
                    No records have been published in this collection yet.
                </div>
            `;
        }

        const title =
            category === "Government"
                ? "Government Records"
                : category === "Legislation"
                    ? "Laws & Legislation"
                    : category === "Business"
                        ? "Businesses & Organizations"
                        : category === "Elections"
                            ? "Elections"
                            : category === "People"
                                ? "People & Officials"
                                : "Events & History";

        const description =
            category === "Government"
                ? "Administrative history, offices, officials, and major government actions."
                : category === "Legislation"
                    ? "Important laws, bills, amendments, and votes."
                    : category === "Business"
                        ? "Companies, organizations, founders, and significant changes."
                        : category === "Elections"
                            ? "Election results, candidates, campaigns, and historical records."
                            : category === "People"
                                ? "Biographical and service records for notable people and officials."
                                : "A chronological record of notable events and developments.";

        const html = `
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        ${escapeHTML(title)} | Redmont Archives
    </title>

    <meta
        name="description"
        content="${escapeHTML(description)}"
    >

    <link
        rel="icon"
        type="image/x-icon"
        href="/favicon.ico"
    >

    <link
        rel="stylesheet"
        href="/styles.css"
    >

</head>

<body>

<header>

    <div class="container nav">

        <a
            class="brand"
            href="/"
        >

            <img
                src="/logo.svg"
                alt="Redmont Archives logo"
                class="logo"
            >

            <span>
                Redmont Archives
            </span>

        </a>

        <nav>

            <a href="/">
                Records
            </a>

            <a href="/organizations.html">
                Organizations
            </a>

            <a href="/#categories">
                Categories
            </a>

            <a href="/#about">
                About
            </a>

            <a href="/account.html">
                Account
            </a>

        </nav>

    </div>

</header>

<main>

<section class="hero">

    <div class="container hero-inner">

        <div class="eyebrow">
            ARCHIVE COLLECTION
        </div>

        <h1>
            ${escapeHTML(title)}
        </h1>

        <p>
            ${escapeHTML(description)}
        </p>

    </div>

</section>

<section class="section">

    <div class="container">

        <div class="heading">

            <div>

                <div class="eyebrow">
                    ${escapeHTML(category)}
                </div>

                <h2>
                    Records
                </h2>

            </div>

            <span>
                ${records.length}
                ${records.length === 1 ? "record" : "records"}
            </span>

        </div>

        <div class="grid">

            ${recordsHTML}

        </div>

    </div>

</section>

</main>

<footer>

    <div class="container foot">

        <span>
            © 2026 Redmont Archives
        </span>

        <span>
            Public information archive
        </span>

    </div>

</footer>

</body>

</html>
`;

        return new Response(
            html,
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "text/html; charset=UTF-8"
                }
            }
        );

    } catch (error) {

        console.error(
            "Archive collection error:",
            error
        );

        return new Response(
            "Unable to load archive collection.",
            {
                status: 500,
                headers: {
                    "Content-Type":
                        "text/plain; charset=UTF-8"
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
