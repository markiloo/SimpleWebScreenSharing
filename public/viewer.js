const watchButton = document.querySelector('#watch-button');
const leaveButton = document.querySelector('#leave-button');
const playButton = document.querySelector('#play-button');
const statusLabel = document.querySelector('#status');
const audioLabel = document.querySelector('#audio-status');
const video = document.querySelector('#stream');

let signaling = null;
let peer = null;
let remoteStream = null;
let closeReason = null;
let pendingCandidates = [];

function setStatus(message) {
  statusLabel.textContent = message;
}

function setAudioStatus(hasAudio) {
  audioLabel.textContent = hasAudio ? 'Computer audio on' : 'No audio';
  audioLabel.className = `pill ${hasAudio ? 'good' : 'warning'}`;
}

function send(message) {
  if (signaling?.readyState === WebSocket.OPEN) signaling.send(JSON.stringify(message));
}

function leave(message = 'Left the stream') {
  const socket = signaling;
  signaling = null;
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  if (peer) peer.close();
  peer = null;
  remoteStream = null;
  pendingCandidates = [];
  video.pause();
  video.srcObject = null;
  watchButton.disabled = false;
  leaveButton.disabled = true;
  playButton.hidden = true;
  audioLabel.textContent = 'Audio unknown';
  audioLabel.className = 'pill';
  setStatus(message);
}

async function playVideo() {
  try {
    await video.play();
    playButton.hidden = true;
  } catch {
    playButton.hidden = false;
    setStatus('Press Play / enable sound to start playback');
  }
}

async function acceptOffer(sdp) {
  if (peer) peer.close();
  const connection = new RTCPeerConnection({ iceServers: [] });
  peer = connection;
  const stream = new MediaStream();
  remoteStream = stream;
  video.srcObject = stream;
  connection.ontrack = (event) => {
    if (peer !== connection) return;
    stream.addTrack(event.track);
    playVideo();
  };
  connection.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'ice-candidate', candidate: event.candidate });
  };
  connection.onconnectionstatechange = () => {
    if (peer !== connection) return;
    if (connection.connectionState === 'connected') setStatus('Live');
    else if (connection.connectionState === 'disconnected') setStatus('Connection interrupted…');
    else if (connection.connectionState === 'failed') leave('Connection failed; press Watch to retry');
  };
  try {
    await connection.setRemoteDescription(sdp);
    for (const candidate of pendingCandidates) await connection.addIceCandidate(candidate).catch(() => {});
    pendingCandidates = [];
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    send({ type: 'answer', sdp: connection.localDescription });
  } catch {
    leave('Could not connect; press Watch to retry');
  }
}

function watch() {
  if (signaling) return;
  closeReason = null;
  watchButton.disabled = true;
  leaveButton.disabled = false;
  setStatus('Connecting…');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/signal?role=viewer`);
  signaling = socket;
  socket.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'viewer-ready') setStatus('Waiting for video…');
    else if (message.type === 'stream-info') setAudioStatus(message.hasAudio);
    else if (message.type === 'offer') acceptOffer(message.sdp);
    else if (message.type === 'ice-candidate') {
      if (peer?.remoteDescription) peer.addIceCandidate(message.candidate).catch(() => {});
      else pendingCandidates.push(message.candidate);
    } else if (message.type === 'room-full') closeReason = 'Room full (3 viewers); try again later';
    else if (message.type === 'host-offline' || message.type === 'host-stopped') closeReason = 'Host is not sharing; try again later';
    else if (message.type === 'connection-failed') closeReason = 'Connection failed; press Watch to retry';
  };
  socket.onerror = () => { closeReason ||= 'Could not reach the host server'; };
  socket.onclose = () => {
    if (signaling === socket) leave(closeReason || 'Disconnected; press Watch to reconnect');
  };
}

watchButton.addEventListener('click', watch);
leaveButton.addEventListener('click', () => leave());
playButton.addEventListener('click', playVideo);
window.addEventListener('pagehide', () => leave());
