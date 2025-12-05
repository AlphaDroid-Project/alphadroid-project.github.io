/**
 * AlphaDroid Project - Routing System
 * Clean, efficient class-based router with lifecycle hooks and data loading integration
 */

// Optimized in-memory cache with size limits and TTL
window.__pageCache = window.__pageCache || new Map();
window.__cacheTimestamps = window.__cacheTimestamps || new Map();
let CACHE_MAX_SIZE = 10;
let CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Router Class - Handles all navigation and page loading
 */
class Router {
    constructor(options = {}) {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentPath = null;
        this.sectionHashes = new Set();
        this.config = options;

        // DOM references
        this.appDiv = null;
        this.heroDiv = null;

        // Scroll throttling
        this.scrollUpdateTimeout = null;
        this.lastScrollY = 0;

        // Bind methods
        this.handleHashChange = this.handleHashChange.bind(this);
        this.handleLoad = this.handleLoad.bind(this);
        this.handleScrollNavigationUpdate = this.handleScrollNavigationUpdate.bind(this);
    }

    /**
     * Initialize the router
     */
    init() {
        this.appDiv = document.getElementById('app');
        this.heroDiv = document.getElementById('hero');

        // Set up event listeners
        window.addEventListener('hashchange', this.handleHashChange);
        window.addEventListener('load', this.handleLoad);

        // Load initial route if already loaded
        if (document.readyState === 'complete') {
            this.handleLoad();
        }
    }

    /**
     * Register a route
     * @param {string} pattern - Route pattern (e.g., '#home', '#devices?codename=:codename')
     * @param {object} config - Route configuration
     */
    register(pattern, config) {
        this.routes.set(pattern, {
            pattern,
            page: config.page,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null,
            scrollTarget: config.scrollTarget || null,
            isSection: config.isSection || false
        });

        if (config.isSection) {
            this.sectionHashes.add(pattern);
        }
    }

    /**
     * Match current hash to a route
     * @param {string} hash - Current hash
     * @returns {object|null} Matched route with params
     */
    matchRoute(hash) {
        const normalizedHash = hash || '#';

        // Check for device route with codename parameter
        if (this.isDeviceRoute(normalizedHash)) {
            const codename = this.getDeviceCodename(normalizedHash);
            const route = this.routes.get('#devices?codename=:codename');
            if (route) {
                return { route, params: { codename } };
            }
        }

        // Direct match
        const route = this.routes.get(normalizedHash);
        if (route) {
            return { route, params: {} };
        }

        return null;
    }

    /**
     * Check if hash is a device route
     */
    isDeviceRoute(hash) {
        return hash && hash.startsWith('#devices?codename=');
    }

    /**
     * Extract codename from device route
     */
    getDeviceCodename(hash) {
        if (!this.isDeviceRoute(hash)) return null;
        try {
            const url = new URL(hash.substring(1), window.location.origin);
            return url.searchParams.get('codename');
        } catch (e) {
            const match = hash.match(/#devices\?codename=([^&]+)/);
            return match ? decodeURIComponent(match[1]) : null;
        }
    }

    /**
     * Navigate to a path
     * @param {string} path - Path to navigate to
     * @param {object} options - Navigation options
     */
    async navigateTo(path, options = {}) {
        const hash = path.startsWith('#') ? path : '#' + path.replace(/^[/#]/, '');

        // Handle scroll to top for home
        if (hash === '#' && window.location.hash === '') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Handle in-page section scrolling
        const targetId = hash.replace('#', '');
        const targetElement = document.getElementById(targetId);
        if (targetElement && (window.location.hash === '' || window.location.hash === '#' || window.location.hash === '#home')) {
            this.scrollWithHeaderOffset(targetElement);
            return;
        }

        window.location.hash = hash;
    }

    /**
     * Handle hash change event
     */
    async handleHashChange() {
        await this.updateContent();
        setTimeout(() => this.updateNavigationState(), 50);
    }

    /**
     * Handle page load event
     */
    async handleLoad() {
        await this.updateContent();
        setTimeout(() => this.updateNavigationState(), 100);

        // Add scroll listener for navigation updates
        window.addEventListener('scroll', this.handleScrollNavigationUpdate, { passive: true });
    }

    /**
     * Update content based on current hash
     */
    async updateContent() {
        const hash = window.location.hash || '#';
        const match = this.matchRoute(hash);

        if (!match) {
            await this.load404();
            return;
        }

        const { route, params } = match;

        // Execute beforeEnter hook
        if (route.beforeEnter) {
            try {
                const result = await route.beforeEnter(params);
                // If beforeEnter returns false, stop navigation
                if (result === false) return;
                // If beforeEnter handles everything (like device popup), update nav and return
                if (this.isDeviceRoute(hash)) {
                    this.updateNavigationState();
                    return;
                }
            } catch (error) {
                console.error('beforeEnter hook error:', error);
            }
        }

        // Check if we can skip page reload for section navigation
        if (route.isSection && this.currentPath === route.page) {
            await this.handleSectionNavigation(route);
            return;
        }

        // Load the page
        await this.loadPage(route, params);
    }

    /**
     * Handle section navigation within the same page
     */
    async handleSectionNavigation(route) {
        // Add fade transition
        this.appDiv.classList.remove('fade-in');
        this.appDiv.classList.add('fade-out');
        if (this.heroDiv) {
            this.heroDiv.classList.remove('fade-in');
            this.heroDiv.classList.add('fade-out');
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Execute afterEnter hook
        if (route.afterEnter) {
            try {
                await route.afterEnter({});
            } catch (error) {
                console.error('afterEnter hook error:', error);
            }
        }

        // Scroll to section
        if (route.scrollTarget) {
            this.scrollToSection(route.scrollTarget);
        }

        // Update hero visibility
        if (typeof window.updateHeroVisibility === 'function') {
            window.updateHeroVisibility();
        }

        // Update navigation state
        this.updateNavigationState();

        // Fade back in
        this.appDiv.classList.remove('fade-out');
        this.appDiv.classList.add('fade-in');
        if (this.heroDiv) {
            this.heroDiv.classList.remove('fade-out');
            this.heroDiv.classList.add('fade-in');
        }
    }

    /**
     * Load a page
     */
    async loadPage(route, params) {
        // Start fade out transition
        this.appDiv.classList.remove('fade-in');
        this.appDiv.classList.add('fade-out');
        if (this.heroDiv) {
            this.heroDiv.classList.remove('fade-in');
            this.heroDiv.classList.add('fade-out');
        }

        await new Promise(resolve => setTimeout(resolve, 400));

        try {
            const response = await fetchContent(route.page);
            if (response.ok) {
                this.appDiv.innerHTML = await response.text();
                this.currentPath = route.page;
                window.__currentPagePath = route.page;

                // Fade in
                this.appDiv.classList.remove('fade-out');
                this.appDiv.classList.add('fade-in');
                if (this.heroDiv) {
                    this.heroDiv.classList.remove('fade-out');
                    this.heroDiv.classList.add('fade-in');
                }

                // Execute afterEnter hook
                if (route.afterEnter) {
                    try {
                        await route.afterEnter(params);
                    } catch (error) {
                        console.error('afterEnter hook error:', error);
                    }
                }

                // Ensure footer present
                if (typeof buildSiteFooter === 'function') buildSiteFooter();

                // Update hero visibility
                if (typeof window.updateHeroVisibility === 'function') {
                    window.updateHeroVisibility();
                }

                // Update navigation state
                this.updateNavigationState();
            } else {
                await this.load404();
            }
        } catch (error) {
            console.error('Error loading page:', error);
            await this.loadError();
        }
    }

    /**
     * Load 404 page
     */
    async load404() {
        try {
            const response = await fetchContent('pages/404.html');
            this.appDiv.innerHTML = await response.text();
            this.currentPath = 'pages/404.html';
            window.__currentPagePath = 'pages/404.html';

            this.appDiv.classList.remove('fade-out');
            this.appDiv.classList.add('fade-in');
            if (this.heroDiv) {
                this.heroDiv.classList.remove('fade-out');
                this.heroDiv.classList.add('fade-in');
            }

            if (typeof buildSiteFooter === 'function') buildSiteFooter();
            this.updateNavigationState();
        } catch (error) {
            console.error('Error loading 404 page:', error);
            await this.loadError();
        }
    }

    /**
     * Load error page
     */
    async loadError() {
        this.appDiv.innerHTML = '<div class="container"><h1>Error</h1><p>Failed to load content. Please ensure you are running the site through a web server.</p></div>';
        this.currentPath = 'error';
        window.__currentPagePath = 'error';

        this.appDiv.classList.remove('fade-out');
        this.appDiv.classList.add('fade-in');
        if (this.heroDiv) {
            this.heroDiv.classList.remove('fade-out');
            this.heroDiv.classList.add('fade-in');
        }

        if (typeof buildSiteFooter === 'function') buildSiteFooter();
        this.updateNavigationState();
    }

    /**
     * Scroll to section with header offset
     */
    scrollToSection(id) {
        if (!id) return;
        setTimeout(() => {
            let el = document.getElementById(id);
            if (!el) {
                const appEl = document.getElementById('app');
                el = appEl ? appEl.querySelector(`#${id}`) : null;
            }
            if (el) this.scrollWithHeaderOffset(el);
        }, 120);
    }

    /**
     * Scroll with header offset
     */
    scrollWithHeaderOffset(el, extra = 8) {
        if (!el) return;
        const header = document.querySelector('header');
        const headerH = header ? header.getBoundingClientRect().height : 0;
        const top = el.getBoundingClientRect().top + window.scrollY - headerH - extra;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    /**
     * Update navigation active states
     */
    updateNavigationState() {
        const hash = window.location.hash || '#';

        // Clear all active states
        const allNavItems = [
            'nav-home-desktop', 'nav-features-desktop', 'nav-screenshots-desktop',
            'nav-home-mobile', 'nav-features-mobile', 'nav-screenshots-mobile'
        ];

        allNavItems.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('active');
        });

        // Don't set active states for devices page
        if (hash === '#devices' || hash.startsWith('#devices?codename=') || this.currentPath === 'pages/devices.html') {
            return;
        }

        // Check if we're on a home-related page
        const isHomePage = !hash || hash === '#' || hash === '#home' ||
            this.sectionHashes.has(hash) ||
            this.currentPath === 'pages/home.html';

        if (isHomePage) {
            const sections = [
                { id: 'features', nav: { desktop: 'nav-features-desktop', mobile: 'nav-features-mobile' } },
                { id: 'screenshots', nav: { desktop: 'nav-screenshots-desktop', mobile: 'nav-screenshots-mobile' } },
                { id: 'download', nav: { desktop: 'nav-screenshots-desktop', mobile: 'nav-screenshots-mobile' } }
            ];

            let currentSection = null;
            const header = document.querySelector('header');
            const headerHeight = header ? header.getBoundingClientRect().height : 0;
            const scrollOffset = headerHeight + 100;

            for (const section of sections) {
                const element = document.getElementById(section.id);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const elementTop = rect.top + window.scrollY;

                    if (window.scrollY + scrollOffset >= elementTop) {
                        currentSection = section;
                    }
                }
            }

            let activeDesktop = null;
            let activeMobile = null;

            if (currentSection) {
                activeDesktop = currentSection.nav.desktop;
                activeMobile = currentSection.nav.mobile;
            } else {
                activeDesktop = 'nav-home-desktop';
                activeMobile = 'nav-home-mobile';
            }

            if (activeDesktop) {
                const desktopElement = document.getElementById(activeDesktop);
                if (desktopElement) desktopElement.classList.add('active');
            }

            if (activeMobile) {
                const mobileElement = document.getElementById(activeMobile);
                if (mobileElement) mobileElement.classList.add('active');
            }
        }
    }

    /**
     * Handle scroll navigation update (throttled)
     */
    handleScrollNavigationUpdate() {
        if (this.scrollUpdateTimeout) return;

        const currentScrollY = window.scrollY;
        if (Math.abs(currentScrollY - this.lastScrollY) < 10) return;
        this.lastScrollY = currentScrollY;

        this.scrollUpdateTimeout = setTimeout(() => {
            this.updateNavigationState();
            this.scrollUpdateTimeout = null;
        }, 100);
    }
}

// Create global router instance
const router = new Router();

// Legacy compatibility functions
function navigateTo(path) {
    router.navigateTo(path);
}

function navigate(event, path) {
    event.preventDefault();
    navigateTo(path);
}

function navigateToDevice(codename) {
    if (!codename) return;
    window.location.hash = `#devices?codename=${encodeURIComponent(codename)}`;
}

// Make navigateToDevice globally available
window.navigateToDevice = navigateToDevice;

function isDeviceRoute(hash) {
    return router.isDeviceRoute(hash);
}

function getDeviceCodename(hash) {
    return router.getDeviceCodename(hash);
}

function scrollToSection(id) {
    router.scrollToSection(id);
}

function scrollWithHeaderOffset(el, extra = 8) {
    router.scrollWithHeaderOffset(el, extra);
}

function updateNavigationState() {
    router.updateNavigationState();
}

function handleScrollNavigationUpdate() {
    router.handleScrollNavigationUpdate();
}

/**
 * Initialize router with configuration
 */
function initializeRouterConfig() {
    const navConfig = window.configManager?.getNavigation() || {};
    const uiConfig = window.configManager?.getUi() || {};
    const homePreview = uiConfig.deviceLimits?.homePreview || 5;

    // Helper to create device loading action
    const makeLoadAction = (limit, scrollId) => async () => {
        if (typeof loadDevices === 'function') {
            const container = document.querySelector('.devices-container');
            const hasCards = container && container.querySelector('article[data-codename]');
            if (!hasCards) await loadDevices(limit);
        }
        if (scrollId) {
            scrollToSection(scrollId);
        } else if (limit === 0) {
            setTimeout(() => {
                const devicesTitle = document.getElementById('devices-title');
                if (devicesTitle) {
                    scrollWithHeaderOffset(devicesTitle);
                } else {
                    const header = document.querySelector('header');
                    const headerH = header ? header.getBoundingClientRect().height : 0;
                    window.scrollTo({ top: Math.max(0, headerH + 8), behavior: 'smooth' });
                }
            }, 120);
        }
    };

    // Register routes
    router.register('#', {
        page: 'pages/home.html',
        afterEnter: makeLoadAction(homePreview)
    });

    router.register('#home', {
        page: 'pages/home.html',
        afterEnter: makeLoadAction(homePreview)
    });

    router.register('#features', {
        page: 'pages/home.html',
        isSection: true,
        scrollTarget: 'features',
        afterEnter: makeLoadAction(homePreview, 'features')
    });

    router.register('#screenshots', {
        page: 'pages/home.html',
        isSection: true,
        scrollTarget: 'screenshots',
        afterEnter: makeLoadAction(homePreview, 'screenshots')
    });

    router.register('#download', {
        page: 'pages/home.html',
        isSection: true,
        scrollTarget: 'download',
        afterEnter: makeLoadAction(homePreview, 'download')
    });

    router.register('#devices', {
        page: 'pages/devices.html',
        afterEnter: makeLoadAction(0)
    });

    router.register('#devices?codename=:codename', {
        beforeEnter: async (params) => {
            if (params.codename && typeof showDeviceDetails === 'function') {
                try {
                    await showDeviceDetails(params.codename);
                } catch (error) {
                    console.error('Failed to show device details:', error);

                    // Show error notification
                    const snackbar = document.createElement('div');
                    snackbar.className = 'snackbar';
                    snackbar.innerHTML = `
                        <div>Device "${params.codename}" not found</div>
                        <button class="transparent circle" onclick="this.parentElement.remove()">
                            <i>close</i>
                        </button>
                    `;
                    document.body.appendChild(snackbar);
                    setTimeout(() => snackbar.remove(), 5000);

                    // Navigate to devices page
                    window.location.hash = '#devices';
                }
            }
        }
    });

    router.register('#about', {
        page: 'pages/about.html'
    });

    router.register('#contact', {
        page: 'pages/contact.html'
    });

    // Initialize cache settings
    if (uiConfig.cache) {
        CACHE_MAX_SIZE = uiConfig.cache.maxSize || 10;
        CACHE_TTL = uiConfig.cache.ttl || 5 * 60 * 1000;
    }
}

// Initialize router when config is ready
window.addEventListener('configReady', () => {
    initializeRouterConfig();
});

// Also initialize immediately if config is already loaded
if (window.configManager && window.configManager.isLoaded()) {
    initializeRouterConfig();
}

// Initialize router on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => router.init());
} else {
    router.init();
}

// Initialize cache settings from configuration
function initializeCacheSettings() {
    if (window.configManager && window.configManager.isLoaded()) {
        const uiConfig = window.configManager.getUi();
        CACHE_MAX_SIZE = uiConfig.cache?.maxSize || 10;
        CACHE_TTL = uiConfig.cache?.ttl || 5 * 60 * 1000;
    }
}

async function fetchContent(url) {
    // Serve from cache if available and not expired
    if (window.__pageCache.has(url)) {
        const timestamp = window.__cacheTimestamps.get(url);
        if (timestamp && Date.now() - timestamp < CACHE_TTL) {
            const cached = window.__pageCache.get(url);
            return { ok: true, text: async () => cached };
        } else {
            // Remove expired cache entry
            window.__pageCache.delete(url);
            window.__cacheTimestamps.delete(url);
        }
    }

    // Use preloaded page fragment if available
    try {
        if (window.__preloadedPages && window.__preloadedPages[url]) {
            const html = window.__preloadedPages[url];
            window.__pageCache.set(url, html);
            return { ok: true, text: async () => html };
        }
    } catch (e) {
        // fall back to network
    }

    // Handle both development and production environments
    if (window.location.protocol === 'file:') {
        // Development mode - return mock content (do not cache)
        return {
            ok: true,
            text: async () => `<div class="container">
                <h1>Development Mode</h1>
                <p>You are viewing: ${url}</p>
                <p>To see actual content, please run this site through a web server.</p>
            </div>`
        };
    }

    // Network fetch with no-cache header; cache successful response body
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) {
        const html = await res.text();

        // Implement cache size management
        if (window.__pageCache.size >= CACHE_MAX_SIZE) {
            const firstKey = window.__pageCache.keys().next().value;
            window.__pageCache.delete(firstKey);
            window.__cacheTimestamps.delete(firstKey);
        }

        window.__pageCache.set(url, html);
        window.__cacheTimestamps.set(url, Date.now());
        return { ok: true, text: async () => html };
    }
    return res;
}

