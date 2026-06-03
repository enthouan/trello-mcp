import { z } from "zod";

export const TrelloIdSchema = z.string().min(1);

export const TrelloMemberSchema = z.object({
  id: TrelloIdSchema,
  username: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  initials: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const TrelloBoardSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  desc: z.string().optional(),
  closed: z.boolean().optional(),
  idOrganization: TrelloIdSchema.nullable().optional(),
  url: z.string().url().optional(),
  shortUrl: z.string().url().optional(),
  dateLastActivity: z.string().nullable().optional(),
});

export const TrelloListSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  closed: z.boolean().optional(),
  idBoard: TrelloIdSchema.optional(),
  pos: z.union([z.number(), z.string()]).optional(),
});

export const TrelloAttachmentSchema = z.object({
  id: TrelloIdSchema,
  name: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  bytes: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
});

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
]);

export const TrelloLabelSchema = z.object({
  id: TrelloIdSchema,
  idBoard: TrelloIdSchema.optional(),
  name: z.string().nullable().optional(),
  color: TrelloLabelColorSchema.nullable().optional(),
  uses: z.number().optional(),
});

export const TrelloActionSchema = z.object({
  id: TrelloIdSchema,
  type: z.string(),
  date: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  memberCreator: TrelloMemberSchema.optional(),
});

export const TrelloChecklistItemSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  state: z.enum(["complete", "incomplete"]).optional(),
  pos: z.number().optional(),
});

export const TrelloChecklistSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  idBoard: TrelloIdSchema.optional(),
  idCard: TrelloIdSchema.optional(),
  pos: z.number().optional(),
  checkItems: z.array(TrelloChecklistItemSchema).optional(),
});

export const TrelloCardSchema = z.object({
  id: TrelloIdSchema,
  name: z.string(),
  desc: z.string().optional(),
  closed: z.boolean().optional(),
  idBoard: TrelloIdSchema.optional(),
  idList: TrelloIdSchema.optional(),
  idMembers: z.array(TrelloIdSchema).optional(),
  idLabels: z.array(TrelloIdSchema).optional(),
  url: z.string().url().optional(),
  shortUrl: z.string().url().optional(),
  due: z.string().nullable().optional(),
  dueComplete: z.boolean().optional(),
  pos: z.union([z.number(), z.string()]).optional(),
  dateLastActivity: z.string().nullable().optional(),
});

export const TrelloCardListSchema = z.array(TrelloCardSchema);
export const TrelloBoardListSchema = z.array(TrelloBoardSchema);
export const TrelloListListSchema = z.array(TrelloListSchema);
export const TrelloMemberListSchema = z.array(TrelloMemberSchema);
export const TrelloLabelListSchema = z.array(TrelloLabelSchema);
export const TrelloAttachmentListSchema = z.array(TrelloAttachmentSchema);
export const TrelloChecklistListSchema = z.array(TrelloChecklistSchema);
export const TrelloActionListSchema = z.array(TrelloActionSchema);
export const DeleteResponseSchema = z
  .object({ _value: z.union([z.string(), z.null()]).optional() })
  .passthrough();
