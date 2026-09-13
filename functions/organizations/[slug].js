export async function onRequestGet(context) {
    try {
        const slug = context.params.slug;

        const organization = await context.env.DB
            .prepare(`
                SELECT id, name, slug, description
                FROM organizations
                WHERE slug = ?
            `)
            .bind(slug)
            .first();

        if (!organization) {
            return new Response(
                "Organization not found.",
                {
                    status: 404,
                    headers: {
                        "Content-Type": "text/plain"
                    }
                }
            );
        }

        const pagesResult = await context.env.DB
            .prepare(`
                SELECT id, title, slug, content
                FROM pages
                WHERE organization_id = ?
                  AND status = 'published'
                ORDER BY title ASC
            `)
            .bind(organization.id)
            .all();

        const pages = pagesResult.results || [];

        let recordsHTML = "";

        for (const page of pages) {
            recordsHTML +=
                "<article class=\"card\">" +
                    "<b>ORGANIZATION PAGE</b>" +
                    "<h3>" +
                        escapeHTML(page.title) +
                    "</h3>" +
                    "<p>" +
                        escapeHTML(page.content) +
                    "</p>" +

                    "<div " +
                        "class=\"owner-page-controls\" " +
                        "hidden>" +

                        "<button " +
                            "class=\"delete-page-button\" " +
                            "data-page-id=\"" + page.id + "\"" +
                            " type=\"button\">" +
                            "Delete Page" +
                        "</button>" +

                    "</div>" +

                "</article>";
        }

        if (!recordsHTML) {
            recordsHTML =
                "<div class=\"none\">" +
                    "No published information is available yet." +
                "</div>";
        }

        const safeName =
            escapeHTML(organization.name);

        const safeDescription =
            escapeHTML(
                organization.description ||
                "No organization description has been published."
            );

        const orgSlug =
            JSON.stringify(organization.slug);

        const organizationId =
            JSON.stringify(organization.id);

        const html =
`<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>${safeName} | Redmont Archives</title>

    <meta
        name="description"
        content="${safeDescription}"
    >

    <link
        rel="stylesheet"
        href="/styles.css"
    >

    <style>

        .owner-controls {
            margin-top: 30px;
        }

        .owner-controls h3 {
            margin-bottom: 15px;
        }

        .owner-controls input,
        .owner-controls textarea {
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 12px;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #ccc;
        }

        .owner-controls textarea {
            min-height: 140px;
            resize: vertical;
        }

        .owner-controls button,
        .delete-page-button {
            border: 0;
            border-radius: 8px;
            padding: 10px 14px;
            cursor: pointer;
            margin-right: 8px;
            margin-bottom: 8px;
        }

        .owner-page-controls {
            margin-top: 15px;
        }

        .owner-message {
            margin-top: 12px;
        }

    </style>

</head>

<body>

<header>

    <div class="container nav">

        <a class="brand" href="/">

            <span class="mark">RA</span>

            <span>
                Redmont Archives
            </span>

        </a>

        <nav>

            <a href="/">
                Archive
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
            ${safeName}
        </h1>

        <p>
            ${safeDescription}
        </p>

    </div>

</section>

<section class="section">

    <div class="container">

        <div class="card">

            <div class="eyebrow">
                ORGANIZATION AI
            </div>

            <h2>
                Ask about this organization
            </h2>

            <p>
                AI access requires a Redmont Archives account.
            </p>

            <form id="ai-form">

                <input
                    id="ai-question"
                    type="text"
                    maxlength="1000"
                    placeholder="Ask a question..."
                    required
                >

                <br>
                <br>

                <button
                    type="submit"
                    id="ai-button"
                >
                    Ask AI
                </button>

            </form>

            <div id="ai-result" hidden>

                <div
                    id="ai-label"
                    class="eyebrow"
                ></div>

                <p id="ai-answer"></p>

            </div>

        </div>

    </div>

</section>

<section class="section">

    <div class="container">

        <div class="eyebrow">
            PUBLISHED INFORMATION
        </div>

        <h2>
            Organization records
        </h2>

        <div class="grid">

            ${recordsHTML}

        </div>

        <div
            id="organization-owner-controls"
            class="card owner-controls"
            hidden
        >

            <div class="eyebrow">
                ORGANIZATION MANAGEMENT
            </div>

            <h2>
                Owner Controls
            </h2>

            <h3>
                Add Page
            </h3>

            <form id="add-page-form">

                <input
                    id="page-title"
                    type="text"
                    maxlength="200"
                    placeholder="Page title"
                    required
                >

                <input
                    id="page-slug"
                    type="text"
                    maxlength="100"
                    placeholder="Page slug, e.g. about"
                    required
                >

                <textarea
                    id="page-content"
                    maxlength="10000"
                    placeholder="Page content"
                    required
                ></textarea>

                <button
                    type="submit"
                    id="add-page-button"
                >
                    Add Page
                </button>

            </form>

            <div
                id="page-message"
                class="owner-message"
                hidden
            ></div>

            <br>

            <button
                id="delete-organization-button"
                type="button"
            >
                Delete Organization
            </button>

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
            Organization Archive
        </span>

    </div>

</footer>

<script>

const organizationSlug = ${orgSlug};

const organizationId = ${organizationId};

const form =
    document.getElementById("ai-form");

const question =
    document.getElementById("ai-question");

const button =
    document.getElementById("ai-button");

const result =
    document.getElementById("ai-result");

const label =
    document.getElementById("ai-label");

const answer =
    document.getElementById("ai-answer");

const ownerControls =
    document.getElementById(
        "organization-owner-controls"
    );

const deleteOrganizationButton =
    document.getElementById(
        "delete-organization-button"
    );

const addPageForm =
    document.getElementById(
        "add-page-form"
    );

const addPageButton =
    document.getElementById(
        "add-page-button"
    );

const pageMessage =
    document.getElementById(
        "page-message"
    );

async function checkOwnerStatus() {

    try {

        const response =
            await fetch(
                "/api/organization-owner?organization=" +
                encodeURIComponent(
                    organizationSlug
                )
            );

        const data =
            await response.json();

        if (
            data.authenticated &&
            data.owner
        ) {

            ownerControls.hidden = false;

            const pageControls =
                document.querySelectorAll(
                    ".owner-page-controls"
                );

            pageControls.forEach(
                function(control) {

                    control.hidden = false;

                }
            );

            const deleteButtons =
                document.querySelectorAll(
                    ".delete-page-button"
                );

            deleteButtons.forEach(
                function(button) {

                    button.addEventListener(
                        "click",
                        function() {

                            deletePage(
                                button.dataset.pageId
                            );

                        }
                    );

                }
            );

        }

    } catch (error) {

        console.error(
            "Owner check failed:",
            error
        );

    }

}

async function deletePage(pageId) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this page?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/organization-manage",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        organizationId:
                            organizationId,

                        action:
                            "delete_page",

                        pageId:
                            Number(pageId)
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unable to delete page."
            );

        }

        location.reload();

    } catch (error) {

        alert(
            error.message ||
            "Unable to delete page."
        );

    }

}

addPageForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const title =
            document
                .getElementById("page-title")
                .value
                .trim();

        const slug =
            document
                .getElementById("page-slug")
                .value
                .trim();

        const content =
            document
                .getElementById("page-content")
                .value
                .trim();

        if (
            !title ||
            !slug ||
            !content
        ) {
            return;
        }

        addPageButton.disabled = true;

        addPageButton.textContent =
            "Creating...";

        pageMessage.hidden = false;

        pageMessage.textContent =
            "Creating page...";

        try {

            const response =
                await fetch(
                    "/api/organization-page-create",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            organizationId:
                                organizationId,

                            title:
                                title,

                            slug:
                                slug,

                            content:
                                content
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Unable to create page."
                );

            }

            location.reload();

        } catch (error) {

            pageMessage.textContent =
                error.message ||
                "Unable to create page.";

        } finally {

            addPageButton.disabled = false;

            addPageButton.textContent =
                "Add Page";

        }

    }
);

deleteOrganizationButton.addEventListener(
    "click",
    async function() {

        const confirmed =
            confirm(
                "Are you sure you want to permanently delete this organization?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const response =
                await fetch(
                    "/api/organization-manage",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            organizationId:
                                organizationId,

                            action:
                                "delete_organization"
                        })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Unable to delete organization."
                );

            }

            window.location.href =
                "/organizations.html";

        } catch (error) {

            alert(
                error.message ||
                "Unable to delete organization."
            );

        }

    }
);

form.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const text =
            question.value.trim();

        if (!text) {
            return;
        }

        button.disabled = true;

        button.textContent =
            "Thinking...";

        result.hidden = false;

        label.textContent =
            "ORGANIZATION AI";

        answer.textContent =
            "Checking your account...";

        try {

            const response =
                await fetch(
                    "/api/organization-ai",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            organization:
                                organizationSlug,

                            query:
                                text
                        })
                    }
                );

            const data =
                await response.json();

            if (
                response.status === 401
            ) {

                window.location.href =
                    "/login.html?returnTo=" +
                    encodeURIComponent(
                        window.location.pathname
                    );

                return;

            }

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Unable to complete AI request."
                );

            }

            label.textContent =
                "AI ANSWER";

            answer.textContent =
                data.answer ||
                "No answer was returned.";

        } catch (error) {

            console.error(error);

            label.textContent =
                "AI ERROR";

            answer.textContent =
                error.message ||
                "Unable to complete AI request.";

        } finally {

            button.disabled = false;

            button.textContent =
                "Ask AI";

        }

    }
);

checkOwnerStatus();

</script>

</body>

</html>`;

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
            "Organization page error:",
            error
        );

        return new Response(
            "Unable to load organization.",
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
