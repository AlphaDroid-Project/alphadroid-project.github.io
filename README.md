# AlphaDroid ROM Website

A modern, responsive website for the AlphaDroid custom Android ROM project, showcasing supported devices, features, and downloads.

## Quick Start

- **View Live Site**: [alphadroid-project.github.io](https://alphadroid-project.github.io)
- **Device Management**: See [DOCUMENTATION.md](DOCUMENTATION.md) for detailed guides
- **Support**: [Telegram Chat](https://t.me/alphadroid_chat)

## Key Features

- 📱 **Device Showcase**: Browse supported devices with images and details
- 🔄 **Auto-Updates**: Automatic device data synchronization via GitHub Actions
- ⚡ **Performance**: Optimized loading with caching and lazy loading
- 📱 **Responsive**: Works perfectly on desktop and mobile devices
- 🎨 **Modern UI**: Material You design with dark mode support

## Device Management

### Adding Devices
- Edit `data/device_db.json` to add new devices
- Add device images to `images/devices/` directory
- Use device codename as filename (e.g., `raphael.png`)

### Updating Device Information
- Modify device metadata in `data/device_db.json`
- Use GitHub Actions for automatic updates
- Manual updates available via Actions tab

### Device Images
- Format: PNG or WebP
- Size: 400x400px recommended
- Location: `images/devices/`
- Naming: Use device codename

## Configuration

The website uses `config.json` for centralized configuration:
- Site metadata and branding
- Theme colors and animations
- Navigation and content
- API endpoints and settings

## Automation

GitHub Actions workflows handle:
- **Device Data Updates**: Every 15 minutes via polling
- **Health Monitoring**: Hourly system checks
- **Manual Updates**: On-demand with multiple strategies
- **Scheduled Fallback**: Every 12 hours as backup

## Development

For development setup, testing, and technical details, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Contributors

- **Website Maintainer**: [Naoko Shoto](https://github.com/naokoshoto)
- **Web Contributor/Initiator**: [Pacuka](https://github.com/Pacuka))

## Support

- **Issues & Questions**: [GitHub Issues](https://github.com/alphadroid-project/alphadroid-project.github.io/issues)
- **Community Chat**: [Telegram Chat](https://t.me/alphadroid_chat)

---

*For detailed documentation, see [DOCUMENTATION.md](DOCUMENTATION.md)*
