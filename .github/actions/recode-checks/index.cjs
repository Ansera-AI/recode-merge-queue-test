"use strict";

// src/main.ts
var import_node_child_process7 = require("node:child_process");
var import_node_fs6 = require("node:fs");
var import_node_os3 = require("node:os");
var import_node_path6 = require("node:path");

// ../core/src/protocol.ts
function checkTime(ms) {
  const s = Math.max(1, Math.round(ms / 1e3));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

// ../core/src/checks-summary.ts
function checksTitle(checks, o = {}) {
  const flaky = new Set(checks.flatMap((c) => c.flaky ?? [])).size;
  const flakyNote = flaky ? ` \xB7 ${flaky} flaky` : "";
  const nearFailed = checks.some((c) => c.stage === "near" && c.status === "fail");
  if (nearFailed) {
    const failed2 = checks.filter((c) => c.stage === "near" && c.status === "fail").length;
    return { title: `${failed2} failed near the change`, conclusion: "failure" };
  }
  const ran = checks.filter((c) => c.status !== "skipped" && c.stage !== "near");
  const failed = ran.filter((c) => c.status === "fail").length;
  const passed = ran.filter((c) => c.status === "pass" && !c.flaky).length;
  if (!ran.length) return { title: "No checks found", conclusion: "neutral" };
  if (failed) return { title: `${failed} failed${passed ? ` \xB7 ${passed} passed` : ""}${flakyNote}`, conclusion: "failure" };
  if (flaky && o.flakyFails) return { title: `${flaky} flaky${passed ? ` \xB7 ${passed} passed` : ""}`, conclusion: "failure" };
  return { title: `${passed} passed${flakyNote}`, conclusion: "success" };
}
function checksSummary(checks, o) {
  const staged = checks.some((c) => c.stage);
  const lines = staged ? ["| | Check | | Time |", "|---|---|---|---|"] : ["| Check | | Time |", "|---|---|---|"];
  let last;
  for (const c of checks) {
    const stage = c.stage === "near" ? "Near the change" : "Whole suite";
    const first = staged ? `| ${stage === last ? "" : stage} ` : "";
    last = stage;
    const what = c.stage === "near" && c.scope ? ` ${c.scope.replace(/\|/g, "\\|").slice(0, 80)}` : c.command ? ` \`${c.command.replace(/\|/g, "\\|").slice(0, 80)}\`` : "";
    const how = c.notRun ? "didn't run" : c.flaky ? "~ flaky" : c.status === "pass" ? "\u2713 passed" : c.status === "fail" ? `\u2717 failed${c.timedOut ? " (timed out)" : c.exitCode !== null ? ` (exit ${c.exitCode})` : ""}${c.rerun ? ", and again" : ""}` : "skipped";
    lines.push(`${first}| ${c.name}${what} | ${how} | ${c.status === "skipped" ? "" : checkTime(c.ms)} |`);
  }
  const flaky = [...new Set(checks.flatMap((c) => c.flaky ?? []))];
  if (flaky.length) lines.push("", `**Flaky:** ${flaky.map((t) => `\`${t.replace(/`/g, "'").slice(0, 120)}\``).join(", ")} failed, then passed when rerun at ${o.head.slice(0, 7)}. Marked, not fixed.`);
  const near = checks.find((c) => c.stage === "near" && c.from);
  if (near) lines.push("", `Near the change, from ${near.from}.${checks.some((c) => c.notRun) ? " The whole suite didn't run: a check near the change failed first." : ""}`);
  const failed = checks.filter((c) => c.status === "fail");
  for (const c of failed) lines.push("", `**${c.name}**`, "```", c.output.split("\n").slice(-30).join("\n").replace(/```/g, "'''").slice(0, 6e3), "```");
  lines.push("", `Checked ${o.where} at ${o.head.slice(0, 7)}${o.from ? `, from ${o.from}` : ""}. What runs comes from the default branch and project settings.${o.link ? ` [Open in recode](${o.link})` : ""}`);
  return lines.join("\n").slice(0, 6e4);
}

// ../harness/sdk/src/providers.ts
var ANTHROPIC_KEY = { env: "ANTHROPIC_API_KEY", provider: "anthropic", pattern: /^sk-ant-api\d\d-[\w-]{20,}$/, hint: "An Anthropic API key starts with sk-ant-api", placeholder: "sk-ant-api\u2026", hosts: ["api.anthropic.com"] };
var OPENAI_KEY = { env: "OPENAI_API_KEY", provider: "openai", pattern: /^sk-(?!ant-|or-)[\w-]{20,}$/, hint: "An OpenAI API key starts with sk-", placeholder: "sk-\u2026", hosts: ["api.openai.com"] };
var OPENROUTER_KEY = { env: "OPENROUTER_API_KEY", provider: "openrouter", pattern: /^sk-or-[\w-]{20,}$/, hint: "An OpenRouter key starts with sk-or-", placeholder: "sk-or-\u2026", hosts: ["openrouter.ai"] };
var googleKey = (env) => ({ env, provider: "google", pattern: /^AIza[\w-]{30,}$/, hint: "A Google AI Studio key starts with AIza", placeholder: "AIza\u2026", hosts: ["generativelanguage.googleapis.com"] });

// ../runner/src/sandbox.ts
var SOCKET_VARS = ["SSH_AUTH_SOCK", "DBUS_SESSION_BUS_ADDRESS", "DOCKER_HOST", "XDG_RUNTIME_DIR", "WSL_INTEROP", "WSLENV"];

// ../runner/src/checks.ts
var import_node_child_process6 = require("node:child_process");
var import_node_fs5 = require("node:fs");
var import_node_path5 = require("node:path");

// ../core/src/output.ts
var FAILURE = /^\s*(not ok \d+|✖ (?!failing tests)|✗ |× |FAIL\b|--- FAIL|FAILED\b|failures:|test .* \.\.\. FAILED|E\s{3}|error(\[\w+\])?:|ERR!)/i;
var PASSED = /^\s*(ok \d+|✔ |✓ |PASS\b|--- PASS)/;
var FAILURE_LINES = 12;
var FAILURE_BLOCKS = 10;
function keepEnd(s, lines, blocks = FAILURE_BLOCKS) {
  const all = s.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  if (all.length <= lines) return all.join("\n");
  const cut = all.length - lines;
  const failures = [];
  let found = 0;
  for (let i = 0; i < cut && found < blocks; i++) {
    if (!FAILURE.test(all[i])) continue;
    found++;
    let end = i + 1;
    while (end < Math.min(i + FAILURE_LINES, cut) && !PASSED.test(all[end]) && !FAILURE.test(all[end])) end++;
    const block = all.slice(i, end);
    failures.push(...block);
    i += block.length - 1;
  }
  const head = failures.length ? ["Failures, from earlier in the output:", ...failures, ""] : [];
  return [...head, `\u2026 ${cut} earlier lines`, ...all.slice(-lines)].join("\n");
}

// ../runner/src/git.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");

// ../runner/src/space.ts
var GB = 1024 ** 3;
var LOW_SPACE_BYTES = 5 * GB;
var MIN_SPACE_BYTES = 1 * GB;
var OUT_OF_SPACE = "This machine is out of disk space. Free some up, then try again";

// ../harness/claude-code/src/manifest.ts
var manifest = {
  id: "claude",
  name: "Claude Code",
  bin: "claude",
  transport: "jsonl",
  installUrl: "https://code.claude.com/docs/en/quickstart",
  login: "claude auth login",
  colors: { light: "#8b4fb8", dark: "#c690d8", lightWash: "#f1e7f4", darkWash: "#352339", terminal: "magenta" },
  rank: 0,
  family: "anthropic",
  guidanceFiles: ["CLAUDE.md"],
  // `min`: its sandbox's `strictAllowlist` came in 2.1.219. `tested` is the CLI the recordings come from.
  versions: { min: "2.1.219", tested: "2.1.316" },
  env: {
    billed: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX"],
    clearOnPlan: ["ANTHROPIC_AUTH_TOKEN"],
    clearOnCloud: ["CLAUDE_CODE_OAUTH_TOKEN"]
  },
  credentials: [
    { env: "ANTHROPIC_API_KEY", provider: "anthropic", pattern: /^sk-ant-api\d\d-[\w-]{20,}$/, hint: "An Anthropic API key starts with sk-ant-api", placeholder: "sk-ant-api\u2026" }
  ],
  // `sonnet` names the latest Sonnet.
  stepDefaults: { planner: { model: "sonnet", effort: "low" }, plan: { model: "sonnet", effort: "medium" }, fix: { model: "sonnet", effort: "medium" }, verify: { model: "sonnet", effort: "medium" } },
  traits: {
    session: { resume: true, boundToCwd: true, reportsContext: true, cost: "session-total" },
    steer: "live",
    live: { echoesInput: true, reportsBackground: true },
    limits: "event",
    runnerTools: { commandHook: true, allowList: true },
    images: "paths",
    instructions: "system",
    // Its command hook decides on recode's own commands (docs/specs/harnesses-next.md 5).
    decisions: "hook"
  },
  // With a key it runs with --bare, which skips hooks from settings: most likely the output helper's too.
  authTraits: { "api-key": { runnerTools: { commandHook: false, allowList: true }, decisions: "none" } },
  isolation: {
    userConfig: { plan: ["--setting-sources", "project,local", "--strict-mcp-config"], key: ["--bare"] },
    repoConfig: [".claude/settings.json", "CLAUDE.md", ".claude/commands", ".claude/agents", ".claude/skills"],
    // Its sign-in stays where the person's is: the Keychain item, or the credentials file on Linux, follows
    // CLAUDE_SECURESTORAGE_CONFIG_DIR when it's set (2.1.316), and the default place when it's empty.
    // Plan mode writes its plan under `plans/`, which the step's result reads.
    state: { env: "CLAUDE_CONFIG_DIR", default: ".claude", signIn: { env: "CLAUDE_SECURESTORAGE_CONFIG_DIR", keychain: "Claude Code-credentials" }, readable: ["plans"] },
    envPassthrough: "all",
    // Every command and hook goes through this (2.1.316: one argument, the whole command as a shell string).
    commands: { prefixEnv: "CLAUDE_CODE_SHELL_PREFIX" }
  },
  // Where it signs in and calls its API.
  hosts: ["anthropic.com", "*.anthropic.com", "claude.com", "*.claude.com", "claude.ai", "*.claude.ai"],
  cloud: {
    plans: "Claude Pro, Max, Team or Enterprise",
    // It waits at "Paste code here" only in a terminal (docs/design/cloud-runner.md Appendix C).
    signIn: { argv: ["claude", "auth", "login", "--claudeai"], wantsCode: true, terminal: true },
    signOut: ["claude", "auth", "logout"],
    planToken: /^sk-ant-oat/,
    // About 4 weeks after signing in; renewing doesn't move it (docs/design/cloud-runner.md Appendix C).
    signInEnds: { file: ".claude/.credentials.json", path: ["claudeAiOauth", "refreshTokenExpiresAt"] }
  }
};

// ../harness/codex/src/manifest.ts
var manifest2 = {
  id: "codex",
  name: "Codex",
  bin: "codex",
  transport: "jsonl",
  installUrl: "https://github.com/openai/codex",
  login: "codex login",
  colors: { light: "#0e877b", dark: "#5cc4bc", lightWash: "#e0f1ef", darkWash: "#15312f", terminal: "cyan" },
  rank: 1,
  // Its default; the person's own model, where they chose one, says otherwise (the runner reports it).
  family: "openai",
  guidanceFiles: ["AGENTS.md"],
  // No floor known yet. `tested` is the CLI the recordings come from; 0.167.0 ran on cloud machines too.
  versions: { tested: "0.157.0" },
  env: {
    billed: ["OPENAI_API_KEY", "CODEX_API_KEY"],
    clearOnPlan: [],
    clearOnCloud: []
  },
  credentials: [
    { env: "OPENAI_API_KEY", provider: "openai", pattern: /^sk-(?!ant-)[\w-]{20,}$/, hint: "An OpenAI API key starts with sk-", placeholder: "sk-\u2026" }
  ],
  // Effort only: the model stays the person's own Codex default.
  stepDefaults: { planner: { effort: "low" }, plan: { effort: "medium" }, fix: { effort: "medium" }, verify: { effort: "medium" } },
  traits: {
    session: { resume: true, boundToCwd: false, reportsContext: false, cost: "none" },
    // `codex exec` only takes a prompt at the start, so a message stops it between tool calls and carries on its session.
    steer: "resume",
    // In its own words, with when the limit resets: the adapter reads it (limitResetIn).
    limits: "event",
    runnerTools: { commandHook: false, allowList: false },
    images: "flag",
    instructions: "prompt",
    // `codex exec` asks no one, and has no hook that can refuse a command.
    decisions: "none"
  },
  isolation: {
    // Nothing to pass: its own folder (`state`) has a config of recode's, with only the person's model carried over.
    // Their MCP servers, notify program, rules, skills and AGENTS.md stay out.
    userConfig: "none",
    // Also the project's execpolicy `.rules` files, which `--ignore-rules` skips; where it looks for them is to check.
    repoConfig: ["AGENTS.md"],
    // It writes a renewed sign-in through the link (0.157.0). The model and its provider are the person's choice.
    state: {
      env: "CODEX_HOME",
      default: ".codex",
      signIn: { link: ["auth.json"] },
      carry: { file: "config.toml", keys: ["model", "model_provider", "model_reasoning_effort"], tables: ["model_providers."] }
    },
    // Names with KEY, SECRET or TOKEN in them too, as 0.157.0 showed: a test environment's secrets reach its commands.
    envPassthrough: "all",
    // Its sandbox (bubblewrap) refuses to start with inherited capabilities: "Unexpected capabilities but not setuid".
    needs: { linux: "no-ambient-caps" }
  },
  // Its assets come from OpenAI's content hosts.
  hosts: ["openai.com", "*.openai.com", "chatgpt.com", "*.chatgpt.com", "*.oaiusercontent.com"],
  cloud: {
    plans: "ChatGPT plan",
    // Its device sign-in shows a code to enter on the sign-in page.
    signIn: { argv: ["codex", "login", "--device-auth"], wantsCode: false, codeFormat: /\b([A-Z0-9]{4}-[A-Z0-9]{4,5})\b/ },
    signOut: ["codex", "logout"]
  }
};

// ../harness/opencode/src/manifest.ts
var XDG = { XDG_CONFIG_HOME: ".config", XDG_STATE_HOME: ".local/state", XDG_CACHE_HOME: ".cache" };
var manifest3 = {
  id: "opencode",
  name: "opencode",
  bin: "opencode",
  transport: "jsonl",
  installUrl: "https://opencode.ai/docs",
  login: "opencode auth login",
  colors: { light: "#a2621a", dark: "#e0a458", lightWash: "#f6ead9", darkWash: "#3a2a16", terminal: "yellow" },
  rank: 2,
  guidanceFiles: ["AGENTS.md"],
  // `min`: OPENCODE_PURE, the json events as recorded, `auth list`. `tested` is the CLI the recordings come from.
  versions: { min: "1.19.0", tested: "1.19.6" },
  env: {
    billed: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    // Its whole sign-in as one variable, which would win over the person's own.
    clearOnPlan: ["OPENCODE_AUTH_CONTENT"],
    clearOnCloud: []
  },
  credentials: [ANTHROPIC_KEY, OPENAI_KEY, OPENROUTER_KEY, googleKey("GOOGLE_GENERATIVE_AI_API_KEY")],
  // Its own sign-ins (OpenCode Zen, ChatGPT), and its model catalog.
  hosts: ["opencode.ai", "*.opencode.ai", "models.dev", "chatgpt.com", "*.chatgpt.com", "auth.openai.com"],
  npm: "opencode-ai",
  // Reasoning only, as for Codex: the model stays the person's own default. As `--variant`: a model without that
  // level ignores it (session/llm/request.ts), so it runs at its own default.
  stepDefaults: { planner: { effort: "low" }, plan: { effort: "medium" }, fix: { effort: "medium" }, verify: { effort: "medium" } },
  traits: {
    // Its sessions are kept per project, by folder.
    session: { resume: true, boundToCwd: true, reportsContext: true, cost: "per-run" },
    // `run` takes a prompt only at the start: a message stops it between tool calls and carries on its session.
    steer: "resume",
    limits: "text",
    // A plugin could rewrite long commands, but plugins from outside are off (OPENCODE_PURE).
    runnerTools: { commandHook: false, allowList: false },
    images: "flag",
    instructions: "prompt",
    // `run` turns down whatever its rules leave to ask. Answering through its own server comes later.
    decisions: "none"
  },
  isolation: {
    // Nothing to pass: its folders are recode's, with only the person's models and providers carried over. Their MCP
    // servers, plugins, agents, commands and instructions stay out.
    userConfig: "none",
    // It reads CLAUDE.md where there's no AGENTS.md.
    repoConfig: ["opencode.json", "opencode.jsonc", ".opencode/", "AGENTS.md", "CLAUDE.md"],
    state: {
      env: "XDG_DATA_HOME",
      default: ".local/share",
      more: XDG,
      sub: "opencode",
      // recode's settings for it, and the folders it's moved to: never for its commands.
      agentEnv: ["OPENCODE_CONFIG_CONTENT", "OPENCODE_PURE", "OPENCODE_DISABLE_AUTOUPDATE", "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER"],
      // Its sign-ins and stored keys. It writes a renewed sign-in through the link.
      signIn: { link: ["auth.json"] },
      carry: { file: ["opencode.json", "opencode.jsonc", "config.json"], from: "XDG_CONFIG_HOME", keys: ["model", "small_model", "provider", "enabled_providers", "disabled_providers"] }
    },
    envPassthrough: "all",
    // Nothing of its own holds its commands (docs/specs/harnesses-opencode-pi.md 2.5).
    needs: { recodeSandbox: true },
    // Its shell tool runs `<shell> -c <command>`, with the shell from its config (docs/specs/harnesses-opencode-pi.md 4.6).
    commands: { shell: "setting" }
  },
  // Keys only on cloud machines, for now (docs/specs/harnesses-opencode-pi.md 4.4).
  cloud: {}
};

// ../harness/pi/src/manifest.ts
var manifest4 = {
  id: "pi",
  name: "pi",
  bin: "pi",
  transport: "jsonl",
  installUrl: "https://github.com/earendil-works/pi",
  login: "pi auth login",
  colors: { light: "#2f6fd0", dark: "#7fa9ec", lightWash: "#e3ecfa", darkWash: "#1a2a44", terminal: "blue" },
  rank: 3,
  guidanceFiles: ["AGENTS.md", "CLAUDE.md"],
  // `min`: agent_settled, `--list-models`, `shellPath`. `tested` is the CLI the recordings come from.
  versions: { min: "1.5.0", tested: "1.5.2" },
  env: {
    billed: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY"],
    // Anthropic's other credentials, which would win over the person's own sign-in.
    clearOnPlan: ["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_AUTH_TOKEN"],
    clearOnCloud: []
  },
  credentials: [ANTHROPIC_KEY, OPENAI_KEY, OPENROUTER_KEY, googleKey("GEMINI_API_KEY")],
  // It reaches only its providers: its version check and telemetry are off.
  hosts: [],
  npm: "@earendil-works/pi-coding-agent",
  // Reasoning only, as for Codex: the model stays the person's own default. As `--thinking`, which it caps at what
  // the model can do.
  stepDefaults: { planner: { effort: "low" }, plan: { effort: "medium" }, fix: { effort: "medium" }, verify: { effort: "medium" } },
  traits: {
    session: { resume: true, boundToCwd: true, reportsContext: true, cost: "per-run" },
    // Its RPC mode takes messages on its input while it works, and answers each (docs/specs/harnesses-opencode-pi.md 5.2).
    steer: "live",
    live: { echoesInput: true, reportsBackground: false },
    limits: "text",
    // No hooks or rules of its own: everything it can do, it may.
    runnerTools: { commandHook: false, allowList: false },
    // Its live input takes text only: it's told the images' paths, and reads them with its read tool.
    images: "paths",
    instructions: "system",
    decisions: "none"
  },
  isolation: {
    // Nothing to pass: its folder is recode's, with only the person's default model carried over. Their extensions,
    // skills, prompts, MCP servers and AGENTS.md stay out.
    userConfig: "none",
    // `.pi/` and the repo's skills load only for a trusted folder, which recode never says it is (--no-approve).
    repoConfig: ["AGENTS.md", "CLAUDE.md", ".pi/", ".agents/skills"],
    state: {
      env: "PI_CODING_AGENT_DIR",
      default: ".pi/agent",
      // Its sign-ins and stored keys, which it renews through the link, and the person's own endpoints and local models.
      // It locks one while it renews it with a folder beside it (proper-lockfile).
      signIn: { link: ["auth.json", "models.json"], lock: ".lock" },
      carry: { file: "settings.json", keys: ["defaultProvider", "defaultModel", "defaultThinkingLevel"], model: ["defaultProvider", "defaultModel"] }
    },
    envPassthrough: "all",
    // Nothing of its own holds its commands (docs/specs/harnesses-opencode-pi.md 2.5).
    needs: { recodeSandbox: true },
    // Its bash tool runs `<shellPath> -c <command>`, from its settings (docs/specs/harnesses-opencode-pi.md 5.6).
    commands: { shell: "setting" }
  },
  // Keys only on cloud machines, for now.
  cloud: {}
};

// ../harness/registry/src/catalog.ts
var HARNESSES = [manifest, manifest2, manifest3, manifest4];

// ../core/src/workflow.ts
var STEP_TYPES = {
  agent: { id: "agent", outcomes: { done: "Done" }, external: false },
  ask: { id: "ask", outcomes: { approve: "Approve", stop: "Stop" }, external: false },
  // `conflicts`: the branch conflicts with its base, so nothing was pushed. `moved`: the push was refused because the
  // branch moved on GitHub. Only a step with a path for `moved` hears it.
  publish: { id: "publish", outcomes: { done: "Shipped", conflicts: "Conflicts with the base branch", moved: "The branch moved on GitHub" }, external: true },
  // Merges the task's pull request on GitHub, as the operator, on the server.
  // `out`: the merge queue took it out (docs/specs/merge-queue.md 5): a conflict, a check failing on latest main.
  "github.merge": { id: "github.merge", outcomes: { done: "Merged", blocked: { says: "GitHub wouldn't merge it", fields: { "reason!": "text" } }, "not-ready": "Not ready to merge", out: { says: "Couldn't merge", fields: { "reason!": "text", kind: "text", items: "text" } } }, external: true },
  run: { id: "run", outcomes: { pass: { says: "Checks passed", fields: { reason: "text" } }, fail: { says: "Checks failed", fields: { "reason!": "text" } } }, external: false },
  // Only `until: github.pr` works yet: watching the task's pull request.
  wait: { id: "wait", outcomes: { done: "Done", timeout: "Timed out" }, external: false, later: "wait steps arrive with triggers" },
  // Runs the task's subtasks, each as a task of its own on the `piece` workflow, and adds each to the task's branch
  // (docs/design/subtasks.md section 4). `stuck`: one ran out of tries, and nothing else can go on without it. `none`:
  // the plan wrote none, so the task builds as one.
  subtasks: { id: "subtasks", outcomes: { done: "All subtasks done", none: "No subtasks", stuck: { says: "A subtask is stuck", fields: { subtasks: "text" } } }, external: false },
  // A subtask's last step: its branch merged into its task's. `conflicts`: it wouldn't merge cleanly, and nothing changed.
  "merge-into-task": { id: "merge-into-task", outcomes: { done: "Added to the task", conflicts: { says: "Conflicts with the task", fields: { "files!": "text" } } }, external: false }
};
var PR_WAIT = "github.pr";
var isPrWait = (w, id) => w.steps[id]?.uses === "wait" && w.steps[id].with?.until === PR_WAIT;
var SHARED_OUTCOMES = {
  verdict: {
    pass: { says: "It works", fields: { reason: "text" } },
    fail: { says: "Something is wrong", fields: { "reason!": "text" } }
  },
  review: {
    approve: { says: "Nothing blocking", fields: { notes: "text" } },
    changes: { says: "Something needs to change", fields: { "scope!": ["code", "plan"], "notes!": "text" } }
  }
};
var stepIds = (w) => w.order ?? Object.keys(w.steps);
function outcomesOf(w, id) {
  const step = w.steps[id];
  const declared = typeof step.outcomes === "string" ? w.outcomes?.[step.outcomes] ?? SHARED_OUTCOMES[step.outcomes] : step.outcomes;
  const list = declared ?? STEP_TYPES[step.uses]?.outcomes ?? {};
  return Object.entries(list).map(([name, o]) => [name, typeof o === "string" ? { says: o } : o]);
}
var fieldsOf = (o) => Object.entries(o.fields ?? {}).map(([k, type]) => ({ name: k.replace(/!$/, ""), type, required: k.endsWith("!") }));
var agentWith = (w, id) => {
  const own = w.steps[id]?.with ?? {};
  const profile = own.agent ? w.agents?.[own.agent] ?? {} : {};
  return { ...profile, ...own };
};
var isExternal = (w, id) => !!STEP_TYPES[w.steps[id]?.uses]?.external || w.steps[id]?.uses === "run" && w.steps[id].external === true;
function pathsFor(w, id, outcome) {
  const spec = w.steps[id].on?.[outcome];
  if (spec === void 0) return [{ to: defaultTarget(w, id, outcome) }];
  return (Array.isArray(spec) ? spec : [spec]).map((p) => typeof p === "string" ? { to: p } : p);
}
function defaultTarget(w, id, outcome) {
  const ids = stepIds(w);
  const first = outcomesOf(w, id)[0]?.[0];
  if (outcome === first) return ids[ids.indexOf(id) + 1] ?? "done";
  return "stop";
}
function resolveEngine(e, defaultEngine, ready, family) {
  if (!e || e === "default") return defaultEngine;
  if (e === "other") {
    const others = HARNESSES.map((h) => h.id).filter((id) => id !== defaultEngine);
    const mine = family?.(defaultEngine);
    const apart = mine && ready ? others.find((id) => ready(id) && family(id) && family(id) !== mine) : void 0;
    return apart || ready && others.find((id) => ready(id)) || others[0] || defaultEngine;
  }
  return e;
}
var shipFeedback = { "feedback!": "text" };
function prTail(session) {
  return {
    watch: {
      uses: "wait",
      name: "Watch PR",
      with: { until: PR_WAIT },
      outcomes: {
        merged: "Merged on GitHub",
        closed: "Closed without merging",
        conflict: { says: "Can't merge", fields: { "reason!": "text" } },
        fix: { says: "Something to fix", fields: { kind: "text", "items!": "text", summary: "text", head: "text" } },
        ready: { says: "Ready to merge", fields: { head: "text" } }
      },
      on: { merged: "done", closed: "stop", conflict: "cant-merge", fix: "fix-it", ready: "approve-merge" }
    },
    "fix-it": {
      uses: "ask",
      name: "Fix it?",
      with: { to: ["operator"], title: "The pull request needs a fix", show: ["watch"], auto: "fix" },
      outcomes: { fix: "Fix it", ignore: "Ignore" },
      on: { fix: "pr-fix", ignore: "watch" }
    },
    "pr-fix": { uses: "agent", name: "Fix PR", with: { prompt: "fix-pr", can: "edit", session }, on: { done: "approve-push", nothing: "stuck" } },
    "approve-push": {
      uses: "ask",
      name: "Approve push",
      with: { to: ["operator"], title: "Push the fix to the pull request?", show: ["changes", "pr-fix"], auto: "push" },
      outcomes: { approve: "Push the fix", change: { says: "Change the fix", fields: { ...shipFeedback } } },
      on: { approve: "ship", change: "pr-fix" }
    },
    stuck: {
      uses: "ask",
      name: "Fix stuck",
      with: { to: ["operator"], title: "The fix didn't change anything", show: ["pr-fix"] },
      outcomes: { "once-more": { says: "Try once more", fields: { feedback: "text" } }, watch: "Keep watching" },
      on: { "once-more": "pr-fix", watch: "watch" }
    },
    "approve-merge": {
      uses: "ask",
      name: "Approve merge",
      with: { to: ["operator"], title: "Ready to merge", show: ["watch"], auto: "merge" },
      outcomes: { merge: "Merge", wait: "Not yet" },
      on: { merge: "merge", wait: "watch" }
    },
    merge: { uses: "github.merge", name: "Merge", on: { done: "done", "not-ready": "watch", blocked: "cant-merge", out: "queue-out" } },
    // Taken out of the merge queue (merge-queue.md 5): with Fix on, Build tries once; otherwise the operator decides.
    "queue-out": {
      uses: "ask",
      name: "Couldn't merge",
      with: { to: ["operator"], title: "It couldn't merge", show: ["merge"], auto: "fix" },
      outcomes: { fix: { says: "Reply with a hint", fields: { feedback: "text" } }, retry: "Try again", remove: "Remove from queue" },
      on: { fix: "pr-fix", retry: "merge", remove: "watch" }
    },
    "cant-merge": {
      uses: "ask",
      name: "Can't merge",
      with: { to: ["operator"], title: "GitHub won't merge it", show: ["watch", "merge"] },
      outcomes: { watch: "Keep watching", "stop-merge": "Stop auto-merge" },
      on: { watch: "watch", "stop-merge": "watch" }
    }
  };
}
var PR_TAIL_KEYS = Object.keys(prTail("build"));
var SHIP_THEN_WATCH = { uses: "publish", name: "Create PR", on: { moved: { to: "pr-fix", max: 1, else: "stuck" } } };
function withPrTail(w, ship, session) {
  const ids = stepIds(w);
  const tail = prTail(session);
  return { ...w, steps: { ...w.steps, [ship]: { ...w.steps[ship], ...SHIP_THEN_WATCH, name: w.steps[ship].name ?? "Create PR" }, ...tail }, ...w.order ? { order: [...ids, ...Object.keys(tail)] } : {}, replies: w.replies?.length ? [...w.replies, "pr-fix"] : w.replies };
}
var PR_VERIFY_KEY = "pr-verify";
function withVisualPrTail(w) {
  const fix = w.steps["pr-fix"];
  const push = w.steps["approve-push"];
  if (!fix || !push || w.steps[PR_VERIFY_KEY]) return w;
  const ids = stepIds(w);
  const order = [...ids];
  order.splice(ids.indexOf("pr-fix") + 1, 0, PR_VERIFY_KEY);
  const show = push.with?.show ?? [];
  return {
    ...w,
    steps: {
      ...w.steps,
      "pr-fix": { ...fix, with: { ...fix.with, visual: true }, on: { ...fix.on, done: PR_VERIFY_KEY } },
      [PR_VERIFY_KEY]: { uses: "agent", name: "Verify fix", with: { prompt: "verify", can: "run", visual: true }, outcomes: "verdict", on: { pass: "approve-push", fail: "approve-push" } },
      "approve-push": { ...push, with: { ...push.with, show: [...show, PR_VERIFY_KEY] } }
    },
    ...w.order ? { order } : {}
  };
}
var QUICK_CHANGE = withPrTail({
  version: 1,
  id: "quick-change",
  name: "Quick change",
  description: "Small, clear edits. Plan, build and verify, then you approve and recode ships it.",
  triggers: ["manual"],
  workspace: { repos: "from-task" },
  steps: {
    plan: { uses: "agent", name: "Plan", with: { prompt: "plan" } },
    build: { uses: "agent", name: "Build", with: { prompt: "build", can: "edit" } },
    verify: { uses: "agent", name: "Verify", with: { prompt: "verify", can: "run" }, outcomes: "verdict", on: { fail: { to: "build", max: 1, else: "approve" } } },
    approve: {
      uses: "ask",
      name: "Approve",
      with: { to: ["operator"], title: "Your change is ready to approve", show: ["changes", "verify"] },
      outcomes: {
        approve: "Approve and ship",
        change: { says: "Change the code", fields: { ...shipFeedback } },
        "change-plan": { says: "Change the plan", fields: { ...shipFeedback } }
      },
      on: { change: "build", "change-plan": "plan" }
    },
    ship: { uses: "publish", name: "Create PR" }
  }
}, "ship", "build");
var FEATURE = withPrTail({
  version: 1,
  id: "feature",
  name: "Feature",
  description: "New behavior that needs a plan first. The other tool argues with the plan and the change.",
  triggers: ["manual"],
  workspace: { repos: "from-task" },
  replies: ["plan", "build"],
  agents: { critic: { engine: "other", effort: "high", fallback: "skip" } },
  steps: {
    plan: { uses: "agent", name: "Plan", with: { prompt: "plan" } },
    "critique-plan": {
      uses: "agent",
      name: "Critique plan",
      with: { prompt: "adversarial-review", agent: "critic", session: "fresh" },
      outcomes: "review",
      on: { changes: { to: "plan", max: 2, else: "approve-plan" } }
    },
    "approve-plan": {
      uses: "ask",
      name: "Approve plan",
      with: { to: ["operator"], title: "Approve the plan", show: ["plan", "critique-plan"] },
      outcomes: { approve: "Approve the plan", change: { says: "Change the plan", fields: { ...shipFeedback } } },
      on: { change: "plan" }
    },
    build: { uses: "agent", name: "Build", with: { prompt: "build", can: "edit" } },
    checks: { uses: "run", name: "Checks", with: { commands: ["types", "tests", "lint"] }, on: { pass: "critique-code", fail: { to: "fix", max: 3, else: "approve" } } },
    // Carries on Build's session, with what the checks said.
    fix: { uses: "agent", name: "Fix", with: { prompt: "fix", can: "edit", session: "build" }, on: { done: "checks" } },
    "critique-code": {
      uses: "agent",
      name: "recode review",
      // It may run a test or a command to check a finding; what it changes is thrown away.
      with: { prompt: "adversarial-review", agent: "critic", session: "fresh", can: "run" },
      outcomes: "review",
      on: {
        changes: [
          { to: "plan", if: { "steps.critique-code.scope": "plan" }, max: 1, else: "approve" },
          { to: "build", max: 2, else: "approve" }
        ]
      }
    },
    approve: {
      uses: "ask",
      name: "Approve",
      with: { to: ["operator"], title: "Your change is ready to approve", show: ["changes", "checks", "critique-code"] },
      outcomes: {
        approve: "Approve and ship",
        "change-code": { says: "Change the code", fields: { ...shipFeedback } },
        "change-plan": { says: "Change the plan", fields: { ...shipFeedback } }
      },
      on: { "change-code": "build", "change-plan": "plan" }
    },
    ship: { uses: "publish", name: "Create PR" }
  }
}, "ship", "build");
var BUG_FIX = withPrTail({
  version: 1,
  id: "bug-fix",
  name: "Bug fix",
  description: "Something's broken. Find the cause, fix it with a test that shows it, and check nothing else broke.",
  triggers: ["manual"],
  workspace: { repos: "from-task" },
  replies: ["investigate", "fix"],
  steps: {
    investigate: { uses: "agent", name: "Investigate", with: { prompt: "investigate", can: "run" } },
    fix: { uses: "agent", name: "Fix", with: { prompt: "fix-bug", can: "edit" } },
    checks: { uses: "run", name: "Checks", with: { commands: ["types", "tests", "lint"] }, on: { fail: { to: "fix", max: 3, else: "approve" } } },
    approve: {
      uses: "ask",
      name: "Approve",
      with: { to: ["operator"], title: "Your fix is ready to approve", show: ["changes", "checks", "investigate"] },
      outcomes: {
        approve: "Approve and ship",
        change: { says: "Change the fix", fields: { ...shipFeedback } },
        reinvestigate: { says: "Look again at the cause", fields: { ...shipFeedback } }
      },
      on: { change: "fix", reinvestigate: "investigate" }
    },
    ship: { uses: "publish", name: "Create PR" }
  }
}, "ship", "fix");

// ../core/src/validate.ts
var NOTHING = "nothing";
var ENGINES = ["default", "other", ...HARNESSES.map((h) => h.id)];
var CANS = ["read", "run", "edit"];
var EFFORTS = ["low", "medium", "high"];
var FALLBACKS = ["wait", "default", "skip"];
var ENDS = ["done", "stop"];
function validateWorkflow(w, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (step, msg) => errors.push(step ? `${step}: ${msg}` : msg);
  if (w.version !== 1) err(null, "version must be 1");
  const ids = stepIds(w ?? { steps: {} });
  if (!ids.length) {
    err(null, "a workflow needs at least one step");
    return { errors, warnings };
  }
  const has = (id) => ids.includes(id);
  if (w.order && (w.order.length !== Object.keys(w.steps).length || !Object.keys(w.steps).every((k) => w.order.includes(k)))) err(null, "order must list every step once");
  const isTarget = (t) => typeof t === "string" && (has(t) || ENDS.includes(t));
  const workspace = w.workspace?.repos ?? "from-task";
  for (const id of ids) {
    const step = w.steps[id];
    const type = STEP_TYPES[step.uses];
    if (!type) {
      err(id, `there's no step type "${step.uses}"`);
      continue;
    }
    if (type.later && !isPrWait(w, id)) err(id, `"${step.uses}" can't be used yet: ${type.later}`);
    if (typeof step.outcomes === "string" && !w.outcomes?.[step.outcomes] && !SHARED_OUTCOMES[step.outcomes]) {
      err(id, `there's no outcome type "${step.outcomes}"`);
    }
    const outcomes = outcomesOf(w, id);
    if (!outcomes.length) err(id, "it has no outcomes");
    for (const [name, o] of outcomes) {
      for (const f of fieldsOf(o)) {
        const ok = f.type === "text" || f.type === "number" || f.type === "yes/no" || Array.isArray(f.type) && f.type.length > 0 && f.type.every((c) => typeof c === "string");
        if (!ok) err(id, `outcome "${name}" has field "${f.name}" of an unknown type`);
      }
    }
    if (step.uses === "agent") {
      const a = agentWith(w, id);
      const own = step.with ?? {};
      if (typeof own.prompt !== "string" || !own.prompt) err(id, "an agent step needs a prompt");
      if (own.agent !== void 0 && !w.agents?.[own.agent]) err(id, `there's no agent named "${own.agent}"`);
      if (a.can !== void 0 && !CANS.includes(a.can)) err(id, `can must be one of ${CANS.join(", ")}`);
      if (a.engine !== void 0 && !ENGINES.includes(a.engine)) err(id, `engine must be one of ${ENGINES.join(", ")}`);
      if (a.effort !== void 0 && !EFFORTS.includes(a.effort)) err(id, `effort must be one of ${EFFORTS.join(", ")}`);
      if (a.fallback !== void 0 && !FALLBACKS.includes(a.fallback)) err(id, `fallback must be one of ${FALLBACKS.join(", ")}`);
      if ((a.can === "edit" || a.can === "run") && workspace === "none") err(id, `can: ${a.can} needs a workspace`);
      if (a.session && a.session !== "own" && a.session !== "fresh") {
        const other = w.steps[a.session];
        if (!other || other.uses !== "agent") err(id, `session "${a.session}" isn't an agent step`);
        else {
          const b = agentWith(w, a.session);
          const same = HARNESSES.every((h) => resolveEngine(a.engine, h.id) === resolveEngine(b.engine, h.id));
          if (!same) err(id, `it can't share a session with ${a.session}, which uses another tool`);
          if (a.can === "edit" !== (b.can === "edit")) err(id, `it can't share a session with ${a.session}, which works in another folder`);
        }
      }
    }
    if (step.uses === "run") {
      const cmds = step.with?.commands;
      if (!Array.isArray(cmds) || !cmds.length) err(id, "a run step needs commands");
      else for (const c of cmds) {
        const ok = typeof c === "string" && /^[A-Za-z0-9_.:-]+$/.test(c) || c && typeof c === "object" && typeof c.command === "string" && c.command.trim();
        if (!ok) err(id, "each command is a check's name, or { command, name?, timeout? }");
      }
      if (workspace === "none") err(id, "a run step needs a workspace");
    }
    if (step.uses === "ask") {
      const a = step.with ?? {};
      if (!Array.isArray(a.to) || !a.to.length) err(id, "an ask needs someone to ask (to)");
      if (typeof a.title !== "string" || !a.title) err(id, "an ask needs a title");
      for (const s of a.show ?? []) {
        if (s !== "changes" && !has(s)) err(id, `it shows "${s}", which isn't a step`);
      }
    }
    const names = new Set(outcomes.map(([n]) => n));
    for (const [outcome, spec] of Object.entries(step.on ?? {})) {
      if (!names.has(outcome) && outcome !== "failed" && !(outcome === NOTHING && step.uses === "agent")) {
        err(id, `"${outcome}" isn't one of its outcomes (${[...names].join(", ")})`);
        continue;
      }
      const list = Array.isArray(spec) ? spec : [spec];
      for (const p of list) {
        const path = typeof p === "string" ? { to: p } : p;
        if (!isTarget(path.to)) err(id, `on ${outcome}: "${path.to}" isn't a step, done or stop`);
        if (path.else !== void 0 && !isTarget(path.else)) err(id, `on ${outcome}: else "${path.else}" isn't a step, done or stop`);
        if (path.max !== void 0 && (!Number.isInteger(path.max) || path.max < 1)) err(id, `on ${outcome}: max must be a whole number from 1`);
      }
    }
    for (const [name] of outcomes.slice(1)) {
      const routedByItself = step.uses === "publish" && name === "conflicts";
      if (!step.on?.[name] && !routedByItself && !["stop", "fail", "timeout", "moved"].includes(name)) warnings.push(`${id}: outcome "${name}" has no path, so it stops the task`);
    }
  }
  if (errors.length) return { errors, warnings };
  const edges = [];
  for (const id of ids) {
    const names = [...outcomesOf(w, id).map(([n]) => n), ...w.steps[id].on?.failed ? ["failed"] : [], ...w.steps[id].on?.[NOTHING] ? [NOTHING] : []];
    for (const outcome of names) {
      for (const p of pathsFor(w, id, outcome)) {
        edges.push({ from: id, to: p.to, bounded: p.max !== void 0 });
        if (p.max !== void 0) edges.push({ from: id, to: p.else ?? "stop", bounded: false });
      }
    }
  }
  const succ = (n) => edges.filter((e) => e.from === n).map((e) => e.to);
  const pred = (n) => edges.filter((e) => e.to === n).map((e) => e.from);
  const start = ids[0];
  const reach = /* @__PURE__ */ new Set([start]);
  for (const queue = [start]; queue.length; ) for (const n of succ(queue.shift())) if (!reach.has(n)) reach.add(n), queue.push(n);
  for (const id of ids) if (!reach.has(id)) err(id, "no path reaches it");
  const ends = new Set(ENDS);
  for (const queue = [...ENDS]; queue.length; ) for (const n of pred(queue.shift())) if (!ends.has(n)) ends.add(n), queue.push(n);
  for (const id of ids) if (!ends.has(id)) err(id, "it can't reach done or stop");
  const isAsk = (n) => w.steps[n]?.uses === "ask";
  const free = edges.filter((e) => !e.bounded && !isAsk(e.from) && !isAsk(e.to) && has(e.to));
  const state = /* @__PURE__ */ new Map();
  const visit = (n, trail) => {
    state.set(n, 1);
    for (const e of free.filter((x) => x.from === n)) {
      if (state.get(e.to) === 1) err(null, `the loop ${[...trail.slice(trail.indexOf(e.to)), e.to].join(" \u2192 ")} has no limit (max) and no ask`);
      else if (!state.has(e.to)) visit(e.to, [...trail, e.to]);
    }
    state.set(n, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id, [id]);
  const dom = /* @__PURE__ */ new Map();
  for (const id of ids) dom.set(id, id === start ? /* @__PURE__ */ new Set([start]) : new Set(ids));
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of ids) {
      if (id === start || !reach.has(id)) continue;
      const ps = pred(id).filter((p) => reach.has(p));
      const meet = ps.length ? new Set([...dom.get(ps[0])].filter((x) => ps.every((p) => dom.get(p).has(x)))) : /* @__PURE__ */ new Set();
      meet.add(id);
      if (meet.size !== dom.get(id).size) {
        dom.set(id, meet);
        changed = true;
      }
    }
  }
  const unattended = new Set(opts.unattended ?? []);
  for (const id of ids) {
    const step = w.steps[id];
    if (!isExternal(w, id) || unattended.has(step.uses)) continue;
    const seen = /* @__PURE__ */ new Set();
    const back = (n) => {
      for (const p of pred(n)) {
        if (seen.has(p)) continue;
        seen.add(p);
        if (isAsk(p)) continue;
        return p;
      }
      return null;
    };
    if (id === start) err(id, "it changes something outside recode, so a person has to approve it first");
    else {
      const culprit = back(id);
      if (culprit) err(id, `it changes something outside recode, and can run after ${culprit} without a person approving`);
    }
  }
  const afterPublish = /* @__PURE__ */ new Set();
  for (const id of ids.filter((x) => w.steps[x].uses === "publish")) {
    for (const queue = [id]; queue.length; ) for (const n of succ(queue.shift())) if (has(n) && !afterPublish.has(n)) afterPublish.add(n), queue.push(n);
  }
  for (const id of ids) {
    for (const spec of Object.values(w.steps[id].on ?? {})) {
      for (const p of Array.isArray(spec) ? spec : [spec]) {
        if (typeof p !== "string" && p.fresh && afterPublish.has(id)) err(id, "fresh can't be used after a publish");
      }
    }
  }
  const checkRef = (at, ref, whereFrom, value) => {
    const parts = ref.split(".");
    if (parts[0] === "steps") {
      const [, sid, key] = parts;
      if (!has(sid)) return err(at, `{{${ref}}}: there's no step "${sid}"`);
      if (whereFrom === "with" ? sid === at || !dom.get(at).has(sid) : !dom.get(at).has(sid)) {
        return err(at, `{{${ref}}}: ${sid} doesn't always come before it`);
      }
      if (!key || ["output", "outcome", "tries"].includes(key)) return;
      const field = outcomesOf(w, sid).flatMap(([, o]) => fieldsOf(o)).find((f) => f.name === key);
      if (!field) return err(at, `{{${ref}}}: ${sid} has no field "${key}"`);
      if (value !== void 0 && Array.isArray(field.type)) {
        const values = Array.isArray(value) ? value : typeof value === "object" ? [] : [value];
        for (const v of values) if (!field.type.includes(String(v))) err(at, `${ref} can't be "${v}" (it's one of ${field.type.join(", ")})`);
      }
      return;
    }
    if (parts[0] === "input") {
      if (!w.inputs || !Object.keys(w.inputs).some((k) => k.replace(/!$/, "") === parts[1])) err(at, `{{${ref}}}: there's no input "${parts[1]}"`);
      return;
    }
    if (["task", "workspace", "feedback", "previous"].includes(parts[0])) return;
    err(at, `{{${ref}}}: nothing is called "${parts[0]}"`);
  };
  const strings = (v) => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
  for (const id of ids) {
    for (const s of strings(w.steps[id].with)) for (const m of s.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) checkRef(id, m[1], "with");
    for (const spec of Object.values(w.steps[id].on ?? {})) {
      for (const p of Array.isArray(spec) ? spec : [spec]) {
        if (typeof p !== "string") for (const [k, v] of Object.entries(p.if ?? {})) checkRef(id, k, "if", v);
      }
    }
  }
  return { errors, warnings };
}

// ../core/src/catalog.ts
var TOOL_GUIDANCE = [...new Set(HARNESSES.flatMap((h) => h.guidanceFiles))].sort();
var GUIDANCE_FILES = [...TOOL_GUIDANCE, ...TOOL_GUIDANCE.map((f) => `**/${f}`), "CONTRIBUTING.md", ".github/pull_request_template.md", ".github/workflows", "CODEOWNERS", ".github/CODEOWNERS", "docs/design", "docs/adr"];
var STEP_DEFS = [
  { id: "spec", name: "Spec", does: "writes what the change must do: who it's for, what they can do after, how you'll know it works. Asks what the request leaves open", tunes: ["focus", "engine"] },
  { id: "ux-design", name: "UX design", does: "the screens and flows, as HTML mocks. Only when the change has UI", tunes: ["focus", "engine"] },
  { id: "eng-design", name: "Eng design", does: "the architecture: how it fits the code, the data, the interfaces between parts, what could go wrong", tunes: ["focus", "engine"] },
  { id: "plan", name: "Plan", does: "reads the code and writes a short plan, for smaller changes", tunes: ["focus", "engine"] },
  { id: "investigate", name: "Investigate", does: "finds the cause of a bug, reproducing it if it can", tunes: ["focus", "engine"] },
  { id: "subtasks", name: "Subtasks", does: "builds the change as small subtasks, each built, checked and reviewed on its own, when the plan or design splits it. Right before build, after you approve the design or plan; with no split, build does it all", edits: true, tunes: [] },
  { id: "build", name: "Build", does: "makes the change. Can repeat, for more changes later in the task", repeats: true, edits: true, tunes: ["focus", "engine"] },
  { id: "fix-bug", name: "Fix the bug", does: "fixes a bug at its cause, with a test that shows it", repeats: true, edits: true, tunes: ["focus", "engine"] },
  { id: "checks", name: "Checks", does: "runs the project's checks: types, tests, lint, or a script it has, by name", repeats: true, tunes: ["checks", "max"], max: [1, 3, 2] },
  { id: "fix", name: "Fix", does: "fixes what the checks before it found, carrying on Build", repeats: true, edits: true, tunes: [] },
  { id: "verify", name: "Verify", does: "runs the change and says whether it does what was asked", repeats: true, tunes: ["max", "engine"], max: [0, 3, 2] },
  { id: "review", name: "Review", does: "another tool reads the spec, design, plan or change, with a focus, and can send it back. Every change to the code gets one of the change (recode review), added after the last step that changes the code if you leave it out; choose it yourself only to give it a focus or a max", repeats: true, tunes: ["subject", "focus", "engine", "max"], max: [1, 4, 3] },
  { id: "approve", name: "Approve", does: "the person looks at the spec, design, plan or change, and can send it back", repeats: true, tunes: ["subject"] },
  { id: "ship", name: "Create PR", does: "opens the pull request", tunes: [] },
  { id: "make", name: "Make", does: "makes what the request asks for as files, outside the repo: a spreadsheet, a deck, a document, a diagram, a clickable HTML prototype. They show in the task to open or download; nothing goes in the code. Set focus to say what to make", repeats: true, tunes: ["focus", "engine"] },
  { id: "report", name: "Report", does: "answers the request with a written report and changes nothing: for questions, code reviews, audits, surveys and investigations that ask for findings. Can repeat: a later one builds on an earlier one", repeats: true, tunes: ["focus", "engine"] }
];
var defOf = (id) => STEP_DEFS.find((d) => d.id === id);
var TEMPLATES = [
  {
    id: "quick-change",
    name: "Quick change",
    description: "Small, clear edits. Plan, build and verify, then you approve.",
    steps: [{ def: "plan" }, { def: "build" }, { def: "verify" }, { def: "approve", subject: "change" }, { def: "ship" }]
  },
  {
    id: "ui-change",
    name: "UI change",
    description: "Screens and polish. Mocks you approve first, then build, checks and a look at it running, with screenshots.",
    visual: true,
    steps: [
      { def: "plan" },
      { def: "ux-design" },
      { def: "approve", subject: "design" },
      { def: "build" },
      { def: "checks", checks: ["types", "tests", "lint"], max: 3 },
      { def: "fix" },
      { def: "verify" },
      { def: "approve", subject: "change" },
      { def: "ship" }
    ]
  },
  {
    id: "feature",
    name: "Feature",
    description: "Spec and design first, you approve them, then build, checks and a review.",
    steps: [
      { def: "spec" },
      { def: "ux-design" },
      { def: "eng-design" },
      { def: "review", subject: "design" },
      { def: "approve", subject: "design" },
      { def: "subtasks" },
      { def: "build" },
      { def: "checks", checks: ["types", "tests", "lint"], max: 3 },
      { def: "fix" },
      { def: "review", subject: "change", max: 3 },
      { def: "approve", subject: "change" },
      { def: "ship" }
    ]
  },
  {
    id: "bug-fix",
    name: "Bug fix",
    description: "Find the cause, fix it with a test that shows it.",
    steps: [{ def: "investigate" }, { def: "fix-bug" }, { def: "checks", checks: ["types", "tests", "lint"], max: 3 }, { def: "approve", subject: "change" }, { def: "ship" }]
  },
  {
    id: "chore",
    name: "Chore",
    description: "Dependencies, CI, config and docs. Make the change, run the checks, then you approve.",
    steps: [{ def: "build" }, { def: "checks", checks: ["types", "tests", "lint"], max: 2 }, { def: "fix" }, { def: "approve", subject: "change" }, { def: "ship" }]
  },
  {
    id: "hardening",
    name: "Hardening",
    description: "Refactors and reliability. A plan, the full checks, and the other tool reviewing until nothing blocks, before you look.",
    steps: [
      { def: "plan" },
      { def: "build" },
      { def: "checks", checks: ["types", "tests", "lint"], max: 3 },
      { def: "fix" },
      { def: "review", subject: "change", max: 4, focus: "Behavior that should stay the same, and what breaks on restarts, retries, races or partial failures" },
      { def: "approve", subject: "change" },
      { def: "ship" }
    ]
  },
  {
    id: "research",
    name: "Research",
    description: "Questions, reviews and surveys: reads the code and answers with a report. Nothing changes and nothing ships.",
    steps: [{ def: "report" }]
  }
];
var templateOf = (id) => TEMPLATES.find((t) => t.id === id);
var CUSTOM = { id: "custom", name: "Custom", description: "Steps put together for this task.", steps: [] };
var PLANNER_KEY = "planner";
var PLANNER_STEP = {
  uses: "agent",
  name: "Planner",
  with: { prompt: "planner", can: "read" },
  outcomes: { done: "Steps chosen", invalid: { says: "The steps didn't check out", fields: { "reason!": "text" } } },
  on: { invalid: { to: PLANNER_KEY, max: 5, else: "stop" } }
};
var AUTO_START = {
  version: 1,
  id: "auto",
  name: "Auto",
  description: "recode puts the steps together for this task from what you ask.",
  triggers: ["manual"],
  workspace: { repos: "from-task" },
  steps: { [PLANNER_KEY]: PLANNER_STEP },
  order: [PLANNER_KEY]
};
var CHECK_NAME = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,40}$/;
var NOT_A_CHECK = /(deploy|publish|release|push|upload|migrate|seed|prod)/i;
var ENGINES2 = ["default", "other", ...HARNESSES.map((h) => h.id)];
var MAX_STEPS = 16;
var LOOKS = ["investigate", "build", "fix-bug", "verify"];
var clip = (v, n) => typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, n) : void 0;
function assemble(choice) {
  const errors = [];
  const template = templateOf(choice.template) ?? CUSTOM;
  const list = Array.isArray(choice.steps) ? choice.steps : [];
  if (!list.length) errors.push("There are no steps.");
  if (list.length > MAX_STEPS) errors.push(`There are ${list.length} steps; ${MAX_STEPS} at most.`);
  const seen = /* @__PURE__ */ new Map();
  const picked = [];
  list.forEach((c, i) => {
    const at = `Step ${i + 1}`;
    if (!c || typeof c !== "object" || typeof c.def !== "string") return errors.push(`${at} needs a "def".`);
    const d = defOf(c.def);
    if (!d) return errors.push(`${at}: "${c.def}" isn't a step. Use one of ${STEP_DEFS.map((x) => x.id).join(", ")}.`);
    const n = (seen.get(d.id) ?? 0) + 1;
    seen.set(d.id, n);
    if (n > 1 && !d.repeats) errors.push(`${at}: ${d.id} can only be used once.`);
    for (const k of ["focus", "checks", "max", "subject", "engine"]) {
      if (c[k] !== void 0 && !d.tunes.includes(k)) errors.push(`${at}: ${d.id} doesn't take "${k}".`);
    }
    if (c.max !== void 0 && d.max && (!Number.isInteger(c.max) || c.max < d.max[0] || c.max > d.max[1])) errors.push(`${at}: max for ${d.id} is from ${d.max[0]} to ${d.max[1]}.`);
    if (c.subject !== void 0 && !["spec", "design", "plan", "change"].includes(c.subject)) errors.push(`${at}: subject is one of spec, design, plan, change.`);
    if ((d.id === "review" || d.id === "approve") && c.subject === void 0) errors.push(`${at}: ${d.id} needs a subject.`);
    if (c.engine !== void 0 && !ENGINES2.includes(c.engine)) errors.push(`${at}: engine is one of ${ENGINES2.join(", ")}.`);
    if (d.id === "checks") {
      const names = c.checks ?? ["types", "tests", "lint"];
      if (!Array.isArray(names) || !names.length || names.length > 6) errors.push(`${at}: checks is a list of 1 to 6 names.`);
      else for (const name of names) {
        if (typeof name !== "string" || !CHECK_NAME.test(name)) errors.push(`${at}: "${name}" isn't a check's name.`);
        else if (NOT_A_CHECK.test(name)) errors.push(`${at}: "${name}" looks like it changes something outside the workspace, so it can't be a check.`);
      }
    }
    picked.push({ ...c, id: n > 1 ? `${d.id}-${n}` : d.id, d });
  });
  if (errors.length) return { errors };
  const visual = choice.visual === true && !picked.some((p) => p.d.id === "report");
  if (visual && picked.some((p) => p.d.id === "build" || p.d.id === "fix-bug")) {
    const lastWork = () => picked.findLastIndex((p) => !!p.d.edits || p.d.id === "checks");
    const approval = picked.findLastIndex((p) => p.d.id === "approve" && p.subject === "change");
    const has = picked.findIndex((p) => p.d.id === "verify");
    if (has < 0 || has < lastWork() || approval >= 0 && has > approval) {
      const verify = has >= 0 ? picked.splice(has, 1)[0] : { def: "verify", say: "runs the app and checks the change on screen, with a screenshot", id: "verify", d: defOf("verify") };
      const from = lastWork();
      const at = picked.findIndex((p, i) => i > from && (p.d.id === "review" || p.d.id === "approve" || p.d.id === "ship"));
      picked.splice(at < 0 ? picked.length : at, 0, verify);
    }
  }
  if (picked.some((p) => p.d.id === "build" || p.d.id === "fix-bug")) {
    const isWork = (p) => !!p.d.edits || p.d.id === "checks" || p.d.id === "verify";
    const isReview = (p) => p.d.id === "review" && p.subject === "change";
    let from = 0;
    while (from <= picked.length) {
      const next = picked.findIndex((p, j) => j >= from && p.d.id === "approve" && p.subject === "change");
      const to = next < 0 ? picked.length : next;
      const stretch = picked.slice(from, to);
      const lastWork = from + stretch.findLastIndex(isWork);
      if (stretch.some((p) => p.d.edits) && !picked.slice(lastWork + 1, to).some(isReview)) {
        const early = picked.findIndex((p, j) => j >= from && j < lastWork && isReview(p));
        const n = picked.filter((p) => p.d.id === "review").length;
        const review = early >= 0 ? picked.splice(early, 1)[0] : { def: "review", subject: "change", say: "recode review: reads the change, proves what it finds, and writes the brief", id: n ? `review-${n + 1}` : "review", d: defOf("review") };
        const after2 = early >= 0 ? lastWork - 1 : lastWork;
        const end = early >= 0 ? to - 1 : to;
        const at = picked.findIndex((p, j) => j > after2 && j < end && (p.d.id === "approve" || p.d.id === "ship"));
        picked.splice(at < 0 ? end : at, 0, review);
        from = (next < 0 ? picked.length : picked.findIndex((p, j) => j > after2 && p.d.id === "approve" && p.subject === "change")) + 1;
        if (from === 0) break;
      } else {
        if (next < 0) break;
        from = next + 1;
      }
    }
  }
  picked.filter((p) => p.d.id === "review").forEach((p, k) => {
    p.id = k ? `review-${k + 1}` : "review";
  });
  const idx = (pred, from = 0, to = picked.length) => picked.findIndex((p, i) => i >= from && i < to && pred(p));
  const last = (pred, before2 = picked.length) => {
    for (let i = before2 - 1; i >= 0; i--) if (pred(picked[i])) return i;
    return -1;
  };
  const isMaker = (p) => p.d.id === "build" || p.d.id === "fix-bug";
  const ships = picked.filter((p) => p.d.id === "ship");
  if (ships.length > 1) errors.push("Create PR (ship) comes at most once.");
  if (ships.length && picked.slice(picked.findIndex((p) => p.d.id === "ship") + 1).some((p) => p.d.edits)) errors.push("Nothing that changes the code comes after ship: put build, fix-bug or fix before it, or leave ship out.");
  if (ships.length) {
    if (idx(isMaker) < 0) errors.push("Create PR (ship) needs something before it that makes the change: build or fix-bug. Leave ship out when the task makes no change to the code.");
    const lastEdit = last((p) => !!p.d.edits);
    const finalApprove = last((p) => p.d.id === "approve" && p.subject === "change");
    if (finalApprove < 0 || finalApprove < lastEdit) errors.push('Before ship, an approve with subject "change" comes after the last step that changes the code: nothing leaves without a person seeing it.');
  }
  const makerOf = (s) => s === "change" ? isMaker : s === "design" ? (p) => p.d.id === "ux-design" || p.d.id === "eng-design" : (p) => p.d.id === s;
  picked.forEach((p, i) => {
    if (p.subject && idx(makerOf(p.subject), 0, i) < 0) errors.push(`${p.id}: there's nothing before it that makes the ${p.subject}.`);
    if ((p.d.id === "checks" || p.d.id === "verify") && last(isMaker, i) < 0) errors.push(`${p.id}: it needs build or fix-bug before it.`);
    if (p.d.id === "fix" && last((x) => x.d.id === "checks", i) < 0) errors.push(`${p.id}: fix comes after checks.`);
    if (p.d.id === "subtasks") {
      if (picked[i + 1]?.d.id !== "build") errors.push(`${p.id}: it comes right before build.`);
      const approved = last((x) => x.d.id === "approve" && (x.subject === "design" || x.subject === "plan"), i);
      if (approved < 0 || last((x) => x.d.id === "plan" || x.d.id === "eng-design", approved) < 0) errors.push(`${p.id}: it needs plan or eng-design, and an approve of the design or plan, before it: that's where the person sees the list.`);
    }
  });
  if (errors.length) return { errors };
  const ids = picked.map((p) => p.id);
  const after = (i, pred) => {
    const j = idx(pred, i + 1);
    return j < 0 ? void 0 : picked[j].id;
  };
  const before = (i, pred) => {
    const j = last(pred, i);
    return j < 0 ? void 0 : picked[j].id;
  };
  const nextApprove = (i) => {
    const approve = after(i, (p) => p.d.id === "approve") ?? "stop";
    const verify = visual ? after(i, (p) => p.d.id === "verify") : void 0;
    return verify && (approve === "stop" || ids.indexOf(verify) < ids.indexOf(approve)) ? verify : approve;
  };
  const nextReviewOrApprove = (i) => {
    const review = after(i, (p) => p.d.id === "review");
    const approve = nextApprove(i);
    return review && (approve === "stop" || ids.indexOf(review) < ids.indexOf(approve)) ? review : approve;
  };
  const makerAt = (i) => before(i, isMaker) ?? before(picked.length, isMaker);
  const designFirst = (i) => before(i, (p) => p.d.id === "ux-design" || p.d.id === "eng-design") && picked.find((p) => p.d.id === "ux-design" || p.d.id === "eng-design").id;
  const backFor = (i, s) => s === "change" ? makerAt(i) : s === "design" ? designFirst(i) : before(i, (p) => p.d.id === s);
  const steps = {};
  picked.forEach((p, i) => {
    const focus = clip(p.focus, 200);
    const looks = visual && LOOKS.includes(p.d.id);
    const engine = p.engine && p.engine !== "default" && p.d.id !== "review" ? { engine: p.engine, fallback: "default" } : {};
    const w = (extra) => ({ ...engine, ...extra, ...focus ? { focus } : {}, ...looks ? { visual: true } : {} });
    let s;
    switch (p.d.id) {
      case "spec":
        s = { uses: "agent", name: "Spec", with: w({ prompt: "spec", can: "read" }) };
        break;
      case "ux-design":
        s = { uses: "agent", name: "UX design", with: w({ prompt: "ux-design", can: "run" }) };
        break;
      case "eng-design":
        s = { uses: "agent", name: "Eng design", with: w({ prompt: "eng-design", can: "read" }) };
        break;
      case "plan":
        s = { uses: "agent", name: "Plan", with: w({ prompt: "plan", can: "read" }) };
        break;
      case "investigate":
        s = { uses: "agent", name: "Investigate", with: w({ prompt: "investigate", can: "run" }) };
        break;
      case "build":
        s = { uses: "agent", name: "Build", with: w({ prompt: "build", can: "edit" }) };
        break;
      // Done, the subtasks made the change, so the steps after Build check it; with none, Build makes it.
      case "subtasks":
        s = { uses: "subtasks", name: "Subtasks", with: { flow: "piece", at_once: 1 }, on: { done: ids[i + 2] ?? "done", none: ids[i + 1], stuck: nextApprove(i) } };
        break;
      case "fix-bug":
        s = { uses: "agent", name: "Fix the bug", with: w({ prompt: "fix-bug", can: "edit" }) };
        break;
      case "checks": {
        const max = p.max ?? p.d.max[2];
        const fix = after(i, (x) => x.d.id === "fix");
        const fixAdjacent = fix && ids.indexOf(fix) === i + 1;
        const back = fixAdjacent ? fix : makerAt(i);
        s = { uses: "run", name: "Checks", with: { commands: p.checks ?? ["types", "tests", "lint"] }, on: { fail: { to: back, max, else: nextReviewOrApprove(i) } } };
        if (fixAdjacent) s.on.pass = ids[i + 2] ?? "done";
        break;
      }
      case "fix": {
        const builder = before(i, (x) => x.d.id === "build");
        s = { uses: "agent", name: "Fix", with: { prompt: "fix", can: "edit", ...builder ? { session: builder } : {} }, on: { done: before(i, (x) => x.d.id === "checks") } };
        break;
      }
      case "verify": {
        const max = p.max ?? p.d.max[2];
        s = { uses: "agent", name: "Verify", with: w({ prompt: "verify", can: "run" }), outcomes: "verdict", on: max ? { fail: { to: makerAt(i), max, else: nextReviewOrApprove(i) } } : { fail: nextReviewOrApprove(i) } };
        break;
      }
      case "review": {
        const max = p.max ?? p.d.max[2];
        const back = backFor(i, p.subject);
        s = {
          uses: "agent",
          // A review of the change is recode review (docs/specs/recode-review.md): it may run a test or a command to
          // check a finding, and what it changes is thrown away.
          name: p.subject === "change" ? "recode review" : "Review",
          // The other tool reads it with fresh eyes. Every change is reviewed, so with only one tool set up, recode review
          // runs on that one rather than being skipped; a review of a spec, design or plan is skipped as before.
          with: w({ prompt: "review", subject: p.subject, engine: p.engine ?? "other", effort: "high", fallback: p.subject === "change" ? "default" : "skip", session: "fresh", ...p.subject === "change" ? { can: "run" } : {} }),
          outcomes: "review",
          on: max ? { changes: { to: back, max, else: nextApprove(i) } } : { changes: nextApprove(i) }
        };
        break;
      }
      case "approve":
        s = approveStep(picked, i, p.subject, backFor);
        break;
      // Its words are the task's document (DOCUMENT_PROMPTS). It may run the code to check a finding, but changes nothing.
      case "report":
        s = { uses: "agent", name: "Report", with: w({ prompt: "report", can: "run" }) };
        break;
      // In its own folder, like UX design: what it makes is shown in the task, never put in the code.
      case "make":
        s = { uses: "agent", name: "Make", with: w({ prompt: "make", can: "run" }) };
        break;
      default:
        s = { uses: "publish", name: "Create PR" };
    }
    steps[p.id] = s;
  });
  const plain = {
    version: 1,
    id: template.id,
    name: template.name,
    description: clip(choice.why, 600) ?? template.description,
    triggers: ["manual"],
    workspace: { repos: "from-task" },
    steps,
    order: ids
  };
  const shipId = ships[0] ? ships[0].id : void 0;
  const shipMaker = shipId ? before(ids.indexOf(shipId), isMaker) : void 0;
  const workflow = sameToolAsSession(!shipId || !shipMaker ? plain : visual ? withVisualPrTail(withPrTail(plain, shipId, shipMaker)) : withPrTail(plain, shipId, shipMaker));
  const v = validateWorkflow(workflow);
  if (v.errors.length) return { errors: v.errors };
  return {
    workflow,
    assembly: { template: template.id, why: clip(choice.why, 600) ?? "", ...visual ? { visual: true } : {}, steps: picked.map(({ id, d, ...choice2 }) => ({ id, def: d.id, say: clip(choice2.say, 200) ?? null, choice: choice2, ...Array.isArray(choice2.because) && choice2.because.length ? { because: choice2.because.filter((b) => typeof b === "string").slice(0, 6) } : {} })) }
  };
}
function sameToolAsSession(w) {
  const steps = { ...w.steps };
  for (const [k, st] of Object.entries(steps)) {
    const own = st.with;
    const from = own?.session ? steps[own.session]?.with : void 0;
    if (from?.engine && !own.engine) steps[k] = { ...st, with: { ...st.with, engine: from.engine, ...from.fallback ? { fallback: from.fallback } : {} } };
  }
  return { ...w, steps };
}
var feedback = { "feedback!": "text" };
function approveStep(picked, i, subject, backFor) {
  const has = (def) => picked.slice(0, i).find((p) => p.d.id === def)?.id;
  const shipsNext = picked[i + 1]?.d.id === "ship";
  const outcomes = {};
  const on = {};
  const show = [];
  const reviewOf = picked.slice(0, i).filter((p) => p.d.id === "review" && p.subject === subject).at(-1)?.id;
  if (subject === "change") {
    outcomes.approve = shipsNext ? "Approve and ship" : "Approve";
    outcomes.change = { says: "Change the code", fields: feedback };
    on.change = backFor(i, "change");
    show.push("changes");
    for (const k of ["checks", "verify", "investigate"]) {
      const id = picked.slice(0, i).filter((p) => p.d.id === k).at(-1)?.id;
      if (id) show.push(id);
    }
    const plan = has("plan");
    if (plan) {
      outcomes["change-plan"] = { says: "Change the plan", fields: feedback };
      on["change-plan"] = plan;
    }
  } else if (subject === "design") {
    outcomes.approve = "Approve the design";
    const spec = has("spec");
    if (spec) {
      outcomes["change-spec"] = { says: "Change the spec", fields: feedback };
      on["change-spec"] = spec;
      show.push(spec);
    }
    outcomes["change-design"] = { says: "Change the design", fields: feedback };
    on["change-design"] = backFor(i, "design");
    for (const d of ["ux-design", "eng-design"]) if (has(d)) show.push(has(d));
  } else {
    outcomes.approve = subject === "spec" ? "Approve the spec" : "Approve the plan";
    const back = backFor(i, subject);
    outcomes.change = { says: subject === "spec" ? "Change the spec" : "Change the plan", fields: feedback };
    on.change = back;
    show.push(back);
  }
  if (reviewOf) show.push(reviewOf);
  const title = subject === "change" ? "Your change is ready to approve" : subject === "design" ? "Approve the design" : subject === "spec" ? "Approve the spec" : "Approve the plan";
  return { uses: "ask", name: subject === "design" ? "Approve design" : subject === "change" ? "Approve" : `Approve ${subject}`, with: { to: ["operator"], title, show }, outcomes, on };
}
function templateWorkflow(id, opts = {}) {
  const t = templateOf(id) ?? TEMPLATES[0];
  const r = assemble({ template: t.id, steps: t.steps, why: t.description, ...opts.visual ?? t.visual ? { visual: true } : {} });
  if ("errors" in r) throw new Error(`template ${t.id} doesn't assemble: ${r.errors.join("; ")}`);
  return r;
}
var BUILTINS = TEMPLATES.map((t) => templateWorkflow(t.id).workflow);

// ../core/src/files.ts
var MAX_FILE_BYTES = 20 * 1024 * 1024;

// ../core/src/artifacts.ts
var TEXT_PROBE = 64 * 1024;

// ../core/src/kept.ts
var PAGE_LIMITS = { files: 200, bytes: 50 * 1024 * 1024 };
var KEPT_MAX_FILE = 10 * 1024 * 1024;

// ../core/src/refine.ts
var REFINE_LIMITS = { runningMs: 5 * 6e4, waitingMs: 10 * 6e4, files: 12, questions: 5, answers: 4, summary: 400, repos: 4, split: 5 };

// ../core/src/environment.ts
var PLATFORM_NAMES = { web: "Web", ios: "iOS", android: "Android" };
var NAME = /^[a-z][a-z0-9_-]{0,31}$/;
var VAR = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
function environmentProblems(e) {
  const out = [];
  const names = /* @__PURE__ */ new Set();
  for (const c of e.components) {
    if (!NAME.test(c.name)) out.push(`\u201C${c.name}\u201D isn\u2019t a name recode can use: lowercase letters, digits, - and _.`);
    if (names.has(c.name)) out.push(`There are two components called ${c.name}.`);
    names.add(c.name);
    if (c.phone) {
      if (!c.phone.build.trim()) out.push(`${c.name} has no command to build it.`);
      if (!c.phone.output.trim()) out.push(`${c.name} doesn\u2019t say where its build is.`);
      if (c.phone.bundler && !e.components.some((x) => x.name === c.phone.bundler)) out.push(`${c.name}\u2019s code comes from ${c.phone.bundler}, which isn\u2019t a component.`);
    } else if (!c.run.trim()) out.push(`${c.name} has no command to start it.`);
    if (c.cwd && (c.cwd.startsWith("/") || c.cwd.split(/[\\/]/).includes(".."))) out.push(`${c.name}\u2019s folder must be inside the repo.`);
  }
  for (const c of e.components) for (const a of c.after ?? []) if (!names.has(a)) out.push(`${c.name} waits for ${a}, which isn\u2019t a component.`);
  if (cycle(e.components)) out.push("The components wait for each other in a circle.");
  for (const v of e.variables) if (!VAR.test(v.name)) out.push(`\u201C${v.name}\u201D isn\u2019t a variable name.`);
  for (const s of e.scripts) if (!s.run.trim()) out.push("A script has no command.");
  return out;
}
function cycle(cs) {
  const after = new Map(cs.map((c) => [c.name, c.after ?? []]));
  const state = /* @__PURE__ */ new Map();
  const visit = (n) => {
    if (state.get(n) === 2) return false;
    if (state.get(n) === 1) return true;
    state.set(n, 1);
    for (const a of after.get(n) ?? []) if (visit(a)) return true;
    state.set(n, 2);
    return false;
  };
  return [...after.keys()].some(visit);
}
function startOrder(cs) {
  const done = /* @__PURE__ */ new Set();
  const out = [];
  const left = [...cs];
  while (left.length) {
    const i = left.findIndex((c2) => (c2.after ?? []).every((a) => done.has(a)));
    const [c] = left.splice(i < 0 ? 0 : i, 1);
    out.push(c);
    done.add(c.name);
  }
  return out;
}
function fillPorts(text, ports, own) {
  return text.replace(/\$\{([a-z][a-z0-9_-]*)\.port\}/g, (m, n) => n in ports ? String(ports[n]) : m).replace(/\$\{PORT\}|\$PORT\b/g, (m) => own && own in ports ? String(ports[own]) : m);
}

// ../runner/src/git.ts
var exec = (0, import_node_util.promisify)(import_node_child_process.execFile);
var SAFE_GIT_CONFIG = [["core.hooksPath", "/dev/null"], ["core.fsmonitor", "false"]];
function safeGitEnv(env = process.env) {
  const had = Number(env.GIT_CONFIG_COUNT) || 0;
  const out = { GIT_CONFIG_COUNT: String(had + SAFE_GIT_CONFIG.length) };
  SAFE_GIT_CONFIG.forEach(([k, v], i) => {
    out[`GIT_CONFIG_KEY_${had + i}`] = k;
    out[`GIT_CONFIG_VALUE_${had + i}`] = v;
  });
  return out;
}
async function git(cwd, ...args) {
  try {
    const { stdout } = await exec("git", args, { cwd, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...safeGitEnv(), GIT_TERMINAL_PROMPT: "0" } });
    return stdout.trim();
  } catch (err) {
    throw gitError(args, err);
  }
}
function gitError(args, err) {
  const e = err;
  const cmd = `git ${args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "-c") ?? ""}`.trim();
  const text = String(e?.stderr ?? "") || String(e?.message ?? "").split("\n").slice(1).join("\n");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let message;
  if (/no space left on device|disk quota exceeded/i.test(`${text}
${e?.message ?? ""}`)) message = `${OUT_OF_SPACE} (${cmd} failed)`;
  else if (e?.code === "ENOENT") message = "git isn't installed on this computer";
  else {
    const first = lines.find((l) => /^(fatal|error): /.test(l)) ?? lines[0];
    const reason = first ? first.replace(/^(fatal|error): /, "").slice(0, 200) : e?.killed ? "it was stopped" : `exit code ${e?.code ?? "unknown"}`;
    const more = lines.length > 1 ? ` (+${lines.length - 1} more)` : "";
    message = `${cmd} failed: ${reason}${more}`;
  }
  return Object.assign(new Error(message), { code: e?.code, stdout: e?.stdout, stderr: e?.stderr, killed: e?.killed });
}

// ../runner/src/near.ts
var import_node_child_process2 = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// ../core/src/test-files.ts
var TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|((^|\/)__tests__\/.+\.[cm]?[jt]sx?$)|((^|\/)test_[^/]+\.py$)|(_test\.(py|go)$)/;
var isTestFile = (file) => TEST_FILE.test(file);
var CONFIG = [
  /(^|\/)package\.json$/,
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$/,
  /(^|\/)pnpm-workspace\.yaml$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(turbo|nx|project|lerna)\.json$/,
  /(^|\/)[^/]+\.config\.[cm]?[jt]s$/,
  /(^|\/)\.babelrc/,
  /(^|\/)\.(npmrc|nvmrc|node-version)$/,
  /(^|\/)Cargo\.(toml|lock)$/,
  /(^|\/)go\.(mod|sum)$/,
  /(^|\/)(pyproject\.toml|setup\.py|setup\.cfg|tox\.ini|pytest\.ini|conftest\.py)$/,
  /(^|\/)requirements[^/]*\.txt$/,
  /^f4r\//,
  /^\.github\//
];
var isConfig = (file) => CONFIG.some((r) => r.test(file));

// ../runner/src/near.ts
var OUTPUT = /(^|\/)(node_modules|dist|build|out|coverage|target|\.next|\.turbo|\.nx|__pycache__|\.venv|venv|\.pytest_cache)\//;
async function changedFiles(folder, base) {
  const committed = await git(folder, "diff", "--name-only", `${base}...HEAD`).catch(() => void 0);
  if (committed === void 0) return [];
  const open = await git(folder, "status", "--porcelain", "--untracked-files=all", "--", ".", ":!node_modules", ":!*/node_modules/*").catch(() => "");
  const files = new Set(committed.split("\n").filter(Boolean));
  for (const line of open.split("\n")) {
    const f = line.replace(/^\s*\S{1,2}\s+/, "").split(" -> ").at(-1)?.replace(/^"|"$/g, "");
    if (f && !OUTPUT.test(f)) files.add(f);
  }
  return [...files];
}
function fileRunner(command) {
  if (!command || /&&|\|\||;|\|/.test(command)) return void 0;
  if (/^\s*node\s+(?:--[\w-]+(?:=\S+)?\s+)*--test\b/.test(command)) return "node";
  if (/^\s*(?:npx\s+)?vitest\b/.test(command)) return "vitest";
  if (/^\s*(?:npx\s+)?jest\b/.test(command)) return "jest";
  if (/^\s*(?:npx\s+)?mocha\b/.test(command)) return "mocha";
  if (/^\s*(?:python3?\s+-m\s+)?pytest\b/.test(command)) return "pytest";
  if (/^\s*go\s+test\b/.test(command)) return "go";
  return void 0;
}
var quote = (f) => /^[\w./@=-]+$/.test(f) ? f : `'${f.replace(/'/g, `'\\''`)}'`;
function withoutPaths(command, exists) {
  const words = command.trim().split(/\s+/);
  return words.filter((w, i) => {
    if (i === 0 || w.startsWith("-") || w === "run" || w === "test" && words[0] === "go") return true;
    const bare = w.replace(/^['"]|['"]$/g, "");
    return !(/[/*]/.test(bare) || /\.([cm]?[jt]sx?|py)$/.test(bare) || bare === "." || exists(bare));
  }).join(" ");
}
function testsNextTo(file, exists) {
  const dir = (0, import_node_path.dirname)(file);
  const ext = (0, import_node_path.extname)(file);
  const stem = (0, import_node_path.basename)(file, ext);
  const out = [];
  if (ext === ".py") {
    for (const c of [import_node_path.posix.join(dir, `test_${stem}.py`), import_node_path.posix.join(dir, "tests", `test_${stem}.py`), import_node_path.posix.join(dir, `${stem}_test.py`)]) if (exists(c)) out.push(c);
    return out;
  }
  if (!/^\.[cm]?[jt]sx?$/.test(ext)) return out;
  const exts = [.../* @__PURE__ */ new Set([ext, ".ts", ".tsx", ".js", ".jsx", ".mjs"])];
  for (const kind of ["test", "spec"]) {
    for (const e of exts) {
      for (const c of [import_node_path.posix.join(dir, `${stem}.${kind}${e}`), import_node_path.posix.join(dir, "__tests__", `${stem}.${kind}${e}`)]) if (exists(c)) out.push(c);
    }
  }
  return out;
}
function workspaces(patterns, dirs, read) {
  const out = [];
  const matches = (dir) => patterns.some((p) => {
    const clean2 = p.replace(/^\.\//, "").replace(/\/$/, "");
    if (clean2.endsWith("/**")) return dir.startsWith(`${clean2.slice(0, -3)}/`);
    const re = new RegExp(`^${clean2.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}$`);
    return re.test(dir);
  });
  for (const dir of dirs) {
    if (!matches(dir)) continue;
    const text = read(`${dir}/package.json`);
    if (!text) continue;
    try {
      const p = JSON.parse(text);
      out.push({ dir, name: p.name ?? dir, deps: Object.keys({ ...p.dependencies, ...p.devDependencies, ...p.peerDependencies }) });
    } catch {
    }
  }
  return out;
}
function affectedPackages(all, files) {
  const holding = /* @__PURE__ */ new Set();
  for (const f of files) {
    const owner = all.filter((w) => f.startsWith(`${w.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0];
    if (!owner) return void 0;
    holding.add(owner.name);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of all) if (!holding.has(w.name) && w.deps.some((d) => holding.has(d))) {
      holding.add(w.name);
      grew = true;
    }
  }
  return all.filter((w) => holding.has(w.name));
}
function pnpmPatterns(text) {
  const out = [];
  let inList = false;
  for (const line of text.split("\n")) {
    if (/^packages\s*:/.test(line)) {
      inList = true;
      continue;
    }
    if (inList && /^\s*-\s*/.test(line)) {
      const v = line.replace(/^\s*-\s*/, "").replace(/['"]/g, "").trim();
      if (v && !v.startsWith("!")) out.push(v);
      continue;
    }
    if (inList && line.trim() && !/^\s/.test(line)) inList = false;
  }
  return out;
}
function cargoCrates(root, read, dirs) {
  const m = root.match(/\[workspace\][\s\S]*?members\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return void 0;
  const patterns = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const out = [];
  for (const dir of dirs) {
    if (!patterns.some((p) => new RegExp(`^${p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+")}$`).test(dir))) continue;
    const name = read(`${dir}/Cargo.toml`)?.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/)?.[1];
    if (name) out.push({ dir, name, deps: [] });
  }
  return out;
}
function planNear(o) {
  const files = o.files.filter((f) => !/(^|\/)(README|CHANGELOG|LICENSE)[^/]*$/i.test(f) && !/\.(md|mdx|txt|png|jpe?g|gif|svg)$/i.test(f));
  if (!o.files.length) return { skip: "Nothing changed" };
  const config = o.files.find(isConfig);
  if (config) return { skip: `${config} changed, so recode can't tell what's near` };
  const always = (o.always ?? []).map((a) => ({ name: a.name, command: a.command, scope: "always", bin: "node_modules/.bin" }));
  if (!files.length) return always.length ? { commands: always, from: "the always list" } : { skip: "Only docs changed" };
  const withAlways = (commands, from) => ({ commands: [...commands, ...always], from: always.length ? `${from}, and the always list` : from });
  const pkg = (() => {
    try {
      return JSON.parse(o.read("package.json") ?? "null");
    } catch {
      return null;
    }
  })();
  if (o.read("nx.json") !== void 0) {
    return withAlways([{ name: "tests", command: `nx affected -t test --base=${o.base} --head=HEAD`, scope: "Nx affected", bin: "node_modules/.bin" }], "Nx");
  }
  if (o.read("turbo.json") !== void 0) {
    return withAlways([{ name: "tests", command: `turbo run test ${quote(`--filter=...[${o.base}]`)}`, scope: "Turborepo affected", bin: "node_modules/.bin" }], "Turborepo");
  }
  const pnpmWs = o.read("pnpm-workspace.yaml");
  const npmPatterns = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  const patterns = pnpmWs !== void 0 ? pnpmPatterns(pnpmWs) : npmPatterns;
  if (patterns?.length) {
    const hit = affectedPackages(workspaces(patterns, o.dirs, o.read), files);
    if (hit?.length) {
      const yarn = o.read("yarn.lock") !== void 0;
      const commands = hit.map((w) => ({
        name: "tests",
        command: pnpmWs !== void 0 ? `pnpm --filter ${quote(w.name)} run --if-present test` : yarn ? `yarn workspace ${quote(w.name)} run test` : `npm test --if-present -w ${quote(w.dir)}`,
        scope: w.dir
      }));
      return withAlways(commands, `${pnpmWs !== void 0 ? "pnpm" : yarn ? "yarn" : "npm"} workspaces`);
    }
  }
  const cargo = o.read("Cargo.toml");
  if (cargo) {
    const crates = cargoCrates(cargo, o.read, o.dirs);
    if (crates?.length) {
      const hit = files.map((f) => crates.filter((c) => f.startsWith(`${c.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0]);
      if (hit.every(Boolean)) {
        const names = [...new Set(hit.map((c) => c.name))];
        return withAlways([{ name: "tests", command: `cargo test ${names.map((n) => `-p ${quote(n)}`).join(" ")}`, scope: names.join(", ") }], "Cargo workspace");
      }
    }
  }
  const runner = fileRunner(o.testCommand?.command);
  if (runner === "go") {
    const pkgs = [...new Set(files.filter((f) => f.endsWith(".go")).map((f) => `./${(0, import_node_path.dirname)(f)}`.replace(/^\.\/\.$/, ".")))];
    if (pkgs.length && pkgs.length === new Set(files.map((f) => (0, import_node_path.dirname)(f))).size) {
      return withAlways([{ name: "tests", command: `${withoutPaths(o.testCommand.command, o.exists)} ${pkgs.map(quote).join(" ")}`, scope: pkgs.join(", ") }], "the packages that changed");
    }
  } else if (runner) {
    const tests = /* @__PURE__ */ new Set();
    for (const f of files) {
      if (isTestFile(f)) {
        if (o.exists(f)) tests.add(f);
        continue;
      }
      for (const t of testsNextTo(f, o.exists)) tests.add(t);
    }
    const before = tests.size;
    for (const t of o.agentTests ?? []) if (isTestFile(t) && !t.startsWith("/") && !t.includes("..") && o.exists(t)) tests.add(t);
    const fromAgent = tests.size > before;
    if (tests.size) {
      const list = [...tests].sort();
      const command = `${withoutPaths(o.testCommand.command, o.exists)} ${list.map(quote).join(" ")}`;
      return withAlways([{ name: "tests", command, scope: list.map((t) => (0, import_node_path.basename)(t)).join(", "), bin: o.testCommand.bin }], fromAgent ? "the tests next to what changed, and the ones the agent ran" : "the tests next to what changed");
    }
  }
  return always.length ? { commands: always, from: "the always list" } : { skip: "recode couldn't tell which tests are near the change" };
}
async function nearFor(o) {
  const files = await changedFiles(o.folder, o.base);
  if (!files.length) return { skip: "Nothing changed" };
  const listed = (await git(o.clone, "ls-tree", "-r", "--name-only", o.base).catch(() => "")).split("\n").filter(Boolean);
  const wanted = listed.filter((f) => ["package.json", "nx.json", "turbo.json", "pnpm-workspace.yaml", "yarn.lock", "Cargo.toml"].includes(f) || /(^|\/)(package\.json|Cargo\.toml)$/.test(f) && f.split("/").length <= 4 && !f.includes("node_modules/")).slice(0, 300);
  const cache = await readAt(o.clone, o.base, wanted.filter((f) => f !== "yarn.lock")).catch(() => /* @__PURE__ */ new Map());
  if (wanted.includes("yarn.lock")) cache.set("yarn.lock", "");
  const dirs = [...new Set(wanted.filter((f) => f.includes("/")).map((f) => (0, import_node_path.dirname)(f)))];
  return planNear({ files, base: o.base, read: (p) => cache.get(p), dirs, exists: (f) => (0, import_node_fs.existsSync)((0, import_node_path.join)(o.folder, f)), testCommand: o.testCommand, always: o.always, agentTests: o.agentTests });
}
function readAt(clone, rev, paths) {
  const out = /* @__PURE__ */ new Map();
  if (!paths.length) return Promise.resolve(out);
  return new Promise((resolve2, reject) => {
    const child = (0, import_node_child_process2.spawn)("git", ["cat-file", "--batch"], { cwd: clone, env: { ...process.env, ...safeGitEnv(), GIT_TERMINAL_PROMPT: "0" }, stdio: ["pipe", "pipe", "ignore"] });
    const chunks = [];
    child.stdout.on("data", (b) => chunks.push(b));
    child.on("error", reject);
    child.on("close", () => {
      const all = Buffer.concat(chunks);
      let at = 0;
      for (const p of paths) {
        const nl = all.indexOf(10, at);
        if (nl < 0) break;
        const head = all.subarray(at, nl).toString("utf8");
        at = nl + 1;
        const m = head.match(/^\S+ blob (\d+)$/);
        if (!m) continue;
        const size = Number(m[1]);
        out.set(p, all.subarray(at, at + size).toString("utf8"));
        at += size + 1;
      }
      resolve2(out);
    });
    child.stdin.end(paths.map((p) => `${rev}:${p}
`).join(""));
  });
}

// ../runner/src/rerun.ts
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
var shq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
var clean = (s) => s.replace(/\s+\([\d.]+\s*m?s\)\s*$/, "").replace(/^["']|["']$/g, "").trim();
function rerunFor(command, output) {
  const whole = { command, tests: [] };
  const lines = output.split("\n");
  if (/&&|\|\||;|\|/.test(command)) return whole;
  if (/^\s*node\s+(?:--[\w-]+(?:=\S+)?\s+)*--test\b/.test(command)) {
    const said = lines.map((l) => l.match(/^\s*not ok \d+ - (.+?)(?:\s+#.*)?$/)?.[1] ?? l.match(/^\s*✖ (?!failing tests)(.+?)\s+\([\d.]+m?s\)\s*$/)?.[1]);
    const names = [...new Set(said.filter((n) => !!n).map(clean).filter((n) => !/[\\/]/.test(n) || !/\.[cm]?[jt]sx?$/.test(n)))];
    if (!names.length) return whole;
    return { command: command.replace(/--test\b/, () => `--test --test-name-pattern=${shq(names.map(escapeRe).join("|"))}`), tests: names };
  }
  const vitest = /^\s*(?:npx\s+)?vitest\b/.test(command);
  const jest = /^\s*(?:npx\s+)?jest\b/.test(command);
  if (vitest || jest) {
    const files = /* @__PURE__ */ new Set();
    const names = /* @__PURE__ */ new Set();
    for (const l of lines) {
      const v = l.match(/^\s*(?:FAIL|×|✗)\s+(\S+\.[cm]?[jt]sx?)\s+>\s+(.+)$/);
      if (v) {
        files.add(v[1]);
        names.add(clean(v[2].split(" > ").at(-1)));
        continue;
      }
      const f = l.match(/^\s*FAIL\s+(\S+\.[cm]?[jt]sx?)\s*$/);
      if (f) {
        files.add(f[1]);
        continue;
      }
      const j = jest && l.match(/^\s*●\s+(.+)$/);
      if (j && !/^(Test suite failed to run|Console)\b/.test(j[1].trim())) names.add(clean(j[1].split(" \u203A ").at(-1)));
    }
    if (!names.size) return whole;
    const t = [...names];
    return { command: `${command.trim()} ${[...files].map(shq).join(" ")} -t ${shq(t.map(escapeRe).join("|"))}`.replace(/\s+/g, " "), tests: t };
  }
  if (/^\s*(?:python3?\s+-m\s+)?pytest\b/.test(command)) {
    const ids = [...new Set(lines.map((l) => l.match(/^FAILED\s+(\S+::\S+)/)?.[1]).filter((x) => !!x))];
    if (!ids.length) return whole;
    const words = command.trim().split(/\s+/);
    const at = words.findIndex((w) => w === "pytest");
    const base = words.filter((w, i) => i <= at || w.startsWith("-")).join(" ");
    return { command: `${base} ${ids.map(shq).join(" ")}`, tests: ids };
  }
  if (/^\s*go\s+test\b/.test(command)) {
    const names = [...new Set(lines.map((l) => l.match(/^\s*--- FAIL: (\S+)/)?.[1]?.split("/")[0]).filter((x) => !!x))];
    if (!names.length) return whole;
    return { command: command.replace(/^\s*go\s+test\b/, () => `go test -count=1 -run ${shq(`^(${names.map(escapeRe).join("|")})$`)}`), tests: names };
  }
  if (/^\s*cargo\s+test\b/.test(command)) {
    const names = [...new Set(lines.map((l) => l.match(/^test (\S+) \.\.\. FAILED/)?.[1]).filter((x) => !!x))];
    if (names.length !== 1 || / -- /.test(command)) return whole;
    return { command: `${command.trim()} ${shq(names[0])} -- --exact`, tests: names };
  }
  return whole;
}
function rerunRan(command, output) {
  const n = (re) => Number(output.match(re)?.[1] ?? 0);
  if (/--test-name-pattern=/.test(command)) return n(/^[#ℹ]\s*pass\s+(\d+)/m) > 0;
  if (/^\s*(?:npx\s+)?jest\b/.test(command)) return n(/Tests:.*?(\d+) passed/) > 0;
  if (/^\s*(?:npx\s+)?vitest\b/.test(command)) return n(/Tests\s+(\d+) passed/) > 0;
  if (/pytest\b/.test(command)) return n(/(\d+) passed/) > 0;
  if (/^\s*go\s+test\b/.test(command)) return !/\[no tests to run\]/.test(output) && /^(ok|PASS)\b/m.test(output);
  if (/^\s*cargo\s+test\b/.test(command)) return n(/test result: ok\. (\d+) passed/) > 0;
  return true;
}

// ../runner/src/testenv.ts
var import_node_child_process5 = require("node:child_process");
var import_node_crypto2 = require("node:crypto");
var import_node_fs4 = require("node:fs");
var import_node_net = require("node:net");
var import_node_os2 = require("node:os");
var import_node_path4 = require("node:path");

// ../runner/src/builds.ts
var import_node_child_process3 = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var import_node_util2 = require("node:util");
var execFileP = (0, import_node_util2.promisify)(import_node_child_process3.execFile);
var KEEP_BUILDS = 3;
var UNUSED_MS = 14 * 24 * 36e5;
var META = "build.json";
var buildsDir = (home) => (0, import_node_path2.join)(home, "builds");
var slug = (project) => project.replace(/[^\w.-]+/g, "_").slice(0, 100) || "project";
async function fingerprintOf(folder, paths) {
  const h = (0, import_node_crypto.createHash)("sha256");
  const out = await execFileP("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...paths], { cwd: folder, maxBuffer: 256 * 1024 * 1024 }).then((r) => r.stdout, () => "");
  const files = [...new Set(out.split("\0").filter(Boolean))].sort();
  for (const f of files) {
    const p = (0, import_node_path2.join)(folder, f);
    let st;
    try {
      st = (0, import_node_fs2.statSync)(p);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    h.update(`${f}\0${st.size}\0`);
    await new Promise((done) => {
      const s = (0, import_node_fs2.createReadStream)(p);
      s.on("data", (b) => h.update(b));
      s.on("error", () => done());
      s.on("end", () => done());
    });
  }
  return h.digest("hex").slice(0, 20);
}
function sizeOf(p) {
  try {
    const st = (0, import_node_fs2.statSync)(p);
    if (!st.isDirectory()) return st.size;
    return (0, import_node_fs2.readdirSync)(p).reduce((n, x) => n + sizeOf((0, import_node_path2.join)(p, x)), 0);
  } catch {
    return 0;
  }
}
function readMeta(dir) {
  try {
    const m = JSON.parse((0, import_node_fs2.readFileSync)((0, import_node_path2.join)(dir, META), "utf8"));
    return (0, import_node_fs2.existsSync)(m.file) ? m : void 0;
  } catch {
    return void 0;
  }
}
function listBuilds(home) {
  const root = buildsDir(home);
  const out = [];
  const dirs = (p) => {
    try {
      return (0, import_node_fs2.readdirSync)(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  };
  for (const project of dirs(root)) for (const platform of dirs((0, import_node_path2.join)(root, project))) for (const fp of dirs((0, import_node_path2.join)(root, project, platform))) {
    if (fp.startsWith(".")) continue;
    const m = readMeta((0, import_node_path2.join)(root, project, platform, fp));
    if (m) out.push(m);
  }
  return out.sort((a, b) => b.usedAt.localeCompare(a.usedAt));
}
function keptBuild(home, project, platform, fingerprint) {
  const dir = (0, import_node_path2.join)(buildsDir(home), slug(project), platform, fingerprint);
  const m = readMeta(dir);
  if (!m) return void 0;
  const used = { ...m, usedAt: (/* @__PURE__ */ new Date()).toISOString() };
  (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(dir, META), JSON.stringify(used));
  return used;
}
function keepBuild(home, b) {
  const root = (0, import_node_path2.join)(buildsDir(home), slug(b.project), b.platform);
  const dir = (0, import_node_path2.join)(root, b.fingerprint);
  const tmp = (0, import_node_path2.join)(root, `.${b.fingerprint}-${process.pid}`);
  (0, import_node_fs2.rmSync)(tmp, { recursive: true, force: true });
  (0, import_node_fs2.mkdirSync)(tmp, { recursive: true });
  const file = (0, import_node_path2.join)(dir, (0, import_node_path2.basename)(b.built));
  (0, import_node_fs2.cpSync)(b.built, (0, import_node_path2.join)(tmp, (0, import_node_path2.basename)(b.built)), { recursive: true });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const m = { id: `${slug(b.project)}/${b.platform}/${b.fingerprint}`, project: b.project, platform: b.platform, fingerprint: b.fingerprint, file, bytes: sizeOf((0, import_node_path2.join)(tmp, (0, import_node_path2.basename)(b.built))), builtAt: now, usedAt: now, minutes: b.minutes };
  (0, import_node_fs2.writeFileSync)((0, import_node_path2.join)(tmp, META), JSON.stringify(m));
  (0, import_node_fs2.rmSync)(dir, { recursive: true, force: true });
  (0, import_node_fs2.renameSync)(tmp, dir);
  pruneBuilds(home);
  return m;
}
function pruneBuilds(home, now = Date.now()) {
  const removed = [];
  const groups = /* @__PURE__ */ new Map();
  for (const b of listBuilds(home)) {
    const k = `${slug(b.project)}/${b.platform}`;
    groups.set(k, [...groups.get(k) ?? [], b]);
  }
  for (const list of groups.values()) {
    list.forEach((b, i) => {
      if (i >= KEEP_BUILDS || now - Date.parse(b.usedAt) > UNUSED_MS) {
        if (removeBuild(home, b.id)) removed.push(b.id);
      }
    });
  }
  return removed;
}
function removeBuild(home, id) {
  const parts = id.split("/");
  if (parts.length !== 3 || parts.some((p) => !p || p === "." || p === ".." || !/^[\w.-]+$/.test(p))) return false;
  const dir = (0, import_node_path2.join)(buildsDir(home), ...parts);
  if (!(0, import_node_fs2.existsSync)((0, import_node_path2.join)(dir, META))) return false;
  (0, import_node_fs2.rmSync)(dir, { recursive: true, force: true });
  return true;
}
function buildWorkDir(home, project, platform) {
  const d = (0, import_node_path2.join)(buildsDir(home), slug(project), platform, ".work");
  (0, import_node_fs2.mkdirSync)(d, { recursive: true });
  return d;
}
async function withBuildLock(home, project, platform, fn) {
  const file = (0, import_node_path2.join)(buildsDir(home), slug(project), platform, ".lock");
  (0, import_node_fs2.mkdirSync)((0, import_node_path2.join)(buildsDir(home), slug(project), platform), { recursive: true });
  for (; ; ) {
    try {
      (0, import_node_fs2.writeFileSync)(file, String(process.pid), { flag: "wx", mode: 384 });
      break;
    } catch {
      let pid = 0;
      try {
        pid = Number((0, import_node_fs2.readFileSync)(file, "utf8"));
      } catch {
      }
      let alive2 = false;
      try {
        if (pid) process.kill(pid, 0);
        alive2 = !!pid;
      } catch {
      }
      if (!alive2) (0, import_node_fs2.rmSync)(file, { force: true });
      else await new Promise((r) => setTimeout(r, 1e3));
    }
  }
  try {
    return await fn();
  } finally {
    (0, import_node_fs2.rmSync)(file, { force: true });
  }
}

// ../runner/src/phone-android.ts
var import_node_child_process4 = require("node:child_process");
var import_node_fs3 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path3 = require("node:path");
var import_node_util3 = require("node:util");

// ../runner/src/jpeg.ts
var DC_LUM_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
var DC_CHR_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
var DC_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
var AC_LUM_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 125];
var AC_CHR_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 119];
var AC_LUM_VALS = [
  1,
  2,
  3,
  0,
  4,
  17,
  5,
  18,
  33,
  49,
  65,
  6,
  19,
  81,
  97,
  7,
  34,
  113,
  20,
  50,
  129,
  145,
  161,
  8,
  35,
  66,
  177,
  193,
  21,
  82,
  209,
  240,
  36,
  51,
  98,
  114,
  130,
  9,
  10,
  22,
  23,
  24,
  25,
  26,
  37,
  38,
  39,
  40,
  41,
  42,
  52,
  53,
  54,
  55,
  56,
  57,
  58,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  83,
  84,
  85,
  86,
  87,
  88,
  89,
  90,
  99,
  100,
  101,
  102,
  103,
  104,
  105,
  106,
  115,
  116,
  117,
  118,
  119,
  120,
  121,
  122,
  131,
  132,
  133,
  134,
  135,
  136,
  137,
  138,
  146,
  147,
  148,
  149,
  150,
  151,
  152,
  153,
  154,
  162,
  163,
  164,
  165,
  166,
  167,
  168,
  169,
  170,
  178,
  179,
  180,
  181,
  182,
  183,
  184,
  185,
  186,
  194,
  195,
  196,
  197,
  198,
  199,
  200,
  201,
  202,
  210,
  211,
  212,
  213,
  214,
  215,
  216,
  217,
  218,
  225,
  226,
  227,
  228,
  229,
  230,
  231,
  232,
  233,
  234,
  241,
  242,
  243,
  244,
  245,
  246,
  247,
  248,
  249,
  250
];
var AC_CHR_VALS = [
  0,
  1,
  2,
  3,
  17,
  4,
  5,
  33,
  49,
  6,
  18,
  65,
  81,
  7,
  97,
  113,
  19,
  34,
  50,
  129,
  8,
  20,
  66,
  145,
  161,
  177,
  193,
  9,
  35,
  51,
  82,
  240,
  21,
  98,
  114,
  209,
  10,
  22,
  36,
  52,
  225,
  37,
  241,
  23,
  24,
  25,
  26,
  38,
  39,
  40,
  41,
  42,
  53,
  54,
  55,
  56,
  57,
  58,
  67,
  68,
  69,
  70,
  71,
  72,
  73,
  74,
  83,
  84,
  85,
  86,
  87,
  88,
  89,
  90,
  99,
  100,
  101,
  102,
  103,
  104,
  105,
  106,
  115,
  116,
  117,
  118,
  119,
  120,
  121,
  122,
  130,
  131,
  132,
  133,
  134,
  135,
  136,
  137,
  138,
  146,
  147,
  148,
  149,
  150,
  151,
  152,
  153,
  154,
  162,
  163,
  164,
  165,
  166,
  167,
  168,
  169,
  170,
  178,
  179,
  180,
  181,
  182,
  183,
  184,
  185,
  186,
  194,
  195,
  196,
  197,
  198,
  199,
  200,
  201,
  202,
  210,
  211,
  212,
  213,
  214,
  215,
  216,
  217,
  218,
  226,
  227,
  228,
  229,
  230,
  231,
  232,
  233,
  234,
  242,
  243,
  244,
  245,
  246,
  247,
  248,
  249,
  250
];
function codes(bits, vals) {
  const out = [];
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < bits[len - 1]; i++) out[vals[k++]] = [code++, len];
    code <<= 1;
  }
  return out;
}
var DC_LUM = codes(DC_LUM_BITS, DC_VALS);
var DC_CHR = codes(DC_CHR_BITS, DC_VALS);
var AC_LUM = codes(AC_LUM_BITS, AC_LUM_VALS);
var AC_CHR = codes(AC_CHR_BITS, AC_CHR_VALS);
var COS = Array.from({ length: 8 }, (_, u) => Array.from({ length: 8 }, (_2, x) => (u === 0 ? Math.SQRT1_2 : 1) * Math.cos((2 * x + 1) * u * Math.PI / 16)));

// ../runner/src/phone-android.ts
var execFileP2 = (0, import_node_util3.promisify)(import_node_child_process4.execFile);
function androidSdk(env = process.env) {
  const home = (0, import_node_os.homedir)();
  return [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, (0, import_node_path3.join)(home, "Library", "Android", "sdk"), (0, import_node_path3.join)(home, "Android", "Sdk"), (0, import_node_path3.join)(env.LOCALAPPDATA ?? "", "Android", "Sdk")].find((d) => !!d && (0, import_node_fs3.existsSync)((0, import_node_path3.join)(d, "platform-tools")));
}

// ../runner/src/procfs.ts
var import_promises = require("node:fs/promises");
var LISTEN = "0A";
function listenSockets(table) {
  const out = [];
  for (const line of table.split("\n").slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 10 || f[3] !== LISTEN) continue;
    const port = Number.parseInt(f[1].split(":")[1] ?? "", 16);
    if (port > 0 && /^\d+$/.test(f[9]) && f[9] !== "0") out.push({ port, inode: f[9] });
  }
  return out;
}
function parseStat(text) {
  const close = text.lastIndexOf(")");
  if (close < 0) return void 0;
  const rest = text.slice(close + 2).trim().split(/\s+/);
  const pgrp = Number(rest[2]);
  const startTicks = Number(rest[19]);
  return rest.length > 19 && Number.isInteger(pgrp) && Number.isInteger(startTicks) ? { pgrp, startTicks } : void 0;
}
var pids = async () => (await (0, import_promises.readdir)("/proc").catch(() => [])).filter((n) => /^\d+$/.test(n)).map(Number);
var statOf = async (pid) => parseStat(await (0, import_promises.readFile)(`/proc/${pid}/stat`, "utf8").catch(() => ""));
async function socketsOf(pid) {
  const fds = await (0, import_promises.readdir)(`/proc/${pid}/fd`).catch(() => []);
  const links = await Promise.all(fds.map((fd) => (0, import_promises.readlink)(`/proc/${pid}/fd/${fd}`).catch(() => "")));
  return links.map((l) => l.match(/^socket:\[(\d+)\]$/)?.[1]).filter((i) => !!i);
}
async function listening(pid) {
  const read = (t) => (0, import_promises.readFile)(`/proc/${pid}/net/${t}`, "utf8").catch(() => "");
  const [v4, v6] = await Promise.all([read("tcp"), read("tcp6")]);
  return [...listenSockets(v4), ...listenSockets(v6)];
}
async function procGroupPorts(pgid) {
  const members = [];
  for (const pid of await pids()) if ((await statOf(pid))?.pgrp === pgid) members.push(pid);
  if (!members.length) return [];
  const held = new Set((await Promise.all(members.map(socketsOf))).flat());
  return [...new Set((await listening(members[0])).filter((s) => held.has(s.inode)).map((s) => s.port))];
}

// ../runner/src/testenv.ts
var SPEC = "spec.json";
var STATE = "state.json";
var EVENTS = "events.jsonl";
var SECRETS = "secrets";
var LOGS = "logs";
var READY_MS = 12e4;
var LOG_LINES = 12;
var PG_PATH = 'export PATH="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1):$PATH"';
var PKG = /^[a-z0-9][a-z0-9.+-]{0,60}$/;
var QUIET_SERVICES = "(command -v systemctl >/dev/null && { systemctl disable --now postgresql redis-server >/dev/null 2>&1; systemctl stop 'postgresql@*' >/dev/null 2>&1; }) || true";
function runArgs(cmd, args, timeoutMs) {
  return new Promise((done) => {
    const child = (0, import_node_child_process5.spawn)(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (b) => {
      out += b.toString();
    });
    child.stderr.on("data", (b) => {
      out += b.toString();
    });
    const t = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(t);
      done({ ok: false, output: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      done({ ok: code === 0, output: out });
    });
  });
}
var machineLoad = () => ({ cpus: (0, import_node_os2.cpus)().length || 1, load: (0, import_node_os2.loadavg)()[0], free: (0, import_node_os2.freemem)(), total: (0, import_node_os2.totalmem)() });
function roomFor(kept, l = machineLoad()) {
  if (kept <= 0) return true;
  return l.load / l.cpus <= 1 - kept && l.free / l.total >= kept / 2;
}
function readSpec(dir) {
  return JSON.parse((0, import_node_fs4.readFileSync)((0, import_node_path4.join)(dir, SPEC), "utf8"));
}
function readState(dir) {
  try {
    return JSON.parse((0, import_node_fs4.readFileSync)((0, import_node_path4.join)(dir, STATE), "utf8"));
  } catch {
    return void 0;
  }
}
function writeState(dir, s) {
  const tmp = (0, import_node_path4.join)(dir, `${STATE}.${process.pid}`);
  (0, import_node_fs4.writeFileSync)(tmp, JSON.stringify(s), { mode: 384 });
  (0, import_node_fs4.renameSync)(tmp, (0, import_node_path4.join)(dir, STATE));
}
function emit(dir, e) {
  (0, import_node_fs4.appendFileSync)((0, import_node_path4.join)(dir, EVENTS), `${JSON.stringify({ ...e, at: (/* @__PURE__ */ new Date()).toISOString() })}
`, { mode: 384 });
}
function secretsOf(dir) {
  const out = {};
  try {
    for (const name of (0, import_node_fs4.readdirSync)((0, import_node_path4.join)(dir, SECRETS))) out[name] = (0, import_node_fs4.readFileSync)((0, import_node_path4.join)(dir, SECRETS, name), "utf8");
  } catch {
  }
  return out;
}
function assignPorts(spec, ports) {
  const order = startOrder(spec.components.filter((c) => !c.phone));
  if (order.length > ports.length) throw new Error(`This test has ${ports.length} ports, and the app has ${order.length} components.`);
  const product = order.find((c) => c.name === "web") ?? order.filter((c) => !c.service).at(-1) ?? order.at(-1);
  const out = {};
  let next = 1;
  for (const c of order) out[c.name] = c === product ? ports[0] : ports[next++];
  return out;
}
function appEnv(place, spec, ports, learned) {
  const env = {
    // The project's own programs first, as a package manager puts them for its scripts.
    PATH: `${(0, import_node_path4.join)(place.folder, "node_modules", ".bin")}${import_node_path4.delimiter}${process.env.PATH ?? process.env.Path ?? "/usr/bin:/bin"}`,
    HOME: process.env.HOME ?? (0, import_node_os2.homedir)(),
    // Windows' own, without which its shell and most programs don't run.
    ...WIN ? Object.fromEntries(["SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "PATHEXT", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramData", "TEMP", "TMP", "USERNAME", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"].filter((k) => process.env[k]).map((k) => [k, process.env[k]])) : {},
    ...process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {},
    ...process.env.LANG ? { LANG: process.env.LANG } : {},
    F4R_ENV: place.env,
    F4R_ENV_DIR: place.dir,
    F4R_SECRETS_DIR: (0, import_node_path4.join)(place.dir, SECRETS),
    F4R_PORTS: place.ports.join(",")
  };
  for (const [name, port] of Object.entries(ports)) env[`${name.toUpperCase().replace(/-/g, "_")}_PORT`] = String(port);
  for (const v of spec.variables) if (!v.secret && v.value !== void 0) env[v.name] = fillPorts(v.value, ports);
  Object.assign(env, secretsOf(place.dir));
  Object.assign(env, learned);
  return env;
}
function runCommand(command, opts) {
  return new Promise((done) => {
    const sh = shellOf(command);
    const child = (0, import_node_child_process5.spawn)(sh.cmd, sh.args, { cwd: opts.cwd, env: opts.env, stdio: ["ignore", "pipe", "pipe"], detached: !WIN, windowsHide: true, windowsVerbatimArguments: WIN });
    const chunks = [];
    let size = 0;
    const take = (b) => {
      size += b.length;
      chunks.push(b);
      while (size > 8e6 && chunks.length > 1) size -= chunks.shift().length;
      if (opts.log) (0, import_node_fs4.appendFileSync)(opts.log, b);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const stop = () => {
      try {
        if (child.pid) killTree(child.pid, "SIGKILL");
      } catch {
      }
    };
    const timer = opts.timeoutMs ? setTimeout(stop, opts.timeoutMs) : void 0;
    opts.signal?.addEventListener("abort", stop, { once: true });
    child.on("error", (e) => done({ code: 127, output: e.message }));
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      done({ code: code ?? (signal ? 128 : 1), output: Buffer.concat(chunks).toString("utf8") });
    });
  });
}
function learnedFrom(output) {
  const out = {};
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
function setupStamp(place, script) {
  const h = (0, import_node_crypto2.createHash)("sha256").update((0, import_node_path4.resolve)(place.folder)).update("\0").update(script.run);
  for (const f of script.inputs ?? []) {
    try {
      h.update("\0").update(f).update("\0").update((0, import_node_fs4.readFileSync)((0, import_node_path4.join)(place.folder, f)));
    } catch {
      h.update("\0").update(f).update("\0-");
    }
  }
  return (0, import_node_path4.join)(place.home, "setup-done", h.digest("hex").slice(0, 32));
}
async function withFolderLock(place, fn) {
  const dir = (0, import_node_path4.join)(place.home, "setup-locks");
  (0, import_node_fs4.mkdirSync)(dir, { recursive: true });
  const lock = (0, import_node_path4.join)(dir, (0, import_node_crypto2.createHash)("sha256").update((0, import_node_path4.resolve)(place.folder)).digest("hex").slice(0, 32));
  for (const end = Date.now() + 20 * 6e4; ; ) {
    try {
      (0, import_node_fs4.mkdirSync)(lock);
      break;
    } catch {
      try {
        if (Date.now() - (0, import_node_fs4.statSync)(lock).mtimeMs > 20 * 6e4) (0, import_node_fs4.rmSync)(lock, { recursive: true, force: true });
      } catch {
      }
      if (Date.now() > end) throw new Error("Another test of this task is still setting up its folder.");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    return await fn();
  } finally {
    (0, import_node_fs4.rmSync)(lock, { recursive: true, force: true });
  }
}
function serviceDir(place, c) {
  return place.services ? place.services.dir(place.env, c.name) : (0, import_node_path4.join)(place.dir, "services", c.name);
}
function howToRun(place, c, command, env, cwd) {
  const run2 = execOf(command);
  if (c.service && place.broker) return { cmd: place.broker.self[0], args: [...place.broker.self.slice(1), "service", place.broker.socket, c.name] };
  if (c.service && place.services) return place.services.wrap(`mkdir -p "$F4R_SERVICE_DIR" && cd ${shellQuote2(cwd)} && ${run2}`, env, Object.keys(secretsOf(place.dir)));
  if (c.service && !WIN) return { cmd: "/bin/sh", args: ["-c", `${PG_PATH}; mkdir -p "$F4R_SERVICE_DIR" && ${run2}`] };
  return shellOf(WIN ? command : run2);
}
var execOf = (command) => /(&&|\|\||;|\||\n)/.test(command) || /^\s*exec\s/.test(command) ? command : `exec ${command}`;
function startComponent(place, c, env, port, ports) {
  const log = (0, import_node_path4.join)(place.dir, LOGS, `${c.name}.log`);
  const command = fillPorts(c.run, ports, c.name);
  const cwd = c.cwd ? (0, import_node_path4.join)(place.folder, c.cwd) : place.folder;
  const own = { ...env, PORT: String(port), ...c.service ? { F4R_SERVICE_DIR: serviceDir(place, c) } : {} };
  const plain = howToRun(place, c, command, own, cwd);
  const boxed = !!place.wrap && !(c.service && (place.services || place.broker));
  const how = boxed ? place.wrap(plain.cmd, plain.args, cwd) : plain;
  const out = (0, import_node_fs4.openSync)(log, "a", 384);
  try {
    const child = (0, import_node_child_process5.spawn)(how.cmd, how.args, { cwd, env: { ...own, ...boxed ? place.boxEnv : {}, F4R_ENV: place.env }, stdio: ["ignore", out, out], detached: true, windowsHide: true, windowsVerbatimArguments: WIN && how.cmd === COMSPEC });
    child.on("error", (e) => (0, import_node_fs4.appendFileSync)(log, `${e.message}
`));
    child.unref();
    return { pid: child.pid, log };
  } finally {
    (0, import_node_fs4.closeSync)(out);
  }
}
var shellQuote2 = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
var WIN = process.platform === "win32";
var COMSPEC = process.env.ComSpec ?? "cmd.exe";
function shellOf(command) {
  return WIN ? { cmd: COMSPEC, args: ["/d", "/s", "/c", `"${command}"`] } : { cmd: "/bin/sh", args: ["-c", command] };
}
function killTree(pid, signal = "SIGTERM") {
  try {
    if (WIN) (0, import_node_child_process5.spawn)("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => {
    });
    else process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
    }
  }
}
function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function tcpOpen(host, port) {
  return new Promise((done) => {
    const s = (0, import_node_net.connect)({ host, port });
    const end = (ok) => {
      s.destroy();
      done(ok);
    };
    s.setTimeout(1e3, () => end(false));
    s.once("connect", () => end(true));
    s.once("error", () => end(false));
  });
}
async function httpAnswers(host, port, path) {
  try {
    const url = `http://${host.includes(":") ? `[${host}]` : host}:${port}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3e3), redirect: "manual" });
    await res.arrayBuffer().catch(() => {
    });
    return res.status < 500;
  } catch {
    return false;
  }
}
async function readyNow(place, c, port, log, env, cwd) {
  const r = c.ready ?? { tcp: true };
  if ("output" in r) {
    let text = "";
    try {
      text = (0, import_node_fs4.readFileSync)(log, "utf8");
    } catch {
    }
    return text.includes(r.output) ? "127.0.0.1" : void 0;
  }
  if ("command" in r) {
    const command = fillPorts(r.command, { [c.name]: port }, c.name).replace(/\$PORT\b/g, String(port));
    const own = { ...env, PORT: String(port), ...c.service ? { F4R_SERVICE_DIR: serviceDir(place, c) } : {} };
    const how = c.service ? howToRun(place, c, command, own, cwd) : shellOf(command);
    const { ok } = await new Promise((done) => {
      const child = (0, import_node_child_process5.spawn)(how.cmd, how.args, { cwd, env: own, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: WIN && how.cmd === COMSPEC });
      const t = setTimeout(() => child.kill("SIGKILL"), 1e4);
      child.on("error", () => {
        clearTimeout(t);
        done({ ok: false });
      });
      child.on("close", (code) => {
        clearTimeout(t);
        done({ ok: code === 0 });
      });
    });
    return ok ? "127.0.0.1" : void 0;
  }
  for (const host of ["127.0.0.1", "::1"]) {
    if ("http" in r ? await httpAnswers(host, port, r.http) : await tcpOpen(host, port)) return host;
  }
  return void 0;
}
function explainFailure(name, port, logText, exited) {
  const lines = logText.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  const at = (re) => lines.findIndex((l) => re.test(l));
  const from = (i) => i < 0 ? keepEnd(lines.join("\n"), LOG_LINES, 2) : lines.slice(i, i + LOG_LINES).join("\n");
  const taken = at(/EADDRINUSE|address already in use|port \d+ is (already )?in use|Port \d+ is already in use/i);
  if (taken >= 0) {
    const p = lines[taken].match(/(?:port|:)\s*(\d{2,5})/i)?.[1];
    const fixed = p && Number(p) !== port;
    return { why: `${name} didn\u2019t start: port ${p ?? port} was taken.${fixed ? ` It uses ${p} instead of the port it was given ($PORT, ${port}).` : ""}`, log: from(taken) };
  }
  const missing = at(/command not found|not found: |ENOENT|No such file or directory|Cannot find module/i);
  if (missing >= 0) return { why: `${name} didn\u2019t start: ${lines[missing].replace(/^.*?(command not found|not found|ENOENT|No such file or directory|Cannot find module)/i, "$1").slice(0, 160)}.`, log: from(missing) };
  const error = at(/\b(error|exception|fatal|panic)\b/i);
  if (exited) return { why: `${name} stopped as it started.`, log: from(error) };
  return { why: `${name} didn\u2019t answer within ${READY_MS / 1e3} s.`, log: from(error) };
}
async function waitReady(place, c, port, pid, log, env) {
  const cwd = c.cwd ? (0, import_node_path4.join)(place.folder, c.cwd) : place.folder;
  const start = Date.now();
  let looked = 0;
  for (const end = start + READY_MS; Date.now() < end; ) {
    const host = await readyNow(place, c, port, log, env, cwd);
    if (host) return { host };
    if (pid && Date.now() - start > 8e3 && Date.now() - looked > 4e3) {
      looked = Date.now();
      const elsewhere2 = (await listeningPorts(pid)).filter((p) => p !== port);
      if (elsewhere2.length) return { why: `${c.name} started, but listens on port ${elsewhere2[0]}, not the port it was given ($PORT, ${port}). Its command or config sets the port instead of using $PORT.`, log: keepEnd(readLog(log), LOG_LINES, 2) };
    }
    if (!alive(pid)) {
      const late = await readyNow(place, c, port, log, env, cwd);
      if (late) return { host: late };
      return explainFailure(c.name, port, readLog(log), true);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const elsewhere = pid ? (await listeningPorts(pid)).filter((p) => p !== port) : [];
  if (elsewhere.length) return { why: `${c.name} started, but listens on port ${elsewhere[0]}, not the port it was given ($PORT, ${port}). Its command or config sets the port instead of using $PORT.`, log: keepEnd(readLog(log), LOG_LINES, 2) };
  return explainFailure(c.name, port, readLog(log), false);
}
async function listeningPorts(pgid) {
  if (process.platform === "linux") return procGroupPorts(pgid);
  try {
    const out = (0, import_node_child_process5.execFileSync)("lsof", ["-nP", "-a", "-g", String(pgid), "-iTCP", "-sTCP:LISTEN", "-Fn"], { encoding: "utf8", timeout: 5e3, stdio: ["ignore", "pipe", "ignore"] });
    return [...new Set(out.split("\n").filter((l) => l.startsWith("n")).map((l) => Number(l.split(":").pop())).filter((n) => n > 0))];
  } catch {
    return [];
  }
}
var readLog = (log) => {
  try {
    return (0, import_node_fs4.readFileSync)(log, "utf8");
  } catch {
    return "";
  }
};
async function bringUp(place, opts = {}) {
  const spec = readSpec(place.dir);
  const was = readState(place.dir);
  if (was?.status === "up" && was.parts.every((p) => alive(p.pid))) return was;
  const problems = environmentProblems(spec);
  if (problems.length) {
    const state2 = { status: "failed", why: problems.join(" "), parts: [], learned: {}, urls: {}, at: (/* @__PURE__ */ new Date()).toISOString() };
    writeState(place.dir, state2);
    throw new Error(problems.join(" "));
  }
  if (place.keepRoom && !(opts.room ?? roomFor)(place.keepRoom)) {
    const since = (/* @__PURE__ */ new Date()).toISOString();
    writeState(place.dir, { status: "waiting", since, doing: "Waiting for room on this machine", parts: [], learned: {}, urls: {}, at: since });
    emit(place.dir, { t: "app", status: "waiting" });
    opts.onLine?.("Waiting for room on this machine.");
    while (!(opts.room ?? roomFor)(place.keepRoom)) await new Promise((r) => setTimeout(r, opts.roomPollMs ?? 5e3));
  }
  const say = opts.onLine ?? (() => {
  });
  const ports = assignPorts(spec, place.ports);
  const order = startOrder(spec.components.filter((c) => !c.phone));
  const phone = spec.components.find((c) => c.phone && c.phone.platform === spec.platform);
  const parts = order.map((c) => ({ name: c.name, status: "starting", port: ports[c.name] }));
  if (phone) parts.push({ name: "build", status: "starting", port: 0 });
  const state = { status: "starting", parts, learned: {}, urls: {}, at: (/* @__PURE__ */ new Date()).toISOString(), ...spec.platform ? { platform: spec.platform } : {} };
  writeState(place.dir, state);
  emit(place.dir, { t: "app", status: "starting" });
  const base = appEnv(place, spec, ports, {});
  const missing = await servicesReady(place, spec, opts.onLine);
  if (missing) {
    Object.assign(state, { status: "failed", ...missing });
    writeState(place.dir, state);
    emit(place.dir, { t: "app", status: "failed" });
    return state;
  }
  for (const s of spec.scripts.filter((x) => x.when === "setup")) {
    const stamp = setupStamp(place, s);
    if ((0, import_node_fs4.existsSync)(stamp)) continue;
    say(`Setting up: ${s.run}`);
    writeState(place.dir, { ...state, doing: `Setting up: ${s.run}` });
    await withFolderLock(place, async () => {
      if ((0, import_node_fs4.existsSync)(stamp)) return;
      const r = await runCommand(s.run, { cwd: place.folder, env: base, timeoutMs: 20 * 6e4, log: (0, import_node_path4.join)(place.dir, LOGS, "setup.log") });
      if (r.code !== 0) {
        const why = `Setup didn\u2019t work: ${s.run} ended with ${r.code}.`;
        Object.assign(state, { status: "failed", why, log: keepEnd(r.output, LOG_LINES, 2) });
        writeState(place.dir, state);
        emit(place.dir, { t: "app", status: "failed" });
        throw Object.assign(new Error(why), { log: keepEnd(r.output, LOG_LINES, 2) });
      }
      (0, import_node_fs4.mkdirSync)((0, import_node_path4.join)(place.home, "setup-done"), { recursive: true });
      (0, import_node_fs4.writeFileSync)(stamp, (/* @__PURE__ */ new Date()).toISOString());
    });
  }
  for (const c of order) {
    const part = parts.find((p) => p.name === c.name);
    emit(place.dir, { t: "part", name: c.name, status: "starting" });
    const env = appEnv(place, spec, ports, state.learned);
    const { pid, log } = startComponent(place, c, env, ports[c.name], ports);
    part.pid = pid;
    writeState(place.dir, state);
    const r = await waitReady(place, c, ports[c.name], pid, log, env);
    if (!r.host) {
      part.status = "failed";
      part.why = r.why;
      part.log = r.log;
      const need = place.missing?.find((n) => readLog(log).includes(n));
      if (need) {
        part.why = `${c.name} needs ${need}, which isn\u2019t set yet.`;
        state.secret = need;
      }
      state.status = "failed";
      writeState(place.dir, state);
      emit(place.dir, { t: "part", name: c.name, status: "failed", why: r.why, log: r.log });
      emit(place.dir, { t: "app", status: "failed" });
      return state;
    }
    part.status = "up";
    if (!c.service || c.ready && "http" in c.ready) state.urls[c.name] = `http://localhost:${ports[c.name]}`;
    writeState(place.dir, state);
    emit(place.dir, { t: "part", name: c.name, status: "up" });
    say(`\u2713 ${c.name}`);
  }
  if (phone) {
    const built = await buildPhone(place, spec, phone, ports, state, say);
    if (!built) return state;
  }
  for (const s of spec.scripts.filter((x) => x.when === "before")) {
    say(`Before tests: ${s.run}`);
    const r = await runCommand(fillPorts(s.run, ports), { cwd: place.folder, env: appEnv(place, spec, ports, state.learned), timeoutMs: 10 * 6e4, log: (0, import_node_path4.join)(place.dir, LOGS, "before.log") });
    if (r.code !== 0) {
      const why = `A script before tests didn\u2019t work: ${s.run} ended with ${r.code}.`;
      Object.assign(state, { status: "failed", why, log: keepEnd(r.output, LOG_LINES, 2) });
      writeState(place.dir, state);
      emit(place.dir, { t: "app", status: "failed" });
      throw Object.assign(new Error(why), { log: state.log });
    }
    Object.assign(state.learned, learnedFrom(r.output));
  }
  state.status = "up";
  state.at = (/* @__PURE__ */ new Date()).toISOString();
  writeState(place.dir, state);
  emit(place.dir, { t: "app", status: "up", urls: state.urls });
  return state;
}
var projectOf = (place) => process.env.F4R_TEST_PROJECT || place.folder.split(/[\\/]/).filter(Boolean).pop() || "project";
async function buildPhone(place, spec, c, ports, state, say) {
  const p = c.phone;
  const name = PLATFORM_NAMES[p.platform];
  const part = state.parts.find((x) => x.name === "build");
  const project = projectOf(place);
  const fingerprint = await fingerprintOf(place.folder, p.fingerprint.length ? p.fingerprint : ["."]);
  emit(place.dir, { t: "part", name: "build", status: "starting" });
  const built = await withBuildLock(place.home, project, p.platform, async () => {
    let kept2 = keptBuild(place.home, project, p.platform, fingerprint);
    if (kept2) {
      say(`Kept build for ${name}, from ${kept2.builtAt}`);
      state.build = { kept: kept2.builtAt };
    } else {
      const doing = `Building for ${name}`;
      say(doing);
      writeState(place.dir, { ...state, doing });
      const cwd = c.cwd ? (0, import_node_path4.join)(place.folder, c.cwd) : place.folder;
      const out = buildWorkDir(place.home, project, p.platform);
      const started = Date.now();
      const log = (0, import_node_path4.join)(place.dir, LOGS, `build-${p.platform}.log`);
      const base = appEnv(place, spec, ports, state.learned);
      const utf8 = /utf-?8/i.test(base.LANG ?? "") ? {} : { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" };
      const sdk = p.platform === "android" ? androidSdk() : void 0;
      const tools = { ...sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {}, ...process.env.JAVA_HOME ? { JAVA_HOME: process.env.JAVA_HOME } : {} };
      const r = await runCommand(p.build, { cwd, env: { ...base, ...utf8, ...tools, F4R_BUILD_OUT: out, CI: "1" }, timeoutMs: 60 * 6e4, log });
      const file = r.code === 0 ? builtFile(cwd, p.output.replace(/\$\{?F4R_BUILD_OUT\}?/g, out)) : void 0;
      if (!file) {
        const program = buildProgram(r.output, p.build);
        part.status = "failed";
        part.why = r.code === 0 ? `Build for ${name} left no app at ${p.output}.` : `Build failed for ${name} \xB7 ${program} exit ${r.code}`;
        part.log = keepEnd(r.output, LOG_LINES, 2);
        state.status = "failed";
        writeState(place.dir, state);
        emit(place.dir, { t: "part", name: "build", status: "failed", why: part.why, log: part.log });
        emit(place.dir, { t: "app", status: "failed" });
        return void 0;
      }
      const minutes = Math.round((Date.now() - started) / 6e4);
      kept2 = keepBuild(place.home, { project, platform: p.platform, fingerprint, built: file, minutes });
      state.build = { minutes };
    }
    return kept2;
  });
  if (!built) return false;
  const kept = built;
  part.status = "up";
  const bundlerPort = p.bundler ? ports[p.bundler] : void 0;
  state.phone = { platform: p.platform, file: kept.file, ...p.app ? { app: p.app } : {}, ...bundlerPort ? { bundlerPort } : {}, ...p.opens ? { opens: p.opens } : {}, ports: Object.values(ports) };
  writeState(place.dir, state);
  emit(place.dir, { t: "part", name: "build", status: "up" });
  return true;
}
function buildProgram(output, command) {
  const tail = output.split("\n").slice(-60).join("\n");
  if (/\*\* BUILD FAILED \*\*|xcodebuild: error|The following build commands failed/.test(tail)) return "xcodebuild";
  if (/cocoapods|Podfile|pod install|\[!\]/i.test(tail)) return "pod install";
  if (/gradle|FAILURE: Build failed|What went wrong/i.test(tail)) return "gradle";
  if (/expo prebuild|ConfigError|expo/i.test(tail)) return "expo prebuild";
  return command.match(/\b(xcodebuild|gradlew|gradle|pod|expo)\b/)?.[1]?.replace("gradlew", "gradle") ?? "the build";
}
function builtFile(cwd, path) {
  const full = (0, import_node_path4.resolve)(cwd, path);
  const dir = full.slice(0, full.lastIndexOf("/") > 0 ? full.lastIndexOf("/") : full.length);
  const last = full.slice(dir.length + 1);
  if (!last.includes("*")) return (0, import_node_fs4.existsSync)(full) ? full : void 0;
  const re = new RegExp(`^${last.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  let names = [];
  try {
    names = (0, import_node_fs4.readdirSync)(dir).filter((n) => re.test(n));
  } catch {
    return void 0;
  }
  return names.map((n) => (0, import_node_path4.join)(dir, n)).sort((a, b) => (0, import_node_fs4.statSync)(b).mtimeMs - (0, import_node_fs4.statSync)(a).mtimeMs)[0];
}
async function servicesReady(place, spec, say) {
  const services = spec.components.filter((c) => c.service);
  if (!services.length) return void 0;
  const packages = [...new Set(services.flatMap((c) => c.packages ?? []))].filter((p) => PKG.test(p));
  if (place.services || place.broker) {
    if (!packages.length) return void 0;
    say?.(`Installing ${packages.join(", ")} in recode's services machine`);
    writeState(place.dir, { ...readState(place.dir), doing: `Installing ${packages.join(", ")} in recode-services` });
    const r2 = place.broker ? await askBroker(place.broker.socket, { op: "install" }) : await place.services.install(packages);
    return r2.ok ? void 0 : { why: `recode couldn\u2019t install ${packages.join(", ")} in its services machine.`, log: keepEnd(r2.output, LOG_LINES, 2) };
  }
  if (process.platform === "darwin" || process.platform === "win32") {
    return { setup: true, why: `This ${process.platform === "darwin" ? "Mac" : "machine"} isn\u2019t set up for web apps with services, which ${services.map((c) => c.name).join(" and ")} need${services.length === 1 ? "s" : ""}. Set it up, then Try again.` };
  }
  if (!packages.length) return void 0;
  const r = await runArgs("dpkg", ["-s", ...packages], 1e4);
  if (r.ok || /ENOENT|not found/i.test(r.output)) return void 0;
  if (process.env.F4R_CLOUD_MACHINE) {
    say?.(`Installing ${packages.join(", ")}`);
    writeState(place.dir, { ...readState(place.dir), doing: `Installing ${packages.join(", ")}` });
    const apt = `export DEBIAN_FRONTEND=noninteractive; apt-get -o DPkg::Lock::Timeout=300 update -qq && apt-get -o DPkg::Lock::Timeout=300 install -y -qq --no-install-recommends ${packages.join(" ")} && ${QUIET_SERVICES}`;
    const i = await runArgs("sudo", ["-n", "sh", "-c", apt], 15 * 6e4);
    return i.ok ? void 0 : { why: `recode couldn\u2019t install ${packages.join(", ")} on this machine.`, log: keepEnd(i.output, LOG_LINES, 2) };
  }
  return { why: `${services.map((c) => c.what ?? c.name).join(" and ")} ${services.length === 1 ? "isn\u2019t" : "aren\u2019t"} installed on this machine. Install ${packages.length === 1 ? "it" : "them"} (sudo apt-get install ${packages.join(" ")}), then Try again.` };
}
function askBroker(socket, req) {
  return new Promise((done) => {
    const s = (0, import_node_net.connect)(socket);
    let buf = "";
    s.on("connect", () => s.write(`${JSON.stringify(req)}
`));
    s.on("data", (b) => {
      buf += b.toString();
    });
    s.on("end", () => {
      try {
        done(JSON.parse(buf));
      } catch {
        done({ ok: false, output: buf || "recode's helper didn't answer" });
      }
    });
    s.on("error", (e) => done({ ok: false, output: e.message }));
  });
}

// ../runner/src/checks.ts
var KEEP_LINES = 200;
var DEFAULT_TIMEOUT_MS = 10 * 6e4;
var NAMED = ["types", "tests", "lint"];
function parseDuration(v) {
  const m = typeof v === "string" ? v.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/) : typeof v === "number" ? [String(v), String(v), "m"] : null;
  if (!m) return void 0;
  const n = Number(m[1]);
  return Math.round(n * { ms: 1, s: 1e3, m: 6e4, h: 36e5 }[m[2] ?? "m"]);
}
function readChecksYaml(text) {
  const root = {};
  const stack = [{ indent: -1, map: root }];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "");
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const m = line.trim().match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) throw new Error(`f4r/checks.yaml: can't read "${line.trim()}"`);
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).map;
    const value = m[2].trim();
    if (!value) {
      const child = {};
      parent[m[1]] = child;
      stack.push({ indent, map: child });
    } else {
      parent[m[1]] = value.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return root;
}
function fromYaml(text) {
  const y = readChecksYaml(text);
  const checks = {};
  for (const [name, v] of Object.entries(y.checks ?? {})) {
    if (typeof v === "string") checks[name] = { command: v };
    else if (v && typeof v === "object" && typeof v.command === "string") checks[name] = { command: v.command, timeoutMs: parseDuration(v.timeout) };
  }
  const setup = typeof y.setup === "string" ? { command: y.setup } : void 0;
  const always = typeof y.always === "string" ? [{ name: "always", command: y.always }] : y.always && typeof y.always === "object" ? Object.entries(y.always).flatMap(([name, v]) => typeof v === "string" ? [{ name, command: v }] : []) : void 0;
  return { source: "f4r/checks.yaml", checks, setup, ...always?.length ? { always } : {} };
}
function profileFromSpec(spec) {
  const checks = {};
  for (const s of spec.scripts.filter((x) => x.when === "check")) checks[s.name ?? s.run] = { command: s.run, bin: "node_modules/.bin", ...s.needsStart ? { needsStart: true } : {} };
  const setup = spec.scripts.find((x) => x.when === "setup");
  return { source: "Settings \xB7 Testing", checks, ...setup ? { setup: { command: setup.run, needs: setup.run.match(/^(pnpm|npm|yarn|bun)\b/) ? "node_modules" : void 0 } } : {} };
}
function detectProfile(read) {
  const has = (f) => read(f) !== void 0;
  const pkg = read("package.json");
  if (pkg !== void 0) {
    let p;
    try {
      p = JSON.parse(pkg);
    } catch {
      return void 0;
    }
    const scripts = p.scripts ?? {};
    const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lockb") || has("bun.lock") ? "bun" : "npm";
    const run2 = (s) => scripts[s];
    const first = (names) => names.find((n) => scripts[n] && !/no test specified/.test(scripts[n]));
    const checks = {};
    const types = first(["typecheck", "type-check", "types", "tsc"]);
    const tests = first(["test", "tests", "test:unit"]);
    const lint = first(["lint"]);
    if (types) checks.types = { command: run2(types), bin: "node_modules/.bin" };
    if (tests) checks.tests = { command: run2(tests), bin: "node_modules/.bin" };
    if (lint) checks.lint = { command: run2(lint), bin: "node_modules/.bin" };
    const install = pm === "pnpm" ? "pnpm install --frozen-lockfile" : pm === "yarn" ? "yarn install --frozen-lockfile" : pm === "bun" ? "bun install" : has("package-lock.json") ? "npm ci" : "npm install";
    const deps = Object.keys({ ...p.dependencies, ...p.devDependencies }).length > 0;
    const byName = Object.fromEntries(Object.entries(scripts).filter(([n, c]) => typeof c === "string" && !/(deploy|publish|release|push|upload|migrate|seed|prod)/i.test(n)).map(([n, c]) => [n, { command: c, bin: "node_modules/.bin" }]));
    return { source: "package.json", checks, scripts: byName, setup: deps ? { command: install, needs: "node_modules" } : void 0 };
  }
  if (has("Cargo.toml")) return { source: "Cargo.toml", checks: { types: { command: "cargo check --all-targets" }, tests: { command: "cargo test" }, lint: { command: "cargo clippy --all-targets -- -D warnings" } } };
  if (has("go.mod")) return { source: "go.mod", checks: { types: { command: "go vet ./..." }, tests: { command: "go test ./..." } } };
  if (has("pyproject.toml") || has("setup.py") || has("requirements.txt")) {
    const pyproject = read("pyproject.toml") ?? "";
    const checks = { tests: { command: "python -m pytest -q" } };
    if (has("mypy.ini") || /\[tool\.mypy\]/.test(pyproject)) checks.types = { command: "python -m mypy ." };
    if (/\[tool\.ruff\]/.test(pyproject) || has("ruff.toml")) checks.lint = { command: "ruff check ." };
    return { source: has("pyproject.toml") ? "pyproject.toml" : "requirements.txt", checks };
  }
  return void 0;
}
async function resolveProfile(clone, base) {
  const yaml = await git(clone, "show", `${base}:f4r/checks.yaml`).catch(() => void 0);
  if (yaml !== void 0) return fromYaml(yaml);
  const names = ["package.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json", "Cargo.toml", "go.mod", "pyproject.toml", "setup.py", "requirements.txt", "mypy.ini", "ruff.toml"];
  const listed = new Set((await git(clone, "ls-tree", "--name-only", base).catch(() => "")).split("\n"));
  const files = /* @__PURE__ */ new Map();
  for (const n of names) if (listed.has(n)) files.set(n, n === "package.json" || n === "pyproject.toml" ? await git(clone, "show", `${base}:${n}`).catch(() => "") : "");
  return detectProfile((f) => files.get(f));
}
function nodeForChecks(folder, execPath = process.execPath, version = process.version) {
  if (!/^node(\.exe)?$/.test((0, import_node_path5.basename)(execPath))) return void 0;
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  const read = (f) => {
    try {
      return (0, import_node_fs5.readFileSync)((0, import_node_path5.join)(folder, f), "utf8");
    } catch {
      return void 0;
    }
  };
  for (const f of [".nvmrc", ".node-version"]) {
    const pin = read(f)?.trim().split(/\s/)[0]?.replace(/^v/, "");
    if (pin && /^\d+/.test(pin) && Number(pin.split(".")[0]) !== major) return void 0;
  }
  let engines;
  try {
    engines = JSON.parse(read("package.json") ?? "{}")?.engines?.node;
  } catch {
  }
  const min = typeof engines === "string" ? engines.match(/^\s*>=?\s*v?(\d+)/) : null;
  if (min && major < Number(min[1])) return void 0;
  return (0, import_node_path5.dirname)(execPath);
}
function firstFailure(output) {
  for (const line of output.split("\n")) {
    const m = line.match(/^\s*not ok \d+ - (.+)$/) ?? line.match(/^\s*(?:✖|✗|×) (?!failing tests)(.+?)(?: \([\d.]+m?s\))?$/) ?? line.match(/^\s*(?:FAIL|--- FAIL:)\s+(.+)$/);
    if (m) return m[1].trim().slice(0, 120);
  }
  return void 0;
}
var ACTIONS_TOKENS = ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_RUNTIME_URL", "ACTIONS_RESULTS_URL", "ACTIONS_CACHE_URL"];
function runOne(o) {
  const t0 = Date.now();
  return new Promise((resolve2) => {
    const win = process.platform === "win32";
    const shell = win ? process.env.ComSpec ?? "cmd.exe" : process.env.SHELL && (0, import_node_fs5.existsSync)(process.env.SHELL) ? process.env.SHELL : "/bin/sh";
    const first = [o.bin && (0, import_node_path5.join)(o.cwd, o.bin), o.node].filter(Boolean);
    const command = win ? first.length ? `set "PATH=${first.join(";")};%PATH%" && ${o.command}` : o.command : first.length ? `PATH="${first.join(":")}:$PATH"; ${o.command}` : o.command;
    const how = o.box ? o.box.wrap(shell, ["-lc", command], o.cwd) : win ? { cmd: shell, args: ["/d", "/s", "/c", `"${command}"`] } : { cmd: shell, args: ["-lc", command] };
    const env = { ...process.env, ...o.env, ...o.box?.env, F4R_OUTCOME: o.outcomeFile, CI: "1", FORCE_COLOR: "0" };
    if (o.box) for (const v of SOCKET_VARS) delete env[v];
    delete env.NODE_TEST_CONTEXT;
    for (const v of ACTIONS_TOKENS) delete env[v];
    const child = (0, import_node_child_process6.spawn)(how.cmd, how.args, { cwd: o.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: !win, windowsHide: true, windowsVerbatimArguments: win && !o.box });
    let out = "";
    const take = (b) => {
      out += b.toString("utf8");
      if (out.length > 2e6) out = out.slice(-1e6);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    let timedOut = false;
    const kill = win ? () => {
      (0, import_node_child_process6.spawn)("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on("error", () => {
      });
    } : () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
      }
      setTimeout(() => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
        }
      }, 3e3).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, o.timeoutMs);
    const onAbort = () => kill();
    o.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("close", (code) => {
      clearTimeout(timer);
      o.signal?.removeEventListener("abort", onAbort);
      resolve2({ exitCode: code, output: out, ms: Date.now() - t0, timedOut });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve2({ exitCode: null, output: `${out}
${err.message}`, ms: Date.now() - t0, timedOut });
    });
  });
}
async function runChecks(o) {
  const emit2 = o.onEvent ?? (() => {
  });
  const spec = o.app ? readSpec(o.app.dir) : void 0;
  const fromApp = spec && spec.scripts.some((s) => s.when === "check") ? profileFromSpec(spec) : void 0;
  const given = o.scripts && Object.keys(o.scripts).length ? { source: "Settings \xB7 Testing", checks: Object.fromEntries(Object.entries(o.scripts).map(([n, run2]) => [n, { command: run2, bin: "node_modules/.bin" }])) } : void 0;
  const profile = fromApp ?? given ?? (o.commands.some((c) => !c.command) ? await resolveProfile(o.clone, o.base) : void 0);
  let appEnvNow = {};
  if (o.app && spec) appEnvNow = appEnv(o.app, spec, assignPorts(spec, o.app.ports), {});
  let upFailed;
  const ensureUp = async () => {
    if (!o.app || upFailed !== void 0 || readState(o.app.dir)?.status === "up") return;
    const s = await bringUp(o.box ? { ...o.app, wrap: o.box.box.wrap, boxEnv: o.box.box.env } : o.app).catch((e) => ({ status: "failed", why: e.message, parts: [] }));
    if (s.status === "up") appEnvNow = appEnv(o.app, spec, assignPorts(spec, o.app.ports), s.learned);
    else upFailed = s.parts.find((p) => p.status === "failed")?.why ?? s.why ?? "The app didn\u2019t come up.";
  };
  const results = [];
  const node = o.ownNode === false ? void 0 : nodeForChecks(o.folder);
  let declared;
  let near;
  const exec2 = async (name, command, timeoutMs, setup = false, bin) => {
    o.signal?.throwIfAborted();
    const id = `check-${results.length}`;
    const outcomeFile = (0, import_node_path5.join)(o.box?.outDir ?? o.runDir, `${id}.outcome.json`);
    (0, import_node_fs5.rmSync)(outcomeFile, { force: true });
    emit2({ type: "tool.started", id, tool: "shell", kind: "command", input: { command }, summary: command });
    const r = await runOne({ name, command, timeoutMs, cwd: o.folder, outcomeFile, bin, node, signal: o.signal, env: { ...o.env, ...appEnvNow }, box: o.box?.box });
    const output = keepEnd(r.output, KEEP_LINES);
    const ok = r.exitCode === 0 && !r.timedOut;
    emit2({ type: "tool.completed", id, ok, output, exitCode: r.exitCode ?? void 0 });
    if (!setup && (0, import_node_fs5.existsSync)(outcomeFile)) {
      try {
        const j = JSON.parse((0, import_node_fs5.readFileSync)(outcomeFile, "utf8"));
        if (typeof j.outcome === "string") {
          const { outcome, ...fields } = j;
          declared = { name: outcome, fields };
        }
      } catch {
      }
    }
    const first = { name, command, status: ok ? "pass" : "fail", exitCode: r.exitCode, ms: r.ms, output, timedOut: r.timedOut || void 0 };
    if (ok || setup || r.timedOut || o.signal?.aborted || o.rerun === false) return first;
    let again = rerunFor(command, r.output);
    const runAgain = async (cmd, tag) => {
      const id2 = `check-${results.length}-${tag}`;
      const outcomeFile2 = (0, import_node_path5.join)(o.box?.outDir ?? o.runDir, `${id2}.outcome.json`);
      (0, import_node_fs5.rmSync)(outcomeFile2, { force: true });
      emit2({ type: "tool.started", id: id2, tool: "shell", kind: "command", input: { command: cmd }, summary: `Rerun: ${cmd}` });
      const x = await runOne({ name, command: cmd, timeoutMs, cwd: o.folder, outcomeFile: outcomeFile2, bin, node, signal: o.signal, env: { ...o.env, ...appEnvNow }, box: o.box?.box });
      emit2({ type: "tool.completed", id: id2, ok: x.exitCode === 0 && !x.timedOut, output: keepEnd(x.output, KEEP_LINES), exitCode: x.exitCode ?? void 0 });
      return x;
    };
    let r2 = await runAgain(again.command, "again");
    if (again.tests.length && r2.exitCode === 0 && !r2.timedOut && !rerunRan(again.command, r2.output)) {
      again = { command, tests: [] };
      r2 = await runAgain(command, "whole");
    }
    const passed = r2.exitCode === 0 && !r2.timedOut;
    const rerun = { status: passed ? "pass" : "fail", command: again.command, ms: r2.ms, tests: again.tests };
    if (!passed) return { ...first, rerun };
    const named = again.tests.length ? again.tests : [firstFailure(r.output) ?? name];
    return { ...first, status: "pass", rerun, flaky: named };
  };
  if (profile?.setup && (!profile.setup.needs || !(0, import_node_fs5.existsSync)((0, import_node_path5.join)(o.folder, profile.setup.needs)))) {
    const s = await exec2("setup", profile.setup.command, 20 * 6e4, true);
    results.push(s);
    if (s.status === "fail") return finish();
  }
  const tests = profile?.checks.tests;
  if (o.near && tests?.needsStart) await ensureUp();
  if (o.near && tests && !upFailed && o.commands.some((c) => !c.command && c.name === "tests")) {
    near = await nearFor({ folder: o.folder, clone: o.clone, base: o.base, testCommand: { command: tests.command, bin: tests.bin }, always: profile?.always, agentTests: o.agentTests }).catch((e) => ({ skip: `recode couldn't tell what's near the change: ${e.message}` }));
    if ("commands" in near) {
      for (const n of near.commands) {
        const r = await exec2(n.name, n.command, tests.timeoutMs ?? DEFAULT_TIMEOUT_MS, false, n.bin);
        results.push({ ...r, stage: "near", scope: n.scope, from: near.from });
      }
      if (results.some((r) => r.stage === "near" && r.status === "fail")) {
        for (const c of o.commands) {
          const named = c.command ? void 0 : profile?.checks[c.name] ?? profile?.scripts?.[c.name];
          results.push({ name: c.name ?? c.command, command: c.command ?? named?.command ?? null, status: "skipped", exitCode: null, ms: 0, output: "", stage: "whole", notRun: true });
        }
        return finish();
      }
    }
  }
  const stage = near && "commands" in near ? { stage: "whole" } : {};
  for (const c of o.commands) {
    if (c.command) {
      results.push({ ...await exec2(c.name ?? c.command, c.command, c.timeoutMs ?? DEFAULT_TIMEOUT_MS), ...stage });
      continue;
    }
    const named = profile?.checks[c.name] ?? profile?.scripts?.[c.name];
    if (!named) {
      results.push({ name: c.name, command: null, status: "skipped", exitCode: null, ms: 0, output: "", ...stage });
      continue;
    }
    if (named.needsStart) {
      await ensureUp();
      if (upFailed) {
        results.push({ name: c.name, command: named.command, status: "fail", exitCode: null, ms: 0, output: `The app didn\u2019t come up: ${upFailed}`, ...stage });
        continue;
      }
    }
    results.push({ ...await exec2(c.name, named.command, c.timeoutMs ?? named.timeoutMs ?? DEFAULT_TIMEOUT_MS, false, named.bin), ...stage });
  }
  return finish();
  function finish() {
    const failed = results.filter((r) => r.status === "fail");
    const ran = results.filter((r) => r.status !== "skipped");
    const where = (f) => f.stage === "near" ? " near the change" : "";
    const flaky = results.flatMap((r) => r.flaky ?? []);
    const flakyNote = flaky.length ? ` (${flaky.length} flaky)` : "";
    const outcome = declared ?? (failed.length ? { name: "fail", fields: { reason: failed.map((f) => `${f.name} failed${where(f)}${f.timedOut ? " (timed out)" : f.exitCode !== null ? ` (exit ${f.exitCode})` : ""}${f.rerun ? ", and again" : ""}`).join(", ") } } : { name: "pass", fields: { reason: ran.length ? `${[...new Set(ran.filter((r) => r.name !== "setup" && r.stage !== "near").map((r) => r.name))].join(", ")} passed${flakyNote}` : "No checks found" } });
    const lines = [];
    if (!ran.length) lines.push(`No checks found${profile ? ` in ${profile.source}` : ""}. Add f4r/checks.yaml to the repo to name them.`);
    let heading;
    for (const r of results) {
      const h = r.stage === "near" ? `Near the change, from ${r.from}:` : r.stage === "whole" ? "Whole suite:" : void 0;
      if (h && h !== heading) {
        lines.push(h);
        heading = h;
      }
      if (r.notRun) {
        lines.push(`\u2013 ${r.name}: didn't run, since a check near the change failed`);
        continue;
      }
      if (r.flaky) {
        lines.push(`~ ${r.name}: flaky, so not to fix: ${r.flaky.join(", ")} failed, then passed when rerun at the same commit`);
        continue;
      }
      const first = r.status === "fail" ? firstFailure(r.output) : void 0;
      lines.push(`${r.status === "pass" ? "\u2713" : r.status === "fail" ? "\u2715" : "\u2013"} ${r.name}${r.command ? `: ${r.command}` : ": not set up for this project"}${r.status === "fail" ? r.timedOut ? " (timed out)" : ` (exit ${r.exitCode})` : ""}${first ? `, first failing: ${first}` : ""}${r.rerun ? ", and again when rerun at the same commit" : ""}`);
    }
    if (near && "skip" in near && near.skip !== "Nothing changed") lines.push(`No checks near the change first: ${near.skip}.`);
    if (node && ran.length) lines.push(`Node ${process.version}, the one f4r runs on.`);
    for (const f of failed) lines.push("", `${f.name} output:`, "```", f.output, "```");
    return { checks: results, outcome, result: lines.join("\n"), source: profile?.source, ...near ? { near } : {} };
  }
}

// src/main.ts
function input(env, name) {
  const v = env[`INPUT_${name.toUpperCase()}`]?.trim();
  return v ? v : void 0;
}
function flag(env, name, dflt) {
  const v = input(env, name)?.toLowerCase();
  if (v === void 0) return dflt;
  if (["true", "yes", "1", "on"].includes(v)) return true;
  if (["false", "no", "0", "off"].includes(v)) return false;
  throw new Error(`${name} should be true or false, not "${v}"`);
}
var escData = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
var escProp = (s) => escData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
function failureAt(output, workspace, exists = (f) => (0, import_node_fs6.existsSync)((0, import_node_path6.join)(workspace, f))) {
  const re = /(?:file:\/\/)?((?:\/|\.{0,2}\/|[\w@.-]+\/)[^\s'"():]*?\.(?:[cm]?[jt]sx?|py|go|rs))(?::(\d+))(?::\d+)?/g;
  const roots = [workspace];
  try {
    const real = (0, import_node_fs6.realpathSync)(workspace);
    if (real !== workspace) roots.push(real);
  } catch {
  }
  for (const m of output.matchAll(re)) {
    const raw = m[1];
    const file = (0, import_node_path6.isAbsolute)(raw) ? roots.map((r) => (0, import_node_path6.relative)(r, raw)).find((f) => !f.startsWith("..")) ?? ".." : raw.replace(/^\.\//, "");
    if (!file || file.startsWith("..") || file.includes("node_modules/")) continue;
    if (exists(file)) return { file, line: Number(m[2]) };
  }
  return void 0;
}
function baseOf(event, payload) {
  const p = payload;
  const sha = event === "pull_request" || event === "pull_request_target" ? p?.pull_request?.base?.sha : event === "merge_group" ? p?.merge_group?.base_sha : void 0;
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : void 0;
}
var git2 = (cwd, ...args) => (0, import_node_child_process7.execFileSync)("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function haveCommit(workspace, sha, io) {
  try {
    git2(workspace, "cat-file", "-e", `${sha}^{commit}`);
    return true;
  } catch {
  }
  try {
    git2(workspace, "fetch", "--no-tags", "--quiet", "origin", sha);
    return true;
  } catch (e) {
    io.out(`::warning title=recode / checks::Couldn't fetch the base commit ${sha.slice(0, 7)}: ${escData(e.message.split("\n")[0])}. Check out with fetch-depth: 0.`);
    return false;
  }
}
var RECODE_SERVER = "https://code.f4r.ai";
async function identity(env, fetchFn) {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) return null;
  const res = await fetchFn(`${url}${url.includes("?") ? "&" : "?"}audience=recode`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15e3) });
  if (!res.ok) return null;
  return (await res.json()).value ?? null;
}
async function setupFrom(server, env, fetchFn) {
  const token = await identity(env, fetchFn).catch(() => null);
  if (!token) return { said: "GitHub gave this run no identity token. The workflow needs permissions: id-token: write, and a fork's pull request never gets one" };
  try {
    const res = await fetchFn(`${server}/actions/checks/setup`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15e3) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { said: body.error ?? `recode said ${res.status}` };
    return { scripts: Array.isArray(body.scripts) ? body.scripts : [], flakyFails: body.flakyFails === true };
  } catch (e) {
    return { said: `recode couldn't be reached: ${e.message}` };
  }
}
async function run(env, io = { out: (l) => process.stdout.write(`${l}
`) }, platform = process.platform, fetchFn = (...a) => fetch(...a)) {
  if (platform === "win32") throw new Error("recode checks runs on Linux and macOS jobs. Use runs-on: ubuntu-latest for this one.");
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const event = env.GITHUB_EVENT_NAME;
  const payload = env.GITHUB_EVENT_PATH && (0, import_node_fs6.existsSync)(env.GITHUB_EVENT_PATH) ? JSON.parse((0, import_node_fs6.readFileSync)(env.GITHUB_EVENT_PATH, "utf8")) : null;
  const names = (input(env, "checks") ?? NAMED.join(",")).split(/[\s,]+/).filter(Boolean);
  const server = (input(env, "server") ?? RECODE_SERVER).replace(/\/+$/, "");
  const setup = await setupFrom(server, env, fetchFn);
  const connected = "scripts" in setup ? setup : null;
  const flakyFails = connected ? connected.flakyFails : flag(env, "flaky-fails", false);
  const rerun = flag(env, "rerun", true);
  let base = baseOf(event, payload);
  if (base && !haveCommit(workspace, base, io)) base = void 0;
  const near = flag(env, "near", true) && event !== "merge_group" && !!base;
  if (base) {
    try {
      if (git2(workspace, "rev-parse", "--is-shallow-repository") === "true") io.out("::notice title=recode / checks::The checkout is shallow, so recode may not tell what changed. Check out with fetch-depth: 0.");
    } catch {
    }
  }
  const runDir = (0, import_node_fs6.mkdtempSync)((0, import_node_path6.join)(env.RUNNER_TEMP ?? (0, import_node_os3.tmpdir)(), "recode-checks-"));
  let open = false;
  const onEvent = (e) => {
    if (e.type === "tool.started") {
      if (open) io.out("::endgroup::");
      io.out(`::group::${escData(String(e.summary ?? ""))}`);
      open = true;
    } else if (e.type === "tool.completed") {
      if (e.output) io.out(String(e.output));
      io.out("::endgroup::");
      open = false;
      io.out(`${e.ok ? "\u2713" : "\u2715"} ${e.ok ? "passed" : `failed${e.exitCode !== void 0 ? ` (exit ${e.exitCode})` : ""}`}`);
    }
  };
  const r = await runChecks({
    folder: workspace,
    clone: workspace,
    base: base ?? "HEAD",
    commands: names.map((name) => ({ name })),
    runDir,
    onEvent,
    near,
    rerun,
    // The workflow's own Node, from its setup-node, not the one GitHub runs this step on.
    ownNode: false,
    ...connected?.scripts.length ? { scripts: Object.fromEntries(connected.scripts.map((s) => [s.name, s.run])) } : {}
  }).finally(() => (0, import_node_fs6.rmSync)(runDir, { recursive: true, force: true }));
  if (open) io.out("::endgroup::");
  const t = checksTitle(r.checks, { flakyFails });
  for (const c of r.checks) {
    if (c.status === "fail") {
      const at = failureAt(c.output, workspace);
      const what = firstFailure(c.output) ?? `${c.name} failed${c.exitCode !== null ? ` (exit ${c.exitCode})` : ""}`;
      const where = at ? `file=${escProp(at.file)},line=${at.line},` : "";
      io.out(`::error ${where}title=${escProp(`recode / checks: ${c.name}${c.stage === "near" ? " near the change" : ""}`)}::${escData(`${what}${c.rerun ? ". Rerun at the same commit: failed again." : ""}`)}`);
    } else if (c.flaky) {
      io.out(`::warning title=${escProp(`recode / checks: flaky ${c.name}`)}::${escData(`${c.flaky.join(", ")} failed, then passed when rerun at the same commit. Marked, not fixed.`)}`);
    }
  }
  const head = payload?.pull_request?.head?.sha ?? env.GITHUB_SHA ?? (() => {
    try {
      return git2(workspace, "rev-parse", "HEAD");
    } catch {
      return "";
    }
  })();
  let heard = "said" in setup ? `recode didn't hear of this run: ${setup.said}.` : "";
  if (connected) {
    const number = payload?.pull_request?.number ?? null;
    try {
      const token = await identity(env, fetchFn);
      const res = token ? await fetchFn(`${server}/actions/checks/results`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(3e4),
        body: JSON.stringify({ number, head, checks: r.checks, checksFrom: r.source ?? null })
      }) : null;
      heard = res?.ok ? "Reported to recode." : `recode didn't hear of this run: ${res ? (await res.json().catch(() => ({}))).error ?? `it said ${res.status}` : "GitHub gave no identity token for the results"}.`;
    } catch (e) {
      heard = `recode didn't hear of this run: ${e.message}.`;
    }
  }
  if (heard && !heard.startsWith("Reported")) io.out(`::notice title=recode / checks::${escData(heard)}`);
  const summary = `## ${t.title}

${checksSummary(r.checks, { head, where: "in GitHub Actions", from: r.source ?? null, link: null })}
${heard ? `
${heard}
` : ""}`;
  if (env.GITHUB_STEP_SUMMARY) (0, import_node_fs6.appendFileSync)(env.GITHUB_STEP_SUMMARY, summary);
  io.out(`recode / checks: ${t.title}`);
  if (t.conclusion === "neutral") io.out("::notice title=recode / checks::No checks found. Add f4r/checks.yaml to the repo to name them.");
  const exitCode = t.conclusion === "failure" ? 1 : 0;
  return { checks: r.checks, title: t.title, conclusion: t.conclusion, exitCode };
}

// src/index.ts
run(process.env).then(
  (r) => {
    process.exitCode = r.exitCode;
  },
  (e) => {
    process.stdout.write(`::error title=recode / checks::${String(e.message).replace(/%/g, "%25").replace(/\r?\n/g, "%0A")}
`);
    process.exitCode = 1;
  }
);
