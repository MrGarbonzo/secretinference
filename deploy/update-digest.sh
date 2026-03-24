#!/bin/bash
# Pull the latest digest from GHCR and update docker-compose.yaml
# Usage: ./deploy/update-digest.sh

IMAGE="ghcr.io/mrgarbonzo/secretinference"
echo "Fetching latest digest for $IMAGE..."
docker pull $IMAGE:latest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' $IMAGE:latest | cut -d@ -f2)
echo "Digest: $DIGEST"
sed -i "s|$IMAGE@sha256:.*|$IMAGE@sha256:$DIGEST|" docker-compose.yaml
echo "Updated docker-compose.yaml"
echo "Commit this change before deploying to SecretVM."
