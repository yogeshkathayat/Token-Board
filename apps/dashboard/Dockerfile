# --- Build ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/dashboard/package.json apps/dashboard/

RUN npm ci --workspaces --include-workspace-root

COPY packages/shared packages/shared
COPY apps/dashboard apps/dashboard

RUN npm --workspace @tokenboard/shared run build && \
    npm --workspace @tokenboard/dashboard run build

# --- Dev target ---
FROM build AS dev
EXPOSE 5173
CMD ["npm", "--workspace", "apps/dashboard", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Runtime: nginx serving the SPA ---
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
RUN printf 'server {\n\
  listen 80 default_server;\n\
  root /usr/share/nginx/html;\n\
  gzip on;\n\
  gzip_types text/css application/javascript application/json image/svg+xml;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location ~* \\.(js|css|woff2|svg)$ {\n\
    expires 7d;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
