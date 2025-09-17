const routes = {
    "#": "pages/home.html",
    "#home": "pages/home.html",
    "#features": "pages/home.html",     // will scroll to #features after render
    "#screenshots": "pages/home.html",  // will scroll to #screenshots after render (if present)
    "#devices": "pages/devices.html",
    // UPDATED: #download now treated as home section (scroll to #download)
    "#download": "pages/home.html",
    "#about": "pages/about.html",
    "#contact": "pages/contact.html"
};

// NEW: section hashes that should not trigger page reload when already on home
const sectionHashes = new Set(['#features', '#screenshots', '#download']);

// Small in-memory cache for fetched HTML fragments
window.__pageCache = window.__pageCache || new Map();

async function fetchContent(url) {
    // Serve from cache if available
    if (window.__pageCache.has(url)) {
        const cached = window.__pageCache.get(url);
        return { ok: true, text: async () => cached };
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
        window.__pageCache.set(url, html);
        return { ok: true, text: async () => html };
    }
    return res;
}

function navigateTo(path) {
    // Convert path to hash if needed
    const hash = path.startsWith('#') ? path : '#' + path.replace(/^[/#]/, '');
    
    if (hash === '#' && window.location.hash === '') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const targetId = hash.replace('#', '');
    const targetElement = document.getElementById(targetId);
    // UPDATED: use header offset scroll when already on home sections
    if (targetElement && (window.location.hash === '' || window.location.hash === '#' || window.location.hash === '#home')) {
        scrollWithHeaderOffset(targetElement);
        return;
    }

    window.location.hash = hash;
}

// Fix: proper function name (was split across a newline previously)
async function navigate(event, path) {
    event.preventDefault();
    navigateTo(path);
}

// Helper to generate route actions with optional scroll target
const makeLoadAction = (limit, scrollId) => async () => {
    // Skip redundant loads if content already exists
    if (typeof loadDevices === 'function') {
        const container = document.querySelector('.devices-container');
        const hasCards = container && container.querySelector('article[data-codename]');
        if (!hasCards) await loadDevices(limit);
    }
    if (scrollId) {
        scrollToSection(scrollId);
    } else if (limit === 0) {
        // Devices page: scroll to top below header
        setTimeout(() => {
            const header = document.querySelector('header');
            const headerH = header ? header.getBoundingClientRect().height : 0;
            window.scrollTo({ top: Math.max(0, headerH + 8), behavior: 'smooth' });
        }, 120);
    }
};

// Simplified route actions using the helper
const routeActions = {
    "#": makeLoadAction(5),
    "#home": makeLoadAction(5),
    "#features": makeLoadAction(5, 'features'),
    "#screenshots": makeLoadAction(5, 'screenshots'),
    // UPDATED: #download now scrolls to in-page section "download"
    "#download": makeLoadAction(5, 'download'),
    "#devices": makeLoadAction(0)
};

// NEW: helper to scroll accounting for fixed header height
function scrollWithHeaderOffset(el, extra = 8) {
    if (!el) return;
    const header = document.querySelector('header');
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - extra;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// helper: smooth scroll to element by id if exists (now header-safe)
function scrollToSection(id) {
    if (!id) return;
    setTimeout(() => {
        let el = document.getElementById(id);
        if (!el) {
            const appEl = document.getElementById('app');
            el = appEl ? appEl.querySelector(`#${id}`) : null;
        }
        if (el) scrollWithHeaderOffset(el);
    }, 120);
}

async function updateContent() {
    const hash = window.location.hash || '#';
    const appDiv = document.getElementById("app");
    const heroDiv = document.getElementById("hero");

    // NEW: Skip reload for in-home sections if home already loaded
    if (sectionHashes.has(hash) && window.__currentPagePath === 'pages/home.html') {
        // Add fade transition for section navigation (including hero)
        appDiv.classList.remove('fade-in');
        appDiv.classList.add('fade-out');
        if (heroDiv) {
            heroDiv.classList.remove('fade-in');
            heroDiv.classList.add('fade-out');
        }
        await new Promise(resolve => setTimeout(resolve, 200)); // Shorter fade for sections
        
        // Ensure any post-render action (e.g., lazy load devices preview) still runs
        if (routeActions[hash]) routeActions[hash]().catch(err => console.error('routeAction error', err));
        scrollToSection(hash.substring(1));
        if (typeof window.updateHeroVisibility === 'function') window.updateHeroVisibility();
        
        // Update navigation state
        updateNavigationState();
        
        // Fade back in
        appDiv.classList.remove('fade-out');
        appDiv.classList.add('fade-in');
        if (heroDiv) {
            heroDiv.classList.remove('fade-out');
            heroDiv.classList.add('fade-in');
        }
        return;
    }

    // Start transition (including hero)
    appDiv.classList.remove('fade-in');
    appDiv.classList.add('fade-out');
    if (heroDiv) {
        heroDiv.classList.remove('fade-in');
        heroDiv.classList.add('fade-out');
    }
    await new Promise(resolve => setTimeout(resolve, 400)); // Wait for fade out

    try {
        const routeKey = hash;
        if (routeKey && routes[routeKey]) {
            const response = await fetchContent(routes[routeKey]);
            if (response.ok) {
                appDiv.innerHTML = await response.text();
                appDiv.classList.remove('fade-out');
                appDiv.classList.add('fade-in');
                if (heroDiv) {
                    heroDiv.classList.remove('fade-out');
                    heroDiv.classList.add('fade-in');
                }

                // NEW: record current page path for section skip logic
                window.__currentPagePath = routes[routeKey];

                // Run any route-specific post-render actions (scrolling, extra loads)
                if (routeActions[routeKey]) {
                    routeActions[routeKey]().catch(err => console.error('routeAction error', err));
                }

                // Ensure footer present
                if (typeof buildSiteFooter === 'function') buildSiteFooter();

                // NEW: update hero visibility after content change
                if (typeof window.updateHeroVisibility === 'function') window.updateHeroVisibility();

                // Update navigation state
                updateNavigationState();

                return;
            }
        }

        // allow serving top-level HTML files directly (e.g. visiting /devices.html)
        // try to fetch the path as-is (strip leading slash)
        const tryPath = (window.location.pathname || '').replace(/^\/+/, '');
        try {
            const directResp = await fetchContent(tryPath);
            if (directResp.ok) {
                appDiv.innerHTML = await directResp.text();
                appDiv.classList.remove('fade-out');
                appDiv.classList.add('fade-in');
                if (heroDiv) {
                    heroDiv.classList.remove('fade-out');
                    heroDiv.classList.add('fade-in');
                }
                window.__currentPagePath = tryPath;
                updateNavigationState();
                return;
            }
        } catch (e) {
            // ignore
        }

        const notFoundResponse = await fetchContent('pages/404.html');
        appDiv.innerHTML = await notFoundResponse.text();
        appDiv.classList.remove('fade-out');
        appDiv.classList.add('fade-in');
        if (heroDiv) {
            heroDiv.classList.remove('fade-out');
            heroDiv.classList.add('fade-in');
        }
        window.__currentPagePath = 'pages/404.html';
        if (typeof buildSiteFooter === 'function') buildSiteFooter();
        updateNavigationState();
    } catch (error) {
        console.error('Error loading page:', error);
        appDiv.innerHTML = '<div class="container"><h1>Error</h1><p>Failed to load content. Please ensure you are running the site through a web server.</p></div>';
        appDiv.classList.remove('fade-out');
        appDiv.classList.add('fade-in');
        if (heroDiv) {
            heroDiv.classList.remove('fade-out');
            heroDiv.classList.add('fade-in');
        }
        window.__currentPagePath = 'error';
        if (typeof buildSiteFooter === 'function') buildSiteFooter();
        updateNavigationState();
    }
}

// NEW: Update navigation active states based on current route and scroll position
function updateNavigationState() {
    const hash = window.location.hash || '#';
    
    // Clear all active states first
    const allNavItems = [
        'nav-home-desktop', 'nav-features-desktop', 'nav-screenshots-desktop',
        'nav-home-mobile', 'nav-features-mobile', 'nav-screenshots-mobile'
    ];
    
    allNavItems.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.remove('active');
    });
    
    // Determine which navigation items should be active based on scroll position
    let activeDesktop = null;
    let activeMobile = null;
    
    // Check if we're on devices page - if so, no nav items should be active
    if (hash === '#devices' || window.__currentPagePath === 'pages/devices.html') {
        // Don't set any active states for devices page
        return;
    }
    
    // Check if we're on a home-related page
    const isHomePage = !hash || hash === '#' || hash === '#home' || 
                      sectionHashes.has(hash) || 
                      window.__currentPagePath === 'pages/home.html';
    
    if (isHomePage) {
        // Get sections to check scroll position
        const sections = [
            { id: 'features', nav: { desktop: 'nav-features-desktop', mobile: 'nav-features-mobile' } },
            { id: 'screenshots', nav: { desktop: 'nav-screenshots-desktop', mobile: 'nav-screenshots-mobile' } },
            { id: 'download', nav: { desktop: 'nav-screenshots-desktop', mobile: 'nav-screenshots-mobile' } }
        ];
        
        let currentSection = null;
        const header = document.querySelector('header');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const scrollOffset = headerHeight + 100; // Additional offset for better UX
        
        // Check which section is currently in view
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
        
        if (currentSection) {
            activeDesktop = currentSection.nav.desktop;
            activeMobile = currentSection.nav.mobile;
        } else {
            // Default to home if no specific section is active
            activeDesktop = 'nav-home-desktop';
            activeMobile = 'nav-home-mobile';
        }
    }
    // For other non-home routes like #about, #contact, no active state is set
    
    // Set active states
    if (activeDesktop) {
        const desktopElement = document.getElementById(activeDesktop);
        if (desktopElement) desktopElement.classList.add('active');
    }
    
    if (activeMobile) {
        const mobileElement = document.getElementById(activeMobile);
        if (mobileElement) mobileElement.classList.add('active');
    }
}

// NEW: Throttled scroll handler for navigation updates
let scrollUpdateTimeout = null;
function handleScrollNavigationUpdate() {
    if (scrollUpdateTimeout) return;
    
    scrollUpdateTimeout = setTimeout(() => {
        updateNavigationState();
        scrollUpdateTimeout = null;
    }, 100); // Throttle to avoid excessive updates
}

// Handle browser navigation (back/forward buttons and hash changes)
window.onhashchange = () => {
    updateContent();
    // Ensure navigation state updates on hash change
    setTimeout(() => updateNavigationState(), 50);
};

// Load the correct content when the page loads
window.onload = () => {
    updateContent();
    // Ensure navigation state is set on initial load
    setTimeout(() => updateNavigationState(), 100);
    
    // Add scroll listener for navigation updates
    window.addEventListener('scroll', handleScrollNavigationUpdate, { passive: true });
};

/**
 * Fetch device JSON files from the GitHub repo and render device cards.
 * Uses data/devices.json (created by GitHub Actions) if available to avoid client-side rate limits.
 * @param {number} limit - maximum number of devices to render (0 or omitted = all)
 */
async function loadDevices(limit = 0) {
    const container = document.querySelector('.devices-container');
    if (!container) return;

    // Simple loading state
    const loadingEl = document.createElement('div');
    loadingEl.className = 'center-align';
    loadingEl.innerHTML = '<div class="loader"></div>';
    container.innerHTML = '';
    container.appendChild(loadingEl);

    // Helper to normalize different JSON shapes (data.response[] vs flat)
    function normalizeEntry(res) {
        // res may be { name, data: { response: [ { ... } ] }, rawUrl, lastModified }
        // or already a simple device object
        if (!res) return { rawName: '' };
        const rawName = (res.name || '').replace(/\.json$/i, '');
        if (res.data && Array.isArray(res.data.response) && res.data.response.length > 0) {
            const d = res.data.response[0];
            return Object.assign({ rawName, raw: res }, d);
        }
        if (res.data && typeof res.data === 'object') {
            return Object.assign({ rawName, raw: res }, res.data);
        }
        // fallback: res itself could be the device object
        return Object.assign({ rawName, raw: res }, res);
    }

    // New helper: determine the best update timestamp (ms) for an entry
    function getUpdatedTime(entry) {
        if (!entry) return 0;
        // Prefer explicit timestamp fields in various shapes
        try {
            // If entry.data is the wrapper with response[] (from data/devices.json)
            const data = entry.data || (entry.raw && entry.raw.data) || null;
            if (data) {
                const resp = Array.isArray(data.response) ? data.response[0] : data;
                if (resp && resp.timestamp) {
                    const ts = Number(resp.timestamp);
                    if (!Number.isNaN(ts) && ts > 0) return ts * 1000;
                }
                if (data.timestamp) {
                    const ts2 = Number(data.timestamp);
                    if (!Number.isNaN(ts2) && ts2 > 0) return ts2 * 1000;
                }
            }

            // Some fetch results include lastModified header stored on the wrapper
            if (entry.lastModified) {
                const t = Date.parse(entry.lastModified);
                if (!Number.isNaN(t)) return t;
            }

            // If response objects contain a 'timestamp' at top-level
            if (entry.timestamp) {
                const t2 = Number(entry.timestamp);
                if (!Number.isNaN(t2) && t2 > 0) return t2 * 1000;
            }

            // If version is a date-like string, try to parse it
            const maybe = entry.version || (entry.data && entry.data.version) || '';
            if (maybe && !Number.isNaN(Date.parse(maybe))) return Date.parse(maybe);
        } catch (e) {
            // ignore parse errors
        }
        return 0;
    }

    // Common render function for all data sources
    function renderDevices(devices) {
        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'grid responsive medium-space';
        container.appendChild(grid);

        // Keep raw list for search/filter
        window.__allDevicesRaw = devices.slice();

        // Brand color mapping and helpers for OEM chip styling
        const _brandColors = {
            xiaomi: '#FF6900',
            google: '#4285F4',
            pixel: '#4285F4',
            oneplus: '#EB0029',
            nothing: '#000000',
            samsung: '#1428A0',
            motorola: '#E60012',
            huawei: '#D70015',
            oppo: '#00B388',
            vivo: '#1E90FF',
            realme: '#F3D04E',
            sony: '#00A3E0',
            lg: '#A50034',
            nokia: '#124191',
            asus: '#005BAC'
        };

        function getBrandColor(name) {
            if (!name) return null;
            const v = String(name).toLowerCase().trim();
            // direct key
            if (_brandColors[v]) return _brandColors[v];
            // try contains
            for (const k of Object.keys(_brandColors)) {
                if (v.indexOf(k) !== -1) return _brandColors[k];
            }
            return null;
        }

        function getTextColor(hex) {
            if (!hex) return 'inherit';
            // convert #RRGGBB to rgb
            const h = hex.replace('#', '');
            if (h.length !== 6) return 'white';
            const r = parseInt(h.slice(0,2), 16);
            const g = parseInt(h.slice(2,4), 16);
            const b = parseInt(h.slice(4,6), 16);
            // Perceived luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            return lum > 186 ? 'black' : 'white';
        }

        // Ensure uniform card CSS is present
        ensureUniformCardStyles();

        // Batch DOM insertion to reduce reflows
        const frag = document.createDocumentFragment();

        devices.forEach(res => {
            const d = normalizeEntry(res);
            const codename = (d.codename || d.device || d.id || d.rawName || '').toString();
            const fullname = d.device || d.name || d.model || codename;

            // prefer numeric timestamp -> ISO date; otherwise use version/lastModified
            let latestDisplay = 'Unknown';
            if (d.timestamp) {
                try {
                    const ts = Number(d.timestamp);
                    if (!Number.isNaN(ts) && ts > 0) latestDisplay = new Date(ts * 1000).toISOString().split('T')[0];
                } catch (e) { /* ignore */ }
            }
            if (latestDisplay === 'Unknown') {
                const raw = d.latestVersion || (res && res.lastModified) || d.version || d.release || '';
                if (raw) latestDisplay = isNaN(Date.parse(raw)) ? String(raw) : new Date(raw).toISOString().split('T')[0];
            }

            // NEW: compute version text to show beside date
            let versionDisplay = 'Unknown';
            if (d.version) {
                versionDisplay = String(d.version);
            } else if (d.filename) {
                const m = String(d.filename).match(/v?\d+(?:\.\d+)+/i);
                versionDisplay = m ? m[0] : 'Unknown';
            } else if (d.release) {
                versionDisplay = String(d.release);
            }

            // maintainer can be a string or object; build a simple display
            let maintName = '';
            let maintUrl = '';
            if (typeof d.maintainer === 'string') {
                maintName = d.maintainer;
                // try to surface telegram/paypal/forum if present on parent
                maintUrl = d.telegram || d.paypal || d.forum || '';
            } else if (d.maintainer && typeof d.maintainer === 'object') {
                maintName = d.maintainer.name || d.maintainer.username || d.maintainer.maintainer || '';
                maintUrl = d.maintainer.url || d.maintainer.website || '';
            }
            const maintHtml = maintUrl ? `<a href="${escapeAttr(maintUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(maintName || maintUrl)}</a>` : escapeHtml(maintName || 'Unknown');

            const infoLink = (res.rawUrl || (d.raw && d.raw.rawUrl) || `https://raw.githubusercontent.com/AlphaDroid-devices/OTA/master/${codename}.json`);

            // compute chip values (OEM overridden by device_db.json if available)
            // OLD: const oemVal = (d.oem || d.vendor || d.brand || '').toString();
            let oemVal = (d.oem || d.vendor || d.brand || '').toString();
            try {
                const lc = codename.toLowerCase();
                const ovMap = window.__overrides || null;
                const aliasRev = window.__aliasReverse || null;
                if (ovMap) {
                    const parent = ovMap[lc] ? lc : (aliasRev && aliasRev[lc]);
                    if (parent && ovMap[parent] && ovMap[parent].oem) {
                        oemVal = ovMap[parent].oem;
                    }
                }
            } catch (e) { /* ignore */ }

            const maintText = (typeof maintName === 'string' && maintName) ? maintName : (d.maintainer && typeof d.maintainer === 'string' ? d.maintainer : 'Unknown');

            const oemColor = getBrandColor(oemVal);
            const oemTextColor = getTextColor(oemColor);
            const oemStyle = oemColor ? ('style="background:' + oemColor + '; color:' + oemTextColor + '; border-color: ' + oemColor + ';"') : '';
            const imageUrl = d.image || `images/devices/${codename}.webp`;

            // NEW: resolve aliases for this card (from entry or global map)
            const aliasList = Array.isArray(d.aliases)
                ? d.aliases.map(x => String(x).toLowerCase())
                : ((window.__aliasMap && window.__aliasMap[codename.toLowerCase()]) || []);
            const aliasesAttr = aliasList.join(' ');

            const card = document.createElement('article');
            card.className = 's12 m6 l4 no-padding surface-container-high';
            card.setAttribute('data-codename', codename.toLowerCase());
            // Preserve original capitalization for OEM on the card
            card.setAttribute('data-oem', (oemVal || '').trim());
            card.setAttribute('data-model', (fullname || '').toLowerCase());
            if (aliasesAttr) card.setAttribute('data-aliases', aliasesAttr);

            // NEW: simple card layout to match requested structure
            card.innerHTML = `
                <img loading="lazy" class="responsive large surface-container-low" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(fullname)}" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'extra-large',textContent:'smartphone'}));">
                <div class="padding">
                    <h5 class="device-title" title="${escapeAttr(fullname)}">
                        <span class="marquee-inner">${escapeHtml(fullname)}</span>
                    </h5>
                    <div class="bottom-margin" style="display:flex;flex-wrap:wrap;gap:8px;margin:0.5rem 0;">
                        <nav class="group connected" style="justify-content:flex-start; flex-wrap: wrap;">
                            <button class="chip fill left-round">
                                <i>today</i>
                                <span>${escapeHtml(latestDisplay)}</span>
                            </button>
                            <!-- NEW: version chip -->
                            <button class="chip fill right-round" title="Version">
                                <i>tag</i>
                                <span>${escapeHtml(versionDisplay)}</span>
                            </button>
                        </nav>
                    </div>
                    <div class="bottom-margin">
                        <nav class="group connected" style="justify-content:flex-start; flex-wrap: wrap;">
                            <button class="chip left-round" ${oemStyle}><span>${escapeHtml(oemVal || 'Unknown')}</span></button>
                            <button class="chip fill no-round"><span>${escapeHtml(maintText)}</span></button>
                            <button class="chip fill right-round"><span>${escapeHtml(codename)}</span></button>
                        </nav>
                    </div>
                    <div class="small-margin" style="display:flex; justify-content:flex-end; width:100%;">
                        <button class="border round" onclick="showDeviceDetails('${escapeAttr(codename)}')">
                            <i>info</i>
                            <span>Details</span>
                        </button>
                    </div>
                </div>
            `;
            frag.appendChild(card);
        });

        grid.appendChild(frag);

        // Single marquee initializer (deduplicated)
        initMarquee(grid);

        // NEW: equalize heights after render and image load
        const scheduleEqualize = () => {
            // Use rAF to let layout settle
            requestAnimationFrame(() => equalizeDeviceCardHeights(grid));
        };
        scheduleEqualize();

        const imgs = grid.querySelectorAll('img');
        if (imgs.length) {
            let pending = imgs.length;
            const done = (() => {
                let called = false;
                return () => {
                    if (called) return;
                    called = true;
                    scheduleEqualize();
                };
            })();
            imgs.forEach(img => {
                const once = () => { pending--; if (pending <= 0) done(); };
                img.addEventListener('load', once, { once: true });
                img.addEventListener('error', once, { once: true });
                // If already complete from cache
                if (img.complete) once();
            });
        }

        // Bind a global resize equalizer once
        if (!window.__cardResizeBound) {
            window.__cardResizeBound = true;
            let t = 0;
            window.addEventListener('resize', () => {
                if (t) cancelAnimationFrame(t);
                t = requestAnimationFrame(() => {
                    document.querySelectorAll('.device-title').forEach(t => {
                        t.dataset.marqueeInit = '';
                        t.classList.remove('has-marquee'); // clear fade until recalculated
                        const inn = t.querySelector('.marquee-inner');
                        if (inn) inn.style.animation = 'none';
                    });
                    document.querySelectorAll('.grid.responsive').forEach(g => initMarquee(g));
                });
            }, { passive: true });
        }

        if (limit && limit > 0) {
            const moreWrap = document.createElement('div');
            moreWrap.className = 'center-align';
            moreWrap.innerHTML = `
                <button onclick="navigateTo('/devices'); return false;" class="round large-margin">
                    <i>devices</i>
                    <span>View all devices</span>
                </button>
            `;
            container.appendChild(moreWrap);
        }

        // If full list (limit==0) ensure search initialized
        if (!limit || limit === 0) {
            if (typeof setupDeviceSearch === 'function') setupDeviceSearch();
            if (typeof buildOemFilterChips === 'function') buildOemFilterChips();
        }
    }

    // If preloaded aggregated data exists, use it immediately
    try {
        // Prefer overrides DB produced locally: data/device_db.json
        const dbResp = await fetch('data/device_db.json', { cache: 'no-cache' }).catch(() => null);
        if (dbResp && dbResp.ok) {
            const db = await dbResp.json();
            const overrides = (db && db.overrides) ? db.overrides : {};

            // NEW: collect hidden codenames (support both "hide" and "hidden")
            const hiddenLower = new Set(
                Object.entries(overrides)
                    .filter(([, ov]) => ov && (ov.hide === true || ov.hidden === true))
                    .map(([k]) => k.toLowerCase())
            );

            // NEW: expose alias maps globally for search and rendering (skip hidden)
            const aliasMap = {};
            Object.keys(overrides).forEach(k => {
                if (hiddenLower.has(k.toLowerCase())) return; // skip hidden
                const arr = Array.isArray(overrides[k].aliases) ? overrides[k].aliases : [];
                if (arr.length) aliasMap[k.toLowerCase()] = arr.map(a => String(a).toLowerCase());
            });
            window.__aliasMap = aliasMap;
            window.__aliasReverse = {};
            Object.entries(aliasMap).forEach(([parent, arr]) => arr.forEach(a => window.__aliasReverse[a] = parent));

            // NEW: also expose full overrides globally (lowercased keys, skip hidden)
            window.__overrides = {};
            Object.keys(overrides).forEach(k => {
                if (!hiddenLower.has(k.toLowerCase())) window.__overrides[k.toLowerCase()] = overrides[k];
            });

            // NEW: build alias set so alias codenames are not rendered as separate cards (skip hidden)
            const keys = Object.keys(overrides);
            const aliasSet = new Set();
            keys.forEach(k => {
                if (hiddenLower.has(k.toLowerCase())) return; // skip hidden
                const ov = overrides[k] || {};
                if (Array.isArray(ov.aliases)) {
                    ov.aliases.forEach(a => aliasSet.add(String(a).toLowerCase()));
                }
            });

            // Attempt to load the richer devices.json to preserve download/variant details
            let devicesList = [];
            try {
                const localResp = await fetch('data/devices.json', { cache: 'no-cache' });
                if (localResp && localResp.ok) devicesList = await localResp.json();
            } catch (e) {
                // ignore, we'll create minimal entries from overrides
            }

            // Only create entries for parent keys (skip aliases and hidden)
            const parentKeys = keys.filter(k => {
                const lc = k.toLowerCase();
                return !aliasSet.has(lc) && !hiddenLower.has(lc);
            });

            const entries = parentKeys.map(key => {
                const ov = overrides[key] || {};
                const lower = key.toLowerCase();
                const found = (devicesList || []).find(it => ((it.name || '').replace(/\.json$/i, '').toLowerCase() === lower));
                if (found) {
                    // Use the upstream response but apply override fields to the first response object
                    const respArr = (found.data && Array.isArray(found.data.response)) ? found.data.response.slice() : (found.data ? [found.data] : []);
                    const base = respArr[0] || {};
                    const merged = Object.assign({}, base, {
                        codename: ov.codename || base.codename || key,
                        device: ov.model || base.device || base.model || base.device,
                        model: ov.model || base.model || base.device || '',
                        // NEW: ensure OEM override is applied
                        oem: ov.oem || base.oem || base.vendor || base.brand || '',
                        maintainer: ov.maintainer || base.maintainer || base.maintainer,
                        image: ov.image || base.image || (ov.codename ? `images/devices/${ov.codename}.webp` : `images/devices/${key}.webp`),
                        // NEW: carry aliases into the entry so the card can expose them
                        aliases: Array.isArray(ov.aliases) ? ov.aliases : (Array.isArray(base.aliases) ? base.aliases : [])
                    });
                    respArr[0] = merged;
                    return { ok: true, name: found.name || (key + '.json'), data: { response: respArr }, rawUrl: found.rawUrl || found.rawUrl };
                }
                // Minimal synthesized entry from override
                const minimal = {
                    maintainer: ov.maintainer || '',
                    oem: ov.oem || '',
                    device: ov.model || '',
                    codename: ov.codename || key,
                    image: ov.image || `images/devices/${key}.webp`,
                    // NEW: include aliases on synthesized entries too
                    aliases: Array.isArray(ov.aliases) ? ov.aliases : []
                };
                return { ok: true, name: key + '.json', data: { response: [minimal] } };
            });

            // Sort and render
            entries.sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a));
            const toRender = (limit && limit > 0) ? entries.slice(0, limit) : entries;
            renderDevices(toRender);
            return;
        }
    } catch (e) {
        console.info('device_db.json not usable, falling back to other sources', e);
    }
    
    // Fallback: use any preloaded aggregated data if present
    try {
        if (window.__preloadedData && Array.isArray(window.__preloadedData)) {
            const list = window.__preloadedData;
            const valid = list.filter(Boolean);
            // sort by best-known updated time desc
            valid.sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a));
            const toRender = (limit && limit > 0) ? valid.slice(0, limit) : valid;
            renderDevices(toRender);
            return;
        }
    } catch (e) {
        // fall through to fetch-based loading
        console.info('preloadedData not usable, falling back to fetch', e);
    }

    // Try local cached file first (produced by GitHub Actions)
    try {
        const localResp = await fetch('data/devices.json', { cache: 'no-cache' });
        if (localResp.ok) {
            const list = await localResp.json();
            // Expecting array of { name, data, rawUrl, lastModified }
            const valid = (Array.isArray(list) ? list : []).filter(Boolean);
            // sort by best-known updated time desc
            valid.sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a));
            const toRender = (limit && limit > 0) ? valid.slice(0, limit) : valid;

            renderDevices(toRender);
            return;
        }
    } catch (e) {
        console.info('Local devices cache not available or invalid, falling back to remote fetch', e);
    }

    // Try remote GitHub API listing and fall back to raw fetching if necessary
    try {
        const apiUrl = 'https://api.github.com/repos/AlphaDroid-devices/OTA/contents/';
        const listResp = await fetch(apiUrl);
        if (!listResp.ok) throw new Error(`Failed to list repo contents: ${listResp.status}`);

        const items = await listResp.json();
        const jsonItems = items.filter(i => i.type === 'file' && i.name.toLowerCase().endsWith('.json'));

        if (jsonItems.length === 0) {
            container.innerHTML = '<div class="center-align"><h5>No device definitions found</h5></div>';
            return;
        }

        const results = [];
        const concurrency = 6;
        for (let i = 0; i < jsonItems.length; i += concurrency) {
            const slice = jsonItems.slice(i, i + concurrency);
            const batch = await Promise.all(slice.map(async item => {
                try {
                    const url = item.download_url || item.html_url || item.url;
                    const r = await fetch(url);
                    if (!r.ok) throw new Error(`Failed to fetch ${item.name}`);
                    const data = await r.json();
                    const lastModified = r.headers.get('last-modified') || null;
                    return { ok: true, name: item.name, data, rawUrl: url, lastModified };
                } catch (e) {
                    console.warn('Failed to fetch device file', item.name, e);
                    return { ok: false, name: item.name, error: e };
                }
            }));
            results.push(...batch);
        }

        const valid = results.filter(r => r.ok);
        // Sort by best-known updated time desc
        valid.sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a));

        const toRender = (limit && limit > 0) ? valid.slice(0, limit) : valid;
        renderDevices(toRender);

    } catch (err) {
        console.error('loadDevices error', err);
        container.innerHTML = '<div class="center-align error-text"><h5>Failed to load devices</h5><p>Check console for details</p></div>';
    }
}

// Inject marquee styles once
function ensureMarqueeStyles() {
    if (document.getElementById('marquee-styles')) return;
    const style = document.createElement('style');
    style.id = 'marquee-styles';
    style.textContent = `
        :root { --marquee-gap: 24px; --marquee-fade: 16px; }
        @keyframes scroll-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(var(--marquee-shift, -50%)); }
        }
        /* Constrain title strictly to card width with symmetric padding */
        .device-title {
            display: block;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            padding: 0 4px; /* symmetric left/right */
            overflow: hidden;
            white-space: nowrap;
        }
        /* Apply horizontal fade only when marquee is active */
        .device-title.has-marquee {
            position: relative;
            -webkit-mask-image: linear-gradient(
                to right,
                transparent,
                #000 var(--marquee-fade),
                #000 calc(100% - var(--marquee-fade)),
                transparent
            );
            mask-image: linear-gradient(
                to right,
                transparent,
                #000 var(--marquee-fade),
                #000 calc(100% - var(--marquee-fade)),
                transparent
            );
            -webkit-mask-size: 100% 100%;
            mask-size: 100% 100%;
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
        }
        .device-title .marquee-inner {
            display: inline-flex; /* track with two copies for seamless loop */
            will-change: transform;
            gap: var(--marquee-gap); /* JS reads this value */
        }
        .device-title .marquee-copy {
            flex: 0 0 auto; /* each copy keeps natural width */
        }
        /* Pause when card hovered (CSS-only, efficient) */
        article:hover .marquee-inner { animation-play-state: paused !important; }
        /* Pause when IO marks it (no inline style writes) */
        .marquee-inner.is-paused { animation-play-state: paused; }
    `;
    document.head.appendChild(style);
}

// NEW: inject uniform card styles once
function ensureUniformCardStyles() {
    if (document.getElementById('uniform-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'uniform-card-styles';
    style.textContent = `
        /* Center-align the devices container and grid */
        .devices-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }
        
        .devices-container .grid.responsive {
            justify-content: center;
            max-width: 100%;
        }
        
        /* Normalize card layout for consistent aspect ratio and fill behavior */
        .devices-container article[data-codename] {
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            aspect-ratio: 3 / 5;           /* Card ratio: width:height = 3:5 */
            overflow: hidden;               /* Prevent overflow when content is tall */
        }
        /* Image takes remaining vertical space; fills and crops nicely */
        .devices-container article[data-codename] > img {
            flex: 1 1 auto;
            min-height: 0;
            width: 100%;
            height: auto;                  /* Height driven by flex grow */
            object-fit: cover;
            display: block;
        }
        /* Fallback icon should also fill remaining area if image fails */
        .devices-container article[data-codename] > i.extra-large {
            flex: 1 1 auto;
            min-height: 0;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        /* Content is auto-height; image expands when there's room */
        .devices-container article[data-codename] > .padding {
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
        }
        /* Keep last row aligned to the bottom within content block when applicable */
        .devices-container article[data-codename] > .padding .small-margin:last-child {
            margin-top: auto;
        }
    `;
    document.head.appendChild(style);
}

// Efficient marquee initializer
function initMarquee(grid) {
    if (!grid) return;
    ensureMarqueeStyles();

    const titles = grid.querySelectorAll('.device-title');
    titles.forEach(t => {
        const inner = t.querySelector('.marquee-inner');
        if (!inner) return;

        // Preserve original text once
        const original = t.dataset.title || inner.textContent || '';
        t.dataset.title = original;

        // Reset to a simple text node for measurement
        inner.style.removeProperty('animation');
        inner.style.removeProperty('--marquee-shift');
        inner.textContent = original;

        const containerWidth = Math.round(t.clientWidth || 0);
        const textWidth = Math.ceil(inner.scrollWidth || 0);
        const prevCW = Number(t.dataset.cw || 0);
        const prevTW = Number(t.dataset.tw || 0);

        // Not overflowing -> no marquee and no fade
        if (textWidth <= containerWidth + 1) {
            t.classList.remove('has-marquee');
            t.dataset.cw = containerWidth;
            t.dataset.tw = textWidth;
            return;
        }

        // Rebuild only if dimensions changed or not initialized
        if (!(t.dataset.marqueeInit === '1' && prevCW === containerWidth && prevTW === textWidth)) {
            inner.innerHTML = '';
            const c1 = document.createElement('span');
            c1.className = 'marquee-copy';
            c1.textContent = original;
            const c2 = document.createElement('span');
            c2.className = 'marquee-copy';
            c2.textContent = original;
            inner.append(c1, c2);

            const cs = getComputedStyle(inner);
            const gap = parseFloat(cs.gap) || 24;
            const copyWidth = Math.ceil(c1.getBoundingClientRect().width || 0);
            const shift = copyWidth + gap;

            inner.style.setProperty('--marquee-shift', `-${shift}px`);
            const speed = 40; // px/s
            const duration = Math.max(6, shift / speed);
            inner.style.animation = `scroll-marquee ${duration}s linear infinite 800ms`;

            t.dataset.cw = containerWidth;
            t.dataset.tw = textWidth;
            t.dataset.marqueeInit = '1';
        }

        // Ensure fade is active when marquee is active
        t.classList.add('has-marquee');

        // Visibility-based pause/resume
        if (!window.__marqueeIO) {
            window.__marqueeIO = new IntersectionObserver(entries => {
                entries.forEach(({ isIntersecting, target }) => {
                    const inn = target.querySelector('.marquee-inner');
                    if (!inn) return;
                    // Toggle class instead of inline style so hover CSS can pause efficiently
                    inn.classList.toggle('is-paused', !isIntersecting);
                });
            }, { root: null, threshold: 0 });
        }
        window.__marqueeIO.observe(t);
    });

    // Removed JS hover delegation (CSS handles hover pause)
    // Removed global resize handler remains as-is
    if (!window.__marqueeResizeBound) {
        window.__marqueeResizeBound = true;
        let raf = 0;
        window.addEventListener('resize', () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                document.querySelectorAll('.device-title').forEach(t => {
                    t.dataset.marqueeInit = '';
                    t.classList.remove('has-marquee'); // clear fade until recalculated
                    const inn = t.querySelector('.marquee-inner');
                    if (inn) inn.style.animation = 'none';
                });
                document.querySelectorAll('.grid.responsive').forEach(g => initMarquee(g));
            });
        }, { passive: true });
    }
}

// Add overlay and dialog elements
const overlayDiv = document.createElement('div');
overlayDiv.className = 'overlay blur modal-overlay';
// Ensure overlay covers the viewport and sits behind the dialog
overlayDiv.style.position = 'fixed';
overlayDiv.style.top = '0';
overlayDiv.style.left = '0';
overlayDiv.style.width = '100%';
overlayDiv.style.height = '100%';
overlayDiv.style.background = 'rgba(0,0,0,0.45)';
overlayDiv.style.backdropFilter = 'blur(4px)';
// Start hidden using opacity/visibility so CSS transitions can work
overlayDiv.style.display = 'none';
overlayDiv.style.opacity = '0';
overlayDiv.style.visibility = 'hidden';
// ensure overlay receives pointer events so clicks can close the dialog
overlayDiv.style.pointerEvents = 'auto';
// Use a high z-index so overlay appears above page content but below the dialog
overlayDiv.style.zIndex = '100000';
// Add a short transition so opacity/visibility animate when shown/hidden
overlayDiv.style.transition = 'opacity 220ms ease, visibility 220ms ease';
document.body.appendChild(overlayDiv);

// Utility functions to show/hide the overlay with a smooth transition
function showOverlay() {
    // Ensure display is set so element participates in layout
    overlayDiv.style.display = 'block';
    // Force layout to ensure transition will run
    // eslint-disable-next-line no-unused-expressions
    overlayDiv.getBoundingClientRect();
    overlayDiv.style.opacity = '1';
    overlayDiv.style.visibility = 'visible';
}
function hideOverlay() {
    // Start the fade-out
    overlayDiv.style.opacity = '0';
    overlayDiv.style.visibility = 'hidden';
    // After transition ends, remove from layout to avoid blocking interactable elements
    const cleanup = () => {
        overlayDiv.style.display = 'none';
        overlayDiv.removeEventListener('transitionend', cleanup);
    };
    overlayDiv.addEventListener('transitionend', cleanup);
}

// Create reusable modal elements
const deviceDialog = document.createElement('dialog');
deviceDialog.className = 'modal';
deviceDialog.style.maxWidth = '90%';
deviceDialog.style.width = '400px';
deviceDialog.style.border = 'none';
deviceDialog.style.borderRadius = '8px';
deviceDialog.style.overflow = 'hidden';
deviceDialog.style.zIndex = '100001'; // Above the overlay
document.body.appendChild(deviceDialog);

// Show device details in a modal dialog
async function showDeviceDetails(codename) {
    try {
        // NEW: resolve unified parent + aliases via device_db.json
        let rootCode = codename;
        let unifiedAliases = [];
        try {
            const dbResp0 = await fetch('data/device_db.json', { cache: 'no-cache' }).catch(() => null);
            if (dbResp0 && dbResp0.ok) {
                const db0 = await dbResp0.json();
                const ovAll = (db0 && db0.overrides) || {};
                const keyLC = (codename || '').toLowerCase();
                if (ovAll[keyLC] && Array.isArray(ovAll[keyLC].aliases) && ovAll[keyLC].aliases.length) {
                    // current codename is parent; keep aliases
                    unifiedAliases = ovAll[keyLC].aliases.slice();
                    // ensure rootCode keeps original case of the parent key if present
                    const parentExact = Object.keys(ovAll).find(k => k.toLowerCase() === keyLC);
                    if (parentExact) rootCode = parentExact;
                } else {
                    // find which parent includes this codename as an alias
                    const parent = Object.keys(ovAll).find(k => {
                        const arr = ovAll[k] && Array.isArray(ovAll[k].aliases) ? ovAll[k].aliases : [];
                        return arr.map(a => String(a).toLowerCase()).includes(keyLC);
                    });
                    if (parent) {
                        rootCode = parent;
                        unifiedAliases = (ovAll[parent].aliases || []).slice();
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // Fetch device data (prefer local cache) using parent/rootCode
        let deviceData = null;
        try {
            const localResp = await fetch('data/devices.json');
            if (localResp && localResp.ok) {
                const list = await localResp.json();
                deviceData = list.find(item => {
                    if (!item) return false;
                    const responses = (item.data && Array.isArray(item.data.response)) ? item.data.response : (item.data ? [item.data] : []);
                    if ((item.name || '').replace(/\.json$/i, '').toLowerCase() === String(rootCode).toLowerCase()) return true;
                    return responses.some(d => {
                        if (!d) return false;
                        const candidates = [d.codename, d.device, d.id, item.name];
                        return candidates.some(c => (c || '').toString().toLowerCase() === String(rootCode).toLowerCase());
                    });
                });
            }
        } catch (e) { /* ignore and fallback */ }

        if (!deviceData) {
            const response = await fetch(`https://raw.githubusercontent.com/AlphaDroid-devices/OTA/master/${rootCode}.json`);
            if (!response.ok) throw new Error('Device info not found');
            const rawData = await response.json();
            deviceData = { data: rawData, rawUrl: `https://raw.githubusercontent.com/AlphaDroid-devices/OTA/master/${rootCode}.json` };
        }

        // Normalize
        let d = null;
        if (deviceData && deviceData.data) {
            if (Array.isArray(deviceData.data.response) && deviceData.data.response.length > 0) {
                d = deviceData.data.response.find(item => ((item.codename || item.device || '') + '').toLowerCase() === String(rootCode).toLowerCase()) || deviceData.data.response[0];
            } else {
                d = deviceData.data;
            }
        } else {
            d = deviceData;
        }

        // Apply overrides if available (use parent/rootCode)
        try {
            const dbResp = await fetch('data/device_db.json', { cache: 'no-cache' }).catch(() => null);
            if (dbResp && dbResp.ok) {
                const db = await dbResp.json();
                const ov = (db && db.overrides) ? db.overrides[String(rootCode).toLowerCase()] : null;
                if (ov) {
                    d = d || {};
                    d.codename = ov.codename || d.codename || rootCode;
                    d.oem = ov.oem || d.oem;
                    d.model = ov.model || d.model || d.device || '';
                    d.device = ov.model || d.device || d.model || '';
                    if (ov.maintainer) d.maintainer = ov.maintainer;
                    if (ov.image) d.image = ov.image; else if (!d.image) d.image = `images/devices/${d.codename || rootCode}.webp`;
                }
            }
        } catch (e) { /* ignore */ }

        const displayName = escapeHtml(d.name || d.model || rootCode);
        const deviceCodename = escapeHtml(d.codename || d.device || rootCode);
        const modalImageUrl = d.image || `images/devices/${(d.codename || rootCode)}.webp`;

        // Variants
        const variants = (deviceData && deviceData.data && Array.isArray(deviceData.data.response) && deviceData.data.response.length > 0)
            ? deviceData.data.response
            : [d];

        // Helpers
        function formatBytes(bytes) {
            if (bytes == null || bytes === '') return 'Unknown';
            const n = Number(bytes);
            if (Number.isNaN(n)) return String(bytes);
            if (n === 0) return '0 B';
            const units = ['B','KB','MB','GB','TB'];
            let i = 0;
            let val = n;
            while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
            const fixed = (val < 10 && i > 0) ? val.toFixed(1) : Math.round(val);
            return `${fixed} ${units[i]}`;
        }

        function buildLinkButtons(entry) {
            if (!entry) return '';

            const groups = [
                { name: 'Source', items: [['Device tree', entry.dt], ['Kernel', entry.kernel]] },
                { name: 'Support', items: [['Forum', entry.forum], ['Telegram', entry.telegram], ['Paypal', entry.paypal]] },
                { name: 'More', items: [['Recovery', entry.recovery], ['Firmware', entry.firmware], ['Vendor', entry.vendor]] }
            ];

            // keep only groups that have at least one URL
            const present = groups.map(g => ({ name: g.name, items: g.items.filter(([lbl, url]) => url) })).filter(g => g.items.length);
            if (!present.length) return '';

            const buttons = present.map((g, idx) => {
                let cls = 'no-round';
                if (idx === 0) cls = 'left-round';
                else if (idx === present.length - 1) cls = 'right-round';

                const menuItems = g.items.map(([label, url]) => `
                    <li><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></li>
                `).join('');

                return `
                    <button class="${cls}">
                        <span>${escapeHtml(g.name)}</span>
                        <i>arrow_drop_up</i>
                        <menu class="top">
                            ${menuItems}
                        </menu>
                    </button>
                `;
            }).join('');

            return `<nav class="group connected">${buttons}</nav>`;
        }

        function buildVariantsListHtml(list) {
            if (!list || !list.length) return '';
            const buttons = list.map((v, i) => {
                const label = escapeHtml(v.buildvariant || v.buildtype || v.filename || v.version || `Variant ${i+1}`);
                let cls = 'no-round small';
                if (i === 0) cls = 'left-round small';
                else if (i === list.length - 1) cls = 'right-round small';
                return `<button class="${cls}" data-variant-index="${i}">${label}</button>`;
            }).join('');
            return `<nav class="group connected">${buttons}</nav>`;
        }

        // NEW: build unified codenames section (parent first)
        const allCodes = [String(rootCode)].concat(
            (unifiedAliases || []).filter(a => String(a).toLowerCase() !== String(rootCode).toLowerCase())
        );
        let codeTabsHtml = '';
        if (allCodes.length > 1) {
            const btns = allCodes.map((c, i, arr) => {
                let cls = 'chip small ' + (i === 0 ? 'left-round' : (i === arr.length - 1 ? 'right-round' : 'no-round'));
                return `<button class="${cls}" disabled><span>${escapeHtml(c)}</span></button>`;
            }).join('');
            codeTabsHtml = `
                <div class="s12">
                    <div class="row">
                        <i>merge</i>
                        <div class="max">
                            <div class="bold">Unified codenames</div>
                            <div>
                                <nav class="group connected" id="codename-tabs" style="display:flex; flex-wrap:wrap; gap:6px; white-space:normal;">
                                    ${btns}
                                </nav>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render modal
        deviceDialog.innerHTML = `
            <h5>${displayName}</h5>
            <div class="grid">
                <div class="s12 m6">
                    <div class="row middle-align">
                        <i>smartphone</i>
                        <div class="max">
                            <div class="bold">Codename</div>
                            <div>${deviceCodename}</div>
                        </div>
                    </div>

                    <div class="row middle-align">
                        <i>info</i>
                        <div class="max">
                            <div class="bold">Model</div>
                            <div>${escapeHtml(d.model || d.device || 'N/A')}</div>
                        </div>
                    </div>

                    <div class="row middle-align">
                        <i>update</i>
                        <div class="max">
                            <div class="bold">Latest</div>
                            <div id="device-latest">${escapeHtml(d.timestamp ? (new Date(Number(d.timestamp) * 1000).toISOString().split('T')[0]) : (d.version || 'Unknown'))}</div>
                        </div>
                    </div>
                </div>

                <div class="s12 m6">
                    <div class="row middle-align">
                        <i>tag</i>
                        <div class="max">
                            <div class="bold">Version</div>
                            <div id="device-version">${escapeHtml(d.version || (d.filename ? (d.filename.match(/v[\d.]+/) || [''])[0] : 'Unknown'))}</div>
                        </div>
                    </div>

                    <div class="row middle-align">
                        <i>storage</i>
                        <div class="max">
                            <div class="bold">Size</div>
                            <div id="device-size">${escapeHtml(formatBytes(d.size || d.filesize || d.size_bytes || ''))}</div>
                        </div>
                    </div>

                    <div class="row middle-align">
                        <i>person</i>
                        <div class="max">
                            <div class="bold">Maintainer</div>
                            <div>${(d.maintainer && typeof d.maintainer === 'object' && d.maintainer.url) ? `<a href="${escapeAttr(d.maintainer.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.maintainer.name || d.maintainer.url)}</a>` : escapeHtml((typeof d.maintainer === 'string' && d.maintainer) || (d.maintainer && (d.maintainer.name || d.maintainer.url)) || 'Unknown')}</div>
                        </div>
                    </div>
                </div>

                ${codeTabsHtml}

                <div class="s12">
                    <div class="row">
                        <i>tag</i>
                        <div class="max">
                            <div class="bold">Build Variants</div>
                            <div id="build-variants">
                                ${buildVariantsListHtml(variants)}
                            </div>
                        </div>
                    </div>

                </div>
                <div class="s12">
                    <div class="row center-align">
                        <div id="device-links-wrapper">
                            ${buildLinkButtons(variants[0] || d)}
                        </div>
                    </div>
                </div>
                <div class="s12">
                    <nav class="row right-align no-space">
                        <button class="transparent link" onclick="this.closest('dialog').close(); hideOverlay()">Close</button>
                        <button id="device-download" class="transparent link">Download</button>
                    </nav>
                </div>
            </div>
        `;

        // Variant interactions
        (function() {
            const entries = variants;
            const getListButtons = () => deviceDialog.querySelectorAll('#build-variants [data-variant-index]');
            let selectedIndex = 0;

            function getEntryForIndex(idx) {
                return entries[idx] || entries[0] || d;
            }

            function updateVariantDisplay() {
                const entry = getEntryForIndex(selectedIndex);
                const btn = deviceDialog.querySelector('#device-download');
                const url = entry.download || entry.url || entry.file || entry.filename || deviceData.rawUrl || `https://sourceforge.net/projects/alphadroid-project/files/${rootCode}`;
                if (btn) btn.onclick = () => window.open(url, '_blank');

                if (btn) {
                    const sizeLabel = formatBytes(entry.size || entry.filesize || entry.size_bytes || d.size || '');
                    btn.textContent = `Download (${sizeLabel})`;
                }

                const versionEl = deviceDialog.querySelector('#device-version');
                const latestEl = deviceDialog.querySelector('#device-latest');
                const sizeEl = deviceDialog.querySelector('#device-size');
                if (versionEl) versionEl.textContent = entry.version || entry.filename || entry.buildvariant || entry.buildtype || (d && d.version) || 'Unknown';
                if (latestEl) latestEl.textContent = entry.timestamp ? new Date(Number(entry.timestamp) * 1000).toISOString().split('T')[0] : (entry.version || 'Unknown');
                if (sizeEl) sizeEl.textContent = formatBytes(entry.size || entry.filesize || entry.size_bytes || d.size || '');

                const linksWrapper = deviceDialog.querySelector('#device-links-wrapper');
                if (linksWrapper) linksWrapper.innerHTML = buildLinkButtons(entry);

                const chips = getListButtons();
                if (chips && chips.length) {
                    chips.forEach(c => c.classList.remove('active'));
                    const active = deviceDialog.querySelector(`#build-variants [data-variant-index='${selectedIndex}']`);
                    if (active) active.classList.add('active');
                }
            }

            const listBtns = getListButtons();
            if (listBtns && listBtns.length) {
                listBtns.forEach((b) => {
                    const idx = Number(b.getAttribute('data-variant-index'));
                    b.addEventListener('click', () => {
                        selectedIndex = idx;
                        updateVariantDisplay();
                    });
                });
                updateVariantDisplay();
            } else {
                selectedIndex = 0;
                updateVariantDisplay();
            }
        })();

        // show modal
        showOverlay();
        if (typeof deviceDialog.show === 'function') deviceDialog.show();
        else if (typeof deviceDialog.showModal === 'function') deviceDialog.showModal();
    } catch (error) {
        console.error('Error showing device details:', error);
        const snackbar = document.createElement('div');
        snackbar.className = 'snackbar';
        snackbar.innerHTML = `
            <div>Failed to load device details</div>
            <button class="transparent circle" onclick="this.parentElement.remove()">
                <i>close</i>
            </button>
        `;
        document.body.appendChild(snackbar);
        setTimeout(() => snackbar.remove(), 3000);
    }
}

// Small helpers to avoid injecting poorly-escaped values
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

// Search setup
function setupDeviceSearch() {
    const input = document.getElementById('device-search-input');
    const suggestMenu = document.getElementById('device-search-suggestions'); // retained but unused (suggestions removed)
    if (suggestMenu) suggestMenu.style.display = 'none';
    if (!input) return;

    // Prevent multiple bindings on re-render
    if (input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    const container = document.querySelector('.devices-container');
    if (!container) return;

    function getCards() {
        return Array.from(container.querySelectorAll('article[data-codename]'));
    }

    function activeOemFilter() {
        const active = document.querySelector('#oem-filter-chips button.primary[data-oem]');
        return active ? (active.getAttribute('data-oem') || '').toLowerCase() : '';
    }

    function runFilter(raw) {
        const oemFilter = activeOemFilter();
        const val = (raw || '').trim().toLowerCase();
        const tokens = val.split(/\s+/).filter(Boolean);
        const cards = getCards();
        if (!tokens.length && !oemFilter) {
            cards.forEach(c => c.style.display = '');
            return;
        }
        cards.forEach(c => {
            const codename = c.getAttribute('data-codename') || '';
            // Compare OEMs case-insensitively while preserving caps elsewhere
            const oem = (c.getAttribute('data-oem') || '').toLowerCase();
            const model = c.getAttribute('data-model') || '';
            const aliases = c.getAttribute('data-aliases') || '';
            if (oemFilter && oem !== oemFilter) {
                c.style.display = 'none';
                return;
            }
            const hay = (codename + ' ' + oem + ' ' + model + ' ' + aliases).toLowerCase();
            const match = tokens.every(t => hay.includes(t));
            c.style.display = match ? '' : (tokens.length ? 'none' : '');
        });
    }

    let debounceTimer = null;
    function schedule() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runFilter(input.value), 1000);
    }

    window.applyDeviceSearch = () => runFilter(input.value || '');
    input.addEventListener('input', schedule, { passive: true });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (debounceTimer) clearTimeout(debounceTimer);
            runFilter(input.value);
        } else if (e.key === 'Escape') {
            input.value = '';
            if (debounceTimer) clearTimeout(debounceTimer);
            runFilter('');
        }
    });

    window.__runDeviceSearchFilter = () => runFilter(input.value || '');
}

function buildOemFilterChips() {
    const wrap = document.getElementById('oem-filter-chips');
    if (!wrap) return;
    const cards = Array.from(document.querySelectorAll('.devices-container article[data-oem]'));

    // De-duplicate case-insensitively but keep original capitalization (first seen)
    const oemMap = new Map();
    cards.forEach(c => {
        const raw = (c.getAttribute('data-oem') || '').trim();
        if (!raw) return;
        const key = raw.toLowerCase();
        if (!oemMap.has(key)) oemMap.set(key, raw);
    });
    const oems = Array.from(oemMap.values()).sort((a, b) => a.localeCompare(b));

    if (!oems.length) { wrap.innerHTML=''; return; }
    wrap.innerHTML = '';

    const nav = document.createElement('nav');
    nav.className = 'group connected';
    nav.style.display = 'flex';
    nav.style.flexWrap = 'wrap';
    nav.style.gap = '2px';
    wrap.appendChild(nav);

    function applyRoundClass(btn, i, total) {
        btn.classList.remove('left-round','right-round','no-round');
        if (i === 0) {
            btn.classList.add('left-round');
        } else if (i === total - 1) {
            btn.classList.add('right-round');
        } else {
            btn.classList.add('no-round');
        }
    }

    function rebuildRoundClasses() {
        const list = Array.from(nav.querySelectorAll('button'));
        list.forEach((b, i) => applyRoundClass(b, i, list.length));
    }

    function makeButton(label, dataOEM) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'small border';
        // Keep original caps in data-oem for display; comparisons are lowercased elsewhere
        if (dataOEM) btn.setAttribute('data-oem', dataOEM); else btn.setAttribute('data-all', '');
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('primary');
            const allButtons = nav.querySelectorAll('button');
            allButtons.forEach(b => { b.classList.remove('fill','primary'); if (!b.hasAttribute('data-all')) b.classList.add('border'); });
            if (btn.hasAttribute('data-all')) {
                if (!isActive) { btn.classList.remove('border'); btn.classList.add('fill','primary'); }
                else { btn.classList.add('fill','primary'); btn.classList.remove('border'); }
            } else {
                if (!isActive) {
                    btn.classList.remove('border');
                    btn.classList.add('fill','primary');
                } else {
                    const all = nav.querySelector('button[data-all]');
                    if (all) { all.classList.add('fill','primary'); all.classList.remove('border'); }
                }
            }
            if (window.__runDeviceSearchFilter) window.__runDeviceSearchFilter();
        });
        return btn;
    }

    // All button first
    const allBtn = makeButton('All', null);
    allBtn.classList.remove('border');
    allBtn.classList.add('fill','primary');
    nav.appendChild(allBtn);

    // OEM buttons with original capitalization
    oems.forEach(o => nav.appendChild(makeButton(o, o)));

    rebuildRoundClasses();
}

// BeerCSS footer builder
function buildSiteFooter() {
    if (document.getElementById('site-footer')) return; // already added
    const footer = document.createElement('footer');
    footer.id = 'site-footer';
    footer.className = 'medium-padding';
    footer.innerHTML = `
        <div class="container">
            <div class="grid small-space">
                <div class="s12 m6 l4">
                    <h5 class="no-margin">AlphaDroid ROM</h5>
                    <p class="small-text">The next-generation Android experience with Material You design, performance optimizations and extensive customization.</p>
                    <nav class="chips" style="gap:6px;">
                        <a class="chip small" target="_blank" href="https://t.me/alphadroid_chat"><i>forum</i><span>Chat</span></a>
                        <a class="chip small" target="_blank" href="https://t.me/alphadroid_releases"><i>cloud_download</i><span>Releases</span></a>
                        <a class="chip small" target="_blank" href="https://github.com/alphadroid-project"><i>code</i><span>GitHub</span></a>
                    </nav>
                </div>
                <div class="s12 m6 l4">
                    <h6 class="small-margin">Resources</h6>
                    <ul class="list no-border no-padding">
                        <li><a target="_blank" href="https://t.me/alphadroid_chat">Installation Guide</a></li>
                        <li><a target="_blank" href="https://t.me/alphadroid_chat">FAQ</a></li>
                        <li><a target="_blank" href="https://t.me/alphadroid_chat">Bug Tracker</a></li>
                    </ul>
                </div>
                <div class="s12 m6 l4">
                    <h6 class="small-margin">Community</h6>
                    <ul class="list no-border no-padding">
                        <li><a target="_blank" href="https://t.me/alphadroid_chat">Telegram Group</a></li>
                        <li><a target="_blank" href="https://t.me/alphadroid_releases">Releases Channel</a></li>
                        <li><a target="_blank" href="https://github.com/alphadroid-project">GitHub Org</a></li>
                        <li><a target="_blank" href="https://sourceforge.net/projects/alphadroid-project/">SourceForge</a></li>
                    </ul>
                </div>
            </div>
            <div class="divider small-margin"></div>
            <div class="row small-text center-align" style="opacity:.75; max-width:70vw;">
                <p style="width: 100%;">&copy; ${new Date().getFullYear()} AlphaDroid Project. Open-source project not affiliated with Google or Android. All trademarks belong to their owners. Site by <a class="link" href="https://t.me/Pacuka" target="_blank" rel="noopener">Pacuka</a>, redesigned by <a class="link" href="https://github.com/naokoshoto" target="_blank" rel="noopener">Naoko Shoto</a>.</p>
            </div>
        </div>`;
    document.body.appendChild(footer);
}

// NEW: equalize all device card heights to the tallest card (skip when aspect-ratio is supported)
function equalizeDeviceCardHeights(root) {
    // If aspect-ratio is supported, let CSS handle uniform heights.
    if (CSS && typeof CSS.supports === 'function' && CSS.supports('aspect-ratio: 3 / 5')) {
        const cards = (root || document).querySelectorAll('article[data-codename]');
        cards.forEach(c => { c.style.height = ''; }); // ensure no fixed heights override aspect-ratio
        return;
    }

    const cards = (root || document).querySelectorAll('article[data-codename]');
    if (!cards.length) return;

    // Reset heights to recompute correctly
    cards.forEach(c => { c.style.height = 'auto'; });

    // Compute tallest
    let maxH = 0;
    cards.forEach(c => {
        const h = c.getBoundingClientRect().height || c.offsetHeight || 0;
        if (h > maxH) maxH = h;
    });
    if (maxH <= 0) return;

    // Apply tallest height
    cards.forEach(c => { c.style.height = `${Math.ceil(maxH)}px`; });
}