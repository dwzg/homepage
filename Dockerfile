# Build the site with Node, then serve the output from a ~100 KB busybox
# httpd image. Nothing from the build stage ends up in the final image.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM lipanski/docker-static-website:2.6.0
COPY httpd.conf ./httpd.conf
COPY --from=build /app/dist .
