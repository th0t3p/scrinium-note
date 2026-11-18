FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html tsconfig.json LICENSE.md NOTICE.md ./
COPY tools ./tools
COPY third-party-licenses ./third-party-licenses
COPY src ./src
COPY public ./public
COPY tests ./tests
RUN npm test && npm run build

FROM nginxinc/nginx-unprivileged:alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e
LABEL org.opencontainers.image.title="Scrinium Note" org.opencontainers.image.version="0.1.0" org.opencontainers.image.licenses="PolyForm-Noncommercial-1.0.0"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
