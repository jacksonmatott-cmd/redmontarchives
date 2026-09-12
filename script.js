async function searchRecords() {
    const input = document.getElementById('q');
    const query = input.value.trim();

    if (!query) {
        return;
    }

    const button = document.querySelector('.search button');

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

        showSearchResult(
            data.answer || 'No answer was returned.'
        );

    } catch (error) {
        console.error('Archive search error:', error);

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

    result.replaceChildren();

    const label = document.createElement('div');
    label.className = 'ai-result-label';
    label.textContent = 'REDMONT ARCHIVES AI';

    result.appendChild(label);


    const answerText = document.createElement('div');
    answerText.className = 'ai-result-text';

    const paragraphs = String(answer).split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
        const p = document.createElement('p');

        const lines = paragraph.split('\n');

        lines.forEach((line, index) => {
            p.appendChild(
                document.createTextNode(line)
            );

            if (index < lines.length - 1) {
                p.appendChild(document.createElement('br'));
            }
        });

        answerText.appendChild(p);
    }

    result.appendChild(answerText);

    result.hidden = false;

    result.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}


document.getElementById('q').addEventListener(
    'keydown',
    function (event) {
        if (event.key === 'Enter') {
            searchRecords();
        }
    }
);
