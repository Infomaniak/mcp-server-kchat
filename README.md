# kChat MCP Server

MCP Server for the kChat API.

## Tools

1. `kchat_list_channels`
    - List public channels
    - Optional inputs:
        - `limit` (number, default: 100, max: 200): Maximum number of channels to return
        - `page` (number, default: 0): Pagination page
    - Returns: List of channels with their IDs and information

2. `kchat_post_message`
   - Post a new message to a kChat channel
   - Required inputs:
      - `channel_id` (string): The ID of the channel to post to
      - `text` (string): The message text to post
   - Returns: Message post

3. `kchat_reply_to_thread`
   - Reply to a specific message thread
   - Required inputs:
      - `channel_id` (string): The channel containing the thread
      - `thread_id` (string): The parent message ID
      - `text` (string): The reply text
   - Returns: Message post

4. `kchat_add_reaction`
   - Add an emoji reaction to a message
   - Required inputs:
      - `post_id` (string): The message ID
      - `reaction` (string): Emoji name without colons
   - Returns: Reaction

5. `kchat_get_channel_history`
   - Get recent messages from a channel
   - Required inputs:
      - `channel_id` (string): The channel ID
   - Optional inputs:
      - `limit` (number, default: 10): Number of messages to retrieve
   - Returns: List of messages with their content and metadata

6. `kchat_get_thread_replies`
   - Get all replies in a message thread
   - Required inputs:
      - `thread_ts` (string): The parent message ID
   - Returns: List of replies with their content and metadata


7. `kchat_get_users`
   - Get list of workspace users with basic profile information
   - Optional inputs:
      - `limit` (number, default: 100, max: 100): Maximum number of users to return
      - `page` (number, default: 0): Pagination page
   - Returns: List of users with their basic profiles

8. `kchat_get_user_profile`
   - Get detailed profile information for a specific user
   - Required inputs:
      - `user_id` (string): The user's ID
   - Returns: Detailed user profile information

## Setup

1. Create a kChat token linked to your user:
    - Visit the [API Token page](https://manager.infomaniak.com/v3/ng/accounts/token/list)
    - Choose "kChat" scope

   Create a kChat token linked to a bot:
    - Visit your kChat webapp and click on New > Integrations > Bot accounts > Add bot accounts

2. Get your kChat team name from your kChat url (eg. https://your-team.kchat.infomaniak.com/your-team/channels/town-square url have `your-team` team)

### Usage with Claude Desktop

Add the following to your `claude_desktop_config.json`:

#### NPX

```json
{
  "mcpServers": {
    "kchat": {
      "command": "npx",
      "args": [
        "-y",
        "@infomaniak/kchat-mcp"
      ],
      "env": {
        "KCHAT_TOKEN": "your-token",
        "KCHAT_TEAM_NAME": "your-team"
      }
    }
  }
}
```

#### docker

```json
{
  "mcpServers": {
    "kchat": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "KCHAT_TOKEN",
        "-e",
        "KCHAT_TEAM_NAME",
        "infomaniak/kchat-mcp"
      ],
      "env": {
        "KCHAT_TOKEN": "your-token",
        "KCHAT_TEAM_NAME": "your-team"
      }
    }
  }
}
```

### Environment Variables

1. `KCHAT_TOKEN`: Required. Your kChat token.
2. `KCHAT_TEAM_NAME`: Required. Your kChat team unique name.

### Troubleshooting

If you encounter permission errors, verify that:
1. All required scopes are added to your kChat token
2. The token and team name are correctly copied to your configuration

## Build

Docker build:

```bash
docker build -t infomaniak/kchat-mcp -f Dockerfile .
```

## License

This MCP server is licensed under the MIT License.
