export class KchatClient {
    private readonly token: string;
    private readonly teamName: string;
    private readonly headers: { Authorization: string; "Content-Type": string, "User-Agent": string };

    constructor(token: string, teamName: string) {
        this.token = token;
        this.teamName = teamName;
        this.headers = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            "User-Agent": "kChat MCP Server"
        };
    }

    async getTeamByName(): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/teams/name/${this.teamName}`,
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
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/teams/${team.id}/channels?${params}`,
            {headers: this.headers},
        );

        return response.json();
    }

    async postMessage(channel_id: string, text: string, thread_id: string | undefined): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/posts`,
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
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/reactions`,
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
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/channels/${channel_id}/posts?${params}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getPost(post_id: string): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/posts/${post_id}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getThread(thread_id: string): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/posts/${thread_id}/thread`,
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
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/users?${params}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getUser(user_id: string): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/users/${user_id}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getCurrentUser(): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/users/me`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async getUserByUsername(username: string): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/users/username/${username}`,
            {
                headers: this.headers
            },
        );

        return response.json();
    }

    async createDirectChannel(userIds: [string, string]): Promise<any> {
        const response = await fetch(
            `https://${this.teamName}.kchat.infomaniak.com/api/v4/channels/direct`,
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
            const currentUser = await this.getCurrentUser();
            const channel = await this.createDirectChannel([currentUser.id, to_user_id]);
            const response = await this.postMessage(channel.id, text, undefined);
            return response;
        } catch (error) {
            throw new Error(`Failed to send direct message: ${error}`);
        }
    }
}
