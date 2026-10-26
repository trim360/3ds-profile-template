FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN node scripts/build.mjs

FROM nginx:1.27-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
