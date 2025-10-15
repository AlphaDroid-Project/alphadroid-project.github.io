// Performance monitoring and optimization utilities
(function() {
    'use strict';

    // Performance metrics collection
    const metrics = {
        loadTime: 0,
        domContentLoaded: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0
    };

    // Collect Core Web Vitals and other performance metrics
    function collectMetrics() {
        // Navigation timing
        if (performance.timing) {
            metrics.loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            metrics.domContentLoaded = performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
        }

        // Paint timing
        if (performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach(entry => {
                if (entry.name === 'first-paint') {
                    metrics.firstPaint = entry.startTime;
                } else if (entry.name === 'first-contentful-paint') {
                    metrics.firstContentfulPaint = entry.startTime;
                }
            });
        }

        // Largest Contentful Paint
        if (performance.getEntriesByType) {
            const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
            if (lcpEntries.length > 0) {
                metrics.largestContentfulPaint = lcpEntries[lcpEntries.length - 1].startTime;
            }
        }

        // Cumulative Layout Shift
        if (performance.getEntriesByType) {
            const clsEntries = performance.getEntriesByType('layout-shift');
            metrics.cumulativeLayoutShift = clsEntries.reduce((sum, entry) => {
                return sum + (entry.hadRecentInput ? 0 : entry.value);
            }, 0);
        }

        // First Input Delay
        if (performance.getEntriesByType) {
            const fidEntries = performance.getEntriesByType('first-input');
            if (fidEntries.length > 0) {
                metrics.firstInputDelay = fidEntries[0].processingStart - fidEntries[0].startTime;
            }
        }
    }

    // Memory usage monitoring
    function getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576 * 100) / 100,
                total: Math.round(performance.memory.totalJSHeapSize / 1048576 * 100) / 100,
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576 * 100) / 100
            };
        }
        return null;
    }

    // Resource timing analysis
    function analyzeResources() {
        if (!performance.getEntriesByType) return null;

        const resources = performance.getEntriesByType('resource');
        const analysis = {
            total: resources.length,
            totalSize: 0,
            slowResources: [],
            cacheHits: 0,
            cacheMisses: 0
        };

        resources.forEach(resource => {
            analysis.totalSize += resource.transferSize || 0;
            
            if (resource.duration > 1000) { // Resources taking more than 1 second
                analysis.slowResources.push({
                    name: resource.name,
                    duration: Math.round(resource.duration),
                    size: resource.transferSize || 0
                });
            }

            // Check cache efficiency
            if (resource.transferSize === 0 && resource.decodedBodySize > 0) {
                analysis.cacheHits++;
            } else if (resource.transferSize > 0) {
                analysis.cacheMisses++;
            }
        });

        return analysis;
    }

    // Performance score calculation
    function calculateScore() {
        let score = 100;

        // Deduct points for poor metrics
        if (metrics.firstContentfulPaint > 1800) score -= 20;
        if (metrics.largestContentfulPaint > 2500) score -= 20;
        if (metrics.cumulativeLayoutShift > 0.1) score -= 20;
        if (metrics.firstInputDelay > 100) score -= 20;
        if (metrics.loadTime > 3000) score -= 20;

        return Math.max(0, score);
    }

    // Generate performance report
    function generateReport() {
        collectMetrics();
        const memory = getMemoryUsage();
        const resources = analyzeResources();
        const score = calculateScore();

        return {
            score,
            metrics,
            memory,
            resources,
            timestamp: new Date().toISOString()
        };
    }

    // Log performance report to console (development only)
    function logReport() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const report = generateReport();
            console.group('🚀 Performance Report');
            console.log(`Overall Score: ${report.score}/100`);
            console.log('Core Web Vitals:', report.metrics);
            if (report.memory) console.log('Memory Usage:', report.memory);
            if (report.resources) console.log('Resource Analysis:', report.resources);
            console.groupEnd();
        }
    }

    // Initialize performance monitoring
    function init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'complete') {
            setTimeout(logReport, 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(logReport, 1000);
            });
        }

        // Monitor for performance issues
        let lastMemoryCheck = Date.now();
        setInterval(() => {
            const memory = getMemoryUsage();
            if (memory && memory.used > 100) { // More than 100MB
                console.warn('High memory usage detected:', memory);
            }
        }, 30000); // Check every 30 seconds
    }

    // Expose utilities globally for debugging
    window.PerformanceMonitor = {
        generateReport,
        getMemoryUsage,
        analyzeResources,
        metrics
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
