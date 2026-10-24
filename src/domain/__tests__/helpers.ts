import {
  AvailabilityStatus,
  Category,
  Port,
  PublicResource,
  Request,
  RequestStatus,
  Resource,
  ResourceCondition,
  ResourceType,
} from "../types";

const NOW_ISO = "2026-10-23T12:00:00.000Z";

export function makeResource(overrides: Partial<PublicResource> = {}): PublicResource {
  const base: PublicResource = {
    id: overrides.id ?? "res-1",
    communityId: "campus-demo",
    ownerId: "user-owner",
    ownerDisplayName: "Priya",
    title: "USB-C to HDMI adapter",
    description: "Connects a USB-C laptop to an HDMI display.",
    resourceType: ResourceType.ITEM,
    category: Category.ELECTRONICS_ADAPTERS,
    tags: ["adapter", "usb-c", "hdmi"],
    condition: ResourceCondition.GOOD,
    location: { label: "Student Union", zone: "Central", lat: 40.0, lng: -83.0 },
    availabilityStatus: AvailabilityStatus.AVAILABLE,
    availabilityWindows: [],
    exclusive: true,
    lendingRules: "Return within 2 hours.",
    imageRef: undefined,
    compatibility: {
      sourcePorts: [Port.USB_C],
      sinkPorts: [Port.HDMI],
      attributes: [],
    },
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
  return { ...base, ...overrides };
}

export function makeFullResource(overrides: Partial<Resource> = {}): Resource {
  const pub = makeResource(overrides as Partial<PublicResource>);
  const { ownerDisplayName: _ownerDisplayName, ...rest } = pub;
  void _ownerDisplayName;
  return {
    ...rest,
    pickupInstructions: overrides.pickupInstructions ?? "Desk 2B, ask for Priya.",
  };
}

export function makeRequest(overrides: Partial<Request> = {}): Request {
  const base: Request = {
    id: "req-1",
    communityId: "campus-demo",
    resourceId: "res-1",
    resourceOwnerId: "user-owner",
    requesterId: "user-borrower",
    status: RequestStatus.PENDING,
    requestedTime: NOW_ISO,
    pickupContext: "At the union entrance",
    message: "Thanks!",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
  return { ...base, ...overrides };
}

export const FIXED_NOW = new Date(NOW_ISO);
