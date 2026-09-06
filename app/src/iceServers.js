'use strict';

const crypto = require('crypto');

const DEFAULT_TURN_CREDENTIAL_TTL_SECONDS = 3600;
const MAX_TURN_CREDENTIAL_TTL_SECONDS = 86400;

function normalizeUrls(value) {
    if (!value) return [];

    const values = Array.isArray(value) ? value : [value];
    return values
        .filter((url) => typeof url === 'string')
        .map((url) => url.trim())
        .filter(Boolean);
}

function generateTurnRestCredentials({
    sharedSecret,
    ttlSeconds = DEFAULT_TURN_CREDENTIAL_TTL_SECONDS,
    identity = 'mirotalk',
    now = Date.now(),
}) {
    if (typeof sharedSecret !== 'string' || !sharedSecret.trim()) {
        throw new Error('TURN shared secret is required');
    }

    const parsedTtl = Number(ttlSeconds);
    if (!Number.isInteger(parsedTtl) || parsedTtl <= 0 || parsedTtl > MAX_TURN_CREDENTIAL_TTL_SECONDS) {
        throw new Error(`TURN credential TTL must be an integer between 1 and ${MAX_TURN_CREDENTIAL_TTL_SECONDS}`);
    }

    const safeIdentity = typeof identity === 'string' && identity.trim() ? identity.trim() : 'mirotalk';
    const expiresAt = Math.floor(Number(now) / 1000) + parsedTtl;
    const username = `${expiresAt}:${safeIdentity}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');

    return { username, credential, expiresAt };
}

function createIceServers(webrtcConfig, options = {}) {
    const iceServers = [];
    const stun = webrtcConfig?.stun || {};
    const turn = webrtcConfig?.turn || {};
    const configuredStunUrls = normalizeUrls(stun.urls);
    const configuredTurnUrls = normalizeUrls(turn.urls);
    const stunUrls = configuredStunUrls.length ? configuredStunUrls : normalizeUrls(stun.url);
    const turnUrls = configuredTurnUrls.length ? configuredTurnUrls : normalizeUrls(turn.url);

    if (stun.enabled && stunUrls.length) {
        iceServers.push({ urls: stunUrls });
    }

    if (!turn.enabled || !turnUrls.length) return iceServers;

    if (turn.sharedSecret) {
        const { username, credential } = generateTurnRestCredentials({
            sharedSecret: turn.sharedSecret,
            ttlSeconds: turn.credentialTtlSeconds,
            identity: options.identity || turn.credentialIdentity,
            now: options.now,
        });
        iceServers.push({ urls: turnUrls, username, credential });
        return iceServers;
    }

    if (turn.username && turn.credential) {
        iceServers.push({ urls: turnUrls, username: turn.username, credential: turn.credential });
    }

    return iceServers;
}

function validateIceServerConfiguration(webrtcConfig, production = false) {
    const stun = webrtcConfig?.stun || {};
    const turn = webrtcConfig?.turn || {};
    const configuredStunUrls = normalizeUrls(stun.urls);
    const configuredTurnUrls = normalizeUrls(turn.urls);
    const stunUrls = configuredStunUrls.length ? configuredStunUrls : normalizeUrls(stun.url);
    const turnUrls = configuredTurnUrls.length ? configuredTurnUrls : normalizeUrls(turn.url);

    if (stun.enabled && !stunUrls.length) {
        throw new Error('STUN_SERVER_URLS or STUN_SERVER_URL is required when STUN is enabled');
    }
    if (!turn.enabled) return;
    if (!turnUrls.length) {
        throw new Error('TURN_SERVER_URLS or TURN_SERVER_URL is required when TURN is enabled');
    }
    if (production && !turn.sharedSecret) {
        throw new Error('TURN_SHARED_SECRET is required when TURN is enabled in production');
    }
    if (!turn.sharedSecret && !(turn.username && turn.credential)) {
        throw new Error('TURN credentials are required when TURN is enabled');
    }

    if (turn.sharedSecret) {
        generateTurnRestCredentials({
            sharedSecret: turn.sharedSecret,
            ttlSeconds: turn.credentialTtlSeconds,
            identity: turn.credentialIdentity,
        });
    }
}

module.exports = {
    DEFAULT_TURN_CREDENTIAL_TTL_SECONDS,
    MAX_TURN_CREDENTIAL_TTL_SECONDS,
    createIceServers,
    generateTurnRestCredentials,
    normalizeUrls,
    validateIceServerConfiguration,
};
