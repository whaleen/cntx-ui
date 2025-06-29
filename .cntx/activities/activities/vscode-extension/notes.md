# Notes: VS Code Extension

## General Notes

This file is for capturing thoughts, research, and decisions related to building the `cntx-ui` VS Code extension.

## Technical Decisions

- **Decision**: Use `vsce` for packaging and publishing.
- **Rationale**: Official and standard tool for VS Code extension management.

- **Decision**: Use `esbuild` or `webpack` for bundling the extension.
- **Rationale**: Standard practice for VS Code extensions to ensure a small and efficient package.

- **Decision**: The communication bridge will be a dedicated module.
- **Rationale**: To cleanly separate the logic for `postMessage` (VS Code) and WebSockets (web), allowing the core and UI to remain agnostic.

## Research & Links

*   **VS Code API Docs:**
    *   [Extension Entry File](https://code.visualstudio.com/api/references/extension-manifest#main)
    *   [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
    *   [Commands Guide](https://code.visualstudio.com/api/extension-guides/command)
    *   [Activity Bar Contribution](https://code.visualstudio.com/api/references/contribution-points#contributes.viewsContainers)
*   **Tooling:**
    *   [`@vscode/vsce`](https://www.npmjs.com/package/@vscode/vsce)

## Open Questions

*   What is the best way to package the `web/dist` files within the extension?
*   How will the extension manage the lifecycle of the `server.js` process if it's run as a child process?
