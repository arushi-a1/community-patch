/**
 * Request-body validation schemas for the API boundary (SR §3). Strict,
 * bounded, and the single source of truth for accepted input shapes.
 */
import { z } from "zod";
import {
  Category,
  Port,
  ResourceCondition,
  ResourceType,
  AvailabilityStatus,
} from "@/domain/types";
import { INPUT_LIMITS } from "@/domain/config";

const locationInput = z.object({
  label: z.string().min(1).max(120),
  zone: z.string().min(1).max(60),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const compatibilityInput = z
  .object({
    sourcePorts: z.array(z.nativeEnum(Port)).max(10).default([]),
    sinkPorts: z.array(z.nativeEnum(Port)).max(10).default([]),
    attributes: z.array(z.string().max(60)).max(16).default([]),
    notes: z.string().max(400).optional(),
  })
  .default({ sourcePorts: [], sinkPorts: [], attributes: [] });

export const createResourceSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).default(""),
  resourceType: z.nativeEnum(ResourceType),
  category: z.nativeEnum(Category),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  condition: z.nativeEnum(ResourceCondition).default(ResourceCondition.GOOD),
  location: locationInput,
  exclusive: z.boolean().default(true),
  lendingRules: z.string().max(500).default(""),
  pickupInstructions: z.string().max(500).default(""),
  imageRef: z.string().max(300).optional(),
  compatibility: compatibilityInput,
  availabilityWindows: z
    .array(z.object({ start: z.string().datetime(), end: z.string().datetime() }))
    .max(10)
    .default([]),
});
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = z
  .object({
    title: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    condition: z.nativeEnum(ResourceCondition).optional(),
    location: locationInput.optional(),
    availabilityStatus: z.nativeEnum(AvailabilityStatus).optional(),
    lendingRules: z.string().max(500).optional(),
    pickupInstructions: z.string().max(500).optional(),
    imageRef: z.string().max(300).optional(),
    compatibility: compatibilityInput.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const analyzeSchema = z.object({
  text: z.string().min(1).max(INPUT_LIMITS.problemText),
  locationHint: z.string().max(120).optional(),
  radiusKm: z.number().min(0.1).max(50).optional(),
  requesterLat: z.number().min(-90).max(90).optional(),
  requesterLng: z.number().min(-180).max(180).optional(),
  requesterZone: z.string().max(60).optional(),
});
export type AnalyzeInput = z.infer<typeof analyzeSchema>;

export const matchSchema = z.object({
  interpretation: z.unknown(), // re-validated by validateInterpretation downstream
  radiusKm: z.number().min(0.1).max(50).optional(),
  requesterLat: z.number().min(-90).max(90).optional(),
  requesterLng: z.number().min(-180).max(180).optional(),
  requesterZone: z.string().max(60).optional(),
});

export const createRequestSchema = z.object({
  resourceId: z.string().min(1),
  requestedTime: z.string().datetime().optional(),
  pickupContext: z.string().max(INPUT_LIMITS.pickupContext).default(""),
  message: z.string().max(INPUT_LIMITS.message).default(""),
});
export type CreateRequestBody = z.infer<typeof createRequestSchema>;

const locationInputOptional = z
  .object({
    label: z.string().min(1).max(120),
    zone: z.string().min(1).max(60),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .optional();

export const createCommunityRequestSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1000).default(""),
  category: z.nativeEnum(Category),
  quantity: z.number().int().min(1).max(100).default(1),
  urgency: z.enum(["CRITICAL", "SOON", "FLEXIBLE"]).default("FLEXIBLE"),
  deadline: z.string().datetime().optional(),
  location: locationInputOptional,
});

export const createOfferSchema = z.object({
  message: z.string().max(600).default(""),
  resourceId: z.string().max(80).optional(),
});
