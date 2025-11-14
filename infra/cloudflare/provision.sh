#!/bin/bash
set -e

# Create the D1 database
echo "Creating D1 database..."
wrangler d1 create goldshore_cms

# Create the KV namespace
echo "Creating KV namespace..."
wrangler kv:namespace create SITE_KV

# Create the R2 bucket
echo "Creating R2 bucket..."
wrangler r2 bucket create assets

# Create the Queues
echo "Creating Queues..."
wrangler queues create goldshore-jobs

echo "Cloudflare resources provisioned successfully."
