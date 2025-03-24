# UniFi Kill Switch

A modern web application for managing UniFi network clients with an intuitive interface. This application provides a streamlined way to block and unblock devices connected to your UniFi network.

## Features

- 🔍 Block and Unblock network clients
- 🏷️ Create and assign custom tags to devices
- 📱 Responsive design for desktop and mobile
- 🔒 Secure API key authentication
- 💾 Persistent data storage

## Getting Started

### Prerequisites
- UniFi Network Controller (tested with version 7.x and above)
- Unraid

### Creating a UniFi API Key

1. Log in to your UniFi Controller web interface
2. Navigate to Settings > Control Plane > Integrations
3. Click "Create API Key" or "+ Create API Key"
4. Enter a name for your API key
5. Set the expiration to "Never Expires" (recommended for continuous operation)
6. Copy the generated API key and save it securely
   - Note: The API key will only be shown once
   - If you lose the key, you'll need to generate a new one

⚠️ **Important Security Notes**:
- Keep your API key secure and never share it
- The API key has full access to your UniFi Controller
- If you suspect your API key has been compromised, immediately revoke it and generate a new one


### Environment Variables

- `UNIFI_CONTROLLER_URL`: URL of your UniFi Controller (e.g., https://192.168.1.1)
- `UNIFI_API_KEY`: API key for authentication with UniFi Controller

### Using with Unraid

1. In your Unraid dashboard, go to the "Docker" tab and click "Add Container"
2. Configure the container:
   - Repository: `monkizzle/unifikillswitch:latest`
   - Container Name: `unifikillswitch`
   - Port Mapping: Add a new port mapping
     - Container Port: `3000`
     - Host Port: `3000` (or your preferred port)
   - Volume Mapping: Add a new path mapping
     - Container Path: `/app/data`
     - Host Path: `/mnt/user/appdata/unifikillswitch/db`
     - This path stores your SQLite database and ensures data persistence
   - Environment Variables: Add the following variables
     - `UNIFI_CONTROLLER_URL`: Your UniFi Controller URL (e.g., https://192.168.1.1)
     - `UNIFI_API_KEY`: Your UniFi Controller API key

3. ⚠️ **IMPORTANT**: Set proper permissions before starting the container:
   ```bash
   # Run these commands in the Unraid terminal or through SSH
   # This step is REQUIRED to ensure the container can write to the database
   mkdir -p /mnt/user/appdata/unifikillswitch/db
   chmod 777 /mnt/user/appdata/unifikillswitch/db
   ```
   Without these permissions, the container will fail to start properly.

4. Click "Apply" to create the container
5. Start the container by clicking the play button

Note: On first run, the container will automatically initialize the database and run any necessary migrations. Your data will persist across container updates and restarts thanks to the volume mapping.

#### Accessing the Application
- Once the container is running, you can access the application by navigating to:
  `http://your-unraid-ip:3000` in your web browser
- Replace `your-unraid-ip` with your Unraid server's IP address

### Updating the Container
To update to the latest version in Unraid:
1. Go to the Docker tab
2. Find the UniFi Kill Switch container
3. Click the "Force Update" button (the circular arrow icon)
4. The container will automatically update to the latest version while preserving your data
