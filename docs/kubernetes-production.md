# Kubernetes production runtime

The production image contains no `.env`, generated local `config.js`, or TLS private key. Configuration must be injected as environment variables from Kubernetes ConfigMaps and Secrets. Public HTTPS and WebSocket TLS terminate at Traefik; the pod serves HTTP on port `3000`.

Required production values:

```dotenv
NODE_ENV=production
HOST=https://meet.example.com
PORT=3000
HTTPS=false
TRUST_PROXY=true
LOGS_DEBUG=false
LOGS_JSON=true
STATS_ENABLED=false
CORS_ORIGIN='["https://meet.example.com"]'
JWT_KEY=<from-secret-manager>
APPOINTMENT_JOIN_TOKENS_REQUIRED=true
APPOINTMENT_JOIN_TOKEN_ISSUER=nitya-aarogya-backend
APPOINTMENT_JOIN_TOKEN_AUDIENCE=nitya-aarogya-mirotalk
API_KEY_SECRET=<from-secret-manager>
API_DISABLED='["token","meetings","meeting","join"]'
STUN_SERVER_ENABLED=true
STUN_SERVER_URLS='["stun:turn.example.com:3478"]'
TURN_SERVER_ENABLED=true
TURN_SERVER_URLS='["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp","turns:turn.example.com:5349?transport=tcp"]'
TURN_SHARED_SECRET=<same-secret-as-coturn-static-auth-secret>
TURN_CREDENTIAL_TTL_SECONDS=3600
TURN_CREDENTIAL_IDENTITY=mirotalk
```

The backend's `MIROTALK_JWT_SECRET` must match `JWT_KEY`. It signs five-minute tokens bound to one opaque appointment reference, room, and participant role; database appointment identifiers and participant names are not included. Secure join URLs put the token in the URL fragment, which browsers do not send in HTTP requests or reverse-proxy access logs. MiroTalk clears the fragment after reading it and re-verifies the token when the Socket.IO peer joins. In production, query-string joins, unsigned room creation, legacy token minting, and direct room joins are rejected.

`TURN_SHARED_SECRET` never leaves the server. MiroTalk derives a temporary username of `<expiry-unix-time>:<identity>` and its HMAC-SHA1 credential whenever peers connect. Coturn must use `use-auth-secret`, the matching `static-auth-secret`, and the same realm represented by the TURN hostname.

`TURN_SERVER_USERNAME` and `TURN_SERVER_CREDENTIAL` remain available for local/backward-compatible setups, but production deliberately rejects them unless `TURN_SHARED_SECRET` is also configured.

The image runs as the `node` user and does not write application files. A pod can use `readOnlyRootFilesystem: true`, drop all capabilities, select `RuntimeDefault` seccomp, and mount an `emptyDir` at `/tmp` for dependencies that need temporary space. Use `GET /healthz` for liveness and readiness probes.

The production GitHub Actions workflow expects repository variables `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_BUILD_SERVICE_ACCOUNT`, and `DEPLOY_GITHUB_APP_ID`, plus the protected-environment secret `DEPLOY_GITHUB_APP_PRIVATE_KEY`. It publishes `nitya-apps/mirotalk:<commit SHA>`, resolves the immutable digest, and dispatches that digest to `nitya-aarogya-infra`; it never connects to the server directly. Protect the `production` GitHub environment with required reviewers. Install the GitHub App only on the infrastructure repository and scope the generated token to that repository.
