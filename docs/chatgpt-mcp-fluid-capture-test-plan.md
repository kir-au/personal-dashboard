# ChatGPT MCP Fluid Capture Test Plan

Use this prompt in ChatGPT after connecting the Personal Vault MCP connector.

The goal is to test whether ChatGPT can use Personal Vault as a fluid capture system:

```text
raw input -> capture_note -> raw Markdown saved -> synchronous proposals/questions -> user approval -> apply_capture_action only when approved
```

Do not assume that every capture should update a dashboard. Save first, then inspect the proposals returned by `capture_note`.

## Instructions For ChatGPT

You have access to the Personal Vault MCP connector.

Before running the scenarios, run a connector preflight:

1. List available Personal Vault tools.
2. Confirm that these tools are visible:
   - `capture_note`
   - `apply_capture_action`
   - `get_today_plan`
   - `search_vault`
3. Call `get_today_plan`.
4. If tool discovery works but tool invocation fails with `Resource not found: .../capture_note` or similar, stop the regression suite and report `Connector invocation layer failed`.

Do not test the MCP server by opening `/mcp` in a browser or with plain `curl`.

For this server, a plain browser/curl request may return:

```text
406 Not Acceptable
Client must accept text/event-stream
```

That is expected for a Streamable HTTP MCP endpoint and does not prove the MCP server is broken. The valid test is whether ChatGPT has the Personal Vault tools registered in the conversation and can call `get_today_plan`.

Please run the test scenarios below one by one.

For each scenario:

1. Call `capture_note` with the exact test input.
2. Show me:
   - the saved raw capture path,
   - the proposed actions returned by `capture_note`,
   - any clarification questions,
   - what you think should happen next.
3. Do not call `apply_capture_action` unless I explicitly approve the proposal.
4. If a scenario is unclear, ask the smallest useful question instead of forcing a structured update.

Important: the expected behavior is not exact text matching. I am testing whether the flow is conceptually correct.

## Sync vs Async Expectation

Current expected behavior is synchronous:

```text
capture_note saves raw Markdown
capture_note immediately returns proposed next actions/questions
ChatGPT displays those proposals in the same conversation turn
ChatGPT waits for my approval
apply_capture_action is called only after approval
```

There is no background async worker required for this test.

If you do not see proposals in the `capture_note` response, report that as a connector/server issue.

## Connector Invocation Failure

If ChatGPT reports something like:

```text
Resource not found:
.../capture_note
Call api_tool.list_resources again to rediscover the currently available tools.
```

Treat this as a connector/session failure, not as a classifier failure.

If ChatGPT says no Personal Vault functions are registered in the current session, treat that as a connector attachment failure. The regression suite cannot start from that chat.

Expected diagnosis:

```text
Connector status: FAIL
- Tool discovery may be working.
- Tool invocation is not stable.
- Regression scenarios cannot be executed honestly until capture_note works again.
```

Recommended recovery:

1. Start a new ChatGPT conversation.
2. Reconnect or refresh the Personal Vault connector.
3. Make sure the Personal Vault connector is enabled/selected for the new chat.
4. Ask: `What tools are available in Personal Vault?`
5. Call `get_today_plan`.
6. Only then start Scenario 1.

Do not continue the regression suite while the connector cannot invoke `capture_note`.

## Scenario 1: Generic Personal Vault Note

Test input:

```text
Save this to Personal Vault: I think the most important product principle is that capture should stay fluid. The system should save raw memory first and let the AI processor decide what it means later.
```

Expected:

- Raw capture should be saved.
- This should probably stay in inbox or link to AI/Product/Personal Vault context.
- It should not update Health.
- It should not update Today unless explicitly promoted.
- Good proposals:
  - leave in inbox,
  - link to AI or product/project context if available,
  - maybe add to Today only if treated as an active task.

What to watch:

- If ChatGPT proposes Health/activity update here, that is wrong.
- If it asks no question, that is fine; this is clear enough as an architecture note.

## Scenario 2: Exercise / Health Activity

Test input:

```text
Save this to Personal Vault: I completed 50 Russian kettlebell swings and 40 minutes of cycling today. No shoulder pain during the session.
```

Expected:

- Raw capture should be saved.
- It may propose a generic structured update:

```json
{
  "actionId": "apply-structured-update",
  "projectId": "health",
  "processorId": "health.activity",
  "recordType": "activity_log"
}
```

- It should not expose old project-specific actions like:
  - `log-health-workout`
  - `apply-health-workout`

Good ChatGPT response:

```text
Saved raw capture.

I think this affects Health/activity and Today dashboard.
I can apply the Health activity update if you approve.
```

What to watch:

- This is a valid structured update candidate.
- ChatGPT should wait for approval before calling `apply_capture_action`.

Optional approval test:

If I say:

```text
Approve the health activity update.
```

Then ChatGPT should call `apply_capture_action` with the proposal id returned by `capture_note`, likely `update-health-activity`.

## Scenario 3: Coffee / Nutrition But Incomplete

Test input:

```text
Save this to Personal Vault: I had a flat white coffee this morning.
```

Expected:

- Raw capture should be saved.
- It may identify this as food/drink or nutrition context.
- It should probably ask a minimal clarification before estimating calories:
  - size: small / regular / large,
  - milk type if known,
  - sugar or no sugar.

Good ChatGPT response:

```text
Saved raw capture.

I think this may affect Health / nutrition / energy balance.
Before estimating calories, I need one clarification:
Was it small, regular, or large, and did it include sugar?
```

What to watch:

- It should not invent precise calories from weak information.
- It should not require a nutrition schema from the user.
- It should not create a `log-food` endpoint/action.
- It should keep raw capture even if no structured update is applied.

## Scenario 4: Reading / Article Opened

Test input:

```text
Save this to Personal Vault: I opened an article about AI-native personal software and want to read it later. The main idea seems related to why normal apps are too rigid when AI can reshape the interface.
```

Expected:

- Raw capture should be saved.
- It may propose:
  - leave in inbox,
  - link to AI project,
  - mark as review later/bookmark,
  - maybe add to Today only if it sounds like a task.
- It should not update Health or nutrition.

Good ChatGPT response:

```text
Saved raw capture.

I think this is an AI/project source or review-later item.
Would you like me to link it to the AI project or leave it in the capture inbox?
```

What to watch:

- This is not a workout, not a food item, not a medical record.
- Best behavior is source/bookmark/review-later style proposal.

## Scenario 5: Ambiguous Mixed Capture

Test input:

```text
Save this to Personal Vault: I had coffee, walked for a while, and thought about the dashboard. Need to come back to this tomorrow.
```

Expected:

- Raw capture should be saved.
- ChatGPT should recognize multiple possible meanings:
  - coffee may be nutrition,
  - walk may be activity,
  - dashboard thought may be AI/product,
  - tomorrow may be planning.
- It should ask a minimal question before applying structured updates.

Good ChatGPT response:

```text
Saved raw capture.

This touches several areas:
1. Health/nutrition: coffee
2. Health/activity: walk
3. AI/product: dashboard thought
4. Today/planning: come back tomorrow

I need clarification before applying structured updates:
- Do you want this split into separate updates, or should I leave it as one raw note for review?
```

What to watch:

- It should not force everything into one project.
- It should not invent walk duration or coffee calories.
- It should preserve raw capture.

## Scenario 6: Negative Control

Test input:

```text
Save this to Personal Vault: We discussed MCP OAuth, connector schema caching, and why hardcoded health workout routes are wrong. I did not do a workout. No kg were lifted. No sets or reps were performed.
```

Expected:

- Raw capture should be saved.
- It should not propose Health activity update.
- It may link to AI/product architecture context.

What to watch:

- If this triggers a Health workout/action proposal, the classifier is still too naive.

## Final Report Format

After running all scenarios, summarize results like this:

```text
Scenario 1: pass/fail
- capture path:
- proposals:
- issue:

Scenario 2: pass/fail
- capture path:
- proposals:
- issue:

...

Overall:
- Did capture_note return proposals synchronously?
- Did ChatGPT wait for approval before apply_capture_action?
- Did any old hardcoded action names appear?
- Did any scenario incorrectly update Health?
- What should be fixed in the MCP server?
```

## Pass Criteria

The test passes if:

- every scenario saves raw Markdown,
- `capture_note` returns proposals synchronously,
- ChatGPT waits for user approval before applying,
- Health activity is proposed only for factual health/activity records,
- incomplete nutrition asks a minimal question,
- architecture notes stay as raw/project evidence,
- no old `log-health-workout` or `apply-health-workout` actions appear.
