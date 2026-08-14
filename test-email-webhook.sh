#!/bin/bash
# Test email webhook on live site
# Replace YOUR_LIVE_URL and YOUR_SECRET_TOKEN

LIVE_URL="https://landlinq-catalyst--2fgxpxy.prod1a.defang.dev"
SECRET_TOKEN="your-secret-here"

curl -X POST "${LIVE_URL}/api/inbound-email?token=${SECRET_TOKEN}" \
  -H "Content-Type: multipart/form-data" \
  -F "from=test@broker.com" \
  -F "to=deals@catalyst.landlinq.ai" \
  -F "subject=New Land Deal - 123 Main St" \
  -F "text=Property for sale: 123 Main Street, Charlotte, NC 28202. 5 acres, asking $500,000. Contact: John Doe, john@broker.com, 704-555-1234" \
  -v

echo ""
echo "Check if deal was created in your dashboard!"
