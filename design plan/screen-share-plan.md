# LAN Screen Share with Computer Audio

## Summary

Build a small Node.js app that streams the host computer's selected screen to up to three viewers on the same LAN. The host starts sharing from a control page in Chrome; viewers open the computer's IP address in a desktop browser. Use WebRTC and favor smooth playback; a delay of roughly 10 seconds is acceptable.

## Implementation

- Serve a host control page at `http://localhost:3000/host` and a viewer page at `http://<host-ip>:3000/`. Bind the server to the LAN, but allow only local requests to become the host.
- On a **Start sharing** click, request screen and system audio through the browser's capture prompt. Guide the host to select the primary monitor and enable system audio. Show whether an audio track was provided; allow video-only sharing with a clear **No audio** status.
- Use a WebSocket signaling server and one WebRTC peer connection per viewer. Exchange offers, answers, and ICE candidates locally, without an internet relay or account service. Limit active viewers to three and show a clear message to a fourth.
- Give viewers a **Watch** button to start video and audio playback. Show connecting, live, audio unavailable, and disconnected states. Clean up connections when a viewer leaves, the host stops sharing, or browser capture ends.
- Tune capture frame rate and video bitrate for stable playback on the LAN. Do not add an artificial delay; reduce video quality before allowing repeated stalls.
- Include setup instructions for running the server, finding the host's LAN IP, and allowing the chosen port through Windows Firewall if needed. Anyone with the LAN link can watch while sharing is active.

## Test plan

- On two LAN computers, verify smooth screen motion and computer sound in Chrome or Edge. Check that normal LAN playback stays within roughly 10 seconds of the host screen without repeated stalls.
- Verify video-only viewing when the capture prompt provides no audio track.
- Verify three simultaneous viewers, rejection of a fourth, viewer refresh and reconnect, host stop, and browser capture ending.
- Verify host controls cannot be activated from another LAN computer.

## Assumptions

- The host is a Windows computer with Chrome installed; viewers use desktop Chrome or Edge.
- The host selects the primary monitor in the browser prompt each time. Browser capture permission cannot be preselected or retained automatically.
- The app targets local-network use only; no password, recording, remote internet access, or mobile-browser support in the first version.
