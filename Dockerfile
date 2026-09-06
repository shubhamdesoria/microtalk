FROM node:22.22-alpine3.24@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd AS dependencies

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --silent \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

FROM node:22.22-alpine3.24@sha256:e58326d0d441090181ac150dc2078d3e2cf6a0d42e809aebba3ef5880935ffdd AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /src

COPY --from=dependencies --chown=node:node /src/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node app ./app
COPY --chown=node:node public ./public
RUN cp app/src/config.template.js app/src/config.js \
    && chown node:node app/src/config.js

USER node

EXPOSE 3000
STOPSIGNAL SIGTERM

CMD ["node", "app/src/server.js"]
