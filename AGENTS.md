# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains planning documents in `design plan/`: `screen-share-plan.md` defines the intended behavior, and `checklist.md` tracks implementation steps. No application source, tests, or web assets exist yet. Keep those documents aligned as the app develops. Put the future Node.js server and browser code in clearly named directories such as `src/` and `public/`; place automated tests in `test/`. Keep generated files and dependencies out of Git.

## Build, Test, and Development Commands

There is no `package.json` or runnable app yet, so no build or test command is available. When implementing the project, add npm scripts and document them in `README.md`: `npm install` for dependencies, `npm start` for the LAN server, and `npm test` for automated checks. Commit the lockfile so contributors install the same dependency versions. The planned host page is `http://localhost:3000/host`; viewers use the host's LAN IP on port 3000.

## Coding Style & Naming Conventions

Use two-space indentation for JavaScript, descriptive `camelCase` variables and functions, and `PascalCase` classes. Use lowercase, hyphenated names for web assets. Keep signaling messages explicit about their role and target viewer. Add a formatter or linter only with a documented command; none is configured yet.

## Testing Guidelines

No test framework or coverage threshold is established. Add focused automated tests for signaling roles, the three-viewer limit, and connection cleanup. Name tests `*.test.js`. Manually verify screen motion, computer audio, video-only status, viewer reconnects, and host-only controls from separate LAN computers before claiming the feature works.

## Commit & Pull Request Guidelines

The repository has no commits, so there is no existing commit convention. Use short imperative subjects such as `Add WebRTC signaling server`. Pull requests should summarize behavior, list the commands and devices used to test it, and include screenshots for visible UI changes. Link an issue when one exists.

## Security & Configuration

Restrict host controls and the host signaling role to loopback connections. Treat the LAN viewer URL as accessible to anyone on that network while sharing is active. Do not commit secrets, local IP configuration, or captured media.
