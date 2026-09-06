'use strict';

const jwt = require('jsonwebtoken');

const PURPOSE = 'teleconsult_join';
const ROOM_PATTERN = /^na-[a-f0-9]{36}$/;
const APPOINTMENT_REF_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PARTICIPANTS = new Set(['doctor', 'patient']);

function verifyAppointmentJoinToken(token, options) {
    if (!token || typeof token !== 'string') throw new Error('Missing appointment join token');
    if (token.length > 4096) throw new Error('Appointment join token is too large');

    const claims = jwt.verify(token, options.secret, {
        algorithms: ['HS256'],
        issuer: options.issuer,
        audience: options.audience,
        clockTolerance: 15,
    });

    if (
        !claims ||
        claims.purpose !== PURPOSE ||
        !ROOM_PATTERN.test(claims.room) ||
        !APPOINTMENT_REF_PATTERN.test(claims.appointmentRef) ||
        !PARTICIPANTS.has(claims.participant)
    ) {
        throw new Error('Invalid appointment join claims');
    }

    const expectedDisplayName = claims.participant === 'doctor' ? 'Doctor' : 'Patient';
    const expectedPresenter = claims.participant === 'doctor';
    if (claims.displayName !== expectedDisplayName || claims.presenter !== expectedPresenter) {
        throw new Error('Invalid appointment participant claims');
    }
    if (options.room && claims.room !== options.room) throw new Error('Appointment room mismatch');
    if (options.displayName && claims.displayName !== options.displayName) {
        throw new Error('Appointment display name mismatch');
    }

    return {
        appointmentRef: claims.appointmentRef,
        room: claims.room,
        participant: claims.participant,
        displayName: claims.displayName,
        presenter: claims.presenter,
        jti: claims.jti,
    };
}

module.exports = { verifyAppointmentJoinToken };
