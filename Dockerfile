FROM node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS dependencies

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --silent \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

FROM node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime

# Patch OS libraries and omit the build-only package manager from the runtime.
RUN apk upgrade --no-cache libcrypto3 libssl3 \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

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
