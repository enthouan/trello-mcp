import { z } from "zod";

export const TrelloIdSchema = z.string().min(1);

export const TrelloMemberSchema = z
  .object({
    id: TrelloIdSchema,
    username: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
    initials: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  })
  .passthrough();

export const TrelloTokenPermissionSchema = z
  .object({
    idModel: TrelloIdSchema.optional(),
    modelType: z.string().optional(),
    read: z.boolean().optional(),
    write: z.boolean().optional(),
  })
  .passthrough();

export const TrelloTokenSchema = z.object({
  id: TrelloIdSchema,
  identifier: z.string().nullable().optional(),
  idMember: TrelloIdSchema,
  dateCreated: z.string().nullable().optional(),
  dateExpires: z.string().nullable().optional(),
  permissions: z.array(TrelloTokenPermissionSchema).optional(),
});

export const TrelloSearchMemberSchema = z.object({
  id: TrelloIdSchema,
  username: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  initials: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  url: z.string().url().optional(),
});

export const TrelloOrganizationSchema = z
  .object({
    id: TrelloIdSchema,
    name: z.string().optional(),
    displayName: z.string().optional(),
    desc: z.string().optional(),
    dateLastActivity: z.string().nullable().optional(),
    idBoards: z.array(TrelloIdSchema).optional(),
    url: z.string().url().optional(),
    website: z.string().nullable().optional(),
    prefs: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const TrelloBoardPreferencesSchema = z
  .object({
    permissionLevel: z.string().optional(),
    hideVotes: z.boolean().optional(),
    voting: z.string().optional(),
    comments: z.string().optional(),
    invitations: z.string().optional(),
    selfJoin: z.boolean().optional(),
    cardCovers: z.boolean().optional(),
    isTemplate: z.boolean().optional(),
    cardAging: z.string().optional(),
    calendarFeedEnabled: z.boolean().optional(),
    background: z.string().nullable().optional(),
    backgroundImage: z.string().nullable().optional(),
    backgroundTile: z.boolean().optional(),
    backgroundBrightness: z.string().optional(),
    backgroundBottomColor: z.string().nullable().optional(),
    backgroundTopColor: z.string().nullable().optional(),
    canBePublic: z.boolean().optional(),
    canBeEnterprise: z.boolean().optional(),
    canBeOrg: z.boolean().optional(),
    canBePrivate: z.boolean().optional(),
    canInvite: z.boolean().optional(),
  })
  .passthrough();

export const TrelloBoardLabelNamesSchema = z
  .object({
    green: z.string().optional(),
    yellow: z.string().optional(),
    orange: z.string().optional(),
    red: z.string().optional(),
    purple: z.string().optional(),
    blue: z.string().optional(),
    sky: z.string().optional(),
    lime: z.string().optional(),
    pink: z.string().optional(),
    black: z.string().optional(),
  })
  .passthrough();

export const TrelloBoardSchema = z
  .object({
    id: TrelloIdSchema,
    name: z.string(),
    desc: z.string().optional(),
    closed: z.boolean().optional(),
    idOrganization: TrelloIdSchema.nullable().optional(),
    url: z.string().url().optional(),
    shortUrl: z.string().url().optional(),
    dateLastActivity: z.string().nullable().optional(),
    prefs: TrelloBoardPreferencesSchema.optional(),
    labelNames: TrelloBoardLabelNamesSchema.optional(),
    subscribed: z.boolean().optional(),
  })
  .passthrough();

export const TrelloListSchema = z
  .object({
    id: TrelloIdSchema,
    name: z.string(),
    closed: z.boolean().optional(),
    idBoard: TrelloIdSchema.optional(),
    pos: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export const TrelloAttachmentSchema = z
  .object({
    id: TrelloIdSchema,
    name: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    bytes: z.union([z.number(), z.string()]).nullable().optional(),
    date: z.string().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    edgeColor: z.string().nullable().optional(),
    idMember: TrelloIdSchema.nullable().optional(),
    isUpload: z.boolean().optional(),
    pos: z.union([z.number(), z.string()]).optional(),
    previews: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const TrelloAttachmentResponseSchema = z.preprocess(
  (value) => (Array.isArray(value) && value.length === 1 ? value[0] : value),
  TrelloAttachmentSchema,
);

export const TrelloLabelColorSchema = z.enum([
  "yellow",
  "purple",
  "blue",
  "red",
  "green",
  "orange",
  "black",
  "sky",
  "pink",
  "lime",
  "yellow_dark",
  "purple_dark",
  "blue_dark",
  "red_dark",
  "green_dark",
  "orange_dark",
  "black_dark",
  "sky_dark",
  "pink_dark",
  "lime_dark",
  "yellow_light",
  "purple_light",
  "blue_light",
  "red_light",
  "green_light",
  "orange_light",
  "black_light",
  "sky_light",
  "pink_light",
  "lime_light",
]);

export const TrelloLabelSchema = z.object({
  id: TrelloIdSchema,
  idBoard: TrelloIdSchema.optional(),
  name: z.string().nullable().optional(),
  color: TrelloLabelColorSchema.nullable().optional(),
  uses: z.number().optional(),
});

export const TrelloCoverSchema = z
  .object({
    color: TrelloLabelColorSchema.nullable().optional(),
    idAttachment: TrelloIdSchema.nullable().optional(),
    idUploadedBackground: z
      .union([TrelloIdSchema, z.boolean()])
      .nullable()
      .optional(),
    size: z.string().nullable().optional(),
    brightness: z.string().nullable().optional(),
    isTemplate: z.boolean().optional(),
  })
  .passthrough();

export const TrelloActionSchema = z
  .object({
    id: TrelloIdSchema,
    type: z.string(),
    date: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    idMemberCreator: TrelloIdSchema.optional(),
    member: TrelloMemberSchema.optional(),
    memberCreator: TrelloMemberSchema.optional(),
  })
  .passthrough();

export const TrelloChecklistItemStateSchema = z.enum([
  "complete",
  "incomplete",
]);

export const TrelloChecklistItemSchema = z.object({
  id: TrelloIdSchema,
  idChecklist: TrelloIdSchema.optional(),
  name: z.string(),
  state: TrelloChecklistItemStateSchema.optional(),
  pos: z.union([z.number(), z.string()]).optional(),
  due: z.string().nullable().optional(),
  dueReminder: z.number().nullable().optional(),
  idMember: TrelloIdSchema.nullable().optional(),
});

export const TrelloChecklistSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  idBoard: TrelloIdSchema.optional(),
  idCard: TrelloIdSchema.optional(),
  pos: z.union([z.number(), z.string()]).optional(),
  checkItems: z.array(TrelloChecklistItemSchema).optional(),
});

export const TrelloBoardMembershipSchema = z
  .object({
    id: TrelloIdSchema,
    idMember: TrelloIdSchema.optional(),
    memberType: z.string().optional(),
    unconfirmed: z.boolean().optional(),
    deactivated: z.boolean().optional(),
    member: TrelloMemberSchema.optional(),
  })
  .passthrough();

const TrelloCardLabelIdSchema = z.union([
  TrelloIdSchema,
  z.object({ id: TrelloIdSchema }).passthrough(),
]);

export const TrelloCardSchema = z
  .object({
    id: TrelloIdSchema,
    name: z.string(),
    desc: z.string().optional(),
    closed: z.boolean().optional(),
    idBoard: TrelloIdSchema.optional(),
    idList: TrelloIdSchema.optional(),
    idMembers: z.array(TrelloIdSchema).optional(),
    idLabels: z.array(TrelloCardLabelIdSchema).optional(),
    labels: z.array(TrelloLabelSchema).optional(),
    cover: TrelloCoverSchema.optional(),
    idAttachmentCover: TrelloIdSchema.nullable().optional(),
    url: z.string().url().optional(),
    shortUrl: z.string().url().optional(),
    due: z.string().nullable().optional(),
    dueComplete: z.boolean().optional(),
    pos: z.union([z.number(), z.string()]).optional(),
    dateLastActivity: z.string().nullable().optional(),
  })
  .passthrough();

export const TrelloCustomFieldTypeSchema = z.enum([
  "checkbox",
  "date",
  "list",
  "number",
  "text",
]);

export const TrelloCustomFieldValueSchema = z
  .object({
    checked: z.string().optional(),
    date: z.string().optional(),
    number: z.string().optional(),
    text: z.string().optional(),
  })
  .passthrough();

export const TrelloCustomFieldOptionSchema = z.preprocess(
  (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }

    const option = value as Record<string, unknown>;
    if (option.id === undefined && typeof option._id === "string") {
      const { _id, ...rest } = option;
      return { ...rest, id: _id };
    }

    return value;
  },
  z
    .object({
      id: TrelloIdSchema,
      idCustomField: TrelloIdSchema.optional(),
      value: TrelloCustomFieldValueSchema.nullable().optional(),
      color: z.string().nullable().optional(),
      pos: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough(),
);

export const TrelloCustomFieldDisplaySchema = z
  .object({
    cardFront: z.boolean().optional(),
    name: z.string().optional(),
    pos: z.union([z.number(), z.string()]).optional(),
    options: z.array(TrelloCustomFieldOptionSchema).optional(),
  })
  .passthrough();

export const TrelloCustomFieldSchema = z
  .object({
    id: TrelloIdSchema,
    idModel: TrelloIdSchema.optional(),
    modelType: z.literal("board").optional(),
    fieldGroup: z.string().optional(),
    name: z.string().optional(),
    pos: z.union([z.number(), z.string()]).optional(),
    display: TrelloCustomFieldDisplaySchema.optional(),
    options: z.array(TrelloCustomFieldOptionSchema).optional(),
    type: TrelloCustomFieldTypeSchema,
  })
  .passthrough();

export const TrelloCustomFieldItemSchema = z
  .object({
    id: TrelloIdSchema.optional(),
    idCustomField: TrelloIdSchema,
    idModel: TrelloIdSchema.optional(),
    modelType: z.literal("card").optional(),
    value: TrelloCustomFieldValueSchema.nullable().optional(),
    idValue: TrelloIdSchema.optional(),
  })
  .passthrough();

export const TrelloCardLabelsSchema = z.object({
  id: TrelloIdSchema,
  idLabels: z.array(TrelloCardLabelIdSchema).optional(),
  labels: z.array(TrelloLabelSchema).optional(),
});

function isSearchRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAnyKey(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => key in value);
}

function groupedSearchResults(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const grouped: {
    boards: unknown[];
    cards: unknown[];
    members: unknown[];
    organizations: unknown[];
  } = {
    boards: [],
    cards: [],
    members: [],
    organizations: [],
  };

  for (const item of value) {
    if (!isSearchRecord(item)) {
      continue;
    }

    if (
      hasAnyKey(item, [
        "idList",
        "idShort",
        "idAttachmentCover",
        "idMembers",
        "dueComplete",
      ])
    ) {
      grouped.cards.push(item);
    } else if (
      hasAnyKey(item, [
        "username",
        "fullName",
        "initials",
        "avatarHash",
        "avatarUrl",
      ])
    ) {
      grouped.members.push(item);
    } else if (
      hasAnyKey(item, ["displayName", "website", "idBoards", "logoHash"])
    ) {
      grouped.organizations.push(item);
    } else if (
      hasAnyKey(item, ["idOrganization", "prefs", "labelNames", "shortUrl"])
    ) {
      grouped.boards.push(item);
    }
  }

  return grouped;
}

export const TrelloCardListSchema = z.array(TrelloCardSchema);
export const TrelloCustomFieldListSchema = z.array(TrelloCustomFieldSchema);
export const TrelloCustomFieldOptionListSchema = z.array(
  TrelloCustomFieldOptionSchema,
);
export const TrelloCustomFieldItemListSchema = z.array(
  TrelloCustomFieldItemSchema,
);
export const TrelloBoardListSchema = z.array(TrelloBoardSchema);
export const TrelloListListSchema = z.array(TrelloListSchema);
export const TrelloMemberListSchema = z.array(TrelloMemberSchema);
export const TrelloSearchMemberListSchema = z.array(TrelloSearchMemberSchema);
export const TrelloOrganizationListSchema = z.array(TrelloOrganizationSchema);
export const TrelloSearchResultsSchema = z.preprocess(
  groupedSearchResults,
  z.object({
    cards: TrelloCardListSchema.default([]),
    boards: TrelloBoardListSchema.default([]),
    members: TrelloMemberListSchema.default([]),
    organizations: TrelloOrganizationListSchema.default([]),
  }),
);
export const TrelloBoardMembershipListSchema = z.array(
  TrelloBoardMembershipSchema,
);
export const TrelloLabelListSchema = z.array(TrelloLabelSchema);
export const TrelloAttachmentListSchema = z.array(TrelloAttachmentSchema);
export const TrelloChecklistListSchema = z.array(TrelloChecklistSchema);
export const TrelloChecklistItemListSchema = z.array(TrelloChecklistItemSchema);
export const TrelloActionListSchema = z.array(TrelloActionSchema);
export const DeleteResponseSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { _value: null } : value),
  z
    .object({ _value: z.union([z.string(), z.null()]).optional() })
    .passthrough(),
);
export const TrelloMutationSuccessSchema = z.unknown();
