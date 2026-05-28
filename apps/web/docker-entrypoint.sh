#!/bin/sh
set -e

if [ -z "$API_URL" ]; then
  echo "ERROR: API_URL environment variable is required (e.g. http://api.railway.internal:3000)" >&2
  exit 1
fi

# Strip trailing slash so proxy_pass works correctly
API_URL="${API_URL%/}"
export API_URL

envsubst '$API_URL' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
