# AlphaDroid ROM Website Documentation

## Overview

The AlphaDroid ROM website is a modern, responsive web application that showcases the AlphaDroid custom Android ROM project. It provides information about supported devices, features, screenshots, and download links for the ROM.

## Table of Contents

1. [Device Management](#device-management)
2. [Adding Device Images](#adding-device-images)
3. [Updating Device Information](#updating-device-information)
4. [Automatic Updates](#automatic-updates)
5. [Website Features](#website-features)
6. [Troubleshooting](#troubleshooting)

## Device Management

The website displays device information from multiple sources to provide comprehensive and up-to-date information about supported devices.

### Device Data Sources

The website automatically fetches device information from the AlphaDroid OTA repository and allows manual overrides for specific devices.

### Device Information Structure

Each device entry contains:

- **Codename**: Unique device identifier
- **Model**: Human-readable device name
- **Manufacturer**: Device manufacturer
- **Maintainer**: ROM maintainer information
- **Image**: Device image file
- **Aliases**: Alternative device names

## Adding Device Images

### Image Requirements

- **Format**: PNG or WebP (PNG preferred for compatibility)
- **Size**: Recommended 400x400px or higher
- **Naming**: Use device codename (e.g., `raphael.png`)
- **Location**: `images/devices/` directory

### Adding a New Device Image

1. **Prepare the image**:
   - Resize to appropriate dimensions (400x400px recommended)
   - Ensure good quality and clarity
   - Use PNG format for best compatibility

2. **Upload the image**:
   - Add the image file to the `images/devices/` directory
   - Use the device codename as the filename
   - Commit and push the changes

3. **Update device metadata** (if needed):
   - Edit `data/device_db.json` to add device information
   - Include codename, manufacturer, model, and maintainer details

## Updating Device Information

### Manual Device Information Updates

#### Method 1: Direct File Editing

1. **Edit device metadata**:
   - Open `data/device_db.json` file
   - Find the device entry you want to update
   - Modify the relevant fields (model, maintainer, etc.)

2. **Commit changes**:
   - Save the file and commit your changes
   - Push to the repository

#### Method 2: GitHub Actions Manual Update

1. Go to Actions tab in GitHub
2. Select "Manual Device Data Update"
3. Choose update type:
   - **Full**: Update all device files
   - **Incremental**: Only recently changed files
   - **Dry Run**: Preview changes without applying

### Correcting Device Information

#### Common Corrections

1. **Fix Device Model Name**: Update the model field in device metadata
2. **Update Maintainer Information**: Change maintainer name and links
3. **Add Device Aliases**: Include alternative device names
4. **Hide Duplicate Devices**: Set hide flag to true for duplicates

#### Validation Steps

1. **Check device appears correctly** on the website
2. **Verify maintainer links** work properly
3. **Test search functionality** finds the device
4. **Confirm image displays** correctly

## Automatic Updates

The website automatically stays updated with the latest device information through automated systems:

- **Device Data**: Updates every 15 minutes when changes are detected
- **Health Monitoring**: System checks run hourly to ensure everything works
- **Manual Updates**: On-demand updates available when needed
- **Fallback Protection**: Scheduled updates every 12 hours as backup

### Manual Updates

If you need to force an update:

1. Go to the **Actions** tab in GitHub
2. Select **"Manual Device Data Update"**
3. Choose your update type:
   - **Full**: Update all device files
   - **Incremental**: Only recently changed files
   - **Dry Run**: Preview changes without applying

## Website Features

### Performance
- **Fast Loading**: Optimized for quick page loads
- **Offline Support**: Works even without internet connection
- **Mobile Friendly**: Responsive design for all devices
- **Smart Caching**: Efficient data loading and storage

### User Experience
- **Search Functionality**: Find devices quickly by name or codename
- **Device Details**: Comprehensive information for each device
- **Direct Links**: Shareable links to specific devices
- **Dark Mode**: Automatic theme switching based on system preference

## Troubleshooting

### Common Issues

#### Device not appearing
1. Check if device exists in `data/device_db.json`
2. Verify the device image file exists
3. Ensure device codename is correct

#### Images not loading
1. Verify image file exists in `images/devices/` directory
2. Check image file format (PNG or WebP)
3. Clear browser cache and refresh

#### Updates not working
1. Check GitHub Actions status in the Actions tab
2. Wait for automatic updates (up to 15 minutes)
3. Try manual update if needed

### Getting Help

If you encounter issues:

1. **Check the website** to see if others have the same problem
2. **Search existing issues** in the GitHub repository
3. **Create a new issue** with detailed information
4. **Join the community chat** for real-time help

## Contributors

- **Website Maintainer**: [Naoko Shoto](https://github.com/naokoshoto)
- **Web Contributor/Initiator**: [Pacuka](https://github.com/Pacuka)

## Support

For questions or assistance:

- **Issues & Questions**: [GitHub Issues](https://github.com/alphadroid-project/alphadroid-project.github.io/issues)
- **Community Chat**: [Telegram Chat](https://t.me/alphadroid_chat)

---

*For development and technical details, see [DEVELOPMENT.md](DEVELOPMENT.md)*
