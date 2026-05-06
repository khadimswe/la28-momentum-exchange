#!/bin/bash

# This script grants Cloud Build service account access to your secrets
# Run after setup-secrets.sh

PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

if [ -z "$PROJECT_NUMBER" ]; then
    echo "Error: Could not determine project number"
    exit 1
fi

echo "Granting Cloud Build service account access to secrets..."
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo ""

SECRETS=(
    "vite-gemini-api-key"
    "vite-firebase-api-key"
    "vite-firebase-auth-domain"
    "vite-firebase-project-id"
    "vite-firebase-storage-bucket"
    "vite-firebase-messaging-sender-id"
    "vite-firebase-app-id"
)

for secret in "${SECRETS[@]}"; do
    echo "Granting access to: $secret"
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" \
        --quiet
done

echo ""
echo "✅ Cloud Build now has access to all secrets"
echo ""
echo "To deploy, run:"
echo "  gcloud builds submit --region=us-central1"
