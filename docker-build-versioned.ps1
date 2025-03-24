# Read the version file
$versionFile = "version.json"
$versionInfo = Get-Content $versionFile | ConvertFrom-Json

# Increment build number
$versionInfo.buildNumber = $versionInfo.buildNumber + 1

# Create version tag
$versionTag = "$($versionInfo.version)-build$($versionInfo.buildNumber)"

# Save updated version info
$versionInfo | ConvertTo-Json | Set-Content $versionFile

# Image details
$imageName = "ghcr.io/monkizzle/unifi-killswitch"

Write-Host "Building version: $versionTag"

# Build Docker image with both latest and versioned tags
docker build `
    --build-arg VERSION=$versionTag `
    -t "${imageName}:latest" `
    -t "${imageName}:${versionTag}" `
    .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful, pushing to DockerHub..."
    
    # Push both tags to DockerHub
    docker push "${imageName}:latest"
    docker push "${imageName}:${versionTag}"

    Write-Host "Successfully pushed version $versionTag to DockerHub"
    Write-Host "Tags pushed:"
    Write-Host "  - ${imageName}:latest"
    Write-Host "  - ${imageName}:${versionTag}"
    
    # Display current version info
    Write-Host "`nCurrent version information:"
    Write-Host "Version: $($versionInfo.version)"
    Write-Host "Build number: $($versionInfo.buildNumber)"
} else {
    Write-Host "Build failed, not pushing to DockerHub"
    # Revert build number increment
    $versionInfo.buildNumber = $versionInfo.buildNumber - 1
    $versionInfo | ConvertTo-Json | Set-Content $versionFile
} 