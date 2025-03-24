# UniFi Network Client Manager

A modern web application for managing UniFi network clients with tagging and monitoring capabilities.

## Quick Deploy in Unraid

### Option 1: Using Template URL
1. In Unraid, go to the **Docker** tab
2. Click **Add Container**
3. Click **Template Repositories**
4. Add this URL:
```
https://raw.githubusercontent.com/monkizzle/unipanel/main/template/my-unipanel.xml
```

### Option 2: Manual Setup
```xml
docker run -d \
  --name='unipanel' \
  --net='bridge' \
  -e TZ="America/New_York" \
  -e 'UNIFI_CONTROLLER_URL'='your-controller-url' \
  -e 'UNIFI_API_KEY'='your-api-key' \
  -v '/mnt/user/appdata/unipanel':'/app/.next/cache':'rw' \
  -p '3000:3000/tcp' \
  monkizzle/unipanel:latest
```

## Features
- View and manage network clients
- Tag and categorize devices
- Monitor client statistics
- Docker support with automatic updates
- Built-in health monitoring
- Persistent cache storage

## Environment Variables

| Variable | Description |
|----------|-------------|
| UNIFI_CONTROLLER_URL | URL of your UniFi Controller (including https://) |
| UNIFI_API_KEY | UniFi Controller API Key |

## Support
For issues and feature requests, please visit our [GitHub repository](https://github.com/monkizzle/unipanel). 