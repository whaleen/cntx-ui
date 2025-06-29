# Activity: VS Code Extension for cntx-ui

## Introduction/Overview

This activity outlines the plan to adapt the existing `cntx-ui` tool into a VS Code extension. The goal is to provide users with a seamless experience directly within their editor, combining the rich, interactive UI of the current web application with the convenience of native VS Code integrations. This will allow for faster workflows, better context switching, and deeper integration with the developer's primary workspace.

## Goals

*   **Integrated Experience:** Embed the `cntx-ui` web UI within a VS Code webview.
*   **Native Functionality:** Expose core `cntx-ui` actions through the VS Code Command Palette and Activity Bar.
*   **Shared Codebase:** Maintain a single, shared codebase for both the standalone web application and the VS Code extension to ensure maintainability.
*   **Basic Dashboard:** The initial version will focus on a simple dashboard to monitor and manage the `cntx-ui` system.

## User Stories

*   **As a developer,** I want to open the `cntx-ui` interface directly within VS Code so that I don't have to switch between my editor and a separate browser window.
*   **As a developer,** I want to start and stop the `cntx-ui` server from the VS Code Command Palette for quick and easy control.
*   **As a developer,** I want to see the health status of the `cntx-ui` system at a glance from within VS Code.
*   **As a developer,** I want to view a list of my project's bundles from a simple dashboard inside VS Code.
*   **As an AI assistant,** I want to be able to interact with the `cntx-ui` backend through the extension, enabling programmatic control over bundling and context management.

## Functional Requirements

1.  The extension must provide a command to open the `cntx-ui` web UI in a webview panel.
2.  The extension must add an icon to the Activity Bar that, when clicked, opens the `cntx-ui` webview.
3.  The extension must automatically activate when a `.cntx` directory is detected in the workspace root.
4.  The extension must provide commands in the Command Palette to:
    *   `cntx-ui: Start Server`
    *   `cntx-ui: Stop Server`
    *   `cntx-ui: Open UI`
5.  The initial UI presented in the webview will be a "dashboard" that includes:
    *   Buttons to start and stop the `cntx-ui` server.
    *   A status indicator for the server's health (e.g., "Running," "Stopped," "Error").
    *   A list of available bundles.
    *   Basic tools for bundle assignment.
6.  The extension must establish a communication bridge between the webview and the extension's backend to pass messages and data.

## Non-Goals (Out of Scope)

*   **Heavy UI Replication:** The initial version will *not* replicate the entire, complex UI of the existing web application. The focus is on a minimal, functional dashboard.
*   **Advanced Native Integrations:** Features like right-click context menus, detailed tree views, and complex status bar indicators are out of scope for the first version.
*   **Configuration UI:** The initial version will not include UI for creating or editing bundle configurations, heuristics, or other settings.

## Design Considerations

*   The webview UI should follow the existing design patterns and branding of `cntx-ui`.
*   The dashboard should be clean, simple, and provide clear, at-a-glance information.

## Technical Considerations

*   The extension will be built using TypeScript.
*   The core logic from the existing `lib/` directory will be reused.
*   A communication layer will be created to abstract the differences between WebSockets (for the standalone app) and the VS Code `postMessage` API (for the extension).
*   The extension will be bundled using a tool like `webpack` or `esbuild`.

## Success Metrics

*   A developer can successfully install and activate the extension from the VS Code Marketplace (or a `.vsix` file).
*   A user can open the `cntx-ui` dashboard and see the status of the server.
*   A user can start and stop the server from the Command Palette.
*   The extension maintains a high degree of code reuse with the original `cntx-ui` project.

## Open Questions

*   What specific bundle assignment tools are most critical for the initial dashboard?
*   What information should be displayed for each bundle in the list (e.g., name, description, file count)?
