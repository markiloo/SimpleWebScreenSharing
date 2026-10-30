# Implementation checklist

## 1. Set up the project

- [x] Create a Node.js project with a `start` script and a locked WebSocket dependency.
- [x] Add `.gitignore` entries for `node_modules` and local configuration files.
- [x] Create the HTTP server and serve the host and viewer pages on port 3000.
- [x] Listen on the LAN while restricting the host page and host signaling role to loopback connections.

## 2. Build signaling and session management

- [x] Add a WebSocket endpoint with separate host and viewer roles.
- [x] Allow one active host and at most three active viewers; give additional viewers a clear full-room response.
- [x] Relay WebRTC offers, answers, and ICE candidates only between the host and the intended viewer.
- [x] Remove disconnected viewers and notify all viewers when the host stops or disconnects.

## 3. Build the host controls

- [x] Add **Start sharing** and **Stop sharing** controls with visible session and viewer-count status.
- [x] On a Start click, call `getDisplayMedia` with video and system-audio options, prompting the host to choose the primary monitor and enable audio.
- [x] Check the returned tracks and show **No audio** if the browser provides video only.
- [x] Create one WebRTC peer connection per viewer and add the captured tracks to each connection.
- [x] Set practical capture frame-rate and video bitrate limits, prioritizing stable playback over minimum delay.
- [x] Stop all tracks and close peer connections when sharing stops or browser capture ends.

## 4. Build the viewer page

- [x] Add a **Watch** button that opens signaling and begins media playback after the viewer's click.
- [x] Display connecting, live, no-audio, room-full, and disconnected states.
- [x] Attach incoming video and audio tracks to a media element with viewer volume controls.
- [x] Close the connection when the viewer leaves; allow a refreshed page to reconnect when a slot is available.

## 5. Document and verify

- [x] Write a README with installation, startup, the host URL, and the LAN viewer URL.
- [x] Explain how to find the host's LAN IP and allow port 3000 through Windows Firewall if needed.
- [x] Verify screen motion and computer audio from another LAN computer using desktop Chrome or Edge.
- [x] Check that normal LAN playback stays within roughly 10 seconds of the host screen without repeated stalls; adjust capture quality if needed.
- [x] Verify that video-only sharing works and clearly reports missing audio.
- [x] Verify three simultaneous viewers, fourth-viewer rejection, viewer refresh, and freed slots after disconnect in Edge browser tabs. Signaling behavior is also covered by `npm test`.
- [x] Verify that Stop sharing and browser capture ending disconnect viewers and release capture tracks.
- [x] Verify a LAN viewer cannot access host controls or claim the host signaling role.
