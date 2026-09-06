'use strict';

const crypto = require('crypto');
const should = require('should');

const {
    createIceServers,
    generateTurnRestCredentials,
    normalizeUrls,
    validateIceServerConfiguration,
} = require('../app/src/iceServers');

describe('ICE server configuration', () => {
    it('normalizes URL arrays and removes empty values', () => {
        normalizeUrls([' stun:turn.example.com:3478 ', '', null, 'turn:turn.example.com:3478']).should.deepEqual([
            'stun:turn.example.com:3478',
            'turn:turn.example.com:3478',
        ]);
    });

    it('generates Coturn REST credentials with an expiring username', () => {
        const now = Date.UTC(2026, 8, 3, 0, 0, 0);
        const result = generateTurnRestCredentials({
            sharedSecret: 'test-shared-secret',
            ttlSeconds: 3600,
            identity: 'call-service',
            now,
        });
        const expectedUsername = `${Math.floor(now / 1000) + 3600}:call-service`;
        const expectedCredential = crypto
            .createHmac('sha1', 'test-shared-secret')
            .update(expectedUsername)
            .digest('base64');

        result.should.deepEqual({
            username: expectedUsername,
            credential: expectedCredential,
            expiresAt: Math.floor(now / 1000) + 3600,
        });
    });

    it('creates one STUN entry and one TURN entry with all configured transports', () => {
        const now = Date.UTC(2026, 8, 3, 0, 0, 0);
        const config = {
            stun: {
                enabled: true,
                urls: ['stun:turn.example.com:3478'],
            },
            turn: {
                enabled: true,
                urls: [
                    'turn:turn.example.com:3478?transport=udp',
                    'turn:turn.example.com:3478?transport=tcp',
                    'turns:turn.example.com:5349?transport=tcp',
                ],
                sharedSecret: 'test-shared-secret',
                credentialTtlSeconds: 900,
                credentialIdentity: 'mirotalk',
            },
        };

        const result = createIceServers(config, { now });

        result.should.have.length(2);
        result[0].should.deepEqual({ urls: ['stun:turn.example.com:3478'] });
        result[1].urls.should.deepEqual(config.turn.urls);
        result[1].username.should.equal(`${Math.floor(now / 1000) + 900}:mirotalk`);
        result[1].credential.should.equal(
            crypto.createHmac('sha1', 'test-shared-secret').update(result[1].username).digest('base64')
        );
    });

    it('keeps legacy static credentials outside production', () => {
        const config = {
            stun: { enabled: false },
            turn: {
                enabled: true,
                url: 'turn:legacy.example.com:3478',
                username: 'legacy-user',
                credential: 'legacy-password',
            },
        };

        createIceServers(config).should.deepEqual([
            {
                urls: ['turn:legacy.example.com:3478'],
                username: 'legacy-user',
                credential: 'legacy-password',
            },
        ]);
        (() => validateIceServerConfiguration(config, true)).should.throw(
            'TURN_SHARED_SECRET is required when TURN is enabled in production'
        );
    });

    it('rejects missing TURN URLs and unsafe credential TTLs', () => {
        (() =>
            validateIceServerConfiguration({
                stun: { enabled: true },
                turn: { enabled: false },
            })).should.throw('STUN_SERVER_URLS or STUN_SERVER_URL is required when STUN is enabled');

        (() =>
            validateIceServerConfiguration(
                {
                    turn: {
                        enabled: true,
                        sharedSecret: 'test-shared-secret',
                        credentialTtlSeconds: 3600,
                    },
                },
                true
            )).should.throw('TURN_SERVER_URLS or TURN_SERVER_URL is required when TURN is enabled');

        (() =>
            generateTurnRestCredentials({
                sharedSecret: 'test-shared-secret',
                ttlSeconds: 86401,
            })).should.throw('TURN credential TTL must be an integer between 1 and 86400');
    });
});
