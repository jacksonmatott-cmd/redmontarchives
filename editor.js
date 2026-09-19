document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".redmont-editor").forEach(initEditor);
});

function initEditor(editor) {
    const surface = editor.querySelector(".redmont-editor-surface");
    const inputId = editor.dataset.input;

    const hiddenInput = document.getElementById(inputId);

    if (!surface || !hiddenInput) {
        return;
    }

    // Load any existing HTML content.
    surface.innerHTML = hiddenInput.value || "";

    editor.querySelectorAll("[data-command]").forEach(button => {
        button.addEventListener("mousedown", event => {
            event.preventDefault();

            surface.focus();

            const command = button.dataset.command;
            const value = button.dataset.value || null;

            document.execCommand(
                command,
                false,
                value
            );

            syncEditor();
        });
    });

    editor.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("mousedown", event => {
            event.preventDefault();

            surface.focus();

            handleAction(
                button.dataset.action,
                surface
            );

            syncEditor();
        });
    });

    surface.addEventListener("input", syncEditor);

    const form = editor.closest("form");

    if (form) {
        form.addEventListener("submit", () => {
            syncEditor();
        });
    }

    function syncEditor() {
        hiddenInput.value = surface.innerHTML;
    }
}

function handleAction(action, surface) {

    if (action === "fontSize") {

        const size =
            prompt(
                "Font size (8–48):",
                "16"
            );

        if (!size) {
            return;
        }

        const numericSize =
            Math.min(
                48,
                Math.max(
                    8,
                    Number(size)
                )
            );

        if (!Number.isFinite(numericSize)) {
            return;
        }

        const selection =
            window.getSelection();

        if (!selection.rangeCount) {
            return;
        }

        const range =
            selection.getRangeAt(0);

        if (range.collapsed) {
            return;
        }

        const span =
            document.createElement("span");

        span.style.fontSize =
            numericSize + "px";

        span.appendChild(
            range.extractContents()
        );

        range.insertNode(span);

        selection.removeAllRanges();

        const newRange =
            document.createRange();

        newRange.selectNodeContents(span);

        selection.addRange(newRange);

        return;
    }

    if (action === "fontColor") {

        const color =
            prompt(
                "Font color (example: #d6ad63 or red):",
                "#d6ad63"
            );

        if (!color) {
            return;
        }

        document.execCommand(
            "foreColor",
            false,
            color.trim()
        );

        return;
    }

    if (action === "link") {

        const url =
            prompt(
                "Enter the URL:",
                "https://"
            );

        if (!url) {
            return;
        }

        const safeUrl =
            normalizeUrl(url);

        if (!safeUrl) {
            alert(
                "Please enter a valid HTTP or HTTPS URL."
            );

            return;
        }

        document.execCommand(
            "createLink",
            false,
            safeUrl
        );

        return;
    }

    if (action === "image") {

        const url =
            prompt(
                "Enter the image URL:",
                "https://"
            );

        if (!url) {
            return;
        }

        const safeUrl =
            normalizeUrl(url);

        if (!safeUrl) {
            alert(
                "Please enter a valid HTTP or HTTPS image URL."
            );

            return;
        }

        document.execCommand(
            "insertImage",
            false,
            safeUrl
        );

        return;
    }

    if (action === "table") {

        const rows =
            getPositiveNumber(
                prompt(
                    "Number of rows:",
                    "3"
                ),
                20
            );

        const columns =
            getPositiveNumber(
                prompt(
                    "Number of columns:",
                    "3"
                ),
                10
            );

        if (!rows || !columns) {
            return;
        }

        insertTable(
            surface,
            rows,
            columns
        );

        return;
    }

    if (action === "checklist") {

        insertChecklist(surface);

        return;
    }

    if (action === "footer") {

        insertFooter(surface);

        return;
    }

    if (action === "clearFormatting") {

        document.execCommand(
            "removeFormat",
            false,
            null
        );

        document.execCommand(
            "formatBlock",
            false,
            "p"
        );

        return;
    }
}

function getPositiveNumber(value, max) {
    const number =
        Number(
            String(value || "").trim()
        );

    if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > max
    ) {
        return null;
    }

    return number;
}

function normalizeUrl(value) {

    try {

        const url =
            new URL(value);

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return null;
        }

        return url.href;

    } catch {
        return null;
    }
}

function insertTable(
    surface,
    rows,
    columns
) {
    const table =
        document.createElement("table");

    table.className =
        "editor-table";

    const body =
        document.createElement("tbody");

    for (let row = 0; row < rows; row++) {

        const tr =
            document.createElement("tr");

        for (
            let column = 0;
            column < columns;
            column++
        ) {

            const td =
                document.createElement(
                    "td"
                );

            td.innerHTML =
                "&nbsp;";

            tr.appendChild(td);
        }

        body.appendChild(tr);
    }

    table.appendChild(body);

    insertNodeAtCursor(
        table
    );
}

function insertChecklist(surface) {

    const list =
        document.createElement("ul");

    list.className =
        "editor-checklist";

    list.dataset.checklist =
        "true";

    for (let i = 0; i < 3; i++) {

        const li =
            document.createElement("li");

        const checkbox =
            document.createElement("input");

        checkbox.type =
            "checkbox";

        checkbox.addEventListener(
            "click",
            event => {
                event.stopPropagation();
            }
        );

        const text =
            document.createElement("span");

        text.textContent =
            " Checklist item";

        li.appendChild(
            checkbox
        );

        li.appendChild(
            text
        );

        list.appendChild(li);
    }

    insertNodeAtCursor(
        list
    );
}

function insertFooter(surface) {

    const footer =
        document.createElement("div");

    footer.className =
        "editor-footer";

    footer.dataset.editorFooter =
        "true";

    footer.innerHTML =
        "<hr><p>Footer text</p>";

    insertNodeAtCursor(
        footer
    );
}

function insertNodeAtCursor(node) {

    const selection =
        window.getSelection();

    if (
        !selection ||
        !selection.rangeCount
    ) {
        return;
    }

    const range =
        selection.getRangeAt(0);

    range.deleteContents();

    range.insertNode(node);

    range.setStartAfter(node);

    range.collapse(true);

    selection.removeAllRanges();

    selection.addRange(range);
}
