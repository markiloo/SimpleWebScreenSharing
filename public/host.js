const startButton = document.querySelector('#start-button');
const stopButton = document.querySelector('#stop-button');
const statusLabel = document.querySelector('#status');
const audioLabel = document.querySelector('#audio-status');
const viewerCountLabel = document.querySelector('#viewer-count');
const preview = document.querySelector('#preview');
const includeAudio = document.querySelector('#include-audio');
document.querySelector('#viewer-url').textContent = `http://<your-LAN-IP>:${location.port || '80'}/`;

let captureStream = null;
let signaling = null;
let peers = new Map();
let pendingCandidates = new Map();
let starting = false;

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

function closePeer(viewerId) {
  const peer = peers.get(viewerId);
  if (!peer) return;
  peer.close();
  peers.delete(viewerId);
  pendingCandidates.delete(viewerId);
}

function stopSharing(message = 'Sharing stopped') {
  starting = false;
  const socket = signaling;
  signaling = null;
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  for (const viewerId of peers.keys()) closePeer(viewerId);
  if (captureStream) {
    for (const track of captureStream.getTracks()) track.stop();
    captureStream = null;
  }
  preview.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  includeAudio.disabled = false;
  viewerCountLabel.textContent = '0 viewers connected';
  audioLabel.textContent = 'Audio not started';
  audioLabel.className = 'pill';
  setStatus(message);
}

async function createPeer(viewerId) {
  if (!captureStream || !signaling || peers.has(viewerId)) return;
  const peer = new RTCPeerConnection({ iceServers: [] });
  peers.set(viewerId, peer);
  pendingCandidates.set(viewerId, []);
  peer.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'ice-candidate', viewerId, candidate: event.candidate });
  };
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === 'failed') {
      send({ type: 'disconnect-viewer', viewerId });
      closePeer(viewerId);
    }
  };
  try {
    for (const track of captureStream.getTracks().filter((item) => item.readyState === 'live')) {
      const sender = peer.addTrack(track, captureStream);
      if (track.kind === 'video') {
        const parameters = sender.getParameters();
        if (parameters.encodings?.length) {
          parameters.encodings[0].maxBitrate = 3_000_000;
          parameters.encodings[0].maxFramerate = 20;
          try { await sender.setParameters(parameters); } catch { /* Browser defaults remain usable. */ }
        }
      }
    }
    send({ type: 'stream-info', viewerId, hasAudio: captureStream.getAudioTracks().some((track) => track.readyState === 'live') });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    send({ type: 'offer', viewerId, sdp: peer.localDescription });
  } catch {
    send({ type: 'disconnect-viewer', viewerId });
    closePeer(viewerId);
  }
}

function handleSignal(message) {
  if (message.type === 'viewer-joined') {
    createPeer(message.viewerId);
  } else if (message.type === 'viewer-left') {
    closePeer(message.viewerId);
  } else if (message.type === 'viewer-count') {
    viewerCountLabel.textContent = `${message.count} viewer${message.count === 1 ? '' : 's'} connected`;
  } else if (message.type === 'answer') {
    const peer = peers.get(message.viewerId);
    if (peer && peer.signalingState === 'have-local-offer') {
      peer.setRemoteDescription(message.sdp).then(async () => {
        const queued = pendingCandidates.get(message.viewerId) || [];
        pendingCandidates.delete(message.viewerId);
        for (const candidate of queued) await peer.addIceCandidate(candidate).catch(() => {});
      }).catch(() => {
        send({ type: 'disconnect-viewer', viewerId: message.viewerId });
        closePeer(message.viewerId);
      });
    }
  } else if (message.type === 'ice-candidate') {
    const peer = peers.get(message.viewerId);
    if (peer?.remoteDescription) peer.addIceCandidate(message.candidate).catch(() => {});
    else if (peer) pendingCandidates.get(message.viewerId)?.push(message.candidate);
  }
}

function connectSignaling() {
  return new Promise((resolve, reject) => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/signal?role=host`);
    signaling = socket;
    let settled = false;
    socket.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'host-ready') {
        settled = true;
        resolve();
      } else if (message.type === 'host-busy' || message.type === 'host-forbidden') {
        settled = true;
        reject(new Error(message.type === 'host-busy' ? 'Another host tab is already sharing.' : 'Host controls require localhost.'));
      } else {
        handleSignal(message);
      }
    };
    socket.onerror = () => {
      if (!settled) { settled = true; reject(new Error('Could not connect to the local server.')); }
    };
    socket.onclose = () => {
      if (signaling !== socket) return;
      if (!settled) { settled = true; reject(new Error('The local server closed the connection.')); }
      else stopSharing('Server disconnected; sharing stopped');
    };
  });
}

async function startSharing() {
  if (starting || captureStream) return;
  starting = true;
  startButton.disabled = true;
  includeAudio.disabled = true;
  setStatus(includeAudio.checked ? 'Choose your primary screen and enable system audio…' : 'Choose your primary screen…');
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor', frameRate: { ideal: 20, max: 24 } },
      audio: includeAudio.checked,
      systemAudio: includeAudio.checked ? 'include' : 'exclude',
      monitorTypeSurfaces: 'include',
      selfBrowserSurface: 'exclude',
    });
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || (videoTrack.getSettings().displaySurface && videoTrack.getSettings().displaySurface !== 'monitor')) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Choose Entire Screen in the sharing prompt.');
    }
    captureStream = stream;
    videoTrack.addEventListener('ended', () => stopSharing('Screen capture ended'));
    for (const audioTrack of stream.getAudioTracks()) {
      audioTrack.addEventListener('ended', () => {
        if (!captureStream) return;
        setAudioStatus(false);
        for (const viewerId of peers.keys()) send({ type: 'stream-info', viewerId, hasAudio: false });
      });
    }
    preview.srcObject = stream;
    setAudioStatus(stream.getAudioTracks().some((track) => track.readyState === 'live'));
    await connectSignaling();
    if (!captureStream || signaling?.readyState !== WebSocket.OPEN) {
      throw new Error('The local server closed the connection.');
    }
    stopButton.disabled = false;
    setStatus('Sharing live');
  } catch (error) {
    stopSharing(error.name === 'NotAllowedError' ? 'Screen selection was cancelled' : error.message || 'Could not start sharing');
  } finally {
    starting = false;
  }
}

startButton.addEventListener('click', startSharing);
stopButton.addEventListener('click', () => stopSharing());
window.addEventListener('pagehide', () => stopSharing());
