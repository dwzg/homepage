# Build the site with Node, then serve the output from static-web-server, a
# single Rust binary on a scratch image (~8 MB). Nothing from the build stage
# ends up in the final image.
#
# The server replaced busybox httpd because busybox ignores range requests:
# it answers every request with the whole file, and Safari (every browser on
# iOS) will not play video from such a server.

FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM docker.io/joseluisq/static-web-server:2.44.1
COPY --from=build /app/dist /public

# Port 3000 is what the Portainer stack maps; keep it.
# Cache-Control off: the defaults would cache every page for a day and the
# post images, whose names do not change, for a year. Without the header the
# browser revalidates with Last-Modified, as it did with busybox.
# Everything else is the server's default: no directory listing, hidden files
# and symlinks not served, /path redirected to /path/, gzip/brotli/zstd for
# text, range requests answered with 206.
ENV SERVER_PORT=3000 \
    SERVER_ROOT=/public \
    SERVER_ERROR_PAGE_404=/public/404.html \
    SERVER_CACHE_CONTROL_HEADERS=false \
    SERVER_LOG_LEVEL=warn

# Nobody: the server only reads, and the port is above 1024.
USER 65534:65534
EXPOSE 3000
