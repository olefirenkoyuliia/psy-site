#!/bin/bash
BASE_URL="https://dev.psy-site.pages.dev"
DIR="/Users/artemfedoryshyn/psychologist-site"

echo "=== 1. Live HTTP & Asset Verification ==="
for page in "/" "/cabinet.html" "/admin.html" "/privacy.html" "/meet.html"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$page")
  echo "Page $page: $STATUS"
done

echo "=== 2. API Endpoint Testing ==="
for api in "/api/stats" "/api/data" "/api/calendar" "/api/appointments" "/api/user/profile" "/api/auth/config" "/api/auth/google"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$api")
  echo "API $api: $STATUS"
done

for removed in "/api/telegram/webhook" "/api/inquiries/send"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$removed")
  echo "Removed API $removed: $STATUS"
done

echo "=== 3. Frontend DOM & JS Static/Dynamic Analysis ==="
echo "Checking for removed APIs in frontend..."
grep -rniE "/api/telegram|/api/inquiries" $DIR/public || echo "No references found."

echo "Checking anchor links vs IDs..."
grep -rnE "href=\"#.*\"" $DIR/public/*.html | awk -F'"' '{print $2}' | sort | uniq | grep "^#" | while read -r id; do
  clean_id=$(echo $id | sed 's/#//')
  if ! grep -rq "id=\"$clean_id\"" $DIR/public/*.html; then
     echo "WARNING: Broken anchor link $id"
  fi
done
echo "Analysis done."
