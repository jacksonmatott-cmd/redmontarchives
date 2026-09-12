<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Organization | Redmont Archives</title>

    <link rel="stylesheet" href="../styles.css">
</head>

<body>

<header>
    <div class="container nav">
        <a class="brand" href="/">
            <span class="mark">RA</span>
            <span>Redmont Archives</span>
        </a>

        <nav>
            <a href="/">Archive</a>
            <a href="/#categories">Categories</a>
        </nav>
    </div>
</header>

<main>

    <section class="section">
        <div class="container">

            <div id="organization">
                <p>Loading organization...</p>
            </div>

        </div>
    </section>

</main>

<footer>
    <div class="container foot">
        <span>© 2026 Redmont Archives</span>
        <span>Organization Archive</span>
    </div>
</footer>

<script>
async function loadOrganization() {

    const slug = window.location.pathname
        .split('/')
        .filter(Boolean)
        .pop();

    try {

        const response = await fetch('/api/organizations');

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error('Could not load organizations.');
        }

        const organization = data.organizations.find(
            item => item.slug === slug
        );

        if (!organization) {
            document.getElementById('organization').innerHTML = `
                <div class="eyebrow">ORGANIZATION</div>
                <h1>Organization not found</h1>
                <p>
                    The organization you are looking for could not be found
                    in the Redmont Archives.
                </p>
                <a href="/">← Return to archive</a>
            `;

            return;
        }

        const pagesResponse = await fetch(
            `/api/organizations/${organization.id}/pages`
        );

        const pagesData = await pagesResponse.json();

        if (!pagesResponse.ok || !pagesData.success) {
            throw new Error('Could not load organization pages.');
        }

        let pagesHTML = '';

        if (pagesData.pages.length === 0) {

            pagesHTML = `
                <p>No published pages are available yet.</p>
            `;

        } else {

            pagesHTML = pagesData.pages.map(page => `
                <article class="card">
                    <b>ORGANIZATION PAGE</b>
                    <h3>${escapeHTML(page.title)}</h3>
                    <p>${escapeHTML(page.content)}</p>
                </article>
            `).join('');
        }

        document.title =
            `${organization.name} | Redmont Archives`;

        document.getElementById('organization').innerHTML = `
            <div class="eyebrow">ORGANIZATION ARCHIVE</div>

            <h1>${escapeHTML(organization.name)}</h1>

            <p>
                ${escapeHTML(
                    organization.description ||
                    'No organization description has been published.'
                )}
            </p>

            <br>

            <div class="eyebrow">PUBLISHED INFORMATION</div>

            <div class="grid">
                ${pagesHTML}
            </div>
        `;

    } catch (error) {

        console.error(error);

        document.getElementById('organization').innerHTML = `
            <div class="eyebrow">ERROR</div>
            <h1>Unable to load organization</h1>
            <p>
                Please try again later.
            </p>
        `;
    }
}

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

loadOrganization();
</script>

</body>
</html>
