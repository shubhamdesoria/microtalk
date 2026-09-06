'use strict';

const {
    isAppointmentPresenter,
    isAppointmentRoomMember,
    isAppointmentRoomPeer,
} = require('../app/src/appointmentRoomAccess');

const should = require('should');

const room = 'na-0123456789abcdef0123456789abcdef0123';
const appointmentRef = '0123456789abcdef0123456789abcdef0123456789a';

function makeSocket(id, participant, roomId = room, ref = appointmentRef) {
    return {
        id,
        channels: { [roomId]: roomId },
        appointmentJoin: {
            appointmentRef: ref,
            room: roomId,
            participant,
            displayName: participant === 'doctor' ? 'Doctor' : 'Patient',
            presenter: participant === 'doctor',
        },
    };
}

describe('Appointment room socket access', () => {
    const doctor = makeSocket('doctor-socket', 'doctor');
    const patient = makeSocket('patient-socket', 'patient');
    const peers = {
        [room]: {
            [doctor.id]: { peer_name: 'Doctor' },
            [patient.id]: { peer_name: 'Patient' },
        },
    };

    it('binds membership to the verified socket, room, and generic display name', () => {
        isAppointmentRoomMember(patient, room, peers, 'Patient').should.equal(true);
        isAppointmentRoomMember(patient, room, peers, 'Doctor').should.equal(false);
        isAppointmentRoomMember(patient, 'na-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', peers).should.equal(false);
    });

    it('does not grant presenter rights based on a spoofed client name', () => {
        isAppointmentPresenter(patient, room, peers).should.equal(false);
        isAppointmentPresenter(doctor, room, peers).should.equal(true);
    });

    it('allows signaling only between joined peers for the same appointment', () => {
        isAppointmentRoomPeer(patient, doctor, room, peers).should.equal(true);

        const otherAppointment = makeSocket('other-socket', 'doctor', room, 'a'.repeat(43));
        peers[room][otherAppointment.id] = { peer_name: 'Doctor' };
        isAppointmentRoomPeer(patient, otherAppointment, room, peers).should.equal(false);
        delete peers[room][otherAppointment.id];
    });
});
