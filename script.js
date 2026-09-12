async function searchRecords() {
    const input = document.getElementById('q');
    const query = input.value.trim();

    if (!query) {
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
    // Basic formatting for line breaks
    return text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}


// Press Enter to search
document.getElementById('q').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        searchRecords();
    }
});
