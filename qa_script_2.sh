#!/bin/bash
BASE_URL="https://dev.psy-site.pages.dev"
DIR="/Users/artemfedoryshyn/psychologist-site"

echo "=== 1. Live HTTP & Asset Verification ==="
for page in "/" "/cabinet" "/admin" "/privacy" "/meet"; do
  STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" "$BASE_URL$page")
  echo "Page $page: $STATUS"
done

echo "=== 2. API Endpoint Testing ==="
for removed in "/api/telegram/webhook" "/api/inquiries/send"; do
  STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" "$BASE_URL$removed")
  echo "Removed API $removed: $STATUS"
done

echo "=== 3. Frontend DOM & JS Static/Dynamic Analysis ==="
echo "Checking for removed APIs in frontend..."
grep -rniE "/api/telegram|/api/inquiries" $DIR/*.html || echo "No references found."

echo "Checking anchor links vs IDs in index.html..."
grep -oE 'href="#[^"]+"' $DIR/index.html | sort | uniq | while read -r match; do
  id=$(echo $match | sed -E 's/href="#([^"]+)"/\1/')
  if ! grep -qE "id=\"$id\"" $DIR/*.html; then
     echo "WARNING: Broken anchor link #$id"
  fi
done

echo "Checking getElementById missing IDs in HTML..."
grep -oE "getElementById\(['\"][^'\"]+['\"]\)" $DIR/*.html | awk -F "['\"]" '{print $2}' | sort | uniq | while read -r id; do
  if ! grep -qE "id=[\"']$id[\"']" $DIR/*.html; then
     echo "WARNING: Missing ID in DOM for getElementById: $id"
  fi
done

echo "=== 4. Navigation & Flow Verification ==="
if grep -q "Підбір часу" $DIR/index.html; then
  echo "FAIL: 'Підбір часу' found in index.html"
else
  echo "PASS: 'Підбір часу' removed from index.html"
fi

if grep -q "Запитати психолога" $DIR/index.html; then
  echo "FAIL: 'Запитати психолога' found in index.html"
else
  echo "PASS: 'Запитати психолога' removed from index.html"
fi

echo "=== 5. Security & Privacy ==="
grep -niE "escapeHtml|escapeAdminHtml" $DIR/*.html | head -n 5
