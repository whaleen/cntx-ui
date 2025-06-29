## Relevant Files

- `vscode-extension/extension.ts` - The main entry point for the VS Code extension.
- `vscode-extension/package.json` - The extension manifest and dependencies.
- `vscode-extension/webpack.config.js` - The build configuration for bundling the extension.
- `lib/vscode-bridge.js` - The communication bridge between the webview and the extension host.
- `web/src/components/Dashboard.tsx` - The new React component for the initial dashboard UI.
- `web/src/api.js` - The updated API module in the frontend to handle both WebSocket and webview communication.

### Notes

- A new directory `vscode-extension/` will be created to house the extension-specific files.
- The existing `web/` and `lib/` directories will be leveraged by the extension.

## Tasks

- [ ] 1.0 Project Scaffolding & Setup
  - [ ] 1.1 Create the `vscode-extension/` directory.
  - [ ] 1.2 Initialize a new `package.json` for the extension with the required fields (`name`, `publisher`, `engines`, `contributes`, etc.).
  - [ ] 1.3 Create the main `extension.ts` file with `activate` and `deactivate` functions.
  - [ ] 1.4 Set up `webpack.config.js` to bundle the extension source code.

- [ ] 2.0 Core VS Code Integration
  - [ ] 2.1 Implement the `cntx-ui: Open UI` command to create and show a `WebviewPanel`.
  - [ ] 2.2 Configure the `contributes` section in `package.json` to add an Activity Bar icon.
  - [ ] 2.3 Implement the logic for the Activity Bar icon to open the webview.
  - [ ] 2.4 Configure the `activationEvents` in `package.json` to activate the extension when a `.cntx` directory is present.

- [ ] 3.0 UI Implementation (Dashboard)
  - [ ] 3.1 Create the `Dashboard.tsx` React component.
  - [ ] 3.2 Add UI elements for start/stop buttons, a server status indicator, and a placeholder for the bundle list.
  - [ ] 3.3 Modify the frontend routing or logic to display the `Dashboard.tsx` component when loaded inside the webview.

- [ ] 4.0 Backend Logic & Communication
  - [ ] 4.1 Create the `vscode-bridge.js` module to handle `postMessage` communication.
  - [ ] 4.2 Adapt the frontend's `api.js` to detect the VS Code environment and use the `vscode-bridge.js` instead of WebSockets.
  - [ ] 4.3 In `extension.ts`, listen for messages from the webview and call the appropriate backend functions from `lib/`.
  - [ ] 4.4 Implement the `cntx-ui: Start Server` and `cntx-ui: Stop Server` commands.

- [ ] 5.0 Finalization & Packaging
  - [ ] 5.1 Write a `README.md` for the extension with usage and development instructions.
  - [ ] 5.2 Use `vsce` to package the extension into a `.vsix` file.
  - [ ] 5.3 Manually install and test the `.vsix` file in a clean VS Code instance.