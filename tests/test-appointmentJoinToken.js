'use strict';

const should = require('should');
const jwt = require('jsonwebtoken');
const { verifyAppointmentJoinToken } = require('../app/src/appointmentJoinToken');

const secret = 'test-appointment-join-secret-at-least-32-chars';
const issuer = 'nitya-aarogya-backend';
const audience = 'nitya-aarogya-mirotalk';
const room = 'na-0123456789abcdef0123456789abcdef0123';
const appointmentRef = '0123456789abcdef0123456789abcdef0123456789a';

function sign(overrides = {}, options = {}) {
    const participant = overrides.participant || 'patient';
    return jwt.sign(
        {
            purpose: 'teleconsult_join',
            room,
            appointmentRef,
            participant,
            displayName: participant === 'doctor' ? 'Doctor' : 'Patient',
            presenter: participant === 'doctor',
            ...overrides,
        },
        secret,
        {
            algorithm: 'HS256',
            issuer,
            audience,
            expiresIn: '5m',
            ...options,
        }
    );
}

describe('Appointment join tokens', () => {
    it('accepts an appointment-bound patient token', () => {
        const claims = verifyAppointmentJoinToken(sign(), {
            secret,
            issuer,
            audience,
            room,
            displayName: 'Patient',
        });

        claims.room.should.equal(room);
        claims.appointmentRef.should.equal(appointmentRef);
        claims.participant.should.equal('patient');
        claims.presenter.should.equal(false);
    });

    it('accepts a doctor only as the presenter', () => {
        const claims = verifyAppointmentJoinToken(sign({ participant: 'doctor' }), {
            secret,
            issuer,
            audience,
            room,
            displayName: 'Doctor',
        });

        claims.participant.should.equal('doctor');
        claims.presenter.should.equal(true);
    });

    it('rejects replay into another room', () => {
        should.throws(
            () =>
                verifyAppointmentJoinToken(sign(), {
                    secret,
                    issuer,
                    audience,
                    room: 'na-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    displayName: 'Patient',
                }),
            /room mismatch/
        );
    });

    it('rejects display-name tampering', () => {
        should.throws(
            () =>
                verifyAppointmentJoinToken(sign(), {
                    secret,
                    issuer,
                    audience,
                    room,
                    displayName: 'A patient name',
                }),
            /display name mismatch/
        );
    });

    it('rejects a patient token that claims presenter rights', () => {
        should.throws(
            () =>
                verifyAppointmentJoinToken(sign({ presenter: true }), {
                    secret,
                    issuer,
                    audience,
                    room,
                    displayName: 'Patient',
                }),
            /participant claims/
        );
    });

    it('rejects a token from a different issuer', () => {
        should.throws(
            () =>
                verifyAppointmentJoinToken(sign({}, { issuer: 'untrusted-service' }), {
                    secret,
                    issuer,
                    audience,
                    room,
                    displayName: 'Patient',
                }),
            /issuer/
        );
    });

    it('rejects expired tokens', () => {
        should.throws(
            () =>
                verifyAppointmentJoinToken(sign({}, { expiresIn: -60 }), {
                    secret,
                    issuer,
                    audience,
                    room,
                    displayName: 'Patient',
                }),
            /expired/
        );
    });

    it('rejects oversized tokens before verification', () => {
        should.throws(
            () => verifyAppointmentJoinToken('a'.repeat(4097), { secret, issuer, audience }),
            /too large/
        );
    });
});
