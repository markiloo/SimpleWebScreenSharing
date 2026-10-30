# Repository Guidelines

## Project Structure & Module Organization

`src/server.js` serves pages and relays WebRTC signaling. `public/` contains the host and viewer pages, browser scripts, and styles. `test/` holds Node.js integration tests. `design plan/` contains the feature plan and implementation checklist. Keep generated files and dependencies out of Git.

## Build, Test, and Development Commands

Run `npm ci` to install locked dependencies, `npm start` to serve on port 3000, and `npm test` to run signaling tests. No build step is required. The host page is `http://localhost:3000/host`; viewers use the host's LAN IP on port 3000. Use `PORT` to choose another port.

## Coding Style & Naming Conventions

Use two-space indentation for JavaScript, descriptive `camelCase` variables and functions, and `PascalCase` classes. Use lowercase, hyphenated names for web assets. Keep signaling messages explicit about their role and target viewer. No formatter or linter is configured; keep changes consistent with nearby code.

## Testing Guidelines

Tests use Node's built-in `node:test` module; no coverage threshold is established. Name tests `*.test.js` and run them with `npm test`. Cover signaling roles, the three-viewer limit, message routing, and cleanup. Manually verify screen motion, computer audio, video-only status, and viewer reconnects from separate LAN computers before claiming the full feature works.

## Commit & Pull Request Guidelines

The repository has no commits, so there is no existing commit convention. Use short imperative subjects such as `Add WebRTC signaling server`. Pull requests should summarize behavior, list the commands and devices used to test it, and include screenshots for visible UI changes. Link an issue when one exists.

## Security & Configuration

Restrict host controls and the host signaling role to loopback connections. Treat the LAN viewer URL as accessible to anyone on that network while sharing is active. Do not commit secrets, local IP configuration, or captured media.
