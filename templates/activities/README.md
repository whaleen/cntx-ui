# cntx-ui Activities System

This directory contains the activities management system for cntx-ui. Activities are used to plan, track, and document significant development efforts.

## Guiding Principles for AI Agents

**ATTENTION AI AGENT:** This is a mandatory set of rules for interacting with the cntx-ui Activities System.

1.  **This is a Sequential, Multi-Step Workflow.** You **MUST** follow the 3-step process for creating activities. Do not attempt to combine steps or skip ahead. Each step uses a specific tool (`.mdc` file) and requires user confirmation before proceeding to the next.
2.  **Context is Critical.** Before creating a new activity, you **MUST** first examine the contents of an existing activity in the `activities/` directory (e.g., `api-audit`). This will give you the required context on the structure and content of the four standard files (`README.md`, `tasks.md`, `progress.md`, `notes.md`).
3.  **One Step at a Time.** After completing a step, you **MUST** stop and inform the user of the result. Do not automatically proceed to the next step without explicit user instruction (e.g., the user saying "go" or "proceed").

## The 3-Step Activity Creation Workflow

To create a new activity, you must follow these three steps in order.

---

### **Step 1: Create the Activity Definition**

- **Goal:** To create the high-level plan (`README.md`) for the activity.
- **Input:** A user prompt describing the feature.
- **Tool:** `@.cntx/activities/lib/create-activity.mdc`
- **Output:** A new directory in `.cntx/activities/activities/` containing a single `README.md` file.

**Note to Agent:** After completing this step, your job is done for now. Inform the user that the Activity Definition has been created and that the next step is to generate the task list. **Wait for their command to proceed.**

---

### **Step 2: Generate the Task List & Register Activity**

- **Goal:** To break down the high-level plan into a detailed task list and register the activity.
- **Input:** The `README.md` file created in Step 1.
- **Tool:** `@.cntx/activities/lib/generate-tasks.mdc`
- **Output:**
    1. A `tasks.md` file inside the activity's directory.
    2. A new entry for the activity added to the `.cntx/activities/activities.json` file, including the generated tasks.

**Note to Agent:** This step requires a pause for user confirmation after generating the parent tasks, as per the instructions in `generate-tasks.mdc`. After this step is fully complete, stop and wait for the user's command.

---

### **Step 3: Create Progress and Notes Files**

- **Goal:** To create the initial tracking and notes files for the activity.
- **Input:** The `tasks.md` file from Step 2.
- **Tool:** `@.cntx/activities/lib/process-task-list.mdc` (and knowledge from existing examples).
- **Output:** `progress.md` and `notes.md` files inside the activity's directory, populated with initial template content.

**Note to Agent:** Once this step is complete, the entire activity has been successfully scaffolded. Inform the user and await further instructions.

---
## How to Work on Existing Activities

To begin working on an existing activity, provide the agent with the activity files and use the process-task-list workflow:

```text
I want to work on the [activity-name] activity. Here are the relevant files:
@.cntx/activities/activities/[activity-name]/README.md
@.cntx/activities/activities/[activity-name]/tasks.md
@.cntx/activities/activities/[activity-name]/progress.md

Please start on the next uncompleted task and use @process-task-list.mdc
```

---
This system is for internal cntx-ui project management and is not intended for public open source use.
