---
title: "API coverage"
description: "Supported, partially supported, deferred, and out-of-scope Trello REST API groups."
---

## Source Snapshot

- Official source: [Trello REST API reference](https://developer.atlassian.com/cloud/trello/rest/).
- Checked on: 2026-06-22.
- REST route prefix: `https://api.trello.com/1`. Atlassian's Trello REST reference is organized by API group rather than a named semver-style API version, so this matrix tracks the checked date and route prefix instead of a separate API version.

This project exposes focused MCP tools for personal and self-hosted Trello workflows. It does not try to mirror every Trello REST endpoint one-for-one. The matrix below tracks the current public API group coverage, known gaps, and non-goals so contributors can see where broad endpoint families are intentionally outside the current tool surface.

Trello's REST API uses the term Organizations for what the Trello product commonly presents as workspaces. The MCP tools use user-facing workspace wording, but rows below explicitly call out the underlying Organizations API group where relevant.

For API groups marked partially supported, the detailed coverage section breaks the group down by endpoint family so contributors can see which subset is currently covered without treating this project as a complete Trello REST proxy.

## Status Legend

| Status | Meaning |
| --- | --- |
| ✅ Supported | The current MCP surface covers the main endpoint family for normal user workflows in this group. |
| 🟡 Partially supported | The project covers useful workflows in this group, but intentionally omits some endpoint families or broad admin surfaces. |
| ⏳ Deferred | No current MCP tools cover this group, but the group fits the project if a concrete workflow is prioritized. |
| 🚫 Not planned | The group is outside the current personal/self-hosted scope unless a specific high-value workflow emerges. |

## Coverage Matrix

| Trello REST API group | Status | Current MCP tool coverage | Intentionally unsupported or deferred endpoints | Rationale and follow-up |
| --- | --- | --- | --- | --- |
| [Actions](https://developer.atlassian.com/cloud/trello/rest/api-group-actions/) | 🟡 Partially supported | `card_actions`, `board_actions`, `list_actions`, and `workspace_actions` list bounded activity histories. `card_comment_add`, `card_comment_update`, and `card_comment_delete` cover card comment actions. | Direct action lookup by id, generic action field reads, related-resource reads from an action, action reactions, and generic action mutation/deletion are not exposed. | The supported surface is optimized for activity audits and card comments. Broader action inspection and reactions can be added when a real workflow needs them. |
| [Applications](https://developer.atlassian.com/cloud/trello/rest/api-group-applications/) | 🚫 Not planned | None. | Application, API-key, and compliance/admin endpoints are not exposed. | This server uses a user-provided API key and token; app administration is outside the personal MCP workflow unless a concrete app-admin use case appears. |
| [Batch](https://developer.atlassian.com/cloud/trello/rest/api-group-batch/) | ⏳ Deferred | None. | Batch request helpers are not exposed yet. | Batch support is useful for read-heavy workflows but should be designed around safe response validation and error mapping. Follow-up: [#32](https://github.com/enthouan/trello-mcp/issues/32). |
| [Boards](https://developer.atlassian.com/cloud/trello/rest/api-group-boards/) | 🟡 Partially supported | `list_boards`, `board_create`, `board_get`, `board_field_get`, `board_actions`, `board_lists`, `board_cards`, `board_custom_fields`, `board_labels`, `board_members`, and `board_memberships`. | Board metadata/admin updates such as name, description, subscribed, and closed state; preference mutation; board viewed-state marking; board deletion; board-scoped checklist enumeration; invitations; member/admin mutation; stars; board plugins; board tags; board email/calendar keys; and export endpoints are not exposed. | The project covers board discovery, board reads, board creation, and related list/card/label/member/custom-field lookups. Admin-heavy board management remains out of scope until requested. |
| [Cards](https://developer.atlassian.com/cloud/trello/rest/api-group-cards/) | 🟡 Partially supported | `card_get`, `card_create`, `card_update`, `card_due_date_set`, `card_position_set`, `card_cover_set`, `card_delete`, `card_move`, `card_archive`, `card_board`, `card_list`, `card_labels`, `list_cards`, `board_cards`, attachment tools, checklist tools, member tools, comment tools, action tools, and card custom field tools. | Start dates, due reminders, subscription state, location/address fields, votes, stickers, pluginData, custom sticker images, card notification marking, broad field-specific aliases, and every Trello card subresource are not exposed. | Card CRUD, movement, attachments, checklists, comments, labels, members, covers, due dates, and custom field item workflows are covered. Lower-frequency social, Power-Up, notification, and exhaustive alias endpoints are deferred until they have a clear MCP use case. |
| [Checklists](https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/) | 🟡 Partially supported | `card_checklists`, `card_checklist_create`, `card_checklist_update`, `card_checklist_delete`, `card_checklist_item_create`, `card_checklist_items`, `card_checklist_item_update`, `card_checklist_item_set_checked`, `card_checklist_item_move`, and `card_checklist_item_delete`. | Direct checklist field reads, field-specific update aliases beyond rename and position, checklist board/card relationship reads, bulk checklist operations, and standalone checklist management aliases are not exposed. | Checklist support is intentionally card-scoped because that is how users normally manage checklist work through MCP clients. |
| [CustomFields](https://developer.atlassian.com/cloud/trello/rest/api-group-customfields/) | 🟡 Partially supported | `board_custom_fields`, `custom_field_get`, `custom_field_options`, `card_custom_field_items`, `card_custom_field_set`, and `card_custom_field_clear`. | Custom field definition creation, update, deletion, option creation/update/deletion, and broad custom field admin workflows are not complete. | Reading definitions/options and setting or clearing card values covers the current workflow. Definition and option management needs narrower requirements before adding mutation tools. |
| [Emoji](https://developer.atlassian.com/cloud/trello/rest/api-group-emoji/) | 🚫 Not planned | None. | Emoji listing/search endpoints are not exposed. | Emoji lookup is low fit for a self-hosted Trello workflow server and can be handled by clients if needed. |
| [Enterprises](https://developer.atlassian.com/cloud/trello/rest/api-group-enterprises/) | 🚫 Not planned | None. | Enterprise admin, audit, membership, organization, transfer, and licensing endpoints are not exposed. | Enterprise administration is outside the current personal/self-hosted scope and would require a different permission and safety model. |
| [Labels](https://developer.atlassian.com/cloud/trello/rest/api-group-labels/) | ✅ Supported | `board_labels`, `label_get`, `label_create`, `label_update`, `label_delete`, `card_label_add`, `card_label_remove`, and `card_label_create_and_add`. | No separate label field alias tools are exposed. | Core label discovery, CRUD, and card assignment workflows are covered by focused tools. |
| [Lists](https://developer.atlassian.com/cloud/trello/rest/api-group-lists/) | 🟡 Partially supported | `board_lists`, `list_get`, `list_create`, `list_update`, `list_archive`, `list_move_to_board`, `list_actions`, and `list_cards`. | Native mass-card operations such as archive-all-cards and move-all-cards, list parent-board relationship reads, list subscription, and broad field alias endpoints are not exposed. | List creation, reads, renaming, archiving, moving, actions, and card listing are covered. Mass-card operations need explicit design because they can affect many cards at once. Follow-up: [#140](https://github.com/enthouan/trello-mcp/issues/140). |
| [Members](https://developer.atlassian.com/cloud/trello/rest/api-group-members/) | 🟡 Partially supported | `auth_whoami`, `member_get`, `member_boards`, `member_cards`, `member_workspaces`, `board_members`, `board_memberships`, `card_members`, `card_member_add`, `card_member_remove`, and `search_members`. | Member action history, invited board/workspace reads, member admin mutation, avatars, custom board backgrounds, board stars, custom emoji, custom stickers, saved searches, token lifecycle, notification state, and broad account-management endpoints are not exposed. | The project supports member discovery, profile reads, assignment, and visible resource lookup. Account administration stays outside the MCP server's current scope. |
| [Notifications](https://developer.atlassian.com/cloud/trello/rest/api-group-notifications/) | ⏳ Deferred | None. | Direct notification lookup, notification field reads, notification listing, unread-state updates, and related notification resource reads are not exposed yet. | Notification support fits future triage workflows, but it is separate from card/list/board manipulation. Follow-up: [#39](https://github.com/enthouan/trello-mcp/issues/39). |
| [Organizations](https://developer.atlassian.com/cloud/trello/rest/api-group-organizations/) | 🟡 Partially supported | Exposed as workspace tools: `list_workspaces`, `workspace_get`, `workspace_boards`, `workspace_members`, and `workspace_actions`. Search also supports organization/workspace result types. | Organization creation/update/deletion, membership record reads, admin/member mutation, invitations, exports, preferences, tags, paid-account/admin endpoints, and plugin-related organization endpoints are not exposed. | Trello's Organizations API maps to user-facing workspaces. The current tools focus on discovery, metadata, boards, members, and activity audits rather than workspace administration. |
| [Plugins](https://developer.atlassian.com/cloud/trello/rest/api-group-plugins/) | 🚫 Not planned | None. | Power-Up/plugin and pluginData endpoint families are not exposed. | Power-Up administration and pluginData workflows are low fit for the current public tool surface unless a concrete board or card automation need appears. |
| [Search](https://developer.atlassian.com/cloud/trello/rest/api-group-search/) | ✅ Supported | `search` covers cards, boards, members, and organizations/workspaces with scoped fields and limits. `search_members` covers member lookup with optional board or workspace scope. | None currently planned. | The Trello search endpoint family is represented by focused search tools with bounded output defaults. |
| [Tokens](https://developer.atlassian.com/cloud/trello/rest/api-group-tokens/) | 🟡 Partially supported | `auth_token_info` reads safe metadata about the configured token. `auth_whoami` identifies the authenticated member. | Token-member relationship reads, token creation, revocation, OAuth lifecycle, token-owned webhooks, and broad token/member/admin mutation endpoints are not exposed. | The server intentionally consumes one user-provided API key and token. Diagnostics are useful; token lifecycle management is not part of the current scope. |
| [Webhooks](https://developer.atlassian.com/cloud/trello/rest/api-group-webhooks/) | ⏳ Deferred | None. | Webhook creation, listing, update, deletion, event receiver behavior, and validation helpers are not exposed or documented yet. | Webhooks are useful for future event-driven workflows but require explicit receiver, validation, and cleanup design. Follow-ups: [#42](https://github.com/enthouan/trello-mcp/issues/42), [#43](https://github.com/enthouan/trello-mcp/issues/43). |

## Detailed Coverage By Group

The tables below use the same status legend as the top-level matrix. They are intentionally grouped by useful endpoint families rather than listing every Trello REST route.

### API Group: Actions

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Resource activity history | 🟡 Partially supported | `card_actions`, `board_actions`, `list_actions`, `workspace_actions` | Direct action lookup by id and generic action field reads are not exposed. | Current tools are scoped to the resources users normally audit from MCP clients. |
| Card comments | ✅ Supported | `card_comment_add`, `card_comment_update`, `card_comment_delete` | Generic action mutation/deletion is not exposed. | Comment tools are intentionally card-scoped. |
| Action reactions and related-resource reads | ⏳ Deferred | None. | Reactions and action-related board/card/list/member reads are not exposed. | Add only when a concrete review or collaboration workflow needs them. |

### API Group: Boards

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Board discovery and metadata reads | ✅ Supported | `list_boards`, `board_get`, `board_field_get` | Exhaustive field alias tools are not exposed. | Focused field selection covers normal discovery and inspection. |
| Board metadata updates | ⏳ Deferred | None. | `PUT /boards/{id}` updates such as name, description, subscribed, and closed state are not exposed. | Add only when board administration workflows need explicit mutation safety. |
| Board creation | 🟡 Partially supported | `board_create` | Template-copy helpers, rich preference setup, and follow-up admin mutation are not exposed. | Creation defaults to private boards and supports optional workspace placement. |
| Board related resources | 🟡 Partially supported | `board_lists`, `board_cards`, `board_custom_fields`, `board_labels`, `board_members`, `board_memberships`, `board_actions` | Invitations, member/admin mutation, stars, board plugins, tags, email/calendar keys, exports, and preference mutation are not exposed. | The covered surface supports planning, lookup, and audit workflows without broad board administration. |
| Board-scoped checklists | ⏳ Deferred | None. | `GET /boards/{id}/checklists` is not exposed. | Checklist workflows are currently card-scoped; add board-level checklist enumeration only when a board audit workflow needs it. |
| Board viewed-state mutation | ⏳ Deferred | None. | `POST /boards/{id}/markedAsViewed` is not exposed. | This is a notification/read-state helper and should wait for a concrete triage workflow. |
| Board deletion | ⏳ Deferred | None. | Board delete helpers are not exposed. | Destructive board operations need explicit safety design before adding tools. |

### API Group: Cards

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Card CRUD and core metadata | 🟡 Partially supported | `card_get`, `card_create`, `card_update`, `card_delete` | Start date, due reminder, subscribed state, address/location fields, and exhaustive field-specific aliases are not exposed. | Core title, description, due date, completion, archive state, creation, reading, and explicit deletion are covered. Lower-frequency metadata can be added when a workflow needs it. |
| Movement, archive state, position, due date, and cover | ✅ Supported | `card_move`, `card_archive`, `card_position_set`, `card_due_date_set`, `card_cover_set` | Lower-level Trello aliases are not exposed. | Focused mutation tools keep common edits explicit. |
| Card relationships | ✅ Supported | `card_board`, `card_list`, `card_labels`, `card_members` | Broad relationship aliases are not exposed. | These tools support context gathering before edits or summaries. |
| Attachments | 🟡 Partially supported | `card_attachments`, `card_attachment_get`, `card_attachment_add_url`, `card_attachment_upload`, `card_attachment_delete` | Attachment cover edge aliases and every Trello attachment field route are not exposed. | URL attachments and guarded server-local uploads are supported. |
| Checklists and checklist items | 🟡 Partially supported | `card_checklists`, `card_checklist_create`, `card_checklist_update`, `card_checklist_delete`, `card_checklist_item_create`, `card_checklist_items`, `card_checklist_item_update`, `card_checklist_item_set_checked`, `card_checklist_item_move`, `card_checklist_item_delete` | Standalone checklist aliases and bulk checklist operations are not exposed. | Checklist workflows are intentionally card-scoped. |
| Comments and activity | 🟡 Partially supported | `card_comment_add`, `card_comment_update`, `card_comment_delete`, `card_actions` | Generic action lookup, reactions, and broad action mutation are not exposed. | Covers the common card review and audit path. |
| Labels, members, and custom field items | 🟡 Partially supported | `card_label_add`, `card_label_remove`, `card_label_create_and_add`, `card_member_add`, `card_member_remove`, `card_custom_field_items`, `card_custom_field_set`, `card_custom_field_clear` | Full label/admin, member/admin, and custom field definition management are handled outside the card tool family or not exposed. | Card-scoped assignment and value workflows are covered. |
| Votes, stickers, pluginData, and notification state | ⏳ Deferred | None. | Votes, stickers, custom sticker images, pluginData, and card notification marking are not exposed. | These lower-frequency social, Power-Up, and notification surfaces need concrete MCP use cases first. |

### API Group: Checklists

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Card checklist list/create/update/delete | ✅ Supported | `card_checklists`, `card_checklist_create`, `card_checklist_update`, `card_checklist_delete` | Standalone checklist route aliases are not exposed. | Current model treats checklists as card subresources; checklist update support covers rename and position changes. |
| Checklist item create/read/update/move/delete | ✅ Supported | `card_checklist_item_create`, `card_checklist_items`, `card_checklist_item_update`, `card_checklist_item_set_checked`, `card_checklist_item_move`, `card_checklist_item_delete` | Bulk item operations are not exposed. | Covers normal checklist item management. |
| Checklist field reads and relationships | ⏳ Deferred | None. | Direct checklist field reads, field-specific update aliases beyond the focused rename/position tool, and checklist board/card relationship reads are not exposed. | Add only if card-scoped reads and item-level edits are insufficient for real workflows. |

### API Group: CustomFields

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Definition and option reads | ✅ Supported | `board_custom_fields`, `custom_field_get`, `custom_field_options` | Exhaustive custom field admin reads are not exposed. | Users can discover definitions and dropdown options before writing card values. |
| Card custom field values | ✅ Supported | `card_custom_field_items`, `card_custom_field_set`, `card_custom_field_clear` | Bulk custom field item mutation is not exposed. | Supports setting and clearing one card field value at a time with type-specific validation. |
| Definition and option management | ⏳ Deferred | None. | Custom field definition creation/update/deletion and option creation/update/deletion are not exposed. | Needs narrower requirements because schema and option mutation can affect whole boards. |

### API Group: Lists

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| List reads and card listing | ✅ Supported | `board_lists`, `list_get`, `list_cards`, `list_actions` | Exhaustive field alias endpoints are not exposed. | Covers common list lookup, summarization, and audit workflows. |
| List relationship reads | ⏳ Deferred | None. | The parent-board relationship read `GET /lists/{id}/board` is not exposed as a `list_board` tool. | Add when list-only context needs parent-board expansion without a separate board lookup. |
| List create/update/archive/move | ✅ Supported | `list_create`, `list_update`, `list_archive`, `list_move_to_board` | Subscription helpers are not exposed. | Normal list management is covered with focused tools. |
| Native mass-card operations | ⏳ Deferred | None. | Archive-all-cards and move-all-cards are not exposed. | These broad mutations need explicit safety behavior. Follow-up: [#140](https://github.com/enthouan/trello-mcp/issues/140). |

### API Group: Members

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Member discovery and profile reads | ✅ Supported | `auth_whoami`, `member_get`, `search_members` | Account-management endpoints are not exposed. | Covers identifying the configured user and resolving collaborators. |
| Visible member resources | 🟡 Partially supported | `member_boards`, `member_cards`, `member_workspaces`, `board_members`, `board_memberships` | Invited board/workspace reads and broad admin/account reads are not exposed. | Results are constrained by the configured token's Trello visibility; pending invitations remain outside the current lookup tools. |
| Member action history | ⏳ Deferred | None. | `GET /members/{id}/actions` is not exposed as a `member_actions` tool. | Current activity audit tools are scoped to cards, boards, lists, and workspaces. |
| Card membership assignment | ✅ Supported | `card_members`, `card_member_add`, `card_member_remove` | Workspace or board member/admin mutation is not exposed. | Assignment is card-scoped rather than account-administrative. |
| Account assets and settings | 🚫 Not planned | None. | Avatars, custom board backgrounds, board stars, custom emoji, custom stickers, saved searches, notification state, and token lifecycle endpoints are not exposed. | These are outside the current personal Trello workflow server scope. |

### API Group: Organizations

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Workspace discovery and metadata | ✅ Supported | `list_workspaces`, `workspace_get` | Organization creation/update/deletion is not exposed. | User-facing tools call these workspaces while Trello's API calls them Organizations. |
| Workspace boards, members, and activity | 🟡 Partially supported | `workspace_boards`, `workspace_members`, `workspace_actions`, `search` | Membership record reads, admin/member mutation, invitations, exports, preferences, tags, paid-account/admin endpoints, and plugin-related organization endpoints are not exposed. | Current coverage is for discovery, lookup, and audit, not workspace administration or permission-record inspection. |

### API Group: Tokens

| Endpoint family | Status | MCP tools | Unsupported or deferred details | Notes |
| --- | --- | --- | --- | --- |
| Credential diagnostics | 🟡 Partially supported | `auth_whoami`, `auth_token_info` | The token-member relationship read `GET /tokens/{token}/member` is not exposed. | Helps verify which user and token metadata the server is using without exposing secrets, without adding token-scoped relationship helpers. |
| Token lifecycle and OAuth | 🚫 Not planned | None. | Token creation, revocation, OAuth grant flows, and token-owned webhook management are not exposed. | The server consumes one configured API key and token rather than managing credentials. |

## Non-goals

- This project does not aim to be a complete Trello REST API proxy.
- It does not manage Trello API keys, OAuth grants, or token lifecycle beyond safe diagnostics for the configured token.
- It does not currently target enterprise administration, Power-Up administration, or broad workspace/admin mutation workflows.
- It avoids large destructive or bulk mutations until they have explicit issue scope, safety behavior, and tests.

## Maintenance Notes

- When public MCP tools are added, removed, renamed, or their key inputs change, run `corepack pnpm docs:tools` and update this matrix when the API group coverage changes.
- When rechecking the official Trello REST reference, update the source snapshot date and route prefix if Atlassian changes the published route shape or introduces a new named REST API version.
- Keep workspace terminology user-facing, but reference Trello's Organizations API group where a link or endpoint family uses that official name.
- Prefer "partially supported" when a group has useful workflow coverage but the project does not cover the full Trello endpoint family.
