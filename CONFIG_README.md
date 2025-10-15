# Configuration System

The AlphaDroid website now uses a comprehensive JSON-based configuration system that allows you to customize various aspects of the site without modifying the source code.

## Configuration File

The main configuration is stored in `config.json` at the root of the project. This file contains all configurable elements of the website.

## Configuration Structure

### Site Metadata (`site`)
- `title`: Website title
- `description`: Meta description
- `favicon`: Path to favicon file
- `logo`: Logo configuration with path and alt text

### Theme (`theme`)
- `colors`: Light mode color scheme (CSS custom properties)
- `darkMode`: Dark mode color scheme
- `animation`: Animation settings (speed, border radius, elevations)

### Navigation (`navigation`)
- `routes`: Hash routes to page mappings
- `sections`: Section hashes that don't trigger page reloads
- `menu`: Desktop and mobile menu items
- `fab`: Floating action button configuration

### Content (`content`)
- `hero`: Hero section content (title, subtitle, buttons)
- `features`: Features section with title and feature items
- `screenshots`: Screenshots carousel configuration
- `download`: Download section title
- `devices`: Devices page configuration

### API Configuration (`api`)
- `github`: GitHub API endpoints and repository information
- `localData`: Local data file paths

### UI Settings (`ui`)
- `deviceLimits`: Device display limits for different pages
- `cache`: Cache configuration (size, TTL)
- `animations`: Animation timing settings
- `brandColors`: Brand color mappings for device OEMs

### Social Links (`social`)
- `telegram`: Telegram chat and releases links
- `github`: GitHub organization link
- `sourceforge`: SourceForge project link

### Footer (`footer`)
- `description`: Footer description text
- `links`: Resource and community links
- `copyright`: Copyright text and credits

## Usage

### Loading Configuration

The configuration is automatically loaded when the page loads via `config.js`. The configuration manager provides several utility methods:

```javascript
// Check if config is loaded
window.configManager.isLoaded()

// Get a specific config value
window.configManager.get('site.title', 'Default Title')

// Get entire sections
window.configManager.getNavigation()
window.configManager.getContent()
window.configManager.getApi()
window.configManager.getUi()
window.configManager.getSocial()
window.configManager.getFooter()

// Apply theme configuration
window.configManager.applyTheme()

// Update page metadata
window.configManager.updatePageMetadata()
```

### Event System

The configuration system emits a `configReady` event when the configuration is loaded:

```javascript
window.addEventListener('configReady', function(event) {
    const config = event.detail.config;
    // Use configuration values here
});
```

### Fallback Behavior

If the configuration file fails to load or is missing, the system will:
1. Use hardcoded fallback values
2. Log warnings to the console
3. Continue functioning with default settings

## Customization Examples

### Changing Site Title and Description

```json
{
  "site": {
    "title": "My Custom ROM | Amazing Android Experience",
    "description": "A custom ROM with amazing features and performance."
  }
}
```

### Modifying Theme Colors

```json
{
  "theme": {
    "colors": {
      "primary": "#FF5722",
      "surface": "#FAFAFA",
      "onSurface": "#212121"
    },
    "darkMode": {
      "primary": "#FF8A65",
      "surface": "#121212",
      "onSurface": "#FFFFFF"
    }
  }
}
```

### Adding New Features

```json
{
  "content": {
    "features": {
      "items": [
        {
          "title": "New Feature",
          "description": "Description of the new feature",
          "icon": "new_icon_name"
        }
      ]
    }
  }
}
```

### Updating Social Links

```json
{
  "social": {
    "telegram": {
      "chat": "https://t.me/your_chat",
      "releases": "https://t.me/your_releases"
    },
    "github": "https://github.com/your-org",
    "discord": "https://discord.gg/your-invite"
  }
}
```

## File Structure

```
├── config.json          # Main configuration file
├── config.js            # Configuration loader and manager
├── index.html           # Updated to use configuration
├── route.js             # Updated to use configuration
├── pages/
│   ├── home.html        # Updated to use configuration
│   └── devices.html     # Updated to use configuration
└── style.css            # Updated with configurable theme variables
```

## Benefits

1. **Easy Customization**: Change site content without touching code
2. **Theme Management**: Centralized color and styling configuration
3. **Content Management**: Update features, links, and text from one file
4. **Maintainability**: Separate configuration from implementation
5. **Fallback Safety**: Graceful degradation if configuration is missing
6. **Type Safety**: Structured configuration with clear sections

## Migration Notes

The configuration system maintains backward compatibility. All existing functionality continues to work, with configuration values taking precedence over hardcoded defaults when available.

The system is designed to be robust and will continue functioning even if the configuration file is missing or malformed.
