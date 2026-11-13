import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {KchatClient} from "../dist/kchat-client.js";

const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const id = "00000000-0000-4000-8000-000000000001";
const readTools = {
    kchat_list_channels: {},
    kchat_get_channel_history: {channel_id: id},
    kchat_get_thread_replies: {thread_id: id},
    kchat_get_users: {},
    kchat_get_user_profile: {user_id: id},
};
const writeTools = {
    kchat_post_message: {channel_id: id, text: "test"},
    kchat_reply_to_thread: {thread_id: id, text: "test"},
    kchat_add_reaction: {post_id: id, emoji_name: "thumbsup"},
    kchat_send_direct_message: {username: "test-user", text: "test"},
};

// Keep protocol tests offline, and fail if a handler attempts an HTTP write.
const mockFetch = `globalThis.fetch = async (url, options = {}) => {
    if ((options.method ?? "GET") !== "GET" || options.body !== undefined) {
        throw new Error("Unexpected write request");
    }
    return {json: async () => ({id: "test-id", posts: {}, source: "mock-api"})};
};`;

function serverEnv(setting) {
    const env = {
        ...process.env,
        KCHAT_TOKEN: "test-token",
        KCHAT_TEAM_NAME: "test-team",
    };
    delete env.KCHAT_READ_ONLY;
    if (setting !== undefined) env.KCHAT_READ_ONLY = setting;
    return env;
}

async function connect(t, setting) {
    const client = new Client({name: "read-only-test", version: "1.0.0"});
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", `data:text/javascript,${encodeURIComponent(mockFetch)}`, serverPath],
        env: serverEnv(setting),
        stderr: "pipe",
    });
    t.after(() => client.close());
    await client.connect(transport);
    return client;
}

test("read-only mode exposes only the five working read tools", {timeout: 10000}, async (t) => {
    const client = await connect(t, "true");
    const {tools} = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), Object.keys(readTools).sort());

    for (const [name, args] of Object.entries(readTools)) {
        const result = await client.callTool({name, arguments: args});
        assert.ok(!result.isError, `${name} should succeed`);
        const payload = JSON.parse(result.content[0].text);
        assert.deepEqual(payload, name === "kchat_get_channel_history" || name === "kchat_get_thread_replies"
            ? {} : {id: "test-id", posts: {}, source: "mock-api"});
    }
});

test("read-only mode rejects direct calls to every write tool", {timeout: 10000}, async (t) => {
    const client = await connect(t, "true");
    for (const [name, args] of Object.entries(writeTools)) {
        const result = await client.callTool({name, arguments: args});
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, new RegExp(`Tool ${name} not found`));
    }
});

for (const setting of [undefined, "false"]) {
    test(`all tools remain available when KCHAT_READ_ONLY is ${setting ?? "unset"}`, {timeout: 10000}, async (t) => {
        const client = await connect(t, setting);
        const {tools} = await client.listTools();
        assert.deepEqual(tools.map(tool => tool.name).sort(), [...Object.keys(readTools), ...Object.keys(writeTools)].sort());
    });
}

test("invalid read-only settings fail startup instead of enabling writes", () => {
    for (const setting of ["", "TRUE", "1", "tru", " false "]) {
        const result = spawnSync(process.execPath, [serverPath], {
            env: serverEnv(setting),
            encoding: "utf8",
            timeout: 5000,
        });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /KCHAT_READ_ONLY must be either true or false/);
        assert.equal(result.stdout, "");
    }
});

const writeMethods = [
    ["postMessage", [id, "test", undefined]],
    ["addReaction", [id, "thumbsup"]],
    ["createDirectChannel", [[id, id]]],
    ["sendDirectMessage", [id, "test"]],
];

test("the API client blocks all write methods before any network access", async (t) => {
    let fetchCalls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        fetchCalls += 1;
        throw new Error("Unexpected network access");
    });
    const client = new KchatClient("test-token", "test-team", {readOnly: true});
    for (const [name, args] of writeMethods) {
        await assert.rejects(client[name](...args), /read-only: write operations are disabled/);
    }
    assert.equal(fetchCalls, 0);
});

test("the API client preserves write operations when read-only mode is disabled", async (t) => {
    const requests = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        requests.push({url, options});
        return {json: async () => ({id})};
    });
    for (const options of [undefined, {readOnly: false}]) {
        const client = new KchatClient("test-token", "test-team", options);
        for (const [name, args] of writeMethods) {
            await client[name](...args);
        }
    }
    assert.equal(requests.filter(({options}) => options.method === "POST").length, 10);
});
