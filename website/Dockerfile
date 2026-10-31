FROM caddy:2.8-alpine
COPY . /srv
CMD ["caddy", "run", "--config", "/srv/Caddyfile", "--adapter", "caddyfile"]
