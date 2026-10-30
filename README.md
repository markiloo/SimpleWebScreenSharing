# LAN Screen Share

Share one Windows computer screen and its system audio with up to three desktop viewers on the same local network. The host uses Chrome or Edge's screen picker; viewers use Chrome or Edge. The app uses WebRTC directly over the LAN and favors smooth video. A delay of roughly 10 seconds is acceptable, but no artificial delay is added.

## Background

This project started with a practical problem: I was having trouble casting my computer screen to my TV. I created LAN Screen Share to explore another way to view a computer's screen on a larger display over the local network. It is also part of my practice using AI agents in a class, where I applied what I was learning to build a tool aimed at solving that problem. The project is a learning exercise as well as an attempt at a useful workaround.

## Requirements

- Windows host with Node.js 20 or newer and current Chrome or Edge
- Viewer computers on the same Wi-Fi or Ethernet network, using current Chrome or Edge

## Start

```powershell
npm install
npm start
```

Open the localhost on the host computer with the endpoint /host. Leave **Include computer audio** checked to request sound, then click **Start sharing**, choose **Entire Screen** and your primary monitor, and enable **Share system audio** if the browser offers it. Uncheck the option to share video only. Leave the host tab open. The page shows **No audio** when no audio track is captured.

Viewers open `http://<host-LAN-IP>:3000/` and click **Watch**. The host must start sharing first. Anyone on the LAN who has this URL can watch while sharing is active. Stop from the host page or Chrome's sharing indicator.

To find the host IP, run `ipconfig` in PowerShell and use the IPv4 address of the Wi-Fi or Ethernet adapter that connects to the viewers. If the viewer page does not load, allow Node.js on **Private networks** in the Windows Firewall prompt. Alternatively, add a Windows Firewall inbound rule for TCP port 3000 on the Private profile. Keep the app off public networks.

## Check and troubleshoot

```powershell
npm test
```

This runs signaling and access-control tests. For a different port, set `PORT` before `npm start` and use that port in both URLs.

- **Host is not sharing:** Start sharing on the host before clicking Watch.
- **No audio:** Reselect Entire Screen and enable system audio in the browser's prompt. The browser may not offer system audio for every display source.
- **Video does not play:** Click **Play / enable sound** on the viewer page.
- **Connection fails:** Confirm both computers are on the same LAN and client isolation or VPN routing is not blocking peer connections.
- **Choppy video:** Check Wi-Fi signal and reduce other network traffic. The app caps capture near 20 frames per second and video at 3 Mbps per viewer.

The app has no recording, password, internet relay, or mobile-browser support. Browser permission is required for every new sharing session. See [the implementation checklist](design%20plan/checklist.md) for acceptance checks.
