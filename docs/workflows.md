# Trello Workflows

Use these patterns to turn a broad request into a small, reviewable sequence of
Trello tool calls. They deliberately separate discovery from mutation so the
MCP client can show what it found, propose the exact change, and verify Trello's
result afterward.

> **Client approval is not a server guarantee.** `trello-mcp` executes a valid
> write tool call when it receives one. Proposal and approval happen in the MCP
> client before the call; the server does not add a universal preview,
> transaction, rollback, or `confirm` input around mutations.

The examples assume that `trello-mcp` is already connected. Follow
[Set up your MCP client](client-setup.md) first if the tools are not visible, or
[Trello API key](trello-api-key.md) if the credentials are not configured.

## The five-stage pattern

Apply the same sequence to every workflow:

1. **Discover.** Resolve board, list, card, member, label, custom-field, and
   attachment identifiers with a narrow discovery call. If the prompt includes
   a Trello URL, use it only where the selected tool documents URL support;
   otherwise extract the supported ID or short link and verify the resource.
   Never guess an identifier from a display name.
2. **Inspect.** Read the current Trello state needed to make the decision. Keep
   large board, card, and action responses bounded with fields, filters, dates,
   and limits.
3. **Propose.** State the exact tool, target, inputs, and expected effect. Call
   out whether the change is reversible.
4. **Approve.** Obtain explicit user agreement before a write, especially when
   a prompt is ambiguous or the operation deletes data. An MCP client may show
   its own tool-approval dialog, but that behavior belongs to the client and is
   not enforced by `trello-mcp`.
5. **Verify.** Read the affected resource from Trello again. Treat the mutation
   response as useful evidence, not as a substitute for checking the resulting
   board state.

## Summarize a board without changing it

Example prompt:

> Summarize what is active on my Product Roadmap board, grouped by list. Include
> due dates and assigned members, but do not change anything.

1. **Discover:** use `list_boards` when the prompt does not identify one board.
   If it includes a board URL, extract the board short link before calling a
   board tool; board tools do not accept a literal full URL. Present duplicate
   or similar board names instead of selecting one silently.
2. **Inspect:** call `board_get` and `board_lists`, then use `board_cards` for a
   bounded board-wide view or `list_cards` for selected lists. Add
   `board_actions` only when recent activity is part of the question. Request
   only the fields and time range needed for the summary.
3. **Propose:** state the selected board, whether archived cards are excluded,
   the lists and date window covered, and any response limit that could make the
   summary incomplete.
4. **Approve:** no mutation approval is required for these read-only tools, but
   resolve an ambiguous board or unexpectedly broad scope with the user before
   continuing.
5. **Verify:** base totals and conclusions on the returned collections. Report
   filters, pagination, or inaccessible resources rather than presenting a
   partial response as a complete board inventory.

A safe minimal sequence is:

```text
list_boards -> board_get -> board_lists -> board_cards -> summary
```

## Create and organize a card

Example prompt:

> Create a card called "Prepare launch notes" in the To do list, assign Maya,
> add the Launch label, and create a three-item review checklist.

1. **Discover:** resolve the board with `list_boards`, its destination list with
   `board_lists`, the assignee with `board_members`, and the existing label with
   `board_labels`. If the prompt provides a board or list ID, still resolve its
   current name before proposing the write.
2. **Inspect:** use `list_get` for the destination and inspect member and label
   IDs. Search or list nearby cards if duplicate creation would be harmful.
3. **Propose:** show the exact `card_create` inputs: destination list, title,
   description, due date, position, member IDs, and label IDs. Separately list
   the checklist and checklist-item calls that will follow. Creating a new board
   label with `card_label_create_and_add` is an additional persistent change and
   should be proposed explicitly rather than substituted for a missing label.
4. **Approve:** ask the user to approve the destination and complete change set.
   Then call `card_create`, followed by `card_checklist_create` and the required
   `card_checklist_item_create` calls.
5. **Verify:** read the returned card with `card_get`, then use `card_list`,
   `card_members`, `card_labels`, `card_checklists`, and
   `card_checklist_items` as needed to confirm its placement and organization.

The core sequence is:

```text
list_boards -> board_lists -> board_members + board_labels
            -> propose card_create
            -> card_create -> checklist calls
            -> card_get + relationship reads
```

Prefer passing known member and label IDs to `card_create`; this creates the
card and its initial assignments in one Trello request. Use the focused member,
label, due-date, position, and checklist tools for later changes.

## Move or archive completed work

Example prompt:

> Move this card to Done and archive it after you confirm the target.

1. **Discover:** accept a card ID, short link, or Trello card URL. Use
   `card_board` and `board_lists` to resolve the destination list rather than
   assuming that every board has a unique list named Done.
2. **Inspect:** call `card_get` and `card_list` to capture the current title,
   archive state, and list. For a cross-board move, inspect the destination board
   and list and confirm that the configured Trello member can access both.
3. **Propose:** distinguish among `card_position_set` for reordering in the
   current list, `card_move` for changing list or board, and `card_archive` for
   setting the recoverable archive state. If both move and archive are intended,
   show their order.
4. **Approve:** obtain agreement on the card, destination, position, and archive
   state before calling either mutation.
5. **Verify:** use `card_get`, `card_list`, and, for a cross-board move,
   `card_board` to confirm the new location and `closed` state.

Archive with `card_archive` when the goal is reversible removal. `card_delete`
permanently deletes a Trello card and should be called only after the user has
explicitly requested deletion of the identified card. The server does not turn
"remove," "clean up," or "finish" into an automatic delete confirmation.

## Review activity before adding a comment

Example prompt:

> Review the latest activity on this card and, if the status is still blocked,
> post this update: "Waiting for legal review."

1. **Discover:** resolve the card from its ID or URL. Use `search` only when the
   card itself is unknown, and confirm a unique result before continuing.
2. **Inspect:** call `card_get`, then `card_actions` with a bounded limit and a
   suitable filter or date window. Use `board_actions` or `list_actions` only
   when the decision genuinely depends on wider context.
3. **Propose:** summarize the activity that supports the recommendation and show
   the exact comment text. Do not infer a current status from an action history
   that was truncated or filtered too narrowly.
4. **Approve:** adding a comment is a persistent, visible write. Ask for approval
   of the final wording and target card before calling `card_comment_add`.
5. **Verify:** use the returned comment action ID and a fresh `card_actions` read
   to confirm that the comment appears on the intended card.

Use `card_comment_update` only with the action ID of the comment to edit.
`card_comment_delete` removes that comment and has no server-side undo, so it
requires an explicit deletion request rather than an inferred cleanup step.

## Set or clear a custom field

Example prompt:

> Set the Priority custom field on this card to High.

1. **Discover:** use `card_board` to resolve the board, then
   `board_custom_fields` to find the field definition. For a dropdown/list
   field, call `custom_field_options` and resolve the option ID from Trello.
2. **Inspect:** call `card_custom_field_items` to see the value currently stored
   on the card. Use `custom_field_get` when the field type or definition remains
   unclear.
3. **Propose:** identify the field and current value, then show the typed
   `card_custom_field_set` value. Text uses `text`, number values are sent as
   strings, dates use an ISO-8601 timestamp, checkboxes use `checked`, and list
   fields use an `optionId` returned by Trello.
4. **Approve:** confirm the replacement value or an intentional clear. Call
   `card_custom_field_set` to write a value or `card_custom_field_clear` to
   remove the existing value.
5. **Verify:** call `card_custom_field_items` again and match the returned field
   ID and typed value to the proposal.

Custom field names and dropdown labels are not stable identifiers. Always use
the field and option IDs returned for the card's current board.

## Attach a URL or a server-local file

Example prompts:

> Attach https://example.com/launch-brief to this card as "Launch brief."

> Upload `review.pdf` from the server's approved upload directory to this card.

1. **Discover:** resolve the card and call `card_attachments` to identify
   existing attachments and avoid an unintended duplicate.
2. **Inspect:** for a URL, validate the final public URL and display name. For a
   local upload, confirm that the file exists on the **server host** inside
   `TRELLO_ATTACHMENT_UPLOAD_ROOT`. With Docker, the path must exist inside the
   container through an explicit mount and the environment variable must name
   that container directory.
3. **Propose:** show the card, URL or server-side path, display name, MIME type
   when supplied, and whether the attachment should become the card cover.
   Explain that `card_attachment_add_url` stores a link while
   `card_attachment_upload` reads and uploads a file from the server.
4. **Approve:** obtain approval before adding the attachment or changing the
   cover. Then call `card_attachment_add_url` or `card_attachment_upload`.
5. **Verify:** call `card_attachments`, and optionally `card_attachment_get`, to
   confirm the returned attachment ID, name, URL, and cover state.

An MCP client does not send arbitrary local file bytes through
`card_attachment_upload`. Relative paths resolve within the configured upload
root; absolute paths must still resolve inside it, and the server rejects paths
that escape through `..` or symlinks. Local uploads remain disabled when the
root is unset. `card_attachment_delete` removes an attachment from the card and
should be reserved for an explicit request naming the attachment.

> **Keep the safety boundary visible.** Treat each workflow as a sequence of
> scoped calls across a shared Trello account.
>
> - Trello permissions determine which reads and writes succeed. Run
>   `auth_whoami` and `auth_token_info` when the authenticated account or token
>   scope is uncertain.
> - Prefer a fresh read immediately before and after a write. Another member or
>   automation can change the same board between calls.
> - Prefer archive tools for recoverable cleanup. Card, label, checklist,
>   checklist-item, comment, and attachment deletion tools do not provide a
>   server-side undo.
> - Keep searches, card collections, and action histories narrow. Pagination or
>   a response-size limit is part of the result and should be disclosed.
> - Never paste Trello credentials or an HTTP bearer token into a workflow
>   prompt. They belong in the server or client environment described in
>   [Set up your MCP client](client-setup.md).
> - Review the [API Coverage](api-coverage.md) page when a prompt assumes a
>   Trello capability that may not be exposed as a tool.
