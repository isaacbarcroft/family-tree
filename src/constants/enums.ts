export const ROLE_TYPES = ["member", "friend", "neighbor", "pastor", "other"] as const
export type RoleType = (typeof ROLE_TYPES)[number]

export const EVENT_TYPES = ["life", "memory", "historical"] as const
export type EventType = (typeof EVENT_TYPES)[number]
