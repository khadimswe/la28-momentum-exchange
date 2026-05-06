#!/bin/bash

# This script creates all necessary secrets in Google Secret Manager
# It reads from your local .env file and creates corresponding secrets

if [ ! -f ".env" ]; then
    echo "Error: .env file not found in current directory"
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project configured. Run: gcloud config set project PROJECT_ID"
    exit 1
fi

echo "Setting up secrets in Google Secret Manager..."
echo "Project ID: $PROJECT_ID"
echo ""

# Parse .env and create secrets
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" == \#* ]] && continue
    
    # Convert key to lowercase with hyphens
    secret_name=$(echo "$key" | tr '[:upper:]' '[:lower:]' | sed 's/_/-/g')
    
    echo "Creating secret: $secret_name"
    
    # Create the secret (or update if exists)
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
        echo "  Secret exists, adding version..."
        echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --project="$PROJECT_ID"
    else
        echo "  Creating new secret..."
        echo -n "$value" | gcloud secrets create "$secret_name" --data-file=- --replication-policy="automatic" --project="$PROJECT_ID"
    fi
    
done < .env

echo ""
echo "✅ All secrets created successfully"
echo ""
echo "Next step: Run grant-build-access.sh to give Cloud Build permission"
echo "  ./grant-build-access.sh"
