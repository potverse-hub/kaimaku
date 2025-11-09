// API Configuration
// Documentation: https://api-docs.animethemes.moe/wiki/anime/
// Based on the API docs: GET /anime/ with q parameter for search
// Use proxy in production to avoid CORS issues
const API_BASE = (() => {
    // Auto-detect production URL and use proxy
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Production: use backend proxy to avoid CORS
        return `${window.location.origin}/api/proxy/animethemes`;
    }
    // Development: use direct API (CORS should work locally)
    return 'https://api.animethemes.moe';
})();

// Direct API URL for fallback (if proxy fails)
const API_DIRECT = 'https://api.animethemes.moe';

// Track if we should use direct API as fallback
let useDirectAPI = false;

// Mobile device detection
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
                      ('ontouchstart' in window);

// Mobile-specific configuration
if (isMobileDevice) {
    console.log('[Mobile] Mobile device detected - using mobile-optimized interface');
    document.body.classList.add('mobile-device');
    // Mobile ALWAYS uses proxy to avoid CORS issues
    useDirectAPI = false;
} else {
    console.log('[Desktop] Desktop device detected');
    document.body.classList.add('desktop-device');
}

// Local Database Configuration
// Uses a simple Node.js server that stores data in ratings.json
// Make sure to run: npm install && npm start
// In production, this will be set to your hosting URL
const API_BASE_URL = (() => {
    // Auto-detect production URL
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Production: use same origin (your hosting URL)
        return `${window.location.origin}/api`;
    }
    // Development: use localhost
    return 'http://localhost:3000/api';
})();

// Database state
let databaseInitialized = false;

// Note: If you encounter CORS errors, you may need to:
// 1. Use a CORS proxy server
// 2. Host this website on a server (not file://)
// 3. Set up a backend proxy

// Alternative CORS proxy (uncomment if needed):
// const API_BASE = 'https://cors-anywhere.herokuapp.com/https://api.animethemes.moe';

// State management
let currentTheme = null;
let ratings = JSON.parse(localStorage.getItem('kaimaku') || '{}');
// Store theme metadata for quick access (anime slug/id and theme sequence)
let themeMetadata = JSON.parse(localStorage.getItem('themeMetadata') || '{}');
// Public ratings from database (aggregated)
let publicRatings = {};
// Filter and sort state
let currentSearchResults = [];
let activeFilters = {
    yearMin: null,
    yearMax: null,
    seasons: [],
    ratingMin: null,
    ratingMax: null
};
let currentSort = 'relevance';
let isListView = false;
let allAnimeData = []; // Store all fetched anime for filtering

// Video player event handlers (stored for cleanup)
let videoProgressHandler = null;
let videoCanPlayThroughHandler = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const navbarSearchInput = document.getElementById('navbarSearchInput');
const navbarSearchBtn = document.getElementById('navbarSearchBtn');
const searchResults = document.getElementById('searchResults');
const playerSection = document.getElementById('playerSection');
const videoPlayer = document.getElementById('videoPlayer');
const animeTitle = document.getElementById('animeTitle');
const themeInfo = document.getElementById('themeInfo');
const ratingValue = document.getElementById('ratingValue');
const closePlayer = document.getElementById('closePlayer');
const notification = document.getElementById('notification');
const animeInfo = document.getElementById('animeInfo');
const animeSynopsis = document.getElementById('animeSynopsis');

// Authentication state
let currentUser = null;

// Search spam prevention
let isSearching = false;
let lastSearchTime = 0;
const SEARCH_COOLDOWN = 1000; // 1 second cooldown between searches

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load metadata from localStorage
    themeMetadata = JSON.parse(localStorage.getItem('themeMetadata') || '{}');
    
    // Initialize database
    await initializeDatabase();
    
    // Check authentication
    await checkAuthentication();
    
    setupEventListeners();
    setupAuthEventListeners();
    setupPageNavigation();
    setupNewFeatures();
    setupMobileMenu();
    loadFeaturedOpenings();
    loadLeaderboard();
    
    // Load user's personal ratings from database if authenticated
    if (databaseInitialized && currentUser) {
        loadUserRatings();
    }
    
    // Load public ratings from database
    if (databaseInitialized) {
        loadPublicRatings();
    } else {
        // Retry loading public ratings after a delay if database wasn't ready
        setTimeout(() => {
            if (databaseInitialized) {
                loadPublicRatings();
                if (currentUser) {
                    loadUserRatings();
                }
            }
        }, 2000);
    }
    
    // Setup home button navigation
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        homeBtn.addEventListener('click', showHomePage);
    }
    
    // Load saved preferences
    loadPreferences();
    
    // Initialize filter badge
    updateFilterBadge();
    
    // Handle initial page load based on URL hash
    handlePageNavigation();
});

// Page navigation using URL hash
function setupPageNavigation() {
    // Handle browser back/forward buttons
    window.addEventListener('hashchange', handlePageNavigation);
}

function handlePageNavigation() {
    const hash = window.location.hash;
    const homePage = document.querySelector('.home-content');
    const playerSection = document.getElementById('playerSection');
    
    if (hash === '#player' && currentTheme) {
        // Show player, hide home
        if (homePage) homePage.style.display = 'none';
        if (playerSection) playerSection.classList.remove('hidden');
    } else {
        // Show home, hide player
        if (homePage) homePage.style.display = 'block';
        if (playerSection) playerSection.classList.add('hidden');
        // Clear hash if no theme is loaded
        if (!currentTheme && hash === '#player') {
            window.location.hash = '#home';
        }
    }
}

// Event Listeners
function setupEventListeners() {
    // Home page search (only via Enter key now, filter button replaced search button)
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
        
        // Also support mobile keyboard "Go" button
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
    }
    
    // Navbar search
    if (navbarSearchBtn) navbarSearchBtn.addEventListener('click', handleNavbarSearch);
    if (navbarSearchInput) {
        navbarSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleNavbarSearch();
        });
    }
    
    closePlayer.addEventListener('click', closePlayerSection);
    
    // Rating slider
    const ratingSlider = document.getElementById('ratingSlider');
    const ratingNumber = document.getElementById('ratingNumber');
    const quickRatingBtns = document.querySelectorAll('.quick-rating-btn');
    
    ratingSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        updateRatingDisplay(value);
        updateQuickButtons(value);
    });
    
    ratingSlider.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (value > 0) {
            handleRating(value);
        }
    });
    
    quickRatingBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseFloat(btn.dataset.rating);
            ratingSlider.value = rating;
            updateRatingDisplay(rating);
            updateQuickButtons(rating);
            handleRating(rating);
        });
    });
}

// Get rating color class based on value (shared function)
function getRatingColorClass(value) {
    if (value === 0 || isNaN(value)) {
        return 'rating-none';
    } else if (value >= 1 && value < 3) {
        return 'rating-low'; // Red
    } else if (value >= 3 && value < 5) {
        return 'rating-medium-low'; // Orange
    } else if (value >= 5 && value < 7) {
        return 'rating-medium'; // Yellow
    } else if (value >= 7 && value < 8.5) {
        return 'rating-medium-high'; // Light Green
    } else if (value >= 8.5 && value < 9.5) {
        return 'rating-high'; // Green
    } else if (value >= 9.5) {
        return 'rating-excellent'; // Cyan/Teal
    }
    return 'rating-none';
}

// Update rating display with color based on value
function updateRatingDisplay(value) {
    const ratingNumber = document.getElementById('ratingNumber');
    if (!ratingNumber) return;
    
    // Remove all rating color classes
    ratingNumber.classList.remove('rating-none', 'rating-low', 'rating-medium-low', 
                                   'rating-medium', 'rating-medium-high', 'rating-high', 'rating-excellent');
    
    if (value === 0 || isNaN(value)) {
        ratingNumber.textContent = '-';
        ratingNumber.classList.add('rating-none');
    } else {
        ratingNumber.textContent = value.toFixed(1);
        ratingNumber.classList.add(getRatingColorClass(value));
    }
}

// Search functionality with spam prevention
async function handleSearch(queryParam = null) {
    // Prevent spam clicking
    const now = Date.now();
    if (isSearching || (now - lastSearchTime) < SEARCH_COOLDOWN) {
        const remaining = SEARCH_COOLDOWN - (now - lastSearchTime);
        if (remaining > 0) {
            showNotification(`Please wait ${(remaining / 1000).toFixed(1)}s before searching again`);
            return;
        }
    }
    
    // Get query from parameter or inputs
    let query = queryParam;
    if (!query) {
        query = (searchInput && searchInput.value.trim()) || '';
        if (!query && navbarSearchInput) {
            query = navbarSearchInput.value.trim();
        }
        if (!query) {
            const mobileSearchInput = document.getElementById('mobileSearchInput');
            if (mobileSearchInput) {
                query = mobileSearchInput.value.trim();
            }
        }
    }
    
    if (!query) {
        showNotification('Please enter a search term');
        return;
    }

    // Set searching state
    isSearching = true;
    lastSearchTime = Date.now();

    // Show home page content (but don't close player if already on home)
    const homePage = document.querySelector('.home-content');
    if (homePage) homePage.style.display = 'block';
    const featuredSection = document.getElementById('featuredOpenings');
    if (featuredSection) featuredSection.style.display = 'block';

    // Disable search buttons during search
    // Search button removed, search only works via Enter key now
    if (navbarSearchBtn) {
        navbarSearchBtn.disabled = true;
        navbarSearchBtn.style.opacity = '0.6';
    }
    if (searchResults) {
        searchResults.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div></div>';
    }
    
    try {
        const results = await searchAnime(query);
        displaySearchResults(results);
    } catch (error) {
        console.error('Search error:', error);
        let errorMessage = 'Error searching. ';
        
        if (error.message.includes('CORS')) {
            errorMessage += 'CORS error detected. The API may block direct browser requests.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('status')) {
            errorMessage += `API error: ${error.message}`;
        } else {
            errorMessage += error.message || 'Please try again or check the browser console for details.';
        }
        
        if (searchResults) {
            searchResults.innerHTML = `<p style="text-align: center; color: var(--accent); padding: 2rem;">${errorMessage}</p>`;
        }
        showNotification(errorMessage);
    } finally {
        // Re-enable search buttons after cooldown
        setTimeout(() => {
            isSearching = false;
            // Search button removed
            if (navbarSearchBtn) {
                navbarSearchBtn.disabled = false;
                navbarSearchBtn.style.opacity = '1';
            }
        }, SEARCH_COOLDOWN);
    }
}

async function handleNavbarSearch(queryParam = null) {
    const query = queryParam || (navbarSearchInput ? navbarSearchInput.value.trim() : '');
    if (!query) return;
    
    // Sync search inputs
    if (navbarSearchInput) navbarSearchInput.value = query;
    if (searchInput) searchInput.value = query;
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) mobileSearchInput.value = query;
    
    await handleSearch(query);
    
    // Clear navbar search after search (optional)
    // navbarSearchInput.value = '';
}

// Helper function to process API response
// Handles both /anime/ endpoint: { anime: [...], links: {...}, meta: {...} }
// and /search/ endpoint: { search: { anime: [...], animethemes: [...], ... } }
function processResponse(data, url) {
    // Global search endpoint returns: { search: { anime: [...], ... } }
    if (data.search && data.search.anime && Array.isArray(data.search.anime)) {
        console.log('✓ Found search results (global search endpoint)');
        return data.search.anime;
    }
    
    // Anime endpoint returns: { anime: [...], links: {...}, meta: {...} }
    if (data.anime && Array.isArray(data.anime)) {
        console.log('✓ Found anime array in response');
        return data.anime;
    }
    
    // Fallback: handle other possible structures
    if (data.data && Array.isArray(data.data)) {
        console.log('✓ Found data array in response');
        return data.data;
    } else if (Array.isArray(data)) {
        console.log('✓ Response is direct array');
        return data;
    }
    
    console.warn('Unexpected response structure:', Object.keys(data));
    return [];
}

// Helper function to fetch with proxy fallback to direct API
// IMPORTANT: Mobile devices ALWAYS use proxy (never direct API) to avoid CORS
async function fetchWithFallback(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        // Mobile devices: NEVER try direct API (always causes CORS errors)
        if (isMobileDevice) {
            return response;
        }
        
        // Desktop: If proxy returns 403, try direct API as fallback
        if (response.status === 403 && API_BASE !== API_DIRECT && url.includes(API_BASE) && !isMobileDevice) {
            console.warn(`[Proxy] Received 403, trying direct API as fallback (desktop only)...`);
            const directUrl = url.replace(API_BASE, API_DIRECT);
            console.log(`[Fallback] Trying direct API:`, directUrl);
            
            try {
                const directResponse = await fetch(directUrl, options);
                if (directResponse.ok) {
                    console.log(`[Fallback] ✓ Direct API worked!`);
                    useDirectAPI = true; // Remember to use direct API for future requests
                    return directResponse;
                } else if (directResponse.status === 0 || directResponse.status >= 500) {
                    // CORS error or server error - proxy might be needed but is blocked
                    console.error(`[Fallback] Direct API failed with status ${directResponse.status} (likely CORS)`);
                }
            } catch (directError) {
                console.error(`[Fallback] Direct API error:`, directError.message);
                // If direct API fails due to CORS, we're stuck - return original 403
            }
        }
        
        return response;
    } catch (error) {
        // Mobile: Never try direct API
        if (isMobileDevice) {
            console.error(`[Mobile] Proxy request failed: ${error.message}. Cannot use direct API due to CORS.`);
            throw error;
        }
        
        // Desktop: If proxy fails and we're in production, try direct API
        if (API_BASE !== API_DIRECT && url.includes(API_BASE) && error.message.includes('Failed to fetch') && !isMobileDevice) {
            console.warn(`[Proxy] Request failed, trying direct API as fallback (desktop only)...`);
            const directUrl = url.replace(API_BASE, API_DIRECT);
            try {
                return await fetch(directUrl, options);
            } catch (directError) {
                console.error(`[Fallback] Direct API also failed:`, directError.message);
            }
        }
        throw error;
    }
}

async function searchAnime(query) {
    // Based on API documentation: 
    // 1. Use /search/ endpoint for global search (returns { search: { anime: [...], ... } })
    // 2. Use /anime/?q= for anime-specific search (returns { anime: [...], ... })
    // 3. Page size limit appears to be around 100 (422 error for 1000)
    const encodedQuery = encodeURIComponent(query);
    
    // Mobile: ALWAYS use proxy (never direct API)
    // Desktop: Use direct API only if proxy is blocked and we've confirmed direct works
    const baseUrl = (isMobileDevice || !useDirectAPI) ? API_BASE : API_DIRECT;
    
    // Primary: Use global search endpoint
    // Include animesynonyms to search English names
    const searchEndpoints = [
        // Global search endpoint (recommended for searching)
        // Note: include[type] format for search endpoint, include animesynonyms
        `${baseUrl}/search/?q=${encodedQuery}&include[anime]=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms&page[limit]=50`,
        // Try without videos include for faster search
        `${baseUrl}/search/?q=${encodedQuery}&include[anime]=animethemes.song,animethemes.song.artists,animesynonyms&page[limit]=50`,
        // Anime-specific search with q parameter, include synonyms
        `${baseUrl}/anime/?q=${encodedQuery}&include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms&page[size]=100`,
        // Filter by name (exact match)
        `${baseUrl}/anime/?filter[name]=${encodedQuery}&include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms&page[size]=100`,
    ];
    
    // First, try search endpoints
    for (const url of searchEndpoints) {
        try {
            console.log('Trying search endpoint:', url);
            const response = await fetchWithFallback(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            
            if (!response.ok) {
                if (response.status === 422) {
                    console.warn(`422 error - parameter validation failed for:`, url);
                } else if (response.status === 403) {
                    console.warn(`403 error - access forbidden for:`, url);
                    // If we get 403 and haven't tried direct API yet, continue to next endpoint
                    // The fetchWithFallback should have already tried direct API
                }
                continue;
            }
            
            const data = await response.json();
            const animeList = processResponse(data, url);
            
            if (animeList && animeList.length > 0) {
                console.log(`✓ Found ${animeList.length} results from search endpoint`);
                
                // Check if results have includes (animethemes, etc.)
                const firstAnime = animeList[0];
                const hasIncludes = firstAnime && (firstAnime.animethemes || firstAnime.animethemeentries);
                
                if (!hasIncludes && url.includes('/search/')) {
                    // Search endpoint returned anime without includes - fetch details with includes
                    console.log('Search results lack includes. Fetching anime details with includes...');
                    const animeIds = animeList.map(a => a.id).slice(0, 50); // Limit to first 50
                    const detailedAnime = await fetchAnimeWithIncludes(animeIds);
                    if (detailedAnime && detailedAnime.length > 0) {
                        const filtered = filterAnimeList(detailedAnime, query);
                        if (filtered.length > 0) {
                            console.log(`✓ ${filtered.length} results with includes`);
                            return filtered;
                        }
                    }
                } else {
                    // Check if we need to fetch synonyms separately
                    const needsSynonyms = animeList.some(a => !a.animesynonyms || a.animesynonyms.length === 0);
                    if (needsSynonyms && !url.includes('/search/')) {
                        // Try to enhance with synonyms if missing
                        console.log('Anime results missing synonyms. Enhancing with synonym data...');
                        const enhancedAnime = await enhanceAnimeWithSynonyms(animeList);
                        const filtered = filterAnimeList(enhancedAnime, query);
                        if (filtered.length > 0) {
                            console.log(`✓ ${filtered.length} results after synonym enhancement`);
                            return filtered;
                        }
                    }
                    // Results already have includes or from /anime/ endpoint
                    const filtered = filterAnimeList(animeList, query);
                    if (filtered.length > 0) {
                        console.log(`✓ ${filtered.length} results match query`);
                        return filtered;
                    }
                }
            }
        } catch (error) {
            console.warn('Error with search endpoint:', url, error.message);
            continue;
        }
    }
    
    // Fallback: Fetch anime list with pagination and filter client-side
    console.log('Search endpoints returned no results. Trying paginated fetch with client-side filtering...');
    
    // Try fetching multiple pages if needed
    let allAnime = [];
    const pageSize = 100; // Safe page size to avoid 422 errors
    
    // Mobile: use proxy; Desktop: use direct API only if confirmed working
    const paginationBaseUrl = (isMobileDevice || !useDirectAPI) ? API_BASE : API_DIRECT;
    
    for (let page = 1; page <= 5; page++) { // Try up to 5 pages (500 anime)
        try {
            const url = `${paginationBaseUrl}/anime/?include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms&page[number]=${page}&page[size]=${pageSize}`;
            console.log(`Fetching page ${page}...`);
            
            const response = await fetchWithFallback(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            
            if (!response.ok) {
                if (response.status === 422) {
                    console.warn('422 error - page size or number may be invalid');
                }
                break; // Stop if we get an error
            }
            
            const data = await response.json();
            const animeList = processResponse(data, url);
            
            if (animeList && animeList.length > 0) {
                allAnime = allAnime.concat(animeList);
                console.log(`✓ Fetched page ${page}: ${animeList.length} anime (total: ${allAnime.length})`);
                
                // Check if we've found matches in current batch
                const filtered = filterAnimeList(allAnime, query);
                if (filtered.length > 0) {
                    console.log(`✓ Found ${filtered.length} matches!`);
                    return filtered;
                }
                
                // If we have enough results and none match, probably not found
                if (allAnime.length >= 200 && filtered.length === 0) {
                    throw new Error(`No results found for "${query}". Try a different search term.`);
                }
                
                // Check if there are more pages
                if (data.meta && animeList.length < pageSize) {
                    console.log('Reached last page');
                    break;
                }
            } else {
                break; // No more results
            }
        } catch (error) {
            if (error.message.includes('No results found')) {
                throw error;
            }
            console.warn('Error fetching page:', error.message);
            break;
        }
    }
    
    // Final filter on all collected anime
    if (allAnime.length > 0) {
        const filtered = filterAnimeList(allAnime, query);
        if (filtered.length > 0) {
            console.log(`✓ Found ${filtered.length} matches after paginated search`);
            return filtered;
        }
        throw new Error(`No results found for "${query}" in ${allAnime.length} anime. Try a different search term.`);
    }
    
    // If all endpoints failed, test basic API connectivity
    console.log('All search endpoints failed. Testing basic API connectivity...');
    
    const testUrls = [
        `${paginationBaseUrl}/anime/?page[size]=5`,
    ];
    
    for (const testUrl of testUrls) {
        try {
            console.log('Testing basic connectivity:', testUrl);
            const testResponse = await fetchWithFallback(testUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });
            
            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('✓ API is reachable! Response keys:', Object.keys(testData));
                const testAnimeList = processResponse(testData, testUrl);
                
                if (testAnimeList && testAnimeList.length > 0) {
                    console.log(`✓ Successfully fetched ${testAnimeList.length} anime. API is working!`);
                    console.log('Sample anime name:', getAttributes(testAnimeList[0]).name || getAttributes(testAnimeList[0]).title);
                    
                    // If basic endpoint works, try fetching more results and filtering client-side
                    console.log('Attempting to fetch more results for client-side filtering...');
                    const largePageUrl = testUrl.replace('page[size]=5', 'page[size]=500');
                    
                    try {
                        const largeResponse = await fetchWithFallback(largePageUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                            },
                        });
                        
                        if (largeResponse.ok) {
                            const largeData = await largeResponse.json();
                            const largeAnimeList = processResponse(largeData, largePageUrl);
                            
                            if (largeAnimeList && largeAnimeList.length > 0) {
                                console.log(`Fetched ${largeAnimeList.length} results. Applying client-side filter for "${query}"...`);
                                const filtered = filterAnimeList(largeAnimeList, query);
                                
                                if (filtered.length > 0) {
                                    console.log(`✓ Found ${filtered.length} matching results!`);
                                    return filtered;
                                } else {
                                    console.warn(`No results match "${query}" in ${largeAnimeList.length} anime.`);
                                    throw new Error(`No results found for "${query}". Try a different search term.`);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to fetch large page:', e.message);
                    }
                    
                    // Fallback: filter the small test result set
                    const filtered = filterAnimeList(testAnimeList, query);
                    if (filtered.length > 0) {
                        console.log(`✓ Found ${filtered.length} matches in test results!`);
                        return filtered;
                    }
                }
                
                throw new Error(`API is reachable but no results match "${query}". The search functionality may require different parameters.`);
            } else {
                console.warn(`Test endpoint returned ${testResponse.status}:`, testUrl);
            }
        } catch (testError) {
            console.warn('Test endpoint error:', testUrl, testError.message);
            continue;
        }
    }
    
    // If we get here, the API is not reachable at all
    throw new Error('Cannot connect to the API. This might be a CORS issue, network problem, or the API structure has changed. Check the browser console for details.');
}

// Helper function to extract data from JSON:API format
function getAttributes(item) {
    if (!item) return null;
    if (item.attributes) {
        // JSON:API format - merge attributes with id/type
        return { ...item.attributes, id: item.id, type: item.type };
    }
    return item;
}

// Helper function to resolve JSON:API relationships
function resolveRelationship(ref, includedMap) {
    if (!ref || !ref.type || !ref.id) return null;
    const key = `${ref.type}_${ref.id}`;
    const resource = includedMap?.[key];
    if (resource) {
        return getAttributes(resource);
    }
    return ref;
}

// Helper to resolve array of relationships
function resolveRelationships(refs, includedMap) {
    if (!refs || !Array.isArray(refs)) return [];
    return refs.map(ref => {
        if (ref.type && ref.id) {
            return resolveRelationship(ref, includedMap);
        }
        return getAttributes(ref);
    }).filter(Boolean);
}

// Fetch anime details with includes by ID
async function fetchAnimeWithIncludes(animeIds) {
    if (!animeIds || animeIds.length === 0) return [];
    
    try {
        // Fetch anime by IDs using filter[id] - include synonyms for English name search
        const idsParam = animeIds.join(',');
        // Mobile: ALWAYS use proxy
        const baseUrl = (isMobileDevice || !useDirectAPI) ? API_BASE : API_DIRECT;
        const url = `${baseUrl}/anime/?filter[id]=${idsParam}&include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms&page[size]=${animeIds.length}`;
        
        const response = await fetchWithFallback(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.anime && Array.isArray(data.anime)) {
                return data.anime;
            }
        }
    } catch (error) {
        console.warn('Error fetching anime details:', error.message);
    }
    
    return [];
}

// Enhance anime list with synonyms if missing
async function enhanceAnimeWithSynonyms(animeList) {
    // Check if any anime is missing synonyms
    const needsSynonyms = animeList.filter(a => !a.animesynonyms || a.animesynonyms.length === 0);
    if (needsSynonyms.length === 0) return animeList;
    
    try {
        // Fetch synonyms for anime that don't have them
        const animeIds = needsSynonyms.map(a => a.id);
        const idsParam = animeIds.join(',');
        // Mobile: ALWAYS use proxy
        const baseUrl = (isMobileDevice || !useDirectAPI) ? API_BASE : API_DIRECT;
        const url = `${baseUrl}/anime/?filter[id]=${idsParam}&include=animesynonyms&page[size]=${animeIds.length}`;
        
        const response = await fetchWithFallback(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.anime && Array.isArray(data.anime)) {
                // Merge synonyms back into original anime list
                const synonymMap = new Map();
                data.anime.forEach(a => {
                    if (a.animesynonyms) {
                        synonymMap.set(a.id, a.animesynonyms);
                    }
                });
                
                return animeList.map(anime => {
                    if (synonymMap.has(anime.id)) {
                        return { ...anime, animesynonyms: synonymMap.get(anime.id) };
                    }
                    return anime;
                });
            }
        }
    } catch (error) {
        console.warn('Error enhancing with synonyms:', error.message);
    }
    
    return animeList;
}

// Client-side filtering function as fallback
// Also searches through anime synonyms (English names, etc.)
function filterAnimeList(animeList, query) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) return animeList;
    
    // Split query into words, but also keep the full query for partial matching
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    
    return animeList.filter(anime => {
        // API returns data directly
        const name = (anime.name || '').toLowerCase();
        const slug = (anime.slug || '').toLowerCase();
        
        // Get all synonyms (English names, alternate titles, etc.)
        const synonyms = (anime.animesynonyms || []).map(syn => 
            (syn.text || '').toLowerCase()
        ).filter(text => text.length > 0);
        
        // Combine all searchable text
        const searchableText = [name, slug, ...synonyms];
        const combinedText = searchableText.join(' ');
        
        // First check if the full query matches (for exact or partial matches)
        if (searchableText.some(text => text.includes(queryLower))) {
            return true;
        }
        
        // If query has multiple words, check if all words are present
        if (queryWords.length > 1) {
            return queryWords.every(word => {
                // Each word must be present in name, slug, or any synonym
                return searchableText.some(text => text.includes(word));
            });
        }
        
        // Single word query - check if it's contained anywhere
        return combinedText.includes(queryLower);
    });
}

function displaySearchResults(animeList) {
    // Store results for filtering
    currentSearchResults = [];
    allAnimeData = animeList;
    
    if (!searchResults) return;
    
    if (animeList.length === 0) {
        searchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No results found. Try a different search term.</p>';
        return;
    }

    searchResults.innerHTML = '';
    let hasResults = false;
    
    // Group openings by anime - create a map of anime to their opening themes
    const animeOpeningsMap = new Map();
    
    animeList.forEach(animeRaw => {
        // The API returns anime objects directly (not JSON:API format)
        // Each anime object has animethemes array when included
        const anime = animeRaw;
        
        // Find opening themes - they should be directly in anime.animethemes when included
        let themes = anime.animethemes || [];
        
        // Process themes - entries and videos should be nested directly
        const openingThemes = themes.filter(theme => {
            // Theme type should be directly on the theme object
            const themeType = theme.type;
            const entries = theme.animethemeentries || [];
            // Check if entries have videos
            const hasVideos = entries.some(entry => entry.videos && entry.videos.length > 0);
            return themeType === 'OP' && hasVideos;
        });

        if (openingThemes.length > 0) {
            hasResults = true;
            // Store all openings for this anime
            animeOpeningsMap.set(anime.id || anime.name, {
                anime: anime,
                themes: openingThemes
            });
            
            // Store for filtering
            currentSearchResults.push({
                anime: anime,
                themes: openingThemes
            });
        }
    });
    
    if (!hasResults) {
        searchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No opening themes found. Try searching for a different anime.</p>';
        return;
    }
    
    // Apply filters and sorting before displaying
    filterAndDisplayResults();
}

// Create a card for an anime with all its openings
function createAnimeCard(anime, themes, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // API returns data directly (not JSON:API format)
    const animeName = anime.name || 'Unknown Anime';
    
    // Get English name from synonyms if available
    const englishSynonym = anime.animesynonyms?.find(syn => 
        syn.type === 'English Short' || (syn.type === 'Other' && /^[a-zA-Z\s]+$/.test(syn.text))
    ) || anime.animesynonyms?.find(syn => syn.type === 'Other');
    
    // Sort themes by sequence
    const sortedThemes = [...themes].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    
    // Create opening buttons
    const openingButtons = sortedThemes.map((theme, idx) => {
        const themeId = getThemeId({ anime, theme });
        // Check both local and public ratings
        let rating = ratings[themeId];
        if (!rating && databaseInitialized && publicRatings[themeId]) {
            rating = publicRatings[themeId].average;
        }
        const themeSlug = theme.slug || '';
        const opNumber = theme.sequence || (idx + 1);
        
        // Only show slug if it's meaningful and different from just "OP1", "OP2", etc.
        const slugToShow = themeSlug && themeSlug.toLowerCase() !== `op${opNumber}` && themeSlug.toLowerCase() !== `op ${opNumber}` 
            ? themeSlug 
            : '';
        
        // Show rating if available with color class
        const ratingClass = rating ? getRatingColorClass(rating) : '';
        const ratingDisplay = rating ? `<span class="op-rating ${ratingClass}">${rating.toFixed(1)}/10</span>` : '';
        
        return `
            <button class="opening-btn" data-anime-id="${anime.id || ''}" data-theme-id="${themeId}">
                <span class="op-number">OP${opNumber}</span>
                ${slugToShow ? `<span class="op-slug">${slugToShow}</span>` : ''}
                ${ratingDisplay}
            </button>
        `;
    }).join('');
    
    card.innerHTML = `
        <div class="result-card-header">
            ${englishSynonym && englishSynonym.text 
                ? `<div class="result-card-title">${animeName}</div><div class="result-card-subtitle">${englishSynonym.text}</div>`
                : `<div class="result-card-title">${animeName}</div>`
            }
        </div>
        <div class="result-card-openings">
            ${openingButtons}
        </div>
    `;
    
    // Add click handlers to opening buttons
    card.querySelectorAll('.opening-btn').forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = sortedThemes[idx];
            playTheme({ anime, theme });
        });
    });
    
    return card;
}

// Video playback
// Store error handler references so we can remove them
let videoErrorHandler = null;
let videoLoadedHandler = null;

async function playTheme({ anime, theme }) {
    // API returns data directly (not JSON:API format)
    currentTheme = { anime, theme };
    
    // Remove any existing event listeners to prevent them from firing when we change src
    if (videoErrorHandler) {
        videoPlayer.removeEventListener('error', videoErrorHandler);
        videoErrorHandler = null;
    }
    if (videoLoadedHandler) {
        videoPlayer.removeEventListener('loadeddata', videoLoadedHandler);
        videoLoadedHandler = null;
    }
    
    // Navigate to player page using URL hash
    window.location.hash = '#player';
    
    // Hide home page, show player
    const homePage = document.querySelector('.home-content');
    if (homePage) homePage.style.display = 'none';
    
    // Show loading
    const overlay = document.querySelector('.video-overlay');
    overlay.classList.add('loading');
    
    playerSection.classList.remove('hidden');
    const animeName = anime.name || 'Unknown Anime';
    // Get English name from synonyms if available
    const englishSynonym = anime.animesynonyms?.find(syn => 
        syn.type === 'English Short' || (syn.type === 'Other' && /^[a-zA-Z\s]+$/.test(syn.text))
    ) || anime.animesynonyms?.find(syn => syn.type === 'Other');
    
    // Main title is the original Japanese name, subtitle is English translation
    const displayName = animeName; // Original title as main
    const subtitleName = englishSynonym && englishSynonym.text ? englishSynonym.text : '';
    
    animeTitle.textContent = displayName;
    if (subtitleName) {
        animeTitle.setAttribute('data-subtitle', subtitleName);
    } else {
        animeTitle.removeAttribute('data-subtitle');
    }
    
    const opNumber = theme.sequence || 1;
    const themeSlug = theme.slug || '';
    const slugToShow = themeSlug && themeSlug.toLowerCase() !== `op${opNumber}` && themeSlug.toLowerCase() !== `op ${opNumber}` 
        ? ` - ${themeSlug}` 
        : '';
    
    // Get song title and artist if available
    let songInfo = '';
    if (theme.song) {
        const songTitle = theme.song.title || '';
        const artists = theme.song.artists || [];
        const artistNames = artists.map(a => a.name || '').filter(Boolean).join(', ');
        
        if (songTitle) {
            songInfo = songTitle;
            if (artistNames) {
                songInfo += ` by ${artistNames}`;
            }
        }
    }
    
    // Display theme info with song if available
    if (songInfo) {
        themeInfo.innerHTML = `OP${opNumber}${slugToShow}<br><span class="song-info">${songInfo}</span>`;
    } else {
        themeInfo.textContent = `OP${opNumber}${slugToShow}`;
    }
    
    // Display anime info
    displayAnimeInfo(anime);
    
    // Find the best quality video
    const videoUrl = findBestVideo(theme);
    
    if (videoUrl) {
        // Create error handler
        videoErrorHandler = () => {
            // Only show error if we still have a theme loaded (not closing)
            if (currentTheme) {
                overlay.classList.remove('loading');
                showNotification('Error loading video. Please try another opening.');
            }
            videoErrorHandler = null;
        };
        
        // Aggressive buffering strategy to prevent stuttering
        let bufferCheckInterval = null;
        let isWaitingForBuffer = false;
        const MIN_BUFFER_AHEAD = 3; // Minimum seconds of buffer before allowing playback
        const TARGET_BUFFER_AHEAD = 5; // Target buffer to maintain during playback
        const BUFFER_CHECK_INTERVAL = 500; // Check buffer every 500ms
        
        // Wait for sufficient buffer before allowing playback
        const checkBufferBeforePlay = () => {
            if (!currentTheme) return;
            
            if (videoPlayer.buffered.length > 0 && videoPlayer.duration > 0) {
                const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
                const bufferAhead = bufferedEnd - videoPlayer.currentTime;
                
                // Wait until we have minimum buffer
                if (bufferAhead >= MIN_BUFFER_AHEAD || bufferedEnd >= videoPlayer.duration * 0.95) {
                    overlay.classList.remove('loading');
                    isWaitingForBuffer = false;
                    setupCustomControls();
                    videoPlayer.setAttribute('data-controls-setup', 'true');
                    // Auto-play if user hasn't paused
                    if (!videoPlayer.paused && videoPlayer.currentTime === 0) {
                        videoPlayer.play().catch(err => console.log('Auto-play prevented:', err));
                    }
                } else {
                    // Still buffering, show loading
                    overlay.classList.add('loading');
                    isWaitingForBuffer = true;
                    // Pause playback if it started too early
                    if (!videoPlayer.paused && bufferAhead < 1) {
                        videoPlayer.pause();
                    }
                }
            }
        };
        
        // Monitor buffer during playback to prevent stuttering
        const monitorBufferDuringPlayback = () => {
            if (!currentTheme) return;
            
            if (videoPlayer.buffered.length > 0 && videoPlayer.duration > 0) {
                const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
                const currentTime = videoPlayer.currentTime;
                const bufferAhead = bufferedEnd - currentTime;
                
                // Pause if buffer is critically low to build up buffer
                if (!videoPlayer.paused && bufferAhead < 1 && bufferedEnd < videoPlayer.duration * 0.99) {
                    videoPlayer.pause();
                    overlay.classList.add('loading');
                    isWaitingForBuffer = true;
                } 
                // Resume when buffer is sufficient
                else if (videoPlayer.paused && bufferAhead >= MIN_BUFFER_AHEAD && isWaitingForBuffer) {
                    videoPlayer.play().catch(err => console.log('Resume play error:', err));
                    overlay.classList.remove('loading');
                    isWaitingForBuffer = false;
                }
                // Hide loading when buffer is good
                else if (bufferAhead >= TARGET_BUFFER_AHEAD) {
                    overlay.classList.remove('loading');
                    isWaitingForBuffer = false;
                }
                // Show loading if buffer is getting low but not critical
                else if (bufferAhead < 2 && bufferAhead >= 1) {
                    overlay.classList.add('loading');
                }
            }
        };
        
        // Handle waiting event (video is buffering)
        const waitingHandler = () => {
            if (!currentTheme) return;
            overlay.classList.add('loading');
            isWaitingForBuffer = true;
        };
        
        // Handle playing event (video resumed)
        const playingHandler = () => {
            if (!currentTheme) return;
            // Only remove loading if we have sufficient buffer
            if (videoPlayer.buffered.length > 0 && videoPlayer.duration > 0) {
                const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
                const bufferAhead = bufferedEnd - videoPlayer.currentTime;
                if (bufferAhead >= 2) {
                    overlay.classList.remove('loading');
                    isWaitingForBuffer = false;
                }
            }
        };
        
        // Handle progress event (more data loaded)
        const progressHandler = () => {
            if (!currentTheme) return;
            // Check if we have enough buffer to start/resume playback
            if (isWaitingForBuffer) {
                checkBufferBeforePlay();
            }
        };
        
        // Handle canplaythrough (enough data to play through without stopping)
        const canPlayThroughHandler = () => {
            if (!currentTheme) return;
            overlay.classList.remove('loading');
            isWaitingForBuffer = false;
            if (!videoPlayer.getAttribute('data-controls-setup')) {
                setupCustomControls();
                videoPlayer.setAttribute('data-controls-setup', 'true');
            }
        };
        
        // Set up event listeners
        videoPlayer.addEventListener('error', videoErrorHandler, { once: true });
        videoPlayer.addEventListener('progress', progressHandler);
        videoPlayer.addEventListener('canplaythrough', canPlayThroughHandler, { once: true });
        videoPlayer.addEventListener('waiting', waitingHandler);
        videoPlayer.addEventListener('playing', playingHandler);
        videoPlayer.addEventListener('loadedmetadata', () => {
            // Start checking buffer once metadata is loaded
            checkBufferBeforePlay();
        });
        
        // Monitor buffer continuously during playback
        bufferCheckInterval = setInterval(() => {
            if (videoPlayer.readyState >= videoPlayer.HAVE_FUTURE_DATA) {
                monitorBufferDuringPlayback();
            } else {
                checkBufferBeforePlay();
            }
        }, BUFFER_CHECK_INTERVAL);
        
        // Store interval for cleanup
        videoPlayer.bufferCheckInterval = bufferCheckInterval;
        videoPlayer.progressHandler = progressHandler;
        videoPlayer.canPlayThroughHandler = canPlayThroughHandler;
        
        // Set video source with aggressive preloading
        videoPlayer.src = videoUrl;
        videoPlayer.preload = 'auto'; // Preload entire video
        // Disable seeking while buffering to prevent interruptions
        videoPlayer.currentTime = 0;
        videoPlayer.load();
        
        // Start checking buffer immediately
        isWaitingForBuffer = true;
        overlay.classList.add('loading');
        
        // Monitor seeking events to handle buffer issues
        const seekingHandler = () => {
            if (isWaitingForBuffer && videoPlayer.readyState < videoPlayer.HAVE_FUTURE_DATA) {
                // Video is seeking while we're still buffering - show loading
                overlay.classList.add('loading');
            }
        };
        videoPlayer.addEventListener('seeking', seekingHandler);
        videoPlayer.seekingHandler = seekingHandler;
        
        // Store handlers for cleanup
        videoPlayer.waitingHandler = waitingHandler;
        videoPlayer.playingHandler = playingHandler;
    } else {
        overlay.classList.remove('loading');
        showNotification('No video available for this opening.');
    }
    
    // Load current rating
    setTimeout(() => {
        loadCurrentRating();
    }, 100);
    
    // Scroll to player
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Display anime info (year, season, format, synopsis)
function displayAnimeInfo(anime) {
    if (!animeInfo || !animeSynopsis) return;
    
    // Build info items
    const infoItems = [];
    if (anime.year) {
        infoItems.push(`<div class="anime-info-item"><span class="anime-info-label">Year:</span> ${anime.year}</div>`);
    }
    if (anime.season) {
        infoItems.push(`<div class="anime-info-item"><span class="anime-info-label">Season:</span> ${anime.season}</div>`);
    }
    if (anime.media_format) {
        infoItems.push(`<div class="anime-info-item"><span class="anime-info-label">Format:</span> ${anime.media_format}</div>`);
    }
    
    animeInfo.innerHTML = infoItems.join('');
    
    // Display synopsis
    if (anime.synopsis) {
        animeSynopsis.innerHTML = `
            <div class="anime-synopsis-title">Synopsis</div>
            <div class="anime-synopsis-text">${anime.synopsis}</div>
        `;
        animeSynopsis.style.display = 'block';
    } else {
        animeSynopsis.style.display = 'none';
    }
}

function findBestVideo(theme) {
    // API returns data directly - entries and videos are nested in the theme object
    const entries = theme.animethemeentries || [];
    
    if (entries.length === 0) {
        return null;
    }
    
    // Collect all available videos with metadata
    const allVideos = [];
    
    for (const entry of entries) {
        const videos = entry.videos || [];
        videos.forEach(video => {
            const link = video.link || video.basename || '';
            if (link) {
                allVideos.push({
                    video: video,
                    entry: entry,
                    url: link.startsWith('http') ? link : `https://animethemes.moe${link}`,
                    mime: video.mime || '',
                    resolution: video.resolution || 0,
                    size: video.size || 0
                });
            }
        });
    }
    
    if (allVideos.length === 0) {
        return null;
    }
    
    // Sort videos by preference:
    // 1. WebM format (generally better compression, faster to load)
    // 2. Lower resolution/smaller size (faster buffering)
    // 3. MP4 as fallback
    allVideos.sort((a, b) => {
        const aIsWebM = a.mime.includes('webm');
        const bIsWebM = b.mime.includes('webm');
        
        // Prefer WebM
        if (aIsWebM && !bIsWebM) return -1;
        if (!aIsWebM && bIsWebM) return 1;
        
        // If both are same format, prefer smaller file size (faster buffering)
        if (a.size > 0 && b.size > 0) {
            return a.size - b.size;
        }
        
        // If sizes unknown, prefer lower resolution
        if (a.resolution > 0 && b.resolution > 0) {
            return a.resolution - b.resolution;
        }
        
        return 0;
    });
    
    // Return the best video (first in sorted array)
    return allVideos[0].url;
}

function getThemeId({ anime, theme }) {
    // API returns data directly - no need for getAttributes
    const animeName = anime.name || 'Unknown';
    const themeType = theme.type || 'OP';
    const sequence = theme.sequence || 0;
    const slug = theme.slug || '';
    return `${animeName}_${themeType}_${sequence}_${slug}`;
}

function closePlayerSection() {
    // Clear buffer monitoring interval
    if (videoPlayer.bufferCheckInterval) {
        clearInterval(videoPlayer.bufferCheckInterval);
        videoPlayer.bufferCheckInterval = null;
    }
    
    // Remove event listeners
    if (videoErrorHandler) {
        videoPlayer.removeEventListener('error', videoErrorHandler);
        videoErrorHandler = null;
    }
    if (videoLoadedHandler) {
        videoPlayer.removeEventListener('loadeddata', videoLoadedHandler);
        videoLoadedHandler = null;
    }
    if (videoPlayer.waitingHandler) {
        videoPlayer.removeEventListener('waiting', videoPlayer.waitingHandler);
        videoPlayer.waitingHandler = null;
    }
    if (videoPlayer.playingHandler) {
        videoPlayer.removeEventListener('playing', videoPlayer.playingHandler);
        videoPlayer.playingHandler = null;
    }
    if (videoPlayer.progressHandler) {
        videoPlayer.removeEventListener('progress', videoPlayer.progressHandler);
        videoPlayer.progressHandler = null;
    }
    if (videoPlayer.canPlayThroughHandler) {
        videoPlayer.removeEventListener('canplaythrough', videoPlayer.canPlayThroughHandler);
        videoPlayer.canPlayThroughHandler = null;
    }
    if (videoPlayer.seekingHandler) {
        videoPlayer.removeEventListener('seeking', videoPlayer.seekingHandler);
        videoPlayer.seekingHandler = null;
    }
    
    // Remove data attribute
    videoPlayer.removeAttribute('data-controls-setup');
    
    // Clear current theme first to prevent error handlers from showing notifications
    currentTheme = null;
    
    // Clear anime info and synopsis
    if (animeInfo) animeInfo.innerHTML = '';
    if (animeSynopsis) {
        animeSynopsis.innerHTML = '';
        animeSynopsis.style.display = 'none';
    }
    
    // Remove loading overlay
    const overlay = document.querySelector('.video-overlay');
    if (overlay) {
        overlay.classList.remove('loading');
    }
    
    // Pause and clear video
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();
    
    // Clean up custom controls
    const videoWrapper = document.querySelector('.video-wrapper');
    if (videoWrapper) {
        videoWrapper.classList.remove('controls-visible');
    }
    
    playerSection.classList.add('hidden');
    
    // Navigate back to home page
    window.location.hash = '#home';
    
    // Show home page
    const homePage = document.querySelector('.home-content');
    if (homePage) homePage.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHomePage() {
    // Close player if open
    if (currentTheme) {
        closePlayerSection();
    } else {
        // Just navigate if no player is open
        window.location.hash = '#home';
        handlePageNavigation();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Custom video player controls
let controlsInitialized = false;
let controlsTimeout = null;
let isDragging = false;

function setupCustomControls() {
    const videoWrapper = document.querySelector('.video-wrapper');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const progressBar = document.querySelector('.progress-bar');
    const progressFilled = document.getElementById('progressFilled');
    const progressHandle = document.getElementById('progressHandle');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // Update play/pause button state
    const updatePlayPauseState = () => {
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');
        if (videoPlayer.paused) {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            videoWrapper.classList.add('controls-visible');
        }
    };
    
    // Update mute button state
    const updateMuteState = () => {
        const volumeIcon = muteBtn.querySelector('.volume-icon');
        const muteIcon = muteBtn.querySelector('.mute-icon');
        const isMuted = videoPlayer.muted || videoPlayer.volume === 0;
        volumeIcon.style.display = isMuted ? 'none' : 'block';
        muteIcon.style.display = isMuted ? 'block' : 'none';
        volumeSlider.value = videoPlayer.volume;
    };
    
    // Only setup event listeners once to avoid duplicates
    if (controlsInitialized) {
        // Just update the initial state
        updatePlayPauseState();
        updateMuteState();
        return;
    }
    
    // Play/Pause
    playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (videoPlayer.paused) {
            videoPlayer.play().catch(() => {
                // Play failed
            });
        } else {
            videoPlayer.pause();
        }
    });
    
    videoPlayer.addEventListener('play', updatePlayPauseState);
    videoPlayer.addEventListener('pause', updatePlayPauseState);
    updatePlayPauseState();
    
    // Mute
    muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoPlayer.muted = !videoPlayer.muted;
    });
    
    videoPlayer.addEventListener('volumechange', updateMuteState);
    updateMuteState();
    
    // Volume slider
    volumeSlider.addEventListener('input', (e) => {
        e.stopPropagation();
        videoPlayer.volume = e.target.value;
        videoPlayer.muted = e.target.value == 0;
    });
    
    // Progress bar
    const updateProgress = () => {
        if (videoPlayer.duration && !isDragging) {
            const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
            progressFilled.style.width = percent + '%';
            progressHandle.style.left = percent + '%';
            currentTimeEl.textContent = formatTime(videoPlayer.currentTime);
            totalTimeEl.textContent = formatTime(videoPlayer.duration);
        }
    };
    
    videoPlayer.addEventListener('timeupdate', updateProgress);
    videoPlayer.addEventListener('loadedmetadata', updateProgress);
    
    // Click on progress bar to seek
    progressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isDragging) {
            const rect = progressBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            videoPlayer.currentTime = percent * videoPlayer.duration;
        }
    });
    
    // Drag progress handle
    progressBar.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        const rect = progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        videoPlayer.currentTime = percent * videoPlayer.duration;
        updateProgress();
    });
    
    const handleMouseMove = (e) => {
        if (isDragging) {
            const rect = progressBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            videoPlayer.currentTime = percent * videoPlayer.duration;
            updateProgress();
        }
    };
    
    const handleMouseUp = () => {
        isDragging = false;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Fullscreen
    fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement) {
            if (videoWrapper.requestFullscreen) {
                videoWrapper.requestFullscreen();
            } else if (videoWrapper.webkitRequestFullscreen) {
                videoWrapper.webkitRequestFullscreen();
            } else if (videoWrapper.mozRequestFullScreen) {
                videoWrapper.mozRequestFullScreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
    });
    
    // Show controls on mouse move
    const showControls = () => {
        videoWrapper.classList.add('controls-visible');
        if (controlsTimeout) {
            clearTimeout(controlsTimeout);
        }
        if (!videoPlayer.paused) {
            controlsTimeout = setTimeout(() => {
                videoWrapper.classList.remove('controls-visible');
            }, 3000);
        }
    };
    
    videoWrapper.addEventListener('mousemove', showControls);
    videoWrapper.addEventListener('mouseenter', showControls);
    
    // Click video to play/pause (but not when clicking controls)
    videoWrapper.addEventListener('click', (e) => {
        // Only trigger if clicking on video wrapper, not on controls
        if (!e.target.closest('.custom-controls') && !e.target.closest('.control-btn') && !e.target.closest('.progress-bar')) {
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        }
    });
    
    controlsInitialized = true;
}

function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Rating system (0-10 scale)
// Track rating changes to prevent spam
let lastRatingChange = {};
const RATING_COOLDOWN = 500; // 500ms cooldown between rating changes for the same theme

// Generate a unique user ID (uses authenticated username if logged in)
function getUserId() {
    // If authenticated, use username
    if (currentUser) {
        return currentUser;
    }
    // Fallback to localStorage generated ID
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// Initialize database (check if server is running)
async function initializeDatabase() {
    try {
        const response = await fetch(`${API_BASE_URL}/ratings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            databaseInitialized = true;
            console.log('✅ Connected to local database server');
            return true;
        } else {
            console.warn('⚠️ Database server not responding. Ratings will be stored locally only.');
            return false;
        }
    } catch (error) {
        console.warn('⚠️ Database server not running. Make sure to run: npm install && npm start');
        console.warn('   Ratings will be stored locally only until the server is started.');
        return false;
    }
}

// Save rating to database (requires authentication)
async function saveRatingToDatabase(themeId, rating, metadata) {
    if (!databaseInitialized) {
        return false;
    }
    
    // Require authentication to save ratings
    if (!currentUser) {
        showNotification('Please login to save ratings');
        return false;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/ratings`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                themeId: themeId,
                rating: rating,
                metadata: metadata
            })
        });
        
        if (response.ok) {
            return true;
        } else if (response.status === 401) {
            // Don't immediately log out - check authentication first
            console.warn('Rating save returned 401, checking authentication...');
            try {
                const authCheck = await fetch(`${API_BASE_URL}/me`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (authCheck.ok) {
                    // Still authenticated, might be a different issue
                    const authData = await authCheck.json();
                    currentUser = authData.username;
                    updateAuthUI();
                    showNotification('Failed to save rating. Please try again.');
                    return false;
                } else {
                    // Actually logged out
                    showNotification('Session expired. Please login again to save ratings');
                    currentUser = null;
                    updateAuthUI();
                    return false;
                }
            } catch (authError) {
                // Auth check failed, assume we're still logged in but there was an error
                console.error('Error checking authentication:', authError);
                showNotification('Failed to save rating. Please try again.');
                return false;
            }
        } else {
            throw new Error('Failed to save rating');
        }
    } catch (error) {
        console.error('Error saving rating to database:', error);
        return false;
    }
}

// Load current user's personal ratings from database
async function loadUserRatings() {
    if (!databaseInitialized || !currentUser) {
        return;
    }
    
    try {
        console.log('🔄 Loading user ratings from database...');
        const response = await fetch(`${API_BASE_URL}/my-ratings`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('⚠️ Not authenticated, cannot load user ratings');
                return;
            }
            throw new Error(`Failed to fetch user ratings: ${response.status}`);
        }
        
        const data = await response.json();
        const userRatings = data.ratings || {};
        
        // Merge user ratings into local ratings object
        Object.keys(userRatings).forEach(themeId => {
            ratings[themeId] = userRatings[themeId].rating;
            
            // Also update metadata if available
            if (userRatings[themeId].animeName) {
                if (!themeMetadata[themeId]) {
                    themeMetadata[themeId] = {};
                }
                themeMetadata[themeId].animeName = userRatings[themeId].animeName;
                themeMetadata[themeId].animeSlug = userRatings[themeId].animeSlug;
                themeMetadata[themeId].themeSequence = userRatings[themeId].themeSequence;
            }
        });
        
        // Save merged ratings to localStorage as backup
        localStorage.setItem('kaimaku', JSON.stringify(ratings));
        localStorage.setItem('themeMetadata', JSON.stringify(themeMetadata));
        
        console.log(`✅ Loaded ${Object.keys(userRatings).length} user ratings from database`);
        
        // Update UI to reflect loaded ratings
        if (currentTheme) {
            loadCurrentRating();
        }
        loadLeaderboard();
    } catch (error) {
        console.error('❌ Error loading user ratings:', error);
    }
}

// Load public ratings from database
async function loadPublicRatings() {
    if (!databaseInitialized) {
        console.warn('⚠️ Database not initialized, cannot load public ratings');
        return;
    }
    
    try {
        console.log('🔄 Loading public ratings from database...');
        const response = await fetch(`${API_BASE_URL}/ratings`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ratings: ${response.status}`);
        }
        
        const data = await response.json();
        publicRatings = data.themeRatings || {};
        
        console.log(`✅ Loaded ${Object.keys(publicRatings).length} public ratings`);
        
        // Update leaderboard with public ratings
        loadLeaderboard();
        // Reload featured openings to show updated ratings
        loadFeaturedOpenings();
    } catch (error) {
        console.error('❌ Error loading public ratings:', error);
    }
}

function handleRating(rating) {
    if (!currentTheme) return;
    
    // Check if user is authenticated
    if (!currentUser) {
        showNotification('Please login or register to rate openings');
        // Open auth modal
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.classList.remove('hidden');
            switchAuthTab('login');
        }
        return;
    }
    
    const themeId = getThemeId(currentTheme);
    const now = Date.now();
    const lastChange = lastRatingChange[themeId] || 0;
    
    // Prevent rapid rating changes (spam prevention)
    if (now - lastChange < RATING_COOLDOWN) {
        return; // Ignore rapid changes
    }
    
    const wasNewRating = !ratings[themeId];
    const oldRating = ratings[themeId];
    const newRating = parseFloat(rating);
    
    // Only save if rating actually changed
    if (oldRating === newRating) {
        return; // No change, don't do anything
    }
    
    ratings[themeId] = newRating;
    lastRatingChange[themeId] = now;
    localStorage.setItem('kaimaku', JSON.stringify(ratings));
    
    // Store metadata for quick theme retrieval
    const { anime, theme } = currentTheme;
    const metadata = {
        animeSlug: anime.slug || anime.id || null,
        animeId: anime.id || null,
        themeSequence: theme.sequence || null,
        themeSlug: theme.slug || null,
        animeName: anime.name || null,
        lastUpdated: now // Track when rating was last updated
    };
    themeMetadata[themeId] = metadata;
    localStorage.setItem('themeMetadata', JSON.stringify(themeMetadata));
    
    // Save to database (public)
    saveRatingToDatabase(themeId, newRating, metadata).then(success => {
        if (success) {
            console.log('✅ Rating saved to database');
            // Reload public ratings after a short delay to update leaderboard
            setTimeout(() => {
                loadPublicRatings();
            }, 500);
        } else {
            console.warn('⚠️ Failed to save rating to database');
        }
    }).catch(error => {
        console.error('❌ Error saving rating to database:', error);
    });
    
    const ratingSlider = document.getElementById('ratingSlider');
    
    if (ratingSlider) {
        ratingSlider.value = rating;
        updateRatingDisplay(rating);
        updateQuickButtons(rating);
    }
    
    // Show appropriate notification
    if (wasNewRating) {
        showNotification(`Rated ${newRating.toFixed(1)}/10!`);
    } else {
        showNotification(`Updated rating to ${newRating.toFixed(1)}/10`);
    }
    
    loadLeaderboard();
    
    // Update search results if visible
    updateSearchResultsRatings();
}

function updateQuickButtons(currentRating) {
    const quickBtns = document.querySelectorAll('.quick-rating-btn');
    quickBtns.forEach(btn => {
        const btnRating = parseFloat(btn.dataset.rating);
        if (Math.abs(currentRating - btnRating) < 0.1) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function loadCurrentRating() {
    if (!currentTheme) return;
    
    const themeId = getThemeId(currentTheme);
    const currentRating = ratings[themeId];
    const ratingSlider = document.getElementById('ratingSlider');
    
    if (ratingSlider) {
        if (currentRating) {
            ratingSlider.value = currentRating;
            updateRatingDisplay(currentRating);
            updateQuickButtons(currentRating);
        } else {
            ratingSlider.value = 0;
            updateRatingDisplay(0);
            updateQuickButtons(0);
        }
    }
}

// Leaderboard - Top Rated Openings (Public ratings from database)
function loadLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList) return;
    
    // Reload metadata from localStorage
    themeMetadata = JSON.parse(localStorage.getItem('themeMetadata') || '{}');
    
    // Use public ratings if available, otherwise fall back to local ratings
    let ratingsToUse = {};
    
    if (databaseInitialized && Object.keys(publicRatings).length > 0) {
        // Use public ratings (aggregated averages)
        ratingsToUse = Object.fromEntries(
            Object.entries(publicRatings).map(([themeId, data]) => [themeId, data.average])
        );
    } else {
        // Fall back to local ratings
        ratingsToUse = ratings;
    }
    
    const allRatings = Object.entries(ratingsToUse)
        .filter(([_, rating]) => rating > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (allRatings.length === 0) {
        leaderboardList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No ratings yet. Search and rate some openings!</p>';
        return;
    }
    
    // Clear previous content
    leaderboardList.innerHTML = '';
    
    // Create list
    allRatings.forEach(([themeId, rating], index) => {
        const metadata = themeMetadata[themeId] || {};
        const publicData = publicRatings[themeId] || {};
        const animeName = publicData.animeName || metadata.animeName || themeId.split('_')[0] || 'Unknown';
        const themeSequence = metadata.themeSequence || 1;
        const themeSlug = metadata.themeSlug || `OP${themeSequence}`;
        const ratingCount = publicData.count || null;
        
        // Get color class based on rating value
        const ratingClass = getRatingColorClass(rating);
        
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${animeName}</div>
                <div class="leaderboard-theme">${themeSlug}${ratingCount ? ` • ${ratingCount} ratings` : ''}</div>
            </div>
            <div class="leaderboard-score">
                <span class="leaderboard-rating ${ratingClass}">${rating.toFixed(1)}</span>
                <span class="leaderboard-out-of">/10</span>
            </div>
        `;
        
        item.addEventListener('click', async () => {
            await playThemeFromLeaderboard(themeId, metadata);
        });
        
        leaderboardList.appendChild(item);
    });
}

// Play theme directly from leaderboard
async function playThemeFromLeaderboard(themeId, metadata) {
    if (!metadata || (!metadata.animeSlug && !metadata.animeId && !metadata.animeName)) {
        // Fallback to search if no metadata
        const animeName = metadata.animeName || themeId.split('_')[0];
        if (searchInput) {
            searchInput.value = animeName;
            handleSearch();
        }
        return;
    }
    
    try {
        // Show loading notification
        showNotification('Loading opening...');
        
        // Try to fetch anime by slug or ID
        let animeUrl = '';
        if (metadata.animeSlug) {
            animeUrl = `${API_BASE}/anime/${metadata.animeSlug}?include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms`;
        } else if (metadata.animeId) {
            animeUrl = `${API_BASE}/anime/${metadata.animeId}?include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms`;
        } else {
            // Fallback to search
            throw new Error('No slug or ID available');
        }
        
        const response = await fetch(animeUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }
        
        const data = await response.json();
        const processed = processResponse(data);
        const anime = processed && processed.length > 0 ? processed[0] : (data.anime && !Array.isArray(data.anime) ? data.anime : null);
        
        if (!anime || !anime.animethemes) {
            throw new Error('Anime data not found');
        }
        
        // Find the matching theme by sequence
        const themes = anime.animethemes || [];
        const openingThemes = themes.filter(t => t.type === 'OP');
        let theme = null;
        
        if (metadata.themeSequence !== null && metadata.themeSequence !== undefined) {
            theme = openingThemes.find(t => t.sequence === metadata.themeSequence);
        } else if (metadata.themeSlug) {
            theme = openingThemes.find(t => t.slug === metadata.themeSlug);
        }
        
        // Fallback to first opening if exact match not found
        if (!theme && openingThemes.length > 0) {
            theme = openingThemes[0];
        }
        
        if (theme) {
            // Check if theme has videos
            const entries = theme.animethemeentries || [];
            const hasVideos = entries.some(entry => entry.videos && entry.videos.length > 0);
            
            if (hasVideos) {
                playTheme({ anime, theme });
            } else {
                showNotification('No video available for this opening.');
            }
        } else {
            throw new Error('Theme not found');
        }
    } catch (error) {
        console.error('Error loading theme from leaderboard:', error);
        // Fallback to search
        const animeName = metadata.animeName || themeId.split('_')[0];
        if (searchInput) {
            searchInput.value = animeName;
            handleSearch();
        }
        showNotification('Opening theme data not found. Searching instead...');
    }
}

// Featured openings - current season
async function loadFeaturedOpenings() {
    const featuredList = document.getElementById('featuredList');
    if (!featuredList) return;
    
    featuredList.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div></div>';
    
    try {
        // Get current year and season
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11
        let season = 'Winter';
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Fall';
        
        console.log(`Loading featured openings for ${season} ${year}...`);
        
        // Mobile: ALWAYS use proxy
        const baseUrl = (isMobileDevice || !useDirectAPI) ? API_BASE : API_DIRECT;
        
        // Try using the animeyear endpoint first (returns grouped by season)
        // Include images for preview backgrounds
        let url = `${baseUrl}/animeyear/${year}?include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms,images`;
        
        // Add timeout for mobile networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        let response = await fetchWithFallback(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        let processedAnime = [];
        
        if (response.ok) {
            const data = await response.json();
            // Get the current season's anime from the grouped response
            const seasonKey = season.toLowerCase();
            const rawAnimeList = data[seasonKey] || [];
            
            // animeyear endpoint returns season arrays directly
            if (Array.isArray(rawAnimeList)) {
                processedAnime = rawAnimeList;
            } else {
                processedAnime = [];
            }
        } else {
            // Fallback to filter-based endpoint
            url = `${baseUrl}/anime/?filter[year]=${year}&filter[season]=${season}&include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms,images&page[size]=50&sort=name`;
            
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 15000);
            
            response = await fetchWithFallback(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller2.signal
            });
            
            clearTimeout(timeoutId2);
            
            if (response.ok) {
                const data = await response.json();
                processedAnime = processResponse(data) || [];
            } else {
                throw new Error(`Failed to fetch featured: ${response.status}`);
            }
        }
        
        if (processedAnime.length === 0) {
            featuredList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No current season anime found. Check back later!</p>';
            return;
        }
        
        // Filter for openings and collect items
        featuredList.innerHTML = '';
        let displayed = 0;
        const maxDisplay = 20;
        const featuredItems = [];
        
        // Process and collect featured openings
        for (const anime of processedAnime) {
            if (displayed >= maxDisplay) break;
            
            // Fetch full anime data with includes if we only have basic info
            let fullAnime = anime;
            if (!anime.animethemes || (anime.animethemes && anime.animethemes.length === 0) || !anime.images) {
                try {
                    const animeResponse = await fetch(`${API_BASE}/anime/${anime.id || anime.slug}?include=animethemes.animethemeentries.videos,animethemes.song,animethemes.song.artists,animesynonyms,images`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                    });
                    if (animeResponse.ok) {
                        const animeData = await animeResponse.json();
                        const processed = processResponse(animeData);
                        // Single anime endpoint might return { anime: {...} } directly
                        if (processed && processed.length > 0) {
                            fullAnime = processed[0];
                        } else if (animeData.anime && !Array.isArray(animeData.anime)) {
                            fullAnime = animeData.anime;
                        } else {
                            fullAnime = anime;
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch full data for anime ${anime.id || anime.slug}:`, e);
                }
            }
            
            const themes = fullAnime.animethemes || [];
            const openingThemes = themes.filter(theme => {
                const themeType = theme.type;
                const entries = theme.animethemeentries || [];
                const hasVideos = entries.some(entry => entry.videos && entry.videos.length > 0);
                return themeType === 'OP' && hasVideos;
            });
            
            if (openingThemes.length > 0) {
                const firstOpening = openingThemes[0];
                featuredItems.push({
                    anime: fullAnime,
                    theme: firstOpening
                });
                displayed++;
            }
        }
        
        if (displayed === 0) {
            featuredList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No openings available for current season. Check back soon!</p>';
            return;
        }
        
        // Create carousel with featured items
        createFeaturedCarousel(featuredItems, featuredList);
    } catch (error) {
        console.error('Error loading featured openings:', error);
        
        // More specific error messages
        let errorMessage = 'Unable to load featured openings. ';
        if (error.name === 'AbortError') {
            errorMessage += 'Request timed out. Please check your connection and try again.';
        } else if (error.message && error.message.includes('Failed to fetch')) {
            errorMessage += 'Network error. Please check your connection.';
        } else {
            errorMessage += 'Please try again later.';
        }
        
        featuredList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">${errorMessage}</p>`;
        
        // Retry after a delay on mobile
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                console.log('Retrying featured openings load...');
                loadFeaturedOpenings();
            }, 5000);
        }
    }
}

// Create featured carousel wheel
function createFeaturedCarousel(items, container) {
    if (items.length === 0) return;
    
    let currentIndex = 0;
    let isTransitioning = false;
    
    container.innerHTML = `
        <div class="featured-carousel-wrapper">
            <button class="carousel-nav-btn carousel-prev" id="carouselPrev">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <div class="featured-carousel" id="featuredCarousel"></div>
            <button class="carousel-nav-btn carousel-next" id="carouselNext">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>
        <div class="carousel-dots" id="carouselDots"></div>
    `;
    
    const carousel = document.getElementById('featuredCarousel');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    const dotsContainer = document.getElementById('carouselDots');
    
    if (!prevBtn || !nextBtn || !carousel || !dotsContainer) {
        console.error('Carousel elements not found');
        return;
    }
    
    // Create dots
    items.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
            if (!isTransitioning) goToSlide(index);
        });
        dotsContainer.appendChild(dot);
    });
    
    function getAnimeImage(anime) {
        // Get the first available image (prefer Large Cover, then Small Cover)
        const images = anime.images || [];
        
        // Handle both direct image objects and JSON:API references
        const imageArray = Array.isArray(images) ? images : [];
        
        const largeCover = imageArray.find(img => {
            const facet = img.facet || img.attributes?.facet;
            return facet === 'Large Cover';
        });
        
        const smallCover = imageArray.find(img => {
            const facet = img.facet || img.attributes?.facet;
            return facet === 'Small Cover';
        });
        
        const firstImage = largeCover || smallCover || imageArray[0];
        
        if (firstImage) {
            const link = firstImage.link || firstImage.attributes?.link || firstImage.path;
            if (link) {
                return link.startsWith('http') ? link : `https://animethemes.moe${link}`;
            }
        }
        return null;
    }
    
    // Store current card elements for smooth transitions
    let currentCards = {
        prev: null,
        center: null,
        next: null
    };
    
    function updateCarousel() {
        // Get indices for previous, current, and next
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        const nextIndex = (currentIndex + 1) % items.length;
        
        // If cards exist, animate them to new positions
        if (currentCards.center) {
            // Animate existing cards to new positions
            const existingCards = carousel.querySelectorAll('.featured-card');
            
            if (existingCards.length === 3) {
                // Map existing cards to new positions
                // Current center becomes prev
                // Current next becomes center  
                // New card becomes next
                const cardArray = Array.from(existingCards);
                const centerCard = cardArray.find(card => card.classList.contains('featured-card-center'));
                const nextCard = cardArray.find(card => card.classList.contains('featured-card-next'));
                const prevCard = cardArray.find(card => card.classList.contains('featured-card-prev'));
                
                if (centerCard) {
                    centerCard.classList.remove('featured-card-center');
                    centerCard.classList.add('featured-card-prev');
                    centerCard.style.pointerEvents = 'none';
                    centerCard.style.cursor = 'default';
                }
                
                if (nextCard) {
                    nextCard.classList.remove('featured-card-next');
                    nextCard.classList.add('featured-card-center');
                    nextCard.style.pointerEvents = 'all';
                    nextCard.style.cursor = 'pointer';
                }
                
                if (prevCard) {
                    // Remove the old prev card and create new next card
                    prevCard.remove();
                }
                
                // Create new next card
                const newNextItem = items[nextIndex];
                const newNextCard = createFeaturedCard(newNextItem.anime, newNextItem.theme, 'next', getAnimeImage(newNextItem.anime));
                newNextCard.style.pointerEvents = 'none';
                newNextCard.style.cursor = 'default';
                carousel.appendChild(newNextCard);
            }
        } else {
            // Initial load - create all cards
            carousel.innerHTML = '';
            
            const indices = [prevIndex, currentIndex, nextIndex];
            const positions = ['prev', 'center', 'next'];
            
            indices.forEach((index, i) => {
                const item = items[index];
                const position = positions[i];
                const card = createFeaturedCard(item.anime, item.theme, position, getAnimeImage(item.anime));
                
                if (position !== 'center') {
                    card.style.pointerEvents = 'none';
                    card.style.cursor = 'default';
                } else {
                    card.style.pointerEvents = 'all';
                    card.style.cursor = 'pointer';
                }
                
                carousel.appendChild(card);
                
                // Store references
                if (position === 'prev') currentCards.prev = card;
                if (position === 'center') currentCards.center = card;
                if (position === 'next') currentCards.next = card;
            });
        }
        
        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
    }
    
    function goToSlide(index) {
        if (isTransitioning || index === currentIndex) return;
        
        // Calculate direction
        const diff = (index - currentIndex + items.length) % items.length;
        const isForward = diff <= items.length / 2;
        
        // Navigate slide by slide with animation
        const navigate = () => {
            if (currentIndex === index) {
                isTransitioning = false;
                return;
            }
            
            if (isForward) {
                nextSlide();
            } else {
                prevSlide();
            }
            
            // Continue navigating if not at target
            setTimeout(() => {
                if (currentIndex !== index && !isTransitioning) {
                    isTransitioning = true;
                    navigate();
                } else {
                    isTransitioning = false;
                }
            }, 1050);
        };
        
        isTransitioning = true;
        navigate();
    }
    
    function nextSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        
        // Get indices
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        const nextIndex = (currentIndex + 1) % items.length;
        const newNextIndex = (nextIndex + 1) % items.length;
        
        // Animate existing cards - rotate forward
        const existingCards = carousel.querySelectorAll('.featured-card');
        
        if (existingCards.length === 3) {
            const cardArray = Array.from(existingCards);
            const centerCard = cardArray.find(card => card.classList.contains('featured-card-center'));
            const prevCard = cardArray.find(card => card.classList.contains('featured-card-prev'));
            const nextCard = cardArray.find(card => card.classList.contains('featured-card-next'));
            
            // Center card rotates to prev position
            if (centerCard) {
                centerCard.classList.remove('featured-card-center');
                centerCard.classList.add('featured-card-prev');
                centerCard.style.pointerEvents = 'none';
                centerCard.style.cursor = 'default';
            }
            
            // Next card rotates to center position
            if (nextCard) {
                nextCard.classList.remove('featured-card-next');
                nextCard.classList.add('featured-card-center');
                nextCard.style.pointerEvents = 'all';
                nextCard.style.cursor = 'pointer';
                // Ensure click handler is attached
                if (!nextCard.hasAttribute('data-click-handler')) {
                    const nextItem = items[nextIndex];
                    nextCard.addEventListener('click', () => {
                        playTheme({ anime: nextItem.anime, theme: nextItem.theme });
                    });
                    nextCard.setAttribute('data-click-handler', 'true');
                }
            }
            
            // Remove old prev card
            if (prevCard) {
                prevCard.remove();
            }
            
            // Create new next card
            const newNextItem = items[newNextIndex];
            const newNextCard = createFeaturedCard(newNextItem.anime, newNextItem.theme, 'next', getAnimeImage(newNextItem.anime));
            newNextCard.style.pointerEvents = 'none';
            newNextCard.style.cursor = 'default';
            carousel.appendChild(newNextCard);
        } else {
            // Fallback if cards don't exist
            currentIndex = (currentIndex + 1) % items.length;
            updateCarousel();
        }
        
        // Update index
        currentIndex = nextIndex;
        
        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
        
        setTimeout(() => {
            isTransitioning = false;
        }, 1000);
    }
    
    function prevSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        
        // Get indices
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        const nextIndex = (currentIndex + 1) % items.length;
        const newPrevIndex = (prevIndex - 1 + items.length) % items.length;
        
        // Animate existing cards
        const existingCards = carousel.querySelectorAll('.featured-card');
        
        if (existingCards.length === 3) {
            const cardArray = Array.from(existingCards);
            const centerCard = cardArray.find(card => card.classList.contains('featured-card-center'));
            const prevCard = cardArray.find(card => card.classList.contains('featured-card-prev'));
            const nextCard = cardArray.find(card => card.classList.contains('featured-card-next'));
            
            if (centerCard) {
                centerCard.classList.remove('featured-card-center');
                centerCard.classList.add('featured-card-next');
                centerCard.style.pointerEvents = 'none';
                centerCard.style.cursor = 'default';
            }
            
            if (prevCard) {
                prevCard.classList.remove('featured-card-prev');
                prevCard.classList.add('featured-card-center');
                prevCard.style.pointerEvents = 'all';
                prevCard.style.cursor = 'pointer';
                // Ensure click handler is attached
                if (!prevCard.hasAttribute('data-click-handler')) {
                    const prevItem = items[prevIndex];
                    prevCard.addEventListener('click', () => {
                        playTheme({ anime: prevItem.anime, theme: prevItem.theme });
                    });
                    prevCard.setAttribute('data-click-handler', 'true');
                }
            }
            
            if (nextCard) {
                nextCard.remove();
            }
            
            // Create new prev card
            const newPrevItem = items[newPrevIndex];
            const newPrevCard = createFeaturedCard(newPrevItem.anime, newPrevItem.theme, 'prev', getAnimeImage(newPrevItem.anime));
            newPrevCard.style.pointerEvents = 'none';
            newPrevCard.style.cursor = 'default';
            carousel.insertBefore(newPrevCard, carousel.firstChild);
        }
        
        // Update index
        currentIndex = prevIndex;
        
        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
        
        setTimeout(() => {
            isTransitioning = false;
        }, 1000);
    }
    
    // Autoscroll functionality
    let autoscrollInterval = null;
    const AUTOSCROLL_DELAY = 5000; // 5 seconds
    
    function startAutoscroll() {
        // Clear any existing interval
        if (autoscrollInterval) {
            clearInterval(autoscrollInterval);
        }
        
        // Start autoscroll
        autoscrollInterval = setInterval(() => {
            if (!isTransitioning && items.length > 1) {
                nextSlide();
            }
        }, AUTOSCROLL_DELAY);
    }
    
    function stopAutoscroll() {
        if (autoscrollInterval) {
            clearInterval(autoscrollInterval);
            autoscrollInterval = null;
        }
    }
    
    // Pause autoscroll on hover/interaction, resume when not hovering
    const carouselWrapper = container.querySelector('.featured-carousel-wrapper');
    if (carouselWrapper) {
        carouselWrapper.addEventListener('mouseenter', stopAutoscroll);
        carouselWrapper.addEventListener('mouseleave', startAutoscroll);
        
        // Pause when user interacts with navigation
        prevBtn.addEventListener('click', () => {
            stopAutoscroll();
            setTimeout(startAutoscroll, AUTOSCROLL_DELAY);
        });
        nextBtn.addEventListener('click', () => {
            stopAutoscroll();
            setTimeout(startAutoscroll, AUTOSCROLL_DELAY);
        });
    }
    
    // Start autoscroll
    startAutoscroll();
    
    // Set up navigation button handlers
    prevBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        prevSlide();
    };
    
    nextBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        nextSlide();
    };
    
    // Touch support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50; // Minimum distance for swipe
    
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoscroll();
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const swipeDistance = touchStartX - touchEndX;
        
        if (Math.abs(swipeDistance) > minSwipeDistance && !isTransitioning) {
            if (swipeDistance > 0) {
                // Swipe left - go to next
                nextSlide();
            } else {
                // Swipe right - go to previous
                prevSlide();
            }
            setTimeout(startAutoscroll, AUTOSCROLL_DELAY);
        } else {
            startAutoscroll();
        }
    }, { passive: true });
    
    // Keyboard navigation (only when carousel is visible)
    const handleKeydown = (e) => {
        const carouselWrapper = container.querySelector('.featured-carousel-wrapper');
        if (carouselWrapper && carouselWrapper.offsetParent !== null) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevSlide();
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextSlide();
            }
        }
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    updateCarousel();
}

function createFeaturedCard(anime, theme, position = 'center', imageUrl = null) {
    const card = document.createElement('div');
    card.className = `featured-card featured-card-${position}`;
    
    const animeName = anime.name || 'Unknown Anime';
    const englishSynonym = anime.animesynonyms?.find(syn => 
        syn.type === 'English Short' || (syn.type === 'Other' && /^[a-zA-Z\s]+$/.test(syn.text))
    ) || anime.animesynonyms?.find(syn => syn.type === 'Other');
    
    const themeId = getThemeId({ anime, theme });
    // Check both local and public ratings
    let rating = ratings[themeId];
    if (!rating && databaseInitialized && publicRatings[themeId]) {
        rating = publicRatings[themeId].average;
    }
    const ratingClass = rating ? getRatingColorClass(rating) : '';
    
    // Build anime info string
    const infoParts = [];
    if (anime.year) infoParts.push(anime.year);
    if (anime.season) infoParts.push(anime.season);
    const infoString = infoParts.length > 0 ? infoParts.join(' • ') : '';
    
    // Create background with Gaussian blur if image available (minimal blur for better visibility)
    const backgroundStyle = imageUrl 
        ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center; filter: blur(4px) brightness(0.5);`
        : '';
    
    card.innerHTML = `
        ${imageUrl ? `<div class="featured-card-bg" style="${backgroundStyle}"></div>` : ''}
        <div class="featured-card-content">
            <div class="featured-card-header">
                ${englishSynonym && englishSynonym.text 
                    ? `<div class="featured-card-title">${animeName}</div><div class="featured-card-subtitle">${englishSynonym.text}</div>`
                    : `<div class="featured-card-title">${animeName}</div>`
                }
                ${infoString ? `<div class="featured-card-info">${infoString}</div>` : ''}
            </div>
            <div class="featured-card-footer">
                <span class="featured-op-label">OP${theme.sequence || 1}</span>
                ${rating ? `<span class="featured-rating ${ratingClass}">${rating.toFixed(1)}/10</span>` : ''}
            </div>
        </div>
    `;
    
    // Center card plays the video, side cards will have navigation handlers added in carousel
    if (position === 'center') {
        card.addEventListener('click', () => {
            playTheme({ anime, theme });
        });
        card.setAttribute('data-click-handler', 'true');
    }
    
    return card;
}

function updateSearchResultsRatings() {
    const cards = searchResults.querySelectorAll('.result-card');
    cards.forEach(card => {
        // This would need to be enhanced to match cards with current ratings
        // For now, we'll just reload if needed
    });
}

// Notifications
function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Smooth scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe result cards for animations
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.result-card');
    cards.forEach(card => {
        observer.observe(card);
    });
});

// Authentication Functions
async function checkAuthentication() {
    try {
        const response = await fetch(`${API_BASE_URL}/me`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            currentUser = data.username;
            updateAuthUI();
            
            // Load user's ratings after authentication
            if (databaseInitialized) {
                loadUserRatings();
            }
        } else {
            currentUser = null;
            updateAuthUI();
        }
    } catch (error) {
        currentUser = null;
        updateAuthUI();
    }
}

function updateAuthUI() {
    const userDisplay = document.getElementById('userDisplay');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (currentUser) {
        if (userDisplay) {
            userDisplay.textContent = `Hello, ${currentUser}`;
            userDisplay.style.display = 'inline';
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
        if (userDisplay) userDisplay.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'block';
        if (registerBtn) registerBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function setupAuthEventListeners() {
    const authModal = document.getElementById('authModal');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const submitLogin = document.getElementById('submitLogin');
    const submitRegister = document.getElementById('submitRegister');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginBtn) loginBtn.addEventListener('click', () => {
        if (authModal) {
            authModal.classList.remove('hidden');
            switchAuthTab('login');
        }
    });
    
    if (registerBtn) registerBtn.addEventListener('click', () => {
        if (authModal) {
            authModal.classList.remove('hidden');
            switchAuthTab('register');
        }
    });
    
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            currentUser = null;
            updateAuthUI();
            showNotification('Logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    if (closeAuthModal) closeAuthModal.addEventListener('click', () => {
        if (authModal) authModal.classList.add('hidden');
    });
    
    if (authModal) authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchAuthTab(tabName);
        });
    });
    
    if (submitLogin) submitLogin.addEventListener('click', handleLogin);
    if (submitRegister) submitRegister.addEventListener('click', handleRegister);
    
    // CAPTCHA refresh button
    const refreshCaptcha = document.getElementById('refreshCaptcha');
    if (refreshCaptcha) {
        refreshCaptcha.addEventListener('click', () => {
            generateCaptcha();
        });
    }
    
    // Initialize CAPTCHA when page loads
    generateCaptcha();
    
    // Enter key support
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const registerUsername = document.getElementById('registerUsername');
    const registerPassword = document.getElementById('registerPassword');
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    
    if (loginPassword) loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    if (registerConfirmPassword) registerConfirmPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

function switchAuthTab(tabName) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    
    authTabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    if (tabName === 'login') {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (loginError) loginError.textContent = '';
    } else {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (registerError) registerError.textContent = '';
        // Generate new CAPTCHA when switching to register tab
        generateCaptcha();
    }
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');
    
    if (!username || !password) {
        if (errorMsg) errorMsg.textContent = 'Please enter username and password';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.username;
            updateAuthUI();
            document.getElementById('authModal').classList.add('hidden');
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            showNotification(`Welcome back, ${username}!`);
        } else {
            if (errorMsg) errorMsg.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        if (errorMsg) errorMsg.textContent = 'Failed to connect to server';
    }
}

// CAPTCHA state
let captchaAnswer = null;
let captchaId = null;

// Seeded random function
function seededRandom(seed) {
    return ((seed * 9301 + 49297) % 233280) / 233280;
}

function generateCaptcha() {
    // Use timestamp as seed for deterministic generation
    captchaId = Date.now().toString();
    
    // Use different parts of timestamp for different random values
    const seed = parseInt(captchaId.slice(-8)) || 12345678;
    let currentSeed = seed;
    
    const random1 = seededRandom(currentSeed);
    currentSeed = Math.floor(currentSeed * 1.5) + 1;
    const random2 = seededRandom(currentSeed);
    currentSeed = Math.floor(currentSeed * 1.3) + 1;
    const random3 = seededRandom(currentSeed);
    
    const num1 = Math.floor(random1 * 10) + 1;
    const num2 = Math.floor(random2 * 10) + 1;
    const operation = random3 > 0.5 ? '+' : '-';
    
    let question, answer;
    if (operation === '+') {
        question = `${num1} + ${num2} = ?`;
        answer = num1 + num2;
    } else {
        // Ensure result is positive
        const larger = Math.max(num1, num2);
        const smaller = Math.min(num1, num2);
        question = `${larger} - ${smaller} = ?`;
        answer = larger - smaller;
    }
    
    captchaAnswer = answer;
    
    const captchaQuestion = document.getElementById('captchaQuestion');
    if (captchaQuestion) {
        captchaQuestion.textContent = question;
    }
    
    const captchaAnswerInput = document.getElementById('captchaAnswer');
    if (captchaAnswerInput) {
        captchaAnswerInput.value = '';
    }
    
    return { question, answer, id: captchaId };
}

async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const userCaptchaAnswer = parseInt(document.getElementById('captchaAnswer').value);
    const errorMsg = document.getElementById('registerError');
    
    if (!username || !password || !confirmPassword) {
        if (errorMsg) errorMsg.textContent = 'Please fill in all fields';
        return;
    }
    
    if (password !== confirmPassword) {
        if (errorMsg) errorMsg.textContent = 'Passwords do not match';
        return;
    }
    
    if (!captchaAnswer || userCaptchaAnswer !== captchaAnswer) {
        if (errorMsg) errorMsg.textContent = 'CAPTCHA answer is incorrect';
        generateCaptcha(); // Generate new CAPTCHA
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, captchaId, captchaAnswer: userCaptchaAnswer })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.username;
            updateAuthUI();
            document.getElementById('authModal').classList.add('hidden');
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirmPassword').value = '';
            document.getElementById('captchaAnswer').value = '';
            generateCaptcha(); // Generate new CAPTCHA for next time
            showNotification(`Welcome, ${username}! Account created successfully.`);
        } else {
            if (errorMsg) errorMsg.textContent = data.error || 'Registration failed';
            generateCaptcha(); // Generate new CAPTCHA on error
        }
    } catch (error) {
        if (errorMsg) errorMsg.textContent = 'Failed to connect to server';
        generateCaptcha(); // Generate new CAPTCHA on error
    }
}

// ==================== NEW FEATURES ====================

// Setup all new features
function setupNewFeatures() {
    setupFilters();
    setupDiscovery();
    setupKeyboardShortcuts();
    setupThemeToggle();
    setupViewToggle();
}

// Load saved preferences
function loadPreferences() {
    // Load theme preference
    const savedTheme = localStorage.getItem('kaimaku-theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Load view preference
    const savedView = localStorage.getItem('kaimaku-view');
    if (savedView === 'list') {
        isListView = true;
        if (searchResults) {
            searchResults.classList.add('list-view');
        }
        const gridIcon = document.getElementById('gridIcon');
        const listIcon = document.getElementById('listIcon');
        if (gridIcon && listIcon) {
            gridIcon.style.display = 'none';
            listIcon.style.display = 'block';
        }
    }
}

// ==================== FILTERS & SORTING ====================

function setupFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const applyFilters = document.getElementById('applyFilters');
    const clearFilters = document.getElementById('clearFilters');
    const sortSelect = document.getElementById('sortSelect');
    
    if (filterBtn && filterDropdown) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterDropdown.classList.toggle('hidden');
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (filterDropdown && !filterDropdown.contains(e.target) && !filterBtn.contains(e.target)) {
            filterDropdown.classList.add('hidden');
        }
    });
    
    if (applyFilters) {
        applyFilters.addEventListener('click', () => {
            applyFiltersToResults();
            filterDropdown.classList.add('hidden');
            updateFilterBadge();
        });
    }
    
    if (clearFilters) {
        clearFilters.addEventListener('click', () => {
            clearAllFilters();
            updateFilterBadge();
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applySorting();
            updateFilterBadge();
        });
    }
    
    // Update badge on filter changes
    document.querySelectorAll('.season-filter, #yearMin, #yearMax, #ratingMin, #ratingMax').forEach(el => {
        el.addEventListener('change', updateFilterBadge);
        el.addEventListener('input', updateFilterBadge);
    });
}

function updateFilterBadge() {
    const badge = document.getElementById('filterBadge');
    const filterBtn = document.getElementById('filterBtn');
    if (!badge || !filterBtn) return;
    
    let count = 0;
    
    // Check DOM values to get current state
    const yearMin = document.getElementById('yearMin')?.value;
    const yearMax = document.getElementById('yearMax')?.value;
    const ratingMin = document.getElementById('ratingMin')?.value;
    const ratingMax = document.getElementById('ratingMax')?.value;
    const seasonCheckboxes = document.querySelectorAll('.season-filter:checked');
    const sortSelect = document.getElementById('sortSelect');
    const currentSortValue = sortSelect ? sortSelect.value : currentSort;
    
    // Count active filters
    if (yearMin || yearMax) count++;
    if (seasonCheckboxes.length > 0) count++;
    if (ratingMin || ratingMax) count++;
    if (currentSortValue !== 'relevance') count++;
    
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
        filterBtn.classList.add('active');
    } else {
        badge.classList.add('hidden');
        filterBtn.classList.remove('active');
    }
}

function applyFiltersToResults() {
    // Get filter values
    const yearMin = document.getElementById('yearMin')?.value;
    const yearMax = document.getElementById('yearMax')?.value;
    const ratingMin = document.getElementById('ratingMin')?.value;
    const ratingMax = document.getElementById('ratingMax')?.value;
    const seasonCheckboxes = document.querySelectorAll('.season-filter:checked');
    const sortSelect = document.getElementById('sortSelect');
    
    activeFilters = {
        yearMin: yearMin ? parseInt(yearMin) : null,
        yearMax: yearMax ? parseInt(yearMax) : null,
        seasons: Array.from(seasonCheckboxes).map(cb => cb.value),
        ratingMin: ratingMin ? parseFloat(ratingMin) : null,
        ratingMax: ratingMax ? parseFloat(ratingMax) : null
    };
    
    if (sortSelect) {
        currentSort = sortSelect.value;
    }
    
    filterAndDisplayResults();
    updateFilterBadge();
}

function clearAllFilters() {
    document.getElementById('yearMin').value = '';
    document.getElementById('yearMax').value = '';
    document.getElementById('ratingMin').value = '';
    document.getElementById('ratingMax').value = '';
    document.querySelectorAll('.season-filter').forEach(cb => cb.checked = false);
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'relevance';
    
    activeFilters = {
        yearMin: null,
        yearMax: null,
        seasons: [],
        ratingMin: null,
        ratingMax: null
    };
    
    currentSort = 'relevance';
    filterAndDisplayResults();
    updateFilterBadge();
}

function filterAndDisplayResults() {
    if (currentSearchResults.length === 0) return;
    
    let filtered = currentSearchResults.filter(({ anime, themes }) => {
        // Year filter
        if (activeFilters.yearMin && anime.year && anime.year < activeFilters.yearMin) return false;
        if (activeFilters.yearMax && anime.year && anime.year > activeFilters.yearMax) return false;
        
        // Season filter
        if (activeFilters.seasons.length > 0) {
            const animeSeason = anime.season || '';
            if (!activeFilters.seasons.some(s => animeSeason.includes(s))) return false;
        }
        
        // Rating filter (check theme ratings)
        if (activeFilters.ratingMin !== null || activeFilters.ratingMax !== null) {
            const hasMatchingRating = themes.some(theme => {
                const themeId = getThemeId({ anime, theme });
                let rating = ratings[themeId];
                if (!rating && databaseInitialized && publicRatings[themeId]) {
                    rating = publicRatings[themeId].average;
                }
                if (rating === undefined || rating === null) return false;
                if (activeFilters.ratingMin !== null && rating < activeFilters.ratingMin) return false;
                if (activeFilters.ratingMax !== null && rating > activeFilters.ratingMax) return false;
                return true;
            });
            if (!hasMatchingRating) return false;
        }
        
        return true;
    });
    
    // Apply sorting
    applySortingToResults(filtered);
    displayFilteredResults(filtered);
}

function applySorting() {
    if (currentSearchResults.length === 0) return;
    filterAndDisplayResults();
}

function applySortingToResults(results) {
    if (currentSort === 'relevance') {
        // Keep original order
        return;
    }
    
    results.sort((a, b) => {
        const { anime: animeA, themes: themesA } = a;
        const { anime: animeB, themes: themesB } = b;
        
        switch (currentSort) {
            case 'rating-desc':
                const ratingA = getMaxRating(themesA, animeA);
                const ratingB = getMaxRating(themesB, animeB);
                return (ratingB || 0) - (ratingA || 0);
            
            case 'rating-asc':
                const ratingA2 = getMaxRating(themesA, animeA);
                const ratingB2 = getMaxRating(themesB, animeB);
                return (ratingA2 || 0) - (ratingB2 || 0);
            
            case 'year-desc':
                return (animeB.year || 0) - (animeA.year || 0);
            
            case 'year-asc':
                return (animeA.year || 0) - (animeB.year || 0);
            
            case 'alphabetical':
                const nameA = (animeA.name || '').toLowerCase();
                const nameB = (animeB.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            
            case 'popularity':
                // Use rating count as popularity proxy
                const countA = getTotalRatingCount(themesA, animeA);
                const countB = getTotalRatingCount(themesB, animeB);
                return countB - countA;
            
            default:
                return 0;
        }
    });
}

function getMaxRating(themes, anime) {
    let maxRating = 0;
    themes.forEach(theme => {
        const themeId = getThemeId({ anime, theme });
        let rating = ratings[themeId];
        if (!rating && databaseInitialized && publicRatings[themeId]) {
            rating = publicRatings[themeId].average;
        }
        if (rating && rating > maxRating) {
            maxRating = rating;
        }
    });
    return maxRating;
}

function getTotalRatingCount(themes, anime) {
    let total = 0;
    themes.forEach(theme => {
        const themeId = getThemeId({ anime, theme });
        if (databaseInitialized && publicRatings[themeId]) {
            total += publicRatings[themeId].count || 0;
        }
    });
    return total;
}

function displayFilteredResults(filtered) {
    if (!searchResults) return;
    
    if (filtered.length === 0) {
        searchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem; grid-column: 1 / -1;">No results match your filters.</p>';
        // Remove centering classes when no results
        searchResults.classList.remove('centered-1', 'centered-2', 'centered-3');
        return;
    }
    
    searchResults.innerHTML = '';
    
    // Remove existing centering classes
    searchResults.classList.remove('centered-1', 'centered-2', 'centered-3');
    
    let cardIndex = 0;
    filtered.forEach(({ anime, themes }) => {
        const card = createAnimeCard(anime, themes, cardIndex);
        card.style.animationDelay = `${cardIndex * 0.05}s`;
        searchResults.appendChild(card);
        cardIndex++;
    });
    
    // Add centering class if 1-3 items
    if (filtered.length >= 1 && filtered.length <= 3) {
        searchResults.classList.add(`centered-${filtered.length}`);
    }
}


// ==================== DISCOVERY FEATURES ====================

function setupDiscovery() {
    const randomBtn = document.getElementById('randomOpeningBtn');
    const trendingBtn = document.getElementById('trendingBtn');
    const dailyFeaturedBtn = document.getElementById('dailyFeaturedBtn');
    
    if (randomBtn) {
        randomBtn.addEventListener('click', getRandomOpening);
    }
    
    if (trendingBtn) {
        trendingBtn.addEventListener('click', showTrendingOpenings);
    }
    
    if (dailyFeaturedBtn) {
        dailyFeaturedBtn.addEventListener('click', showDailyFeatured);
    }
}

async function getRandomOpening() {
    try {
        showNotification('Finding a random opening...');
        
        // Search for popular anime to get a good pool
        const queries = ['naruto', 'one piece', 'attack on titan', 'demon slayer', 'jujutsu kaisen', 
                        'my hero academia', 'death note', 'fullmetal alchemist', 'dragon ball', 'bleach'];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const results = await searchAnime(randomQuery);
        if (results.length === 0) {
            showNotification('Could not find random opening. Try searching manually.');
            return;
        }
        
        // Flatten all openings
        const allOpenings = [];
        results.forEach(anime => {
            const themes = anime.animethemes || [];
            themes.filter(t => t.type === 'OP').forEach(theme => {
                const entries = theme.animethemeentries || [];
                if (entries.some(e => e.videos && e.videos.length > 0)) {
                    allOpenings.push({ anime, theme });
                }
            });
        });
        
        if (allOpenings.length === 0) {
            showNotification('No openings found. Try searching manually.');
            return;
        }
        
        const random = allOpenings[Math.floor(Math.random() * allOpenings.length)];
        await playTheme({ anime: random.anime, theme: random.theme });
        showNotification('Random opening loaded!');
    } catch (error) {
        console.error('Error getting random opening:', error);
        showNotification('Failed to load random opening');
    }
}

async function showTrendingOpenings() {
    try {
        showNotification('Loading trending openings...');
        
        // Search for popular anime first to get a good dataset
        const queries = ['naruto', 'one piece', 'attack on titan', 'demon slayer', 'jujutsu kaisen', 
                        'my hero academia', 'death note', 'fullmetal alchemist', 'dragon ball', 'bleach',
                        'tokyo ghoul', 'hunter x hunter', 'one punch man', 'mob psycho', 'spy x family'];
        
        // Try multiple queries to get more results
        let allResults = [];
        for (const query of queries.slice(0, 5)) {
            try {
                const results = await searchAnime(query);
                allResults = allResults.concat(results);
                await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
            } catch (err) {
                console.error(`Error searching ${query}:`, err);
            }
        }
        
        // Remove duplicates based on anime ID
        const uniqueResults = [];
        const seenIds = new Set();
        allResults.forEach(anime => {
            const id = anime.id || anime.name;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniqueResults.push(anime);
            }
        });
        
        if (uniqueResults.length === 0) {
            showNotification('No trending openings found. Try searching manually.');
            return;
        }
        
        // Display results
        displaySearchResults(uniqueResults);
        
        // Wait a bit for ratings to load, then sort by popularity
        setTimeout(() => {
            currentSort = 'popularity';
            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) sortSelect.value = 'popularity';
            applySorting();
            showNotification('Showing trending openings');
        }, 500);
    } catch (error) {
        console.error('Error showing trending:', error);
        showNotification('Failed to load trending openings');
    }
}

function showDailyFeatured() {
    // Use date to get a consistent "daily" featured opening
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    
    // If we have search results, pick one based on day
    if (currentSearchResults.length > 0) {
        const index = dayOfYear % currentSearchResults.length;
        const featured = currentSearchResults[index];
        if (featured && featured.themes.length > 0) {
            playTheme({ anime: featured.anime, theme: featured.themes[0] });
            showNotification('Daily featured opening loaded!');
            return;
        }
    }
    
    // Otherwise, search for a popular anime
    searchAnime('attack on titan').then(results => {
        if (results.length > 0) {
            displaySearchResults(results);
            setTimeout(() => {
                if (currentSearchResults.length > 0) {
                    const index = dayOfYear % currentSearchResults.length;
                    const featured = currentSearchResults[index];
                    if (featured && featured.themes.length > 0) {
                        playTheme({ anime: featured.anime, theme: featured.themes[0] });
                        showNotification('Daily featured opening loaded!');
                    }
                }
            }, 1000);
        } else {
            showNotification('Could not load daily featured. Try searching first.');
        }
    });
}

// ==================== KEYBOARD SHORTCUTS ====================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Space bar - play/pause video
        if (e.code === 'Space' && !e.target.tagName === 'INPUT') {
            e.preventDefault();
            if (videoPlayer && !playerSection.classList.contains('hidden')) {
                if (videoPlayer.paused) {
                    videoPlayer.play();
                } else {
                    videoPlayer.pause();
                }
            }
        }
        
        // R - Random opening
        if (e.code === 'KeyR' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const randomBtn = document.getElementById('randomOpeningBtn');
            if (randomBtn) randomBtn.click();
        }
        
        // Escape - Close player or dropdowns
        if (e.code === 'Escape') {
            const filterDropdown = document.getElementById('filterDropdown');
            if (filterDropdown && !filterDropdown.classList.contains('hidden')) {
                filterDropdown.classList.add('hidden');
                return;
            }
            if (!playerSection.classList.contains('hidden')) {
                closePlayerSection();
                return;
            }
            const authModal = document.getElementById('authModal');
            if (authModal && !authModal.classList.contains('hidden')) {
                authModal.classList.add('hidden');
            }
        }
        
        // Arrow keys - Navigate search results (when not in player)
        if (playerSection.classList.contains('hidden')) {
            if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
                // Could implement result navigation here
            }
        }
    });
}

// ==================== THEME TOGGLE ====================

function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('kaimaku-theme', isLight ? 'light' : 'dark');
    
    // Update icon (could add moon icon for dark mode)
    const themeIcon = document.querySelector('#themeToggle svg');
    if (themeIcon) {
        // Icon stays the same, but you could swap it here
    }
}

// ==================== VIEW TOGGLE ====================

function setupViewToggle() {
    const viewToggle = document.getElementById('viewToggle');
    const gridIcon = document.getElementById('gridIcon');
    const listIcon = document.getElementById('listIcon');
    
    if (viewToggle) {
        viewToggle.addEventListener('click', () => {
            isListView = !isListView;
            
            if (searchResults) {
                if (isListView) {
                    searchResults.classList.add('list-view');
                } else {
                    searchResults.classList.remove('list-view');
                }
            }
            
            if (gridIcon && listIcon) {
                if (isListView) {
                    gridIcon.style.display = 'none';
                    listIcon.style.display = 'block';
                } else {
                    gridIcon.style.display = 'block';
                    listIcon.style.display = 'none';
                }
            }
            
            localStorage.setItem('kaimaku-view', isListView ? 'list' : 'grid');
        });
    }
}

// Mobile Menu Setup
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navbarAuth = document.querySelector('.navbar-auth');
    const menuIcon = document.getElementById('menuIcon');
    const closeIcon = document.getElementById('closeIcon');
    const mobileSearchContainer = document.getElementById('mobileSearchContainer');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const navbarSearchInput = document.getElementById('navbarSearchInput');
    const navbarSearchBtn = document.getElementById('navbarSearchBtn');
    
    if (!mobileMenuToggle || !navbarAuth) return;
    
    let isMenuOpen = false;
    
    // Toggle mobile menu
    mobileMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        
        const navbar = document.querySelector('.navbar');
        
        if (isMenuOpen) {
            navbarAuth.classList.add('mobile-menu-open');
            if (navbar) navbar.classList.add('mobile-search-active');
            if (menuIcon) menuIcon.style.display = 'none';
            if (closeIcon) closeIcon.style.display = 'block';
            // Show mobile search when menu opens
            if (mobileSearchContainer) {
                mobileSearchContainer.style.display = 'block';
                setTimeout(() => {
                    if (mobileSearchInput) mobileSearchInput.focus();
                }, 100);
            }
        } else {
            navbarAuth.classList.remove('mobile-menu-open');
            if (navbar) navbar.classList.remove('mobile-search-active');
            if (menuIcon) menuIcon.style.display = 'block';
            if (closeIcon) closeIcon.style.display = 'none';
            // Hide mobile search when menu closes
            if (mobileSearchContainer) {
                mobileSearchContainer.style.display = 'none';
            }
        }
    });
    
    // Mobile search handling
    if (mobileSearchBtn && mobileSearchInput) {
        const handleMobileSearch = () => {
            const query = mobileSearchInput.value.trim();
            if (query) {
                handleNavbarSearch(query);
                // Close menu after search
                if (isMenuOpen) {
                    isMenuOpen = false;
                    navbarAuth.classList.remove('mobile-menu-open');
                    if (menuIcon) menuIcon.style.display = 'block';
                    if (closeIcon) closeIcon.style.display = 'none';
                    if (mobileSearchContainer) mobileSearchContainer.style.display = 'none';
                }
            }
        };
        
        mobileSearchBtn.addEventListener('click', handleMobileSearch);
        mobileSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleMobileSearch();
            }
        });
    }
    
    // Sync mobile and desktop search inputs
    if (mobileSearchInput && navbarSearchInput) {
        mobileSearchInput.addEventListener('input', (e) => {
            navbarSearchInput.value = e.target.value;
        });
        navbarSearchInput.addEventListener('input', (e) => {
            mobileSearchInput.value = e.target.value;
        });
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isMenuOpen && 
            !navbarAuth.contains(e.target) && 
            !mobileMenuToggle.contains(e.target) &&
            !mobileSearchContainer?.contains(e.target)) {
            isMenuOpen = false;
            navbarAuth.classList.remove('mobile-menu-open');
            if (menuIcon) menuIcon.style.display = 'block';
            if (closeIcon) closeIcon.style.display = 'none';
            if (mobileSearchContainer) mobileSearchContainer.style.display = 'none';
        }
    });
    
    // Close menu when clicking on auth buttons
    const authButtons = navbarAuth.querySelectorAll('.nav-auth-btn');
    authButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isMenuOpen) {
                isMenuOpen = false;
                navbarAuth.classList.remove('mobile-menu-open');
                if (menuIcon) menuIcon.style.display = 'block';
                if (closeIcon) closeIcon.style.display = 'none';
                if (mobileSearchContainer) mobileSearchContainer.style.display = 'none';
            }
        });
    });
    
    // Handle view toggle on mobile (if exists)
    const viewToggle = document.getElementById('viewToggle');
    if (viewToggle && isMobileDevice) {
        // On mobile, add view toggle to menu
        viewToggle.addEventListener('click', () => {
            if (isMenuOpen) {
                // Close menu after toggling view on mobile
                setTimeout(() => {
                    isMenuOpen = false;
                    navbarAuth.classList.remove('mobile-menu-open');
                    if (menuIcon) menuIcon.style.display = 'block';
                    if (closeIcon) closeIcon.style.display = 'none';
                    if (mobileSearchContainer) mobileSearchContainer.style.display = 'none';
                }, 300);
            }
        });
    }
}
