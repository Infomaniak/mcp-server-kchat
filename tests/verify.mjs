import { test, describe } from "node:test";
import assert from "node:assert";
import { KchatClient } from "../dist/kchat-client.js";

describe("KchatClient instantiation", () => {
    test("creates a client with token and teamName", () => {
        const client = new KchatClient("test-token", "test-team");
        assert.ok(client);
    });

    test("exposes all expected methods", () => {
        const client = new KchatClient("test-token", "test-team");
        const methods = [
            "getTeamByName", "getChannels", "postMessage", "addReaction",
            "getPostForChannel", "getPost", "getThread", "getUsers", "getUser",
            "getCurrentUser", "getUserByUsername", "createDirectChannel", "sendDirectMessage",
        ];
        for (const m of methods) {
            assert.strictEqual(
                typeof client[m],
                "function",
                `method ${m} should be a function`
            );
        }
    });
});

describe("KchatClient.getTeamByName", () => {
    test("calls fetch with correct URL", async () => {
        let capturedUrl = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            capturedUrl = url;
            return { json: async () => ({ id: "team-123" }) };
        };

        const client = new KchatClient("mock-token", "my-team");
        await client.getTeamByName();

        assert.ok(capturedUrl, "fetch was called");
        assert.ok(capturedUrl.includes("my-team"), "URL contains team name");
        assert.ok(capturedUrl.includes("/teams/name/my-team"), "URL contains correct path");

        globalThis.fetch = originalFetch;
    });
});

describe("KchatClient.getChannels", () => {
    test("calls fetch with correct URL", async () => {
        let capturedUrl = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            capturedUrl = url;
            return { json: async () => ({ result: "success", data: [] }) };
        };

        const client = new KchatClient("mock-token", "my-team");
        await client.getChannels(50, 0);

        assert.ok(capturedUrl, "fetch was called");
        assert.ok(capturedUrl.includes("/teams/"), "URL contains teams path");
        assert.ok(capturedUrl.includes("/channels"), "URL contains channels path");
        assert.ok(capturedUrl.includes("per_page=50"), "URL contains per_page");
        assert.ok(capturedUrl.includes("page=0"), "URL contains page");

        globalThis.fetch = originalFetch;
    });
});

describe("KchatClient.postMessage", () => {
    test("calls correct endpoint with POST", async () => {
        let capturedUrl = null;
        let capturedMethod = null;
        let capturedBody = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url, options) => {
            capturedUrl = url;
            capturedMethod = options?.method;
            capturedBody = options?.body;
            return { json: async () => ({ id: "post-123" }) };
        };

        const client = new KchatClient("mock-token", "my-team");
        await client.postMessage("channel-123", "Hello world", undefined);

        assert.ok(capturedUrl.includes("/api/v4/posts"), "URL is correct");
        assert.strictEqual(capturedMethod, "POST", "method is POST");
        assert.ok(capturedBody, "body is present");
        const body = JSON.parse(capturedBody);
        assert.strictEqual(body.channel_id, "channel-123");
        assert.strictEqual(body.message, "Hello world");
        assert.strictEqual(body.root_id, undefined);

        globalThis.fetch = originalFetch;
    });
});
