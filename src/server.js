const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { WebSocket, WebSocketServer } = require('ws');

const MAX_VIEWERS = 3;
const DEFAULT_PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ROUTES = new Map([
  ['/', ['viewer.html', 'text/html; charset=utf-8', false]],
  ['/viewer.js', ['viewer.js', 'text/javascript; charset=utf-8', false]],
  ['/style.css', ['style.css', 'text/css; charset=utf-8', false]],
  ['/host', ['host.html', 'text/html; charset=utf-8', true]],
  ['/host.js', ['host.js', 'text/javascript; charset=utf-8', true]],
]);

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function createApp() {
  let host = null;
  let nextViewerId = 1;
  const viewers = new Map();
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function notifyCount() {
    if (host) send(host, { type: 'viewer-count', count: viewers.size });
  }

  function removeViewer(id) {
    if (!viewers.delete(id)) return;
    if (host) send(host, { type: 'viewer-left', viewerId: id });
    notifyCount();
  }

  function removeHost(socket) {
    if (host !== socket) return;
    host = null;
    for (const viewer of viewers.values()) {
      send(viewer, { type: 'host-stopped' });
      viewer.close(1000, 'Host stopped sharing');
    }
    viewers.clear();
  }

  function reject(socket, type, reason) {
    send(socket, { type });
    socket.close(1008, reason);
  }

  function handleHostMessage(socket, raw) {
    if (socket !== host || typeof raw !== 'object' || raw === null) return;
    if (raw.type === 'offer' || raw.type === 'ice-candidate' || raw.type === 'stream-info') {
      const target = viewers.get(raw.viewerId);
      if (!target) return;
      if (raw.type === 'offer' && raw.sdp?.type === 'offer' && typeof raw.sdp.sdp === 'string') {
        send(target, { type: 'offer', sdp: raw.sdp });
      } else if (raw.type === 'ice-candidate' && raw.candidate && typeof raw.candidate.candidate === 'string') {
        send(target, { type: 'ice-candidate', candidate: raw.candidate });
      } else if (raw.type === 'stream-info' && typeof raw.hasAudio === 'boolean') {
        send(target, { type: 'stream-info', hasAudio: raw.hasAudio });
      }
    } else if (raw.type === 'disconnect-viewer' && viewers.has(raw.viewerId)) {
      const target = viewers.get(raw.viewerId);
      send(target, { type: 'connection-failed' });
      target.close(1011, 'Peer connection failed');
    }
  }

  function handleViewerMessage(id, raw) {
    if (!host || typeof raw !== 'object' || raw === null) return;
    if (raw.type === 'answer' && raw.sdp?.type === 'answer' && typeof raw.sdp.sdp === 'string') {
      send(host, { type: 'answer', viewerId: id, sdp: raw.sdp });
    } else if (raw.type === 'ice-candidate' && raw.candidate && typeof raw.candidate.candidate === 'string') {
      send(host, { type: 'ice-candidate', viewerId: id, candidate: raw.candidate });
    }
  }

  sockets.on('connection', (socket, request, role) => {
    if (role === 'host') {
      if (!isLoopback(request.socket.remoteAddress)) return reject(socket, 'host-forbidden', 'Host must be local');
      if (host) return reject(socket, 'host-busy', 'Host already connected');
      host = socket;
      send(socket, { type: 'host-ready', viewerCount: viewers.size });
      socket.on('message', (data) => {
        try { handleHostMessage(socket, JSON.parse(data.toString())); } catch { /* Ignore malformed messages. */ }
      });
      socket.on('close', () => removeHost(socket));
      socket.on('error', () => removeHost(socket));
      return;
    }

    if (!host) return reject(socket, 'host-offline', 'Host is not sharing');
    if (viewers.size >= MAX_VIEWERS) return reject(socket, 'room-full', 'Room is full');
    const id = String(nextViewerId++);
    viewers.set(id, socket);
    send(socket, { type: 'viewer-ready' });
    send(host, { type: 'viewer-joined', viewerId: id });
    notifyCount();
    socket.on('message', (data) => {
      try { handleViewerMessage(id, JSON.parse(data.toString())); } catch { /* Ignore malformed messages. */ }
    });
    socket.on('close', () => removeViewer(id));
    socket.on('error', () => removeViewer(id));
  });

  const server = http.createServer((request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; } catch {
      response.writeHead(400).end();
      return;
    }
    const route = ROUTES.get(pathname);
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    const [file, contentType, localOnly] = route;
    if (localOnly && !isLoopback(request.socket.remoteAddress)) {
      response.writeHead(403).end('Host controls are local only.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(path.join(PUBLIC_DIR, file)).pipe(response);
  });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try { url = new URL(request.url, 'http://localhost'); } catch { socket.destroy(); return; }
    const role = url.searchParams.get('role');
    if (url.pathname !== '/signal' || (role !== 'host' && role !== 'viewer')) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    if (role === 'host' && !isLoopback(request.socket.remoteAddress)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      sockets.emit('connection', client, request, role);
    });
  });

  async function close() {
    for (const viewer of viewers.values()) viewer.terminate();
    viewers.clear();
    if (host) host.terminate();
    host = null;
    await new Promise((resolve) => sockets.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }

  return { server, close };
}

if (require.main === module) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer from 1 to 65535.');
    process.exit(1);
  }
  const app = createApp();
  app.server.listen(port, '0.0.0.0', () => {
    console.log(`Host controls: http://localhost:${port}/host`);
    console.log(`Viewers: http://<your-LAN-IP>:${port}/`);
  });
}

module.exports = { createApp, isLoopback, MAX_VIEWERS };
