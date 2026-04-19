#!/usr/bin/env node
// PostToolUse hook: detects successful `gh pr create` and reminds Claude to invoke dual-review skill.
// Project-level workflow rule (Memory Deposit): every PR must be followed by a dual-review pass.

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const evt = JSON.parse(input || "{}");
    if (evt.tool_name !== "Bash") return;

    const cmd = (evt.tool_input && evt.tool_input.command) || "";
    // Match `gh pr create` (allow flags before/after)
    const isPrCreate = /\bgh\s+pr\s+create\b/.test(cmd);
    if (!isPrCreate) return;

    // Skip if the call failed — no PR to review.
    const resp = evt.tool_response || {};
    if (resp.is_error === true) return;

    // Pull a PR URL out of stdout if present (gh pr create prints it on success).
    const stdout = String(resp.stdout || resp.output || "");
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    const prUrl = urlMatch ? urlMatch[0] : null;

    const reminder = [
      "PR создан" + (prUrl ? `: ${prUrl}` : "") + ".",
      "",
      "Workflow Memory Deposit (CLAUDE.md → Development Workflow #3) требует ОБЯЗАТЕЛЬНОГО следующего шага:",
      "вызови skill `dual-review` на этом PR (передай URL/номер как аргумент).",
      "",
      "Без этого задача не считается завершённой — не переходи к следующей фиче и не отчитывайся \"готово\" пока dual-review не отработал."
    ].join("\n");

    const out = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: reminder
      }
    };
    process.stdout.write(JSON.stringify(out));
  } catch {
    // Silent: a hook bug must never block the user's workflow.
  }
});
