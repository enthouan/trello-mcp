---
title: "Tools"
description: "Search the 77 MCP tools generated from the registered trello-mcp tool surface."
---

The server exposes **77 MCP tools**. This catalog shares its names, descriptions, and key inputs with the README and is generated directly from `allTools`.

## Tool catalog

| Name | When to use | Key inputs |
| --- | --- | --- |
| `auth_whoami` | Use as a read-only credential diagnostic to confirm which Trello member the configured API key and token authenticate as. | fields |
| `auth_token_info` | Use as a read-only credential diagnostic to inspect the configured Trello token's owner, expiration, and permissions; it does not create, refresh, revoke, or manage tokens. | fields |
| `list_boards` | Use first when the user has not provided a board, list, card id, or Trello URL; returns boards visible to the authenticated Trello member. | filter, fields |
| `board_create` | Use when creating a new Trello board. Creates boards as private by default, can place them in a workspace with workspaceId, and only supports explicit private, workspace, or public visibility. | name, desc, workspaceId, permissionLevel |
| `board_get` | Use when you need board details, common board preferences, or label names for a known Trello board before listing or summarizing it. | boardId, fields |
| `board_field_get` | Use when you need one specific board field, such as prefs, labelNames, subscribed, name, description, or URL. | boardId, field |
| `board_actions` | Use when auditing recent activity or comments across a board; use filter, limit, page, since, before, and fields to keep large histories bounded. | boardId, filter, fields, limit, since, before, page, member, memberFields, memberCreator, memberCreatorFields |
| `board_lists` | Use when you need the lists on a known Trello board so you can find the right list id before listing or creating cards. | boardId, filter, fields |
| `board_cards` | Use when you need cards across all lists on a known Trello board for personal planning, review, or summarization. | boardId, filter, fields, limit, since, before |
| `board_custom_fields` | Use when inspecting custom field definitions on a known Trello board, including dropdown/list options when Trello returns them. | boardId |
| `board_labels` | Use when discovering labels available on a board before creating or updating cards with labels. | boardId, limit, fields |
| `board_members` | Use when you need the members who can access a known Trello board before assigning cards or reviewing collaboration; requires token visibility of private boards. | boardId, fields |
| `board_memberships` | Use when you need board membership records, member roles, or permission context for a known Trello board; use the admins filter when checking board-admin-only operations. | boardId, filter, member, memberFields |
| `list_workspaces` | Use first when the user asks to show Trello workspaces or needs to choose a workspace before drilling into its boards or members. | filter, fields, paidAccount |
| `workspace_get` | Use when you need basic Trello workspace metadata, such as display name, description, URL, website, board ids, or preferences. | workspaceId, fields |
| `workspace_boards` | Use when you need boards in a known Trello workspace so the user can drill into a workspace board. | workspaceId, filter, fields |
| `workspace_members` | Use when you need members in a known Trello workspace before assignment, auditing, or permission review. | workspaceId, filter, fields |
| `workspace_actions` | Use when auditing recent activity or comments across a Trello workspace; use filter, limit, page, since, before, and fields to keep large histories bounded. | workspaceId, filter, fields, limit, since, before, page, member, memberFields, memberCreator, memberCreatorFields |
| `member_get` | Use after member search or board member listing to inspect a Trello member profile by id, username, or me before assignment or auditing. | memberId, fields |
| `member_boards` | Use when you need boards associated with a known Trello member by id, username, or me; results are limited to boards visible to the configured token. | memberId, filter, fields |
| `member_cards` | Use when you need cards assigned to a known Trello member by id, username, or me; private board cards require token access to those boards. | memberId, filter, fields, limit, since, before |
| `member_workspaces` | Use when you need Trello workspaces associated with a known member by id, username, or me; workspace visibility and role permissions constrain results. | memberId, filter, fields, paidAccount |
| `list_get` | Use when you need metadata for a known Trello list before creating cards in it or changing it. | listId, fields |
| `list_create` | Use when creating a new Trello list on an existing board. | boardId, name, pos |
| `list_update` | Use when renaming a Trello list, changing its position, or setting its archive state. | listId, name, closed, pos |
| `list_archive` | Use when archiving or unarchiving a Trello list while keeping its cards recoverable. | listId, closed |
| `list_move_to_board` | Use when moving an existing Trello list to another board. | listId, boardId |
| `list_actions` | Use when auditing recent activity or comments for a list; use filter, limit, page, since, before, and fields to keep large histories bounded. | listId, filter, fields, limit, since, before, page, member, memberFields, memberCreator, memberCreatorFields |
| `card_get` | Use when you need the current details of one Trello card by id, short id, or URL before editing or summarizing it. | cardId, fields |
| `card_board` | Use when you need the board relationship for a known Trello card before moving, labeling, or summarizing its context. | cardId, fields |
| `card_list` | Use when you need the current list relationship for a known Trello card before moving or reporting its status. | cardId, fields |
| `card_labels` | Use when listing the labels currently applied to a card, including label ids for add/remove workflows. | cardId |
| `list_cards` | Use when you need cards in a specific Trello list; use limit, since, before, and fields to keep large lists small. | listId, filter, fields, limit, since, before |
| `card_create` | Use when the user asks to create a new Trello card in a known list; accepts title, description, due date, members, and labels. | listId, name, desc, due, pos, memberIds, labelIds |
| `card_update` | Use when changing card metadata such as title, description, due date, due completion, or archive state without moving it. | cardId, name, desc, due, dueComplete, closed |
| `card_due_date_set` | Use when setting, clearing, or marking completion of a card due date without changing other card metadata. Provide at least one of due or dueComplete. | cardId, due, dueComplete |
| `card_position_set` | Use when changing only a card's position within its current list; use card_move when changing lists or boards too. | cardId, pos |
| `card_cover_set` | Use when setting a card cover to an existing attachment id, changing cover display size, or clearing the current attachment cover. | cardId, attachmentId, size, brightness |
| `card_label_create_and_add` | Use when creating a new label on the card's board and applying it to the card in one Trello operation. | cardId, name, color |
| `card_delete` | Use only when the user explicitly asks to permanently delete a Trello card; archive instead for reversible removal. | cardId |
| `card_move` | Use when moving a card to another list, another board, or a different position; this is distinct from general card metadata updates. | cardId, listId, boardId, pos |
| `card_archive` | Use when the user wants to archive or unarchive a card while keeping it recoverable; do not use for permanent deletion. | cardId, closed |
| `card_attachments` | Use when listing files or links attached to a card, optionally narrowed by Trello attachment fields or filter. | cardId, fields, filter |
| `card_attachment_get` | Use when inspecting one existing card attachment by attachment id, including upload metadata when Trello returns it. | cardId, fields, attachmentId |
| `card_attachment_add_url` | Use when attaching an existing public URL to a card; this does not upload local files. | cardId, url, name, setCover |
| `card_attachment_upload` | Use when uploading a server-local file to a card. Requires TRELLO_ATTACHMENT_UPLOAD_ROOT and only reads files inside that directory. | cardId, filePath, name, mimeType, setCover |
| `card_attachment_delete` | Use when removing a specific attachment from a card by attachment id. | cardId, attachmentId |
| `card_checklists` | Use when viewing all checklists and checklist items currently on a card. | cardId |
| `card_checklist_create` | Use when adding a new checklist to an existing card, optionally copied from another checklist. | cardId, name, sourceChecklistId |
| `card_checklist_update` | Use when renaming a Trello card checklist or changing the checklist's position on its card. | checklistId, name, pos |
| `card_checklist_delete` | Use when deleting an entire checklist from a Trello card. | cardId, checklistId |
| `card_checklist_item_create` | Use when adding a new item to an existing Trello checklist on a card. | checklistId, name, pos, checked, due, dueReminder, memberId |
| `card_checklist_items` | Use when listing the items in one Trello checklist, including complete and incomplete items by default. | checklistId, filter, fields |
| `card_checklist_item_update` | Use when editing a Trello card checklist item text, due date, member assignment, completion state, checklist, or position. | cardId, checkItemId, name, state, checklistId, pos, due, dueReminder, memberId |
| `card_checklist_item_set_checked` | Use when checking or unchecking a Trello card checklist item without changing other item fields. | cardId, checkItemId, checked |
| `card_checklist_item_move` | Use when moving a Trello checklist item to another checklist on the same card or to a different position. | cardId, checkItemId, checklistId, pos |
| `card_checklist_item_delete` | Use when deleting a checklist item from a Trello card checklist. | cardId, checkItemId |
| `card_custom_field_items` | Use when reading all custom field item values currently set on a Trello card. | cardId |
| `card_custom_field_set` | Use when setting or updating one Trello card custom field value. Use type-specific inputs: text, number string, ISO date, checkbox boolean, or list optionId. | cardId, customFieldId, type, text, number, date, checked, optionId |
| `card_custom_field_clear` | Use when clearing one Trello card custom field value; Trello clears custom field items with an empty PUT body shape rather than DELETE. | cardId, customFieldId |
| `card_members` | Use when listing members assigned to a card; requires token access to the card's board. Use fields to keep member output small. | cardId, fields |
| `card_member_add` | Use when assigning a Trello member to a card by member id; requires write access to the card's board and a member who can be assigned to that board. | cardId, memberId |
| `card_member_remove` | Use when unassigning a Trello member from a card by member id; requires write access to the card's board. | cardId, memberId |
| `card_comment_add` | Use when adding a new comment to a Trello card; returns the created comment action. | cardId, text |
| `card_comment_update` | Use when editing the text of an existing Trello card comment by its comment action id. | actionId, text |
| `card_comment_delete` | Use when deleting an existing Trello card comment by its comment action id. | actionId |
| `card_actions` | Use when auditing recent activity or comments for a card; use filter, limit, page, since, before, and fields to page large histories. | cardId, filter, fields, limit, since, before, page, member, memberFields, memberCreator, memberCreatorFields |
| `label_get` | Use when you need the current name, color, or board for a specific Trello label before editing it. | labelId |
| `label_create` | Use when creating a new reusable label on a Trello board before applying it to cards. | boardId, name, color |
| `label_update` | Use when renaming a Trello label or changing its color without changing any card assignments. | labelId, name, color |
| `label_delete` | Use only when the user explicitly asks to permanently delete a board label from Trello. | labelId |
| `card_label_add` | Use when applying an existing Trello label to a card by label id. | cardId, labelId |
| `card_label_remove` | Use when removing an existing Trello label from a card by label id. | cardId, labelId |
| `custom_field_get` | Use when you need one Trello custom field definition by id, including its type and any dropdown/list options Trello returns. | customFieldId |
| `custom_field_options` | Use when listing the available options for a Trello dropdown/list custom field before setting a card list custom field value. | customFieldId |
| `search` | Use when you need to find Trello cards, boards, members, or workspaces by natural language search terms. | query, modelTypes, boardIds, organizationIds, cardIds, cardFields, boardFields, memberFields, organizationFields, cardsLimit, boardsLimit, membersLimit, organizationsLimit, cardsPage, partial, includeCardBoard, includeCardList, includeCardMembers, includeBoardOrganization |
| `search_members` | Use when looking up Trello members by name or username, optionally scoped to a board or workspace; scoped searches require token access to that board or workspace. | query, limit, boardId, organizationId, onlyOrgMembers |

For supported and deferred Trello REST endpoint families, see [API coverage](/tools/api-coverage/).
