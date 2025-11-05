#!/bin/bash

# Test script for The Ready Lab API
# Usage: ./scripts/test-api.sh

API_URL="http://localhost:4000"

echo "🧪 Testing The Ready Lab API"
echo "=============================="
echo ""

# Test 1: Health Check
echo "1️⃣  Testing health check..."
curl -s "$API_URL/health" | jq .
echo ""
echo ""

# Test 2: Create Video Upload
echo "2️⃣  Creating video upload..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/videos/uploads" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Video",
    "description": "Testing video upload API",
    "ownerId": "test-user-123"
  }')

echo "$UPLOAD_RESPONSE" | jq .
VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | jq -r .id)
echo ""
echo "📹 Video ID: $VIDEO_ID"
echo ""
echo ""

# Test 3: Get Video Details
if [ "$VIDEO_ID" != "null" ] && [ -n "$VIDEO_ID" ]; then
  echo "3️⃣  Getting video details..."
  curl -s "$API_URL/api/videos/$VIDEO_ID" | jq .
  echo ""
  echo ""
fi

# Test 4: List Videos
echo "4️⃣  Listing videos..."
curl -s "$API_URL/api/videos?limit=5" | jq .
echo ""
echo ""

echo "✅ API tests complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Upload a video file to the upload URL"
echo "   2. Wait for Mux webhook to process"
echo "   3. Check worker logs for caption generation"
echo "   4. Retrieve video with GET /api/videos/$VIDEO_ID"
