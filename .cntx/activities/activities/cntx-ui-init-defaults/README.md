# Activity: cntx-ui Init Defaults

## Introduction/Overview

This activity aims to define and implement a comprehensive default template for the `.cntx` directory, which will be established when a user runs `cntx-ui init`. The goal is to provide a clean, fully functional, and immediately usable `.cntx` setup that is compatible with the `cntx-ui` web interface, allowing users to visualize and manage all aspects of their project that `cntx-ui` is designed to handle.

## Goals

*   **Standardized Initialization:** Provide a single, robust default template for the `.cntx` directory.
*   **Full UI Compatibility:** Ensure the initialized `.cntx` structure is fully compatible with the `cntx-ui` web interface, allowing users to visualize and interact with all features.
*   **Comprehensive Defaults:** Include scaffolding for activities, agent-rules, configuration files (config, hidden-files, semantic-cache), and default bundles.
*   **AI Comprehension Ready:** Design the defaults to facilitate better AI comprehension and interaction with the project context.

## User Stories

*   **As a new `cntx-ui` user,** I want to run a single command (`cntx-ui init`) so that my project is immediately set up with a working `.cntx` directory and default configurations.
*   **As an experienced `cntx-ui` user,** I want to quickly initialize new projects with a standardized `.cntx` structure so that I can maintain consistency across my work.
*   **As an AI agent,** I want a predictable and well-defined `.cntx` directory structure so that I can reliably understand and interact with project context.

## Functional Requirements

1.  The `cntx-ui init` command must create the `.cntx` directory if it does not exist.
2.  The `cntx-ui init` command must populate the `.cntx` directory with the following default files and structures:
    *   `activities/` directory with a basic activity structure (e.g., `activities.json`, `lib/`, and a sample activity).
    *   `agent-rules/` directory with default agent rule files.
    *   `config.json` with default bundle definitions (e.g., `master`, `api`, `ui`, `config`, `docs`).
    *   `hidden-files.json` with default hidden file configurations.
    *   `semantic-cache.json` (initially empty or with a basic structure, to be populated by the semantic chunking process).
3.  The default `config.json` must define bundles that cover common project structures (e.g., `master`, `api`, `ui`, `config`, `docs`).
4.  The default `hidden-files.json` must include common ignore patterns (e.g., `node_modules`, `.git`, `dist`).
5.  The initialized `.cntx` directory must be immediately usable by the `cntx-ui` web interface without further manual configuration.
6.  The structure and content of the default files should be designed to enhance AI comprehension of the project.

## Non-Goals (Out of Scope)

*   **Multiple Templates:** This activity will focus on defining and implementing a single, universal default template. Creating multiple, customizable templates is out of scope for this MVP.
*   **Advanced Customization UI:** The `cntx-ui init` command will not offer interactive customization options beyond the single default template.
*   **Dynamic Template Generation:** The template will be static; dynamic generation based on project type (e.g., React, Node.js) is out of scope.

## Design Considerations

*   The default structure should be intuitive and easy for users to understand.
*   File contents should be well-commented where necessary to explain their purpose.
*   The default bundles should provide a good starting point for most projects.

## Technical Considerations

*   The `cntx-ui init` logic will need to be implemented in `bin/cntx-ui.js` or a new module it calls.
*   Existing `cntx-ui` server-side logic for loading configurations and activities will be leveraged.
*   Consider using template files that are copied during initialization.

## Success Metrics

*   A user can run `cntx-ui init` and successfully initialize a `.cntx` directory.
*   The initialized `.cntx` directory allows the `cntx-ui` web interface to load and display all relevant information without errors.
*   The default bundles are generated correctly upon initialization.
*   The default activities and agent rules are visible and accessible in the UI.

## Open Questions

*   What specific default agent rules should be included?
*   What is the minimal set of sample activities to include in the default setup?
*   Should the `semantic-cache.json` be pre-populated with any initial data, or just an empty structure?
