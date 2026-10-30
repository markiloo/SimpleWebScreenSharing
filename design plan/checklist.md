# Implementation checklist

## 1. Set up the project

- [ ] Create a Node.js project with a `start` script and a locked WebSocket dependency.
- [ ] Add `.gitignore` entries for `node_modules` and local configuration files.
- [ ] Create the HTTP server and serve the host and viewer pages on port 3000.
- [ ] Listen on the LAN while restricting the host page and host signaling role to loopback connections.

## 2. Build signaling and session management

- [ ] Add a WebSocket endpoint with separate host and viewer roles.
- [ ] Allow one active host and at most three active viewers; give additional viewers a clear full-room response.
- [ ] Relay WebRTC offers, answers, and ICE candidates only between the host and the intended viewer.
- [ ] Remove disconnected viewers and notify all viewers when the host stops or disconnects.

## 3. Build the host controls

- [ ] Add **Start sharing** and **Stop sharing** controls with visible session and viewer-count status.
- [ ] On a Start click, call `getDisplayMedia` with video and system-audio options, prompting the host to choose the primary monitor and enable audio.
- [ ] Check the returned tracks and show **No audio** if the browser provides video only.
- [ ] Create one WebRTC peer connection per viewer and add the captured tracks to each connection.
- [ ] Set practical capture frame-rate and video bitrate limits, prioritizing stable playback over minimum delay.
- [ ] Stop all tracks and close peer connections when sharing stops or browser capture ends.

## 4. Build the viewer page

- [ ] Add a **Watch** button that opens signaling and begins media playback after the viewer's click.
- [ ] Display connecting, live, no-audio, room-full, and disconnected states.
- [ ] Attach incoming video and audio tracks to a media element with viewer volume controls.
- [ ] Close the connection when the viewer leaves; allow a refreshed page to reconnect when a slot is available.

## 5. Document and verify

- [ ] Write a README with installation, startup, the host URL, and the LAN viewer URL.
- [ ] Explain how to find the host's LAN IP and allow port 3000 through Windows Firewall if needed.
- [ ] Verify screen motion and computer audio from another LAN computer using desktop Chrome or Edge.
- [ ] Check that normal LAN playback stays within roughly 10 seconds of the host screen without repeated stalls; adjust capture quality if needed.
- [ ] Verify that video-only sharing works and clearly reports missing audio.
- [ ] Verify three simultaneous viewers, fourth-viewer rejection, viewer refresh, and freed slots after disconnect.
- [ ] Verify that Stop sharing and browser capture ending disconnect viewers and release capture tracks.
- [ ] Verify a LAN viewer cannot access host controls or claim the host signaling role.
