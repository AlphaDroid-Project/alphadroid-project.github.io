# AlphaDroid ROM - Device List Management Guide

This guide explains how to manually extend the supported devices list for the AlphaDroid ROM website.

## Table of Contents
1. [File Structure Overview](#file-structure-overview)
2. [Adding a New Device](#adding-a-new-device)
   - [Device Data Structure](#device-data-structure)
   - [Manufacturer Categories](#manufacturer-categories)
   - [Android Version Support](#android-version-support)
3. [Updating Existing Devices](#updating-existing-devices)
4. [Testing Your Changes](#testing-your-changes)
5. [Best Practices](#best-practices)

## File Structure Overview <a name="file-structure-overview"></a>

The device list is managed in the main HTML file of the AlphaDroid ROM website. Specifically, you'll find the device data in the JavaScript section at the bottom of the file:

```html
<script>
  // Device data with Android version support
  const devices = [
    // Google Devices
    { 
      codename: "oriole", 
      model: "Pixel 6", 
      androidVersions: ["A14"], 
      maintainer: { name: "iczynbuilds", link: "https://t.me/iczynbuilds" },
      manufacturer: "google"
    },
    // ... other devices ...
  ];
</script>
```

## Adding a New Device <a name="adding-a-new-device"></a>

### Device Data Structure <a name="device-data-structure"></a>

Each device is represented as a JavaScript object with the following properties:

| Property | Required | Description | Example |
|----------|----------|-------------|---------|
| `codename` | Yes | Device codename (lowercase) | `"rubyx"` |
| `model` | Yes | Human-readable device name | `"Redmi Note 12 Pro 5G"` |
| `androidVersions` | Yes | Array of supported Android versions | `["A14", "A15"]` |
| `maintainer` | Yes | Object with maintainer info | `{ name: "YagizAOSP", link: "https://t.me/YagizAOSP" }` |
| `manufacturer` | Yes | Device manufacturer category | `"google"`, `"oneplus"`, `"xiaomi"`, or `"others"` |

### Manufacturer Categories <a name="manufacturer-categories"></a>

Devices must be assigned to one of these manufacturer categories:

- `"google"`: All Google Pixel devices
- `"oneplus"`: OnePlus devices
- `"xiaomi"`: Xiaomi, Redmi, and Poco devices
- `"others"`: All other manufacturers

### Android Version Support <a name="android-version-support"></a>

Use these codes for Android versions:
- `"A14"` for Android 14
- `"A15"` for Android 15

### Step-by-Step Process

1. **Locate the device array** in the HTML file
2. **Identify the appropriate manufacturer section**:
   ```javascript
   // Google Devices
   ...existing Google devices...

   // OnePlus Devices
   ...existing OnePlus devices...

   // Xiaomi Devices
   ...existing Xiaomi devices...

   // Other Devices
   ...existing other devices...
   ```
3. **Add your new device** in the correct manufacturer section
4. **Follow the existing formatting** with proper indentation

### Example: Adding a New Xiaomi Device

```javascript
// Xiaomi Devices
{ 
  codename: "rubyx", 
  model: "Redmi Note 12 Pro 5G", 
  androidVersions: ["A15"], 
  maintainer: { name: "YagizAOSP", link: "https://t.me/YagizAOSP" },
  manufacturer: "xiaomi"
},
// Add your new device BELOW this comment
{ 
  codename: "garnet", 
  model: "Redmi Note 13 Pro 5G | Poco X6 5G", 
  androidVersions: ["A14", "A15"], 
  maintainer: { name: "garnet_JYRRC_builds", link: "https://t.me/garnet_JYRRC_builds" },
  manufacturer: "xiaomi"
},
// END of new device addition
```

## Updating Existing Devices <a name="updating-existing-devices"></a>

To update an existing device:

1. Locate the device in the devices array
2. Modify the relevant properties:
   - To add a new Android version:
     ```javascript
     // Before
     androidVersions: ["A14"],

     // After adding A15 support
     androidVersions: ["A14", "A15"],
     ```
   - To change maintainer information:
     ```javascript
     maintainer: { 
       name: "NewMaintainerName", 
       link: "https://t.me/new_maintainer_link" 
     },
     ```
   - To update device model name:
     ```javascript
     model: "Updated Device Name",
     ```

## Testing Your Changes <a name="testing-your-changes"></a>

After modifying the device list:

1. Open the HTML file in a web browser
2. Verify that:
   - The new device appears in the correct manufacturer section
   - Android version badges display correctly
   - Maintainer links work properly
   - The search functionality finds the new device
3. Check the console for JavaScript errors (Press F12 > Console)

## Best Practices <a name="best-practices"></a>

1. **Keep codenames lowercase**: Use `"rubyx"` instead of `"RubyX"`
2. **Maintain consistent formatting**: Use 2-space indentation and follow existing patterns
3. **Verify Telegram links**: Ensure maintainer links are valid before adding
4. **Add devices in alphabetical order** within each manufacturer section
5. **Comment your additions**: Add a brief comment when adding multiple devices
6. **Double-check manufacturer category**: Ensure devices are in the correct section
7. **Test on mobile**: Verify the layout works well on mobile devices
8. **Update device count**: Remember to update the device count statistic if needed

```javascript
// In the statistics section
<div class="stat-card">
  <span class="stat-number">75</span> <!-- Update this number -->
  <span>Devices</span>
</div>
```

## Direct Device Links

The website now supports direct links to device download popups using codenames as identifiers. This allows users to share direct links to specific device pages.

### URL Format

Direct device links use the following format:
```
https://your-domain.com/#device/[codename]
```

### Examples

- `https://your-domain.com/#device/raphael` - Direct link to Redmi K20 Pro / Mi 9T Pro
- `https://your-domain.com/#device/sweet` - Direct link to Redmi Note 10 Pro
- `https://your-domain.com/#device/shiba` - Direct link to Pixel 8

### How It Works

1. When a user visits a device URL (e.g., `#device/raphael`), the website:
   - Automatically navigates to the devices page
   - Loads the device list
   - Opens the device details popup for the specified codename
2. When the user closes the popup, they're redirected back to the devices page (`#devices`)
3. The URL updates accordingly to reflect the current state

### Implementation Details

The routing is handled by JavaScript functions in `route.js`:
- `isDeviceRoute(hash)` - Checks if the current hash is a device route
- `getDeviceCodename(hash)` - Extracts the codename from a device route
- `navigateToDevice(codename)` - Programmatically navigate to a device
- `showDeviceDetails(codename)` - Shows the device popup (existing function)

### Usage in Code

To programmatically navigate to a device popup:
```javascript
// Navigate to a specific device
navigateToDevice('raphael');

// Or manually set the hash
window.location.hash = '#device/raphael';
```

## Support

For questions or assistance with adding devices, contact on Telegram: [Pacuka](https://t.me/Pacuka)
