import { test, describe } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);

function startServer() {
    return spawn("node", [path.join(__dirname, "..", "dist", "index.js")], {
        env: {
            ...process.env,
            KCHAT_TOKEN: "test-token",
            KCHAT_TEAM_NAME: "test-team",
        },
        stdio: ["pipe", "pipe", "pipe"],
    });
}

function readResponse(child, id, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        let buffer = "";
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`timed out waiting for response id ${id}`));
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const message = JSON.parse(line);
                    if (message.id === id) {
                        clearTimeout(timer);
                        resolve(message);
                        return;
                    }
                } catch {
                    // partial line, keep buffering
                }
            }
        });

        child.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function listTools(child) {
    child.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "0.0.0" },
        },
    }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");

    return readResponse(child, 2);
}

describe("server startup", () => {
    test("the server version should match package.json", async () => {
        const child = startServer();

        try {
            child.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "test-client", version: "0.0.0" },
                },
            }) + "\n");

            const response = await readResponse(child, 1);

            assert.strictEqual(
                response.result.serverInfo.version,
                packageJson.version,
                "server version should match package.json",
            );
        } finally {
            child.kill();
        }
    });

    test("kchat_get_channel_history should expose a page input", async () => {
        const child = startServer();

        try {
            const response = await listTools(child);

            const history = response.result.tools.find(
                (tool) => tool.name === "kchat_get_channel_history",
            );
            assert.ok(history, "kchat_get_channel_history tool should exist");

            assert.deepStrictEqual(
                history.inputSchema.properties.page,
                {
                    type: "number",
                    minimum: 0,
                    default: 0,
                    description: "Current pagination page",
                },
                "kchat_get_channel_history should declare a page input defaulting to 0",
            );
        } finally {
            child.kill();
        }
    });

    test("kchat_list_channels limit should be capped at 100", async () => {
        const child = startServer();

        try {
            const response = await listTools(child);

            const channels = response.result.tools.find(
                (tool) => tool.name === "kchat_list_channels",
            );
            assert.ok(channels, "kchat_list_channels tool should exist");

            assert.strictEqual(
                channels.inputSchema.properties.limit.maximum,
                100,
                "kchat_list_channels limit max should be 100",
            );
        } finally {
            child.kill();
        }
    });

    test("kchat_send_direct_message should declare a username pattern", async () => {
        const child = startServer();

        try {
            const response = await listTools(child);

            const dm = response.result.tools.find(
                (tool) => tool.name === "kchat_send_direct_message",
            );
            assert.ok(dm, "kchat_send_direct_message tool should exist");

            assert.strictEqual(
                dm.inputSchema.properties.username.pattern,
                "^(?=.*[a-z0-9_-])[a-z0-9._-]+$",
                "username should reject traversal payloads at the schema boundary",
            );
        } finally {
            child.kill();
        }
    });

    test("kchat_send_direct_message should reject traversal payloads at the boundary", async () => {
        const child = startServer();

        try {
            child.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "test-client", version: "0.0.0" },
                },
            }) + "\n");
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
            child.stdin.write(JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                    name: "kchat_send_direct_message",
                    arguments: { username: "../me", text: "KC message" },
                },
            }) + "\n");

            const response = await readResponse(child, 2);

            assert.strictEqual(
                response.result.isError,
                true,
                "SDK should reject invalid arguments before the handler runs",
            );
            assert.match(
                response.result.content[0].text,
                /Invalid arguments for tool kchat_send_direct_message/,
            );
        } finally {
            child.kill();
        }
    });
});
