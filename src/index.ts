#!/usr/bin/env node

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {KchatClient} from "./kchat-client.js";

const token = process.env.KCHAT_TOKEN;
const teamName = process.env.KCHAT_TEAM_NAME;

if (!token || !teamName) {
    console.error(
        "Please set KCHAT_TOKEN and KCHAT_TEAM_NAME environment variables",
    );
    process.exit(1);
}

const server = new McpServer(
    {
        name: "kChat MCP Server",
        version: "1.0.1",
    },
    {
        capabilities: {
            completions: {},
            prompts: {},
            resources: {},
            tools: {},
        },
    },
);

const kChatClient = new KchatClient(token, teamName);

server.tool(
    "kchat_list_channels",
    "List kChat public channels with pagination",
    {
        limit: z.preprocess(
            (val) => {
                if (typeof val === "string") {
                    return Number.parseInt(val);
                }

                return val;
            }, z.number().min(1).max(100).default(100).describe("Results limit")
        ),
        page: z.preprocess(
            (val) => {
                if (typeof val === "string") {
                    return Number.parseInt(val);
                }

                return val;
            }, z.number().min(0).default(0).describe("Current pagination page"))
    },
    async ({limit, page}) => {
        const response = await kChatClient.getChannels(limit, page);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

server.tool(
    "kchat_post_message",
    "Post a new message to a kChat channel",
    {
        channel_id: z.string().uuid().describe("The ID of the channel containing the message"),
        text: z.string().describe("The message text to post")
    },
    async ({channel_id, text}) => {
        const response = await kChatClient.postMessage(channel_id, text, undefined);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

server.tool(
    "kchat_reply_to_thread",
    "Reply to a specific message thread in kChat",
    {
        thread_id: z.string().uuid().describe("The parent message ID"),
        text: z.string().describe("The message text to post")
    },
    async ({thread_id, text}) => {
        const post = await kChatClient.getPost(thread_id);
        const response = await kChatClient.postMessage(post.channel_id, text, thread_id);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

server.tool(
    "kchat_add_reaction",
    "Add a reaction emoji to a kChat message",
    {
        post_id: z.string().uuid().describe("The ID of the the message to react to"),
        emoji_name: z.string().describe("The name of the emoji reaction")
    },
    async ({post_id, emoji_name}) => {
        const response = await kChatClient.addReaction(post_id, emoji_name);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

server.tool(
    "kchat_get_channel_history",
    "Get recent messages from a kChat channel",
    {
        channel_id: z.string().uuid().describe("The ID of the channel containing the message"),
        limit: z.preprocess(
            (val) => {
                if (typeof val === "string") {
                    return Number.parseInt(val);
                }

                return val;
            }, z.number().min(1).max(100).default(10).describe("Number of messages to retrieve (default 10)"))
    },
    async ({channel_id, limit}) => {
        const response = await kChatClient.getPostForChannel(channel_id, limit);

        return {
            content: [{type: "text", text: JSON.stringify(response.posts)}],
        };
    }
);

server.tool(
    "kchat_get_thread_replies",
    "Get all replies in a kChat message thread",
    {
        thread_id: z.string().uuid().describe("The parent message ID"),
    },
    async ({thread_id}) => {
        const response = await kChatClient.getThread(thread_id);

        return {
            content: [{type: "text", text: JSON.stringify(response.posts)}],
        };
    }
);

server.tool(
    "kchat_get_users",
    "Get a list of all users in the kChat with their basic profile information",
    {
        limit: z.preprocess(
            (val) => {
                if (typeof val === "string") {
                    return Number.parseInt(val);
                }

                return val;
            }, z.number().min(1).max(100).default(100).describe("Results limit")),
        page: z.preprocess(
            (val) => {
                if (typeof val === "string") {
                    return Number.parseInt(val);
                }

                return val;
            }, z.number().min(0).default(0).describe("Current pagination page"))
    },
    async ({limit, page}) => {
        const response = await kChatClient.getUsers(limit, page);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

server.tool(
    "kchat_send_direct_message",
    "Send a direct message to a kChat user by username",
    {
        username: z.string().describe("The username of the user to send the message to"),
        text: z.string().describe("The message text to send")
    },
    async ({username, text}) => {
        try {
            // Get the user ID from the username
            const user = await kChatClient.getUserByUsername(username);

            // Send the direct message using the user ID
            const response = await kChatClient.sendDirectMessage(user.id, text);

            return {
                content: [{type: "text", text: JSON.stringify(response)}],
            };
        } catch (error) {
            return {
                content: [{type: "text", text: `Error sending direct message: ${error}`}],
            };
        }
    }
);

server.tool(
    "kchat_get_user_profile",
    "Get detailed profile information for a specific kChat user",
    {
        user_id: z.string().uuid().describe("The ID of the user")
    },
    async ({user_id}) => {
        const response = await kChatClient.getUser(user_id);

        return {
            content: [{type: "text", text: JSON.stringify(response)}],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
