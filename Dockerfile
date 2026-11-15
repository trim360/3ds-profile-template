FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN node scripts/build.mjs

FROM node:24-alpine AS owner
WORKDIR /app
COPY . .
RUN mkdir -p /data/site && chown -R node:node /data
ENV OWNER_ROOT=/data/site
VOLUME /data
EXPOSE 8120
USER node
CMD ["node", "scripts/owner-container.mjs"]

FROM nginx:1.27-alpine AS static
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
