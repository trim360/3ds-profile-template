FROM nginx:1.27-alpine

# Fichiers de la page
COPY index.html /usr/share/nginx/html/index.html
COPY style.css   /usr/share/nginx/html/style.css
COPY script.js   /usr/share/nginx/html/script.js
COPY config.js   /usr/share/nginx/html/config.js
COPY LICENSE NOTICE /usr/share/nginx/html/
COPY LICENSES/ /usr/share/nginx/html/LICENSES/
COPY assets/     /usr/share/nginx/html/assets/

# Configuration Nginx (gzip + cache sur les médias)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
