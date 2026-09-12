async function searchRecords() {
    const input = document.getElementById('q');
    const query = input.value.trim();

    if (!query) {
        return;
    }

    // Check for the hidden record creation command
    if (query.toLowerCase().startsWith('?create ')) {
        const parts = query.substring(8).trim().split(/\s+/);

        if (parts.length < 2) {
            showSearchResult(
                'Create format: ?create (page title) (category)'
            );
            return;
        }

        const category = parts.pop();
        const title = parts.join(' ');

        showCreateRecord(title, category);
        return;
    }

    const button = document.querySelector('.search button');

    // Change button while searching
    button.disabled = true;
    button.textContent = 'Searching...';

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: query
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Search failed.');
        }

        // Show the AI answer
        showSearchResult(data.answer);

    } catch (error) {
        console.error(error);
        showSearchResult(
            'Sorry, the archive search encountered an error. Please try again.'
        );
    } finally {
        button.disabled = false;
        button.textContent = 'Search';
    }
}


function showSearchResult(answer) {
    let result = document.getElementById('ai-result');

    // Create the result box if it doesn't exist yet
    if (!result) {
        result = document.createElement('div');
        result.id = 'ai-result';
        result.className = 'ai-result';

        const searchBox = document.querySelector('.search');
        searchBox.parentNode.insertBefore(
            result,
            searchBox.nextElementSibling
        );
    }

    result.innerHTML = `
        <div class="ai-result-label">REDMONT ARCHIVES AI</div>
        <div class="ai-result-text">${formatAnswer(answer)}</div>
    `;

    result.hidden = false;
}


function formatAnswer(text) {
    // Remove Groq citation markers
    text = text.replace(/【\d+(?:†[^】]*)?】/g, '');

    // Basic formatting for line breaks
    return text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

function showCreateRecord(title, category) {
    let result = document.getElementById('ai-result');

    if (!result) {
        result = document.createElement('div');
        result.id = 'ai-result';
        result.className = 'ai-result';

        const searchBox = document.querySelector('.search');
        searchBox.parentNode.insertBefore(
            result,
            searchBox.nextElementSibling
        );
    }

    result.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'ai-result-label';
    label.textContent = 'CREATE ARCHIVE RECORD';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const categoryText = document.createElement('p');
    categoryText.textContent = `Category: ${category}`;

    const textarea = document.createElement('textarea');
    textarea.maxLength = 3000;
    textarea.placeholder = 'Enter the record content...';
    textarea.style.width = '100%';
    textarea.style.minHeight = '250px';
    textarea.style.boxSizing = 'border-box';

    const counter = document.createElement('div');
    counter.textContent = '0 / 3000 characters';
    counter.style.marginTop = '6px';
    counter.style.fontSize = '13px';

    textarea.addEventListener('input', function () {
        counter.textContent = `${textarea.value.length} / 3000 characters`;
    });

    const buttons = document.createElement('div');
    buttons.style.marginTop = '15px';

    const createButton = document.createElement('button');
    createButton.textContent = 'Create Draft';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.marginLeft = '10px';

    createButton.addEventListener('click', function () {
        if (!textarea.value.trim()) {
            alert('Please enter some record content.');
            return;
        }

        alert(
            'Draft created locally for now. Permanent record storage will be added next.'
        );
    });

    cancelButton.addEventListener('click', function () {
        result.hidden = true;
    });

    buttons.appendChild(createButton);
    buttons.appendChild(cancelButton);

    result.appendChild(label);
    result.appendChild(heading);
    result.appendChild(categoryText);
    result.appendChild(textarea);
    result.appendChild(counter);
    result.appendChild(buttons);

    result.hidden = false;

    textarea.focus();
}
// Press Enter to search
document.getElementById('q').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        searchRecords();
    }
});
