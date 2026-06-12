#!/bin/sh
# Runs from the stock nginx image entrypoint (/docker-entrypoint.d). Selects the
# active nginx config based on TLS_DISABLED so the env var documented in
# DEPLOY.md / CONFIG.md is actually honored instead of being a no-op.
set -eu

if [ "${TLS_DISABLED:-false}" = "true" ] || [ "${TLS_DISABLED:-false}" = "1" ]; then
  echo "[tokenboard] TLS_DISABLED=$TLS_DISABLED → plain-HTTP config"
  cp /etc/nginx/conf-available/nginx-notls.conf /etc/nginx/nginx.conf
else
  echo "[tokenboard] TLS enabled → TLS config (expects certs in /etc/nginx/certs)"
  cp /etc/nginx/conf-available/nginx-tls.conf /etc/nginx/nginx.conf
fi
