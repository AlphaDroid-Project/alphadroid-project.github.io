/**
 * Configuration loader and manager for AlphaDroid website
 * Loads configuration from config.json and provides utilities for accessing config values
 */

class ConfigManager {
    constructor() {
        this.config = null;
        this.loadPromise = null;
    }

    /**
     * Load configuration from config.json
     * @returns {Promise<Object>} Configuration object
     */
    async load() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this._fetchConfig();
        this.config = await this.loadPromise;
        return this.config;
    }

    /**
     * Fetch configuration from config.json file
     * @private
     */
    async _fetchConfig() {
        try {
            const response = await fetch('config.json', { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to load configuration:', error);
            // Return default configuration if loading fails
            return this._getDefaultConfig();
        }
    }

    /**
     * Get default configuration as fallback
     * @private
     */
    _getDefaultConfig() {
        return {
            site: {
                title: "AlphaDroid ROM | Next-Generation Android Experience",
                description: "AlphaDroid is a custom ROM based on LineageOS/crDroid, with a new look and some extra features and optimizations.",
                favicon: "images/fav.ico"
            },
            theme: {
                colors: {
                    primary: "#6750A4",
                    surface: "#FEF7FF",
                    onSurface: "#1D1B20"
                }
            },
            navigation: {
                routes: {
                    "#": "pages/home.html",
                    "#home": "pages/home.html",
                    "#features": "pages/home.html",
                    "#screenshots": "pages/home.html",
                    "#devices": "pages/devices.html",
                    "#download": "pages/home.html"
                }
            }
        };
    }

    /**
     * Get configuration value by path (dot notation)
     * @param {string} path - Configuration path (e.g., 'site.title', 'theme.colors.primary')
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value
     */
    get(path, defaultValue = null) {
        if (!this.config) {
            console.warn('Configuration not loaded yet');
            return defaultValue;
        }

        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Check if configuration is loaded
     * @returns {boolean} True if config is loaded
     */
    isLoaded() {
        return this.config !== null;
    }

    /**
     * Apply theme configuration to CSS variables
     */
    applyTheme() {
        if (!this.config?.theme) return;

        const root = document.documentElement;
        const { colors, darkMode, animation } = this.config.theme;

        // Apply light mode colors
        if (colors) {
            Object.entries(colors).forEach(([key, value]) => {
                const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                root.style.setProperty(cssVar, value);
            });
        }

        // Apply dark mode colors
        if (darkMode) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const applyDarkMode = (isDark) => {
                if (isDark) {
                    Object.entries(darkMode).forEach(([key, value]) => {
                        const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                        root.style.setProperty(cssVar, value);
                    });
                } else if (colors) {
                    // Reapply light mode colors
                    Object.entries(colors).forEach(([key, value]) => {
                        const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                        root.style.setProperty(cssVar, value);
                    });
                }
            };

            applyDarkMode(darkModeQuery.matches);
            darkModeQuery.addEventListener('change', applyDarkMode);
        }

        // Apply animation settings
        if (animation) {
            Object.entries(animation).forEach(([key, value]) => {
                const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                root.style.setProperty(cssVar, value);
            });
        }
    }

    /**
     * Update page metadata from configuration
     */
    updatePageMetadata() {
        if (!this.config?.site) return;

        const { title, description, favicon } = this.config.site;

        if (title) {
            document.title = title;
        }

        if (description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = description;
        }

        if (favicon) {
            let faviconEl = document.querySelector('link[rel="shortcut icon"]') || 
                           document.querySelector('link[rel="icon"]');
            if (!faviconEl) {
                faviconEl = document.createElement('link');
                faviconEl.rel = 'shortcut icon';
                faviconEl.type = 'image/x-icon';
                document.head.appendChild(faviconEl);
            }
            faviconEl.href = favicon;
        }
    }

    /**
     * Get navigation configuration
     * @returns {Object} Navigation configuration
     */
    getNavigation() {
        return this.get('navigation', {});
    }

    /**
     * Get content configuration
     * @returns {Object} Content configuration
     */
    getContent() {
        return this.get('content', {});
    }

    /**
     * Get API configuration
     * @returns {Object} API configuration
     */
    getApi() {
        return this.get('api', {});
    }

    /**
     * Get UI configuration
     * @returns {Object} UI configuration
     */
    getUi() {
        return this.get('ui', {});
    }

    /**
     * Get social links configuration
     * @returns {Object} Social links configuration
     */
    getSocial() {
        return this.get('social', {});
    }

    /**
     * Get footer configuration
     * @returns {Object} Footer configuration
     */
    getFooter() {
        return this.get('footer', {});
    }
}

// Create global configuration manager instance
window.configManager = new ConfigManager();

// Initialize configuration when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.configManager.load();
        window.configManager.applyTheme();
        window.configManager.updatePageMetadata();
        
        // Dispatch custom event when config is ready
        window.dispatchEvent(new CustomEvent('configReady', { 
            detail: { config: window.configManager.config } 
        }));
    } catch (error) {
        console.error('Failed to initialize configuration:', error);
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
}
