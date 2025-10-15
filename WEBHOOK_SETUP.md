# GitHub Actions Webhook Setup Guide

This guide explains how to set up automatic updates for the AlphaDroid website when the AlphaDroid-devices/OTA repository is updated.

## Overview

The improved GitHub Actions workflow now supports asynchronous updates via webhooks, allowing the website to be updated immediately when device information changes in the OTA repository, rather than waiting for the next scheduled run (every 6 hours).

## Features

- **Real-time Updates**: Website updates immediately when OTA repository changes
- **Smart Filtering**: Only processes updates when JSON device files are modified
- **Enhanced Error Handling**: Retry logic, rate limit handling, and detailed logging
- **Batch Processing**: Efficient API usage with batched requests
- **Rich Metadata**: Detailed information about fetch operations
- **Conditional Updates**: Skips unnecessary updates when no relevant files changed

## Webhook Setup

### Step 1: Configure Repository Dispatch Webhook in AlphaDroid-devices/OTA

1. **Go to AlphaDroid-devices/OTA repository settings**
   - Navigate to `https://github.com/AlphaDroid-devices/OTA/settings/hooks`
   - Click "Add webhook"

2. **Configure the webhook:**
   ```
   Payload URL: https://api.github.com/repos/alphadroid-project/alphadroid-project.github.io/dispatches
   Content type: application/json
   Secret: [Generate a secure secret and store it in both repositories]
   ```

3. **Select events:**
   - Choose "Let me select individual events"
   - Check "Repository" and "Push"

4. **Advanced settings:**
   - ✅ Active
   - ✅ Just the push event
   - ✅ Send me everything

### Step 2: Add Webhook Secret to Target Repository

1. **Go to alphadroid-project.github.io repository settings**
   - Navigate to `https://github.com/alphadroid-project/alphadroid-project.github.io/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `OTA_WEBHOOK_SECRET`
   - Value: [The same secret you used in step 1]

### Step 3: Create Webhook Handler in AlphaDroid-devices/OTA

Create a GitHub Actions workflow in the AlphaDroid-devices/OTA repository to trigger the webhook:

**File:** `.github/workflows/notify-website.yml`

```yaml
name: Notify Website of Updates

on:
  push:
    branches: [master, main]
    paths: ['*.json']

jobs:
  notify:
    runs-on: ubuntu-latest
    if: github.repository == 'AlphaDroid-devices/OTA'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Need previous commit to compare changes
          
      - name: Get changed files
        id: changes
        run: |
          # Get list of changed files in this push
          CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
          echo "changed_files=$CHANGED_FILES" >> $GITHUB_OUTPUT
          
          # Check if any JSON files were changed
          if echo "$CHANGED_FILES" | grep -q "\.json$"; then
            echo "has_json_changes=true" >> $GITHUB_OUTPUT
            echo "event_type=ota-device-update" >> $GITHUB_OUTPUT
          else
            echo "has_json_changes=false" >> $GITHUB_OUTPUT
            echo "event_type=ota-update" >> $GITHUB_OUTPUT
          fi
          
      - name: Trigger website update
        if: steps.changes.outputs.has_json_changes == 'true'
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          repository: alphadroid-project/alphadroid-project.github.io
          event-type: ${{ steps.changes.outputs.event_type }}
          client-payload: |
            {
              "changed_files": "${{ steps.changes.outputs.changed_files }}",
              "repository": "${{ github.repository }}",
              "commit": "${{ github.sha }}",
              "ref": "${{ github.ref }}",
              "pusher": "${{ github.actor }}",
              "timestamp": "${{ github.event.head_commit.timestamp }}"
            }
```

## Alternative: Manual Webhook Setup

If you prefer to set up the webhook manually without GitHub Actions, you can use a simple script:

### Webhook Handler Script

Create this script in the AlphaDroid-devices/OTA repository:

**File:** `scripts/notify-website.sh`

```bash
#!/bin/bash

# Configuration
TARGET_REPO="alphadroid-project/alphadroid-project.github.io"
WEBHOOK_SECRET="$1"  # Pass as argument
CHANGED_FILES="$2"   # Space-separated list of changed files

# Check if any JSON files were changed
if echo "$CHANGED_FILES" | grep -q "\.json$"; then
    EVENT_TYPE="ota-device-update"
    echo "JSON files changed, triggering device update"
else
    EVENT_TYPE="ota-update"
    echo "Non-JSON changes, triggering general update"
fi

# Prepare payload
PAYLOAD=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "client_payload": {
    "changed_files": "$CHANGED_FILES",
    "repository": "$(git config --get remote.origin.url)",
    "commit": "$(git rev-parse HEAD)",
    "ref": "$(git rev-parse --abbrev-ref HEAD)",
    "pusher": "$(git log -1 --pretty=format:'%an')",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
}
EOF
)

# Send webhook
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $WEBHOOK_SECRET" \
  -H "User-Agent: AlphaDroid-OTA-Bot/1.0" \
  "https://api.github.com/repos/$TARGET_REPO/dispatches" \
  -d "$PAYLOAD"

echo "Webhook sent successfully"
```

## Testing the Setup

### 1. Test Manual Trigger

You can manually test the webhook by going to the Actions tab in the website repository and running the "Fetch device JSONs" workflow manually.

### 2. Test Webhook Trigger

1. Make a test change to a JSON file in the OTA repository
2. Commit and push the change
3. Check the Actions tab in the website repository to see if the workflow was triggered
4. Verify that `data/devices.json` was updated

### 3. Verify Webhook Payload

The webhook payload will include:
- `changed_files`: List of files that were modified
- `repository`: Source repository information
- `commit`: Commit SHA
- `ref`: Branch reference
- `pusher`: User who made the changes
- `timestamp`: When the changes were made

## Monitoring and Troubleshooting

### Workflow Status

Monitor the workflow status in:
- **Website Repository**: `https://github.com/alphadroid-project/alphadroid-project.github.io/actions`
- **OTA Repository**: `https://github.com/AlphaDroid-devices/OTA/actions` (if using GitHub Actions webhook)

### Common Issues

1. **Webhook not triggering:**
   - Check if the webhook URL is correct
   - Verify the secret is set correctly in both repositories
   - Ensure the OTA repository has the webhook handler set up

2. **Workflow failing:**
   - Check the Actions logs for detailed error messages
   - Verify GitHub token permissions
   - Check for rate limiting issues

3. **No changes detected:**
   - Ensure JSON files are actually being modified
   - Check the webhook payload to see what files are being reported as changed

### Logs and Debugging

The enhanced workflow provides detailed logging:
- Batch processing status
- Individual file fetch results
- Error counts and success rates
- Timing information
- Trigger source identification

## Benefits

1. **Faster Updates**: Website updates within minutes instead of hours
2. **Reduced Resource Usage**: Only updates when necessary
3. **Better Reliability**: Enhanced error handling and retry logic
4. **Improved Monitoring**: Detailed logs and status reporting
5. **Flexible Triggers**: Supports both webhook and scheduled updates

## Security Considerations

- Use strong, unique secrets for webhook authentication
- Regularly rotate webhook secrets
- Monitor webhook logs for unauthorized access attempts
- Consider IP restrictions if needed
- Use repository dispatch events (recommended) over external webhooks for better security

## Maintenance

- Monitor workflow success rates
- Update webhook secrets periodically
- Review and optimize batch sizes if needed
- Keep the webhook handler script updated
- Monitor API rate limits and adjust retry logic if necessary
