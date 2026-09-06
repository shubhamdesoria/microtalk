'use strict';

function isAppointmentRoomMember(socket, roomId, peers, claimedName) {
    const claims = socket?.appointmentJoin;
    const member =
        typeof roomId === 'string' &&
        claims?.room === roomId &&
        socket.channels?.[roomId] === roomId &&
        Boolean(peers[roomId]?.[socket.id]);

    return member && (claimedName === undefined || claimedName === claims.displayName);
}

function isAppointmentRoomPeer(socket, targetSocket, roomId, peers) {
    if (!isAppointmentRoomMember(socket, roomId, peers) || !targetSocket) return false;

    const sourceClaims = socket.appointmentJoin;
    const targetClaims = targetSocket.appointmentJoin;
    return (
        isAppointmentRoomMember(targetSocket, roomId, peers) &&
        targetClaims.appointmentRef === sourceClaims.appointmentRef
    );
}

function isAppointmentPresenter(socket, roomId, peers) {
    return isAppointmentRoomMember(socket, roomId, peers) && socket.appointmentJoin.presenter === true;
}

module.exports = {
    isAppointmentPresenter,
    isAppointmentRoomMember,
    isAppointmentRoomPeer,
};
