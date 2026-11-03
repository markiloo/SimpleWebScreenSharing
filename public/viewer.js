const watchButton = document.querySelector('#watch-button');
const leaveButton = document.querySelector('#leave-button');
const playButton = document.querySelector('#play-button');
const statusLabel = document.querySelector('#status');
const audioLabel = document.querySelector('#audio-status');
const video = document.querySelector('#stream');
const stage = document.querySelector('#stage');
const statusDot = document.querySelector('#status-dot');
const placeholderTitle = document.querySelector('#placeholder-title');
const placeholderText = document.querySelector('#placeholder-text');

let signaling = null;
let peer = null;
let remoteStream = null;
let closeReason = null;
let pendingCandidates = [];
let playAttempt = 0;
let connectionTimer = null;

function clearConnectionTimer() {
  if (connectionTimer) clearTimeout(connectionTimer);
  connectionTimer = null;
}

function setStatus(message, state = 'idle') {
  statusLabel.textContent = message;
  statusDot.className = state === 'idle' ? 'status-dot' : `status-dot ${state}`;
}

function setAudioStatus(hasAudio) {
  audioLabel.textContent = hasAudio ? 'Computer audio on' : 'No audio';
  audioLabel.className = `pill ${hasAudio ? 'good' : 'warning'}`;
}

function send(message) {
  if (signaling?.readyState === WebSocket.OPEN) signaling.send(JSON.stringify(message));
}

function leave(message = 'Left the stream') {
  clearConnectionTimer();
  const socket = signaling;
  signaling = null;
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  if (peer) peer.close();
  peer = null;
  remoteStream = null;
  pendingCandidates = [];
  playAttempt += 1;
  video.pause();
  video.srcObject = null;
  video.muted = false;
  stage.classList.remove('is-playing');
  placeholderTitle.textContent = 'Not watching yet';
  placeholderText.textContent = "Press Watch to connect to the host's screen.";
  watchButton.disabled = false;
  leaveButton.disabled = true;
  playButton.hidden = true;
  playButton.textContent = 'Play / enable sound';
  audioLabel.textContent = 'Audio unknown';
  audioLabel.className = 'pill';
  setStatus(message);
}

async function playVideo() {
  const attempt = ++playAttempt;
  try {
    await video.play();
    if (attempt !== playAttempt || !signaling) return;
    playButton.hidden = !video.muted;
    if (peer?.connectionState === 'connected') {
      stage.classList.add('is-playing');
      setStatus(video.muted ? 'Live (muted); press Enable sound' : 'Live', 'live');
    }
  } catch {
    if (attempt !== playAttempt || !signaling) return;
    if (!video.muted) {
      video.muted = true;
      playVideo();
      return;
    }
    playButton.hidden = false;
    stage.classList.remove('is-playing');
    placeholderTitle.textContent = 'Playback paused';
    placeholderText.textContent = 'Press Play / enable sound below to start.';
    setStatus('Press Play / enable sound to start playback', 'pending');
  }
}

async function acceptOffer(sdp) {
  clearConnectionTimer();
  if (peer) peer.close();
  const connection = new RTCPeerConnection({ iceServers: [] });
  peer = connection;
  const stream = new MediaStream();
  remoteStream = stream;
  video.srcObject = stream;
  connection.ontrack = (event) => {
    if (peer !== connection) return;
    if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
    playVideo();
  };
  connection.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'ice-candidate', candidate: event.candidate });
  };
  connection.onconnectionstatechange = () => {
    if (peer !== connection) return;
    if (connection.connectionState === 'connected') {
      clearConnectionTimer();
      if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        stage.classList.add('is-playing');
        setStatus(video.muted ? 'Live (muted); press Enable sound' : 'Live', 'live');
      } else setStatus('Connected; starting video…', 'pending');
    } else if (connection.connectionState === 'disconnected') setStatus('Connection interrupted…', 'pending');
    else if (connection.connectionState === 'failed') leave('Connection failed; press Watch to retry');
  };
  try {
    await connection.setRemoteDescription(sdp);
    for (const candidate of pendingCandidates) await connection.addIceCandidate(candidate).catch(() => {});
    pendingCandidates = [];
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    send({ type: 'answer', sdp: connection.localDescription });
    if (connection.connectionState !== 'connected') {
      connectionTimer = setTimeout(() => {
        if (peer === connection && connection.connectionState !== 'connected') {
          leave('Video connection timed out. Check LAN or firewall settings, then retry');
        }
      }, 15000);
    }
  } catch {
    leave('Could not connect; press Watch to retry');
  }
}

video.addEventListener('playing', () => {
  if (!signaling || peer?.connectionState !== 'connected') return;
  stage.classList.add('is-playing');
  playButton.hidden = video.muted ? false : true;
  if (video.muted) {
    playButton.textContent = 'Enable sound';
    setStatus('Live (muted); press Enable sound', 'live');
  } else {
    setStatus('Live', 'live');
  }
});

function watch() {
  if (signaling) return;
  closeReason = null;
  stage.classList.remove('is-playing');
  placeholderTitle.textContent = 'Connecting…';
  placeholderText.textContent = 'Waiting for the host to send video.';
  watchButton.disabled = true;
  leaveButton.disabled = false;
  setStatus('Connecting…', 'pending');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/signal?role=viewer`);
  signaling = socket;
  connectionTimer = setTimeout(() => {
    if (signaling === socket && !peer) leave('Host did not send video. Press Watch to retry');
  }, 15000);
  socket.onmessage = (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'viewer-ready') setStatus('Waiting for video…', 'pending');
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
playButton.addEventListener('click', () => {
  video.muted = false;
  playButton.textContent = 'Play / enable sound';
  playVideo();
});
window.addEventListener('pagehide', () => leave());
