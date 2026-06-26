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

describe("server startup", () => {
    test("the server version should match package.json", async () => {
        const child = spawn("node", [path.join(__dirname, "..", "dist", "index.js")], {
            env: {
                ...process.env,
                KCHAT_TOKEN: "test-token",
                KCHAT_TEAM_NAME: "test-team",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });

        const initialize = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test-client", version: "0.0.0" },
            },
        };

        child.stdin.write(JSON.stringify(initialize) + "\n");

        const response = await new Promise((resolve, reject) => {
            let buffer = "";
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error("timed out waiting for initialize response"));
            }, 5000);

            child.stdout.on("data", (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const message = JSON.parse(line);
                        if (message.id === 1) {
                            clearTimeout(timer);
                            child.kill();
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

        assert.strictEqual(
            response.result.serverInfo.version,
            packageJson.version,
            "server version should match package.json",
        );
    });
});
