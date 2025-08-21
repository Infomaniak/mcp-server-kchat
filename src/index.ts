#!/usr/bin/env node

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";

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
        version: "0.0.10",
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

class KchatClient {
    private readonly headers: { Authorization: string; "Content-Type": string, "User-Agent": string };

    constructor() {
        this.headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "kChat MCP Server"
        };
    }

    async getTeamByName(): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/teams/name/${teamName}`,
            {headers: this.headers},
        );

        return response.json();
    }

    async getChannels(limit: number, page: number): Promise<any> {
        const params = new URLSearchParams({
            per_page: Math.min(limit, 100).toString(),
            page: page.toString()
        });

        const team = await this.getTeamByName();

        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/teams/${team.id}/channels?${params}`,
            {headers: this.headers},
        );

        return response.json();
    }

    async postMessage(channel_id: string, text: string, thread_id: string | undefined): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/posts`,
            {
                headers: this.headers,
                method: "POST",
                body: JSON.stringify({
                    channel_id,
                    root_id: thread_id,
                    message: text,
                })
            },
        );

        return response.json();
    }

    async addReaction(post_id: string, emoji_name: string): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/reactions`,
            {
                headers: this.headers,
                method: "POST",
                body: JSON.stringify({
                    post_id,
                    emoji_name
                })
            },
        );

        return response.json();
    }

    async getPostForChannel(channel_id: string, limit: number): Promise<any> {
        const params = new URLSearchParams({
            per_page: Math.min(limit, 100).toString(),
            page: "0"
        });

        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/channels/${channel_id}/posts?${params}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getPost(post_id: string): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/posts/${post_id}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getThread(thread_id: string): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/posts/${thread_id}/thread`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getUsers(limit: number, page: number): Promise<any> {
        const params = new URLSearchParams({
            per_page: Math.min(limit, 100).toString(),
            page: page.toString()
        });

        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/users?${params}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getUser(user_id: string): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/users/${user_id}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getCurrentUser(): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/users/me`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getUserByUsername(username: string): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/users/username/${username}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async createDirectChannel(userIds: [string, string]): Promise<any> {
        const response = await fetch(
            `https://${teamName}.kchat.infomaniak.com/api/v4/channels/direct`,
            {
                headers: this.headers,
                method: "POST",
                body: JSON.stringify(userIds)
            },
        );

        return response.json();
    }

    async sendDirectMessage(to_user_id: string, text: string): Promise<any> {
        try {
            // First, get the current user (sender)
            const currentUser = await this.getCurrentUser();

            // Create a direct channel between the current user and the recipient
            const channel = await this.createDirectChannel([currentUser.id, to_user_id]);

            // Send the message to the direct channel
            const response = await this.postMessage(channel.id, text, undefined);

            return response;
        } catch (error) {
            throw new Error(`Failed to send direct message: ${error}`);
        }
    }
}

const kChatClient = new KchatClient();

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
    console.log("Fatal error in main():", error);
    process.exit(1);
});
