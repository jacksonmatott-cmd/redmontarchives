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
            data.answer || 'No answer was returned.',
            Array.isArray(data.sources) ? data.sources : []
        );

    } catch (error) {
        console.error('Archive search error:', error);

        showSearchResult(
            'Sorry, the archive search encountered an error. Please try again.',
            []
        );

    } finally {
        button.disabled = false;
        button.textContent = 'Search';
    }
}


function showSearchResult(answer, sources) {
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

    /*
     * AI label
     */
    const label = document.createElement('div');
    label.className = 'ai-result-label';
    label.textContent = 'REDMONT ARCHIVES AI';

    result.appendChild(label);


    /*
     * AI answer
     */
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


    /*
     * Sources
     */
    if (sources.length > 0) {
        const sourcesSection = document.createElement('div');
        sourcesSection.className = 'ai-sources';

        const heading = document.createElement('div');
        heading.className = 'ai-sources-heading';
        heading.textContent = 'Sources';

        sourcesSection.appendChild(heading);


        for (const source of sources) {
            if (!source || !source.url) {
                continue;
            }

            let url;

            try {
                url = new URL(source.url);
            } catch {
                continue;
            }

            /*
             * Only allow normal web URLs.
             */
            if (
                url.protocol !== 'https:' &&
                url.protocol !== 'http:'
            ) {
                continue;
            }


            /*
             * Source link
             */
            const sourceLink = document.createElement('a');

            sourceLink.className = 'ai-source';
            sourceLink.href = url.href;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener noreferrer';


            /*
             * Source title
             */
            const title = document.createElement('strong');

            title.textContent =
                source.title || 'Untitled source';

            sourceLink.appendChild(title);


            /*
             * Domain
             */
            const domain = document.createElement('span');

            domain.className = 'ai-source-domain';
            domain.textContent = url.hostname;

            sourceLink.appendChild(domain);


            /*
             * Optional snippet
             */
            if (source.snippet) {
                const snippet = document.createElement('span');

                snippet.className = 'ai-source-snippet';
                snippet.textContent = source.snippet;

                sourceLink.appendChild(snippet);
            }


            sourcesSection.appendChild(sourceLink);
        }


        /*
         * Only display Sources if at least one
         * valid source was successfully added.
         */
        if (sourcesSection.querySelector('.ai-source')) {
            result.appendChild(sourcesSection);
        }
    }


    result.hidden = false;

    /*
     * Scroll the result into view.
     */
    result.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}


/*
 * Pressing Enter in the search box
 * performs the search.
 */
document.getElementById('q').addEventListener(
    'keydown',
    function (event) {
        if (event.key === 'Enter') {
            searchRecords();
        }
    }
);
