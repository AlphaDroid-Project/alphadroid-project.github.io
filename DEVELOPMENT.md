# AlphaDroid ROM Website - Development Documentation

## Overview

This document covers the technical aspects of developing, testing, and maintaining the AlphaDroid ROM website. For general usage and device management, see [DOCUMENTATION.md](DOCUMENTATION.md).

## Table of Contents

1. [Development Setup](#development-setup)
2. [Testing](#testing)
3. [GitHub Actions & Automation](#github-actions--automation)
4. [Performance & Optimization](#performance--optimization)
5. [Configuration System](#configuration-system)
6. [Troubleshooting](#troubleshooting)
7. [Contributing](#contributing)

## Development Setup

### Prerequisites

- Git
- Python 3.x or Node.js (for local server)
- Modern web browser with developer tools

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/alphadroid-project/alphadroid-project.github.io.git
   cd alphadroid-project.github.io
   ```

2. **Serve locally**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Access the site**:
   - Open `http://localhost:8000` in your browser
   - Test device functionality
   - Verify configuration changes

### Development Workflow

1. **Make changes** to source files
2. **Test locally** using the development server
3. **Commit changes** with descriptive messages
4. **Push to repository** to trigger GitHub Actions
5. **Monitor workflows** in the Actions tab

## Testing

### Automated Testing

The project includes comprehensive testing scripts for various components:

```bash
# Test all systems
node scripts/test-update-methods.js

# Test specific components
node scripts/test-update-methods.js api
node scripts/test-update-methods.js commits 60
node scripts/test-update-methods.js files
```

### Test Script Features

- **API Connectivity**: Tests GitHub API access and rate limits
- **File Download**: Verifies device JSON file fetching
- **Data Freshness**: Checks if data is up-to-date
- **Error Handling**: Tests retry logic and fallback mechanisms

### Manual Testing Checklist

#### Device Management
- [ ] Device images load correctly
- [ ] Device information displays properly
- [ ] Search functionality works
- [ ] Device details modal opens
- [ ] Maintainer links work

#### Performance
- [ ] Page loads quickly
- [ ] Images lazy load properly
- [ ] Caching works correctly
- [ ] Service worker functions
- [ ] Mobile responsiveness

#### Configuration
- [ ] Theme changes apply
- [ ] Navigation works
- [ ] Content updates reflect
- [ ] Social links function

### Browser Testing

Test on multiple browsers and devices:
- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **Tablet**: iPad Safari, Android Chrome

## GitHub Actions & Automation

### Workflow Overview

The website uses multiple GitHub Actions workflows for automation:

1. **fetch-devices.yml**: Main device data fetcher (every 12 hours)
2. **poll-ota-updates.yml**: Polling for changes (every 15 minutes)
3. **manual-update.yml**: Manual update controls
4. **health-check.yml**: System health monitoring (every hour)

### Workflow Features

- **Smart Change Detection**: Only updates when JSON files change
- **Retry Logic**: Automatic retries for network errors
- **Rate Limit Handling**: Intelligent backoff for API limits
- **Batch Processing**: Efficient API usage
- **Detailed Logging**: Comprehensive error reporting

### Manual Workflow Triggers

#### Polling Workflow
```yaml
# Manual options:
# - Force update: Bypass change detection
# - Check interval: How far back to look for changes (default: 30 minutes)
```

#### Manual Update Workflow
```yaml
# Update types:
# - full: Update all device files
# - incremental: Only recently changed files
# - force: Force update regardless of changes
# - dry_run: Preview changes without applying
```

#### Health Check Workflow
```yaml
# Check types:
# - full: Complete system health check
# - data_freshness: Check if data is up-to-date
# - api_status: Verify GitHub API connectivity
# - website_status: Check if website files exist
```

### Monitoring Workflows

1. **Check workflow status** in Actions tab
2. **Review logs** for errors or warnings
3. **Monitor success rates** and performance
4. **Use health checks** for system diagnostics

### Workflow Configuration

#### Environment Variables
- `GITHUB_TOKEN`: Automatic GitHub token for API access
- `OTA_WEBHOOK_SECRET`: Webhook secret for enhanced security

#### Rate Limiting
- **API Calls**: Respects GitHub API rate limits
- **Batch Size**: Processes 5 files concurrently (configurable)
- **Retry Logic**: Exponential backoff for failed requests

## Performance & Optimization

### Caching Strategy

#### Service Worker Implementation
```javascript
// Key features:
- Static asset caching
- Dynamic asset caching with patterns
- Background sync for data updates
- Push notification support (ready for future use)
- Offline fallback pages
- Cache versioning and cleanup
```

#### Three-Tier Caching System
1. **Static Cache**: CSS, JS, HTML files
2. **Dynamic Cache**: JSON data, device images
3. **Memory Cache**: Page fragments with TTL

### Performance Monitoring

#### Real-time Metrics Collection
```javascript
// Generate performance report
window.PerformanceMonitor.generateReport()

// Check memory usage
window.PerformanceMonitor.getMemoryUsage()

// Analyze resources
window.PerformanceMonitor.analyzeResources()
```

#### Core Web Vitals Tracking
- **First Contentful Paint (FCP)**: Monitored and optimized
- **Largest Contentful Paint (LCP)**: Tracked for performance insights
- **Cumulative Layout Shift (CLS)**: Minimized through proper sizing
- **First Input Delay (FID)**: Optimized through efficient event handling

### Optimization Features

- **Lazy Loading**: Images load progressively
- **Critical CSS**: Above-the-fold styles inlined
- **Resource Prioritization**: High-priority resources first
- **Debounced Events**: Optimized scroll and resize handling
- **Memory Management**: Intelligent cache management and cleanup

### Performance Budgets

- **Initial Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds
- **Largest Contentful Paint**: < 2.5 seconds
- **Cumulative Layout Shift**: < 0.1

## Configuration System

### Configuration Structure

The `config.json` file contains all configurable elements:

```json
{
  "site": {
    "title": "Website Title",
    "description": "Meta description",
    "favicon": "images/fav.ico",
    "logo": { "path": "images/logo.jpg", "alt": "Logo" }
  },
  "theme": {
    "colors": { /* Light mode colors */ },
    "darkMode": { /* Dark mode colors */ },
    "animation": { /* Animation settings */ }
  },
  "navigation": {
    "routes": { /* Hash routes to page mappings */ },
    "sections": [ /* Section hashes */ ],
    "menu": { /* Desktop and mobile menu items */ }
  },
  "content": {
    "hero": { /* Hero section content */ },
    "features": { /* Features section */ },
    "screenshots": { /* Screenshots carousel */ }
  },
  "api": {
    "github": { /* GitHub API endpoints */ },
    "localData": { /* Local data file paths */ }
  },
  "ui": {
    "deviceLimits": { /* Device display limits */ },
    "cache": { /* Cache configuration */ },
    "animations": { /* Animation timing */ }
  }
}
```

### Configuration API

```javascript
// Check if config is loaded
window.configManager.isLoaded()

// Get specific values
window.configManager.get('site.title', 'Default Title')

// Get entire sections
window.configManager.getNavigation()
window.configManager.getContent()
window.configManager.getApi()
window.configManager.getUi()

// Apply theme configuration
window.configManager.applyTheme()

// Update page metadata
window.configManager.updatePageMetadata()
```

### Event System

```javascript
window.addEventListener('configReady', function(event) {
    const config = event.detail.config;
    // Use configuration values here
});
```

## Troubleshooting

### Common Issues

#### Device not appearing
1. Check `data/device_db.json` overrides
2. Verify image file exists
3. Check GitHub Actions logs
4. Ensure device codename is correct

#### Images not loading
1. Verify file path in `device_db.json`
2. Check image file format and size
3. Clear browser cache
4. Check file permissions

#### Updates not working
1. Run health check workflow
2. Check GitHub API status
3. Verify repository permissions
4. Review workflow logs

#### Performance issues
1. Check Core Web Vitals
2. Monitor memory usage
3. Review caching strategies
4. Optimize images

### Debug Tools

#### Browser Developer Tools
- **Console**: Check for JavaScript errors
- **Network**: Monitor resource loading
- **Performance**: Analyze runtime performance
- **Application**: Inspect service worker and cache

#### GitHub Actions Logs
- **Workflow Runs**: Check success/failure status
- **Step Logs**: Review detailed execution logs
- **Artifacts**: Download generated files

#### Local Testing Scripts
```bash
# Test API connectivity
node scripts/test-update-methods.js api

# Test file downloads
node scripts/test-update-methods.js files

# Test recent commits
node scripts/test-update-methods.js commits 60
```

### Error Handling

#### Network Errors
- Automatic retries with exponential backoff
- Graceful degradation when services unavailable
- Fallback to cached data when possible

#### API Rate Limiting
- Intelligent waiting between requests
- Batch processing to reduce API calls
- Respect for GitHub API limits

#### Data Validation
- JSON schema validation
- Fallback values for missing data
- Error logging for debugging

## Contributing

### Development Guidelines

#### Code Style
- Use consistent indentation (2 spaces)
- Follow JavaScript best practices
- Comment complex logic
- Use descriptive variable names

#### Git Workflow
1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Test thoroughly before pushing
4. Create pull request with clear description

#### Testing Requirements
- Test on multiple browsers
- Verify mobile responsiveness
- Check performance impact
- Validate accessibility

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** with descriptive commits
4. **Test thoroughly** using local development server
5. **Push to fork**: `git push origin feature/amazing-feature`
6. **Create Pull Request** with detailed description

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] Changes are properly tested
- [ ] Documentation updated if needed
- [ ] Performance impact considered
- [ ] Accessibility maintained
- [ ] Mobile compatibility verified

### Issue Reporting

When reporting issues, please include:
- **Browser and version**
- **Operating system**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Console errors (if any)**
- **Screenshots (if applicable)**

## Contributors

- **Website Maintainer**: [Naoko Shoto](https://github.com/naokoshoto)
- **Web Contributor/Initiator**: [Pacuka](https://t.me/Pacuka)

## Support

For development questions or technical assistance:

- **Issues & Questions**: [GitHub Issues](https://github.com/alphadroid-project/alphadroid-project.github.io/issues)
- **Community Chat**: [Telegram Chat](https://t.me/alphadroid_chat)

---

*This development documentation covers the technical aspects of the AlphaDroid ROM website. For general usage and device management, see [DOCUMENTATION.md](DOCUMENTATION.md).*
