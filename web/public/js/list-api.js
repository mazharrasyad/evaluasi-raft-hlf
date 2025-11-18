// State management
let apiData = null;
let currentFilter = 'all';
let currentSearch = '';

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const apiList = document.getElementById('apiList');
const noResults = document.getElementById('noResults');
const statsSection = document.getElementById('statsSection');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button');

// Fetch API data
async function fetchApiData() {
    try {
        const response = await fetch('/api/list');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching API data:', error);
        throw error;
    }
}

// Render stats section
function renderStats(data) {
    const stats = [
        {
            label: 'Total Endpoints',
            value: data.totalEndpoints,
            icon: '🔌',
            color: 'primary'
        },
        {
            label: 'Kategori',
            value: data.totalCategories,
            icon: '📁',
            color: 'secondary'
        },
        {
            label: 'Framework',
            value: data.serverInfo.framework,
            icon: '⚙️',
            color: 'accent'
        },
        {
            label: 'Version',
            value: data.version,
            icon: '📌',
            color: 'highlight'
        }
    ];

    statsSection.innerHTML = stats.map(stat => `
        <div class="stats-card">
            <div class="text-3xl mb-2">${stat.icon}</div>
            <div class="text-2xl font-bold text-${stat.color} mb-1">${stat.value}</div>
            <div class="text-sm text-muted">${stat.label}</div>
        </div>
    `).join('');
}

// Get method badge class
function getMethodBadgeClass(method) {
    const methodLower = method.toLowerCase();
    return `method-${methodLower}`;
}

// Render API endpoint card
function renderEndpointCard(endpoint) {
    const hasBody = endpoint.body !== undefined;
    const hasQuery = endpoint.query !== undefined;

    return `
        <div class="api-card" data-method="${endpoint.method}">
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 flex-1">
                    <span class="method-badge ${getMethodBadgeClass(endpoint.method)}">${endpoint.method}</span>
                    <code class="text-primary text-base font-semibold">${endpoint.path}</code>
                </div>
            </div>

            <p class="text-muted text-sm mb-3 leading-relaxed">${endpoint.description}</p>

            ${hasQuery ? `
                <div class="mb-3">
                    <div class="text-xs text-muted font-semibold mb-1">Query Parameters:</div>
                    <div class="code-block">${endpoint.query}</div>
                </div>
            ` : ''}

            ${hasBody ? `
                <div class="mb-3">
                    <div class="text-xs text-muted font-semibold mb-1">Request Body:</div>
                    <div class="code-block">${endpoint.body}</div>
                </div>
            ` : ''}

            <div>
                <div class="text-xs text-muted font-semibold mb-1">Response:</div>
                <div class="code-block">${endpoint.response}</div>
            </div>
        </div>
    `;
}

// Render category section
function renderCategory(category) {
    return `
        <div class="category-section" data-category="${category.category}">
            <div class="category-header">
                <h2 class="text-xl font-bold text-textdark">${category.category}</h2>
                <p class="text-sm text-muted mt-1">${category.endpoints.length} endpoint${category.endpoints.length > 1 ? 's' : ''}</p>
            </div>
            <div class="endpoints-container">
                ${category.endpoints.map(endpoint => renderEndpointCard(endpoint)).join('')}
            </div>
        </div>
    `;
}

// Render all API data
function renderApiList(data) {
    if (!data || !data.categories || data.categories.length === 0) {
        apiList.innerHTML = '<p class="text-center text-muted py-8">Tidak ada data API tersedia.</p>';
        return;
    }

    apiList.innerHTML = data.categories.map(category => renderCategory(category)).join('');
}

// Filter and search functionality
function filterAndSearch() {
    if (!apiData) return;

    const searchTerm = currentSearch.toLowerCase();
    let visibleCount = 0;

    // Get all API cards
    const allCards = document.querySelectorAll('.api-card');

    allCards.forEach(card => {
        const method = card.getAttribute('data-method');
        const cardText = card.textContent.toLowerCase();

        // Check method filter
        const methodMatch = currentFilter === 'all' || method === currentFilter;

        // Check search term
        const searchMatch = searchTerm === '' || cardText.includes(searchTerm);

        if (methodMatch && searchMatch) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Hide empty categories
    const categories = document.querySelectorAll('.category-section');
    categories.forEach(category => {
        const visibleCards = category.querySelectorAll('.api-card[style="display: block;"]');
        if (visibleCards.length === 0) {
            category.style.display = 'none';
        } else {
            category.style.display = 'block';
        }
    });

    // Show/hide no results message
    if (visibleCount === 0) {
        noResults.classList.remove('hidden');
        apiList.classList.add('hidden');
    } else {
        noResults.classList.add('hidden');
        apiList.classList.remove('hidden');
    }
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    filterAndSearch();
});

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active state
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update filter
        currentFilter = button.getAttribute('data-method');
        filterAndSearch();
    });
});

// Initialize
async function init() {
    try {
        // Show loading state
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        apiList.classList.add('hidden');
        statsSection.innerHTML = '';

        // Fetch data
        const data = await fetchApiData();
        apiData = data;

        // Render stats and API list
        renderStats(data);
        renderApiList(data);

        // Hide loading, show content
        loadingState.classList.add('hidden');
        apiList.classList.remove('hidden');

        // Initial filter
        filterAndSearch();

    } catch (error) {
        // Show error state
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.textContent = error.message || 'Terjadi kesalahan saat memuat data API';
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
