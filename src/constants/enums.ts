export const ROLE_TYPES = ["family member", "friend", "neighbor", "pastor", "other"] as const
export type RoleType = (typeof ROLE_TYPES)[number]

export const EVENT_TYPES = ["life", "memory", "historical"] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const RELATIONSHIP_TYPES = ["parent-child", "spouse"] as const
export const RELATIONSHIP_SUBTYPES = ["biological", "adoptive", "step", "foster", "other"] as const
export const MARRIAGE_STATUSES = ["married", "divorced", "separated", "widowed", "partner"] as const
