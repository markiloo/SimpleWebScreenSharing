const assert = require('node:assert/strict');
const { test } = require('node:test');
const { WebSocket } = require('ws');
const { createApp, isLoopback, MAX_VIEWERS } = require('../src/server');

function inbox(socket) {
  const messages = [];
  const waiters = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (waiters.length) waiters.shift()(message);
    else messages.push(message);
  });
  return {
    next() {
      if (messages.length) return Promise.resolve(messages.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for signaling')), 2000);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    pending() { return messages.length; },
  };
}

test('HTTP routes and signaling enforce roles, viewer limit, relay, and cleanup', async () => {
  const app = createApp();
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const sockets = [];
  async function connect(role) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/signal?role=${role}`);
    const queue = inbox(socket);
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return { socket, queue };
  }
  try {
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/host`)).status, 200);
    assert.equal((await fetch(`${base}/host.js`)).status, 200);
    const lanInfo = await fetch(`${base}/api/lan-url`);
    assert.equal(lanInfo.status, 200);
    const { url: lanUrl } = await lanInfo.json();
    assert.ok(lanUrl === null || /^http:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d+\/$/.test(lanUrl));
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);

    const offline = await connect('viewer');
    assert.equal((await offline.queue.next()).type, 'host-offline');
    const host = await connect('host');
    assert.equal((await host.queue.next()).type, 'host-ready');
    const busy = await connect('host');
    assert.equal((await busy.queue.next()).type, 'host-busy');

    const viewers = [];
    const ids = [];
    for (let index = 0; index < MAX_VIEWERS; index++) {
      const viewer = await connect('viewer');
      viewers.push(viewer);
      assert.equal((await viewer.queue.next()).type, 'viewer-ready');
      const joined = await host.queue.next();
      assert.equal(joined.type, 'viewer-joined');
      ids.push(joined.viewerId);
      assert.deepEqual(await host.queue.next(), { type: 'viewer-count', count: index + 1 });
    }
    const fourth = await connect('viewer');
    assert.equal((await fourth.queue.next()).type, 'room-full');

    host.socket.send(JSON.stringify({ type: 'stream-info', viewerId: ids[0], hasAudio: false }));
    assert.deepEqual(await viewers[0].queue.next(), { type: 'stream-info', hasAudio: false });
    host.socket.send(JSON.stringify({ type: 'offer', viewerId: ids[0], sdp: { type: 'offer', sdp: 'sample-offer' } }));
    assert.deepEqual(await viewers[0].queue.next(), { type: 'offer', sdp: { type: 'offer', sdp: 'sample-offer' } });
    assert.equal(viewers[1].queue.pending(), 0);
    viewers[0].socket.send(JSON.stringify({ type: 'answer', sdp: { type: 'answer', sdp: 'sample-answer' } }));
    assert.deepEqual(await host.queue.next(), { type: 'answer', viewerId: ids[0], sdp: { type: 'answer', sdp: 'sample-answer' } });
    viewers[0].socket.send(JSON.stringify({ type: 'ice-candidate', candidate: { candidate: 'candidate:sample' } }));
    assert.deepEqual(await host.queue.next(), { type: 'ice-candidate', viewerId: ids[0], candidate: { candidate: 'candidate:sample' } });
    host.socket.send(JSON.stringify({ type: 'ice-candidate', viewerId: ids[0], candidate: { candidate: 'candidate:reply' } }));
    assert.deepEqual(await viewers[0].queue.next(), { type: 'ice-candidate', candidate: { candidate: 'candidate:reply' } });

    viewers[0].socket.close();
    assert.deepEqual(await host.queue.next(), { type: 'viewer-left', viewerId: ids[0] });
    assert.deepEqual(await host.queue.next(), { type: 'viewer-count', count: 2 });
    const replacement = await connect('viewer');
    assert.equal((await replacement.queue.next()).type, 'viewer-ready');
    assert.equal((await host.queue.next()).type, 'viewer-joined');
    assert.deepEqual(await host.queue.next(), { type: 'viewer-count', count: 3 });

    host.socket.close();
    for (const viewer of [...viewers.slice(1), replacement]) {
      assert.equal((await viewer.queue.next()).type, 'host-stopped');
    }
    const nextHost = await connect('host');
    assert.equal((await nextHost.queue.next()).type, 'host-ready');
    const nextViewer = await connect('viewer');
    assert.equal((await nextViewer.queue.next()).type, 'viewer-ready');
    assert.equal((await nextHost.queue.next()).type, 'viewer-joined');
  } finally {
    for (const socket of sockets) socket.terminate();
    await app.close();
  }
});

test('only actual loopback addresses may control the host', () => {
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('::ffff:127.0.0.1'), true);
  assert.equal(isLoopback('192.168.1.20'), false);
  assert.equal(isLoopback('::ffff:192.168.1.20'), false);
});
