/**
 * Deterministic demo seed data for the clearly-labeled `campus-demo` community.
 * All members and resources are FICTIONAL. Availability states are mock and do
 * NOT represent real-world availability (see product/requirements.md §12).
 *
 * The dataset is designed so the matching engine can visibly distinguish good
 * matches from superficially similar but infeasible options:
 *   - a compatible, available USB-C→HDMI adapter (the right answer),
 *   - a compatible USB-C→HDMI adapter that is already RESERVED (must not match),
 *   - an HDMI-only cable that is INCOMPATIBLE with a USB-C source,
 *   - a USB-C hub with HDMI (a valid ALTERNATIVE),
 *   - a graphing calculator flagged not-exam-permitted,
 *   - assistance offers with availability windows, etc.
 */
import {
  AvailabilityStatus,
  Category,
  CommunityRequest,
  CommunityRequestStatus,
  Conversation,
  Message,
  Notification,
  NotificationType,
  Offer,
  OfferStatus,
  PointTransaction,
  Port,
  Request,
  RequestStatus,
  Resource,
  ResourceCondition,
  ResourceType,
  User,
} from "@/domain/types";

export const DEMO_COMMUNITY_ID = "campus-demo";

// Fixed reference "now" so relative windows are deterministic across seeds.
// The seed script recomputes windows relative to the real current time so the
// demo always has fresh, plausible deadlines.
function iso(offsetMinutes: number, base: Date): string {
  return new Date(base.getTime() + offsetMinutes * 60_000).toISOString();
}

// --- Users ------------------------------------------------------------------

export const SEED_USERS: User[] = [
  { id: "user-maya", communityId: DEMO_COMMUNITY_ID, displayName: "Maya R.", email: "maya@example.edu", homeZone: "Central Campus", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: "user-priya", communityId: DEMO_COMMUNITY_ID, displayName: "Priya S.", email: "priya@example.edu", homeZone: "Central Campus", createdAt: "2026-09-01T10:00:00.000Z" },
  { id: "user-devin", communityId: DEMO_COMMUNITY_ID, displayName: "Devin K.", email: "devin@example.edu", homeZone: "North Campus", createdAt: "2026-09-02T10:00:00.000Z" },
  { id: "user-sam", communityId: DEMO_COMMUNITY_ID, displayName: "Sam T.", email: "sam@example.edu", homeZone: "West Campus", createdAt: "2026-09-02T10:00:00.000Z" },
  { id: "user-lena", communityId: DEMO_COMMUNITY_ID, displayName: "Lena M.", email: "lena@example.edu", homeZone: "U-District", createdAt: "2026-09-03T10:00:00.000Z" },
  { id: "user-omar", communityId: DEMO_COMMUNITY_ID, displayName: "Omar H.", email: "omar@example.edu", homeZone: "South Campus", createdAt: "2026-09-03T10:00:00.000Z" },
  { id: "user-iris", communityId: DEMO_COMMUNITY_ID, displayName: "Iris W.", email: "iris@example.edu", homeZone: "Central Campus", createdAt: "2026-09-04T10:00:00.000Z" },
  { id: "user-theo", communityId: DEMO_COMMUNITY_ID, displayName: "Theo B.", email: "theo@example.edu", homeZone: "North Campus", createdAt: "2026-09-04T10:00:00.000Z" },
];

export const USER_DISPLAY: Record<string, string> = Object.fromEntries(
  SEED_USERS.map((u) => [u.id, u.displayName]),
);

// --- Location catalog (coarse campus zones with coordinates) ----------------

// Real University of Washington / Seattle locations with accurate coordinates.
// Zones map to recognizable campus/neighborhood areas around UW.
const LOC = {
  union: { label: "HUB (Student Union)", zone: "Central Campus", lat: 47.6554, lng: -122.3045 },
  library: { label: "Suzzallo Library", zone: "Central Campus", lat: 47.6557, lng: -122.3079 },
  engineering: { label: "Paul Allen Center (CSE)", zone: "South Campus", lat: 47.6531, lng: -122.3057 },
  northDorm: { label: "McMahon Hall", zone: "North Campus", lat: 47.6603, lng: -122.3036 },
  westLab: { label: "Odegaard Library", zone: "West Campus", lat: 47.6565, lng: -122.3105 },
  eastQuad: { label: "The Quad", zone: "Central Campus", lat: 47.6571, lng: -122.3066 },
  southCafe: { label: "Husky Union Market", zone: "South Campus", lat: 47.6542, lng: -122.3089 },
  recCenter: { label: "IMA Recreation Center", zone: "East Campus", lat: 47.6536, lng: -122.3005 },
  artBuilding: { label: "Henry Art Gallery", zone: "West Campus", lat: 47.6586, lng: -122.3116 },
  stadium: { label: "Husky Stadium", zone: "Montlake", lat: 47.6502, lng: -122.3016 },
  ave: { label: "The Ave (University Way)", zone: "U-District", lat: 47.6615, lng: -122.3131 },
  // Genuinely far from campus (~6 km) — used to demonstrate the radius filter.
  downtown: { label: "Downtown Seattle", zone: "Downtown", lat: 47.6097, lng: -122.3331 },
} as const;

// --- Resource builder -------------------------------------------------------

type ResSeed = Omit<Resource, "createdAt" | "updatedAt"> & {
  /** Relative window offsets in minutes [startOffset, endOffset] from now. */
  windowOffsets?: Array<[number, number]>;
};

function emptyCompat() {
  return { sourcePorts: [], sinkPorts: [], attributes: [] };
}

/**
 * Resource definitions. Timestamps/windows are filled in by buildResources()
 * relative to a provided `now` so the demo stays fresh.
 */
const RESOURCE_DEFS: ResSeed[] = [
  // --- Electronics & adapters (the signature-scenario cluster) --------------
  {
    id: "res-usbc-hdmi-1", communityId: DEMO_COMMUNITY_ID, ownerId: "user-priya",
    title: "USB-C to HDMI adapter (Anker)", description: "Reliable USB-C to HDMI adapter, supports 4K@60Hz. Great for connecting a USB-C laptop to a projector or HDMI display.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["adapter", "usb-c", "hdmi", "projector", "dongle"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day. Please don't bend the connector.",
    pickupInstructions: "Student Union info desk, ask for Priya's loaner bin (tag A3).",
    compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [Port.HDMI], attributes: ["4K60"] },
  },
  {
    id: "res-usbc-hdmi-2", communityId: DEMO_COMMUNITY_ID, ownerId: "user-theo",
    title: "USB-C to HDMI adapter (reserved)", description: "USB-C to HDMI adapter. Currently promised to another borrower this afternoon.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["adapter", "usb-c", "hdmi"], condition: ResourceCondition.GOOD,
    location: LOC.library, availabilityStatus: AvailabilityStatus.RESERVED, availabilityWindows: [],
    exclusive: true, lendingRules: "Return within 2 hours.",
    pickupInstructions: "Library locker 14.",
    compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [Port.HDMI], attributes: [] },
  },
  {
    id: "res-hdmi-cable", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "HDMI to HDMI cable (2m)", description: "Standard HDMI cable. Only useful if both devices already have HDMI ports.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["cable", "hdmi"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return when done.",
    pickupInstructions: "Union desk tag H1.",
    compatibility: { sourcePorts: [Port.HDMI], sinkPorts: [Port.HDMI], attributes: [] },
  },
  {
    id: "res-usbc-hub", communityId: DEMO_COMMUNITY_ID, ownerId: "user-iris",
    title: "USB-C hub with HDMI + USB-A", description: "7-in-1 USB-C hub with an HDMI output, USB-A ports, and passthrough charging. A great alternative to a single adapter.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["hub", "usb-c", "hdmi", "dock", "dongle"], condition: ResourceCondition.NEW,
    location: LOC.library, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Handle gently. Return same day.",
    pickupInstructions: "Library help desk, ask for Iris.",
    compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [Port.HDMI, Port.USB_A], attributes: ["passthrough-charging"] },
  },
  {
    id: "res-vga-hdmi", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "VGA to HDMI converter", description: "Converts a VGA source to HDMI. Not for USB-C laptops.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["adapter", "vga", "hdmi"], condition: ResourceCondition.FAIR,
    location: LOC.engineering, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return within a day.",
    pickupInstructions: "Engineering Hall room 120.",
    compatibility: { sourcePorts: [Port.VGA], sinkPorts: [Port.HDMI], attributes: [] },
  },
  {
    id: "res-usbc-hdmi-far", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "USB-C to HDMI adapter (downtown)", description: "Works, but it's stored at an apartment in downtown Seattle — too far for a quick campus pickup.",
    resourceType: ResourceType.ITEM, category: Category.ELECTRONICS_ADAPTERS,
    tags: ["adapter", "usb-c", "hdmi"], condition: ResourceCondition.GOOD,
    location: LOC.downtown, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day.",
    pickupInstructions: "Downtown Seattle — arrange a time.",
    compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [Port.HDMI], attributes: [] },
  },

  // --- Chargers & batteries -------------------------------------------------
  {
    id: "res-usbc-charger-65w", communityId: DEMO_COMMUNITY_ID, ownerId: "user-devin",
    title: "65W USB-C laptop charger", description: "65W USB-C PD charger, compatible with most USB-C laptops (MacBook Air/Pro 13\", Dell XPS, etc.).",
    resourceType: ResourceType.ITEM, category: Category.CHARGERS_BATTERIES,
    tags: ["charger", "usb-c", "65w", "laptop", "power"], condition: ResourceCondition.GOOD,
    location: LOC.northDorm, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return by evening.",
    pickupInstructions: "North Residence front desk, Devin K.",
    compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [], attributes: ["65W", "USB-PD"] },
  },
  {
    id: "res-powerbank", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Portable phone power bank (20,000mAh)", description: "USB-A and USB-C outputs. Charges a phone 3-4 times.",
    resourceType: ResourceType.ITEM, category: Category.CHARGERS_BATTERIES,
    tags: ["power bank", "battery", "phone", "charger"], condition: ResourceCondition.GOOD,
    location: LOC.recCenter, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Shared — please top it up before returning.",
    pickupInstructions: "Rec Center locker room attendant.",
    compatibility: { sourcePorts: [], sinkPorts: [Port.USB_C, Port.USB_A], attributes: [] },
  },
  {
    id: "res-lightning-cable", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "Lightning cable + wall plug", description: "For older iPhones. USB-A to Lightning.",
    resourceType: ResourceType.ITEM, category: Category.CHARGERS_BATTERIES,
    tags: ["cable", "lightning", "iphone", "charger"], condition: ResourceCondition.WORN,
    location: LOC.eastQuad, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return when done.",
    pickupInstructions: "East Quad mailroom.",
    compatibility: { sourcePorts: [Port.USB_A], sinkPorts: [Port.LIGHTNING], attributes: [] },
  },

  // --- School supplies ------------------------------------------------------
  {
    id: "res-calc-scientific", communityId: DEMO_COMMUNITY_ID, ownerId: "user-iris",
    title: "Scientific calculator (TI-30XS)", description: "Basic scientific calculator, widely permitted in exams. No graphing, no memory storage.",
    resourceType: ResourceType.ITEM, category: Category.SCHOOL_SUPPLIES,
    tags: ["calculator", "scientific", "exam", "math"], condition: ResourceCondition.GOOD,
    location: LOC.library, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day.",
    pickupInstructions: "Library help desk.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["exam-permitted:true"], notes: "Non-graphing; commonly permitted, but confirm your exam's policy." },
  },
  {
    id: "res-calc-graphing", communityId: DEMO_COMMUNITY_ID, ownerId: "user-theo",
    title: "Graphing calculator (TI-84)", description: "Powerful graphing calculator. Not permitted in some exams due to memory/graphing features.",
    resourceType: ResourceType.ITEM, category: Category.SCHOOL_SUPPLIES,
    tags: ["calculator", "graphing", "ti-84", "math"], condition: ResourceCondition.GOOD,
    location: LOC.engineering, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return within a day.",
    pickupInstructions: "Engineering Hall study lounge.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["exam-permitted:false"], notes: "Graphing calculators are NOT permitted in some exams — check your exam rules." },
  },
  {
    id: "res-stapler", communityId: DEMO_COMMUNITY_ID, ownerId: "user-maya",
    title: "Heavy-duty stapler", description: "Staples up to 40 pages. Includes a box of staples.",
    resourceType: ResourceType.ITEM, category: Category.SCHOOL_SUPPLIES,
    tags: ["stapler", "office", "supplies"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Use at the union, don't remove from the building.",
    pickupInstructions: "Union club office shelf.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-whiteboard-markers", communityId: DEMO_COMMUNITY_ID, ownerId: "user-maya",
    title: "Whiteboard marker set", description: "Set of 8 dry-erase markers + eraser.",
    resourceType: ResourceType.ITEM, category: Category.SCHOOL_SUPPLIES,
    tags: ["markers", "whiteboard", "supplies"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Return what you don't use.",
    pickupInstructions: "Union club office.",
    compatibility: emptyCompat(),
  },

  // --- Tools & repair -------------------------------------------------------
  {
    id: "res-screwdriver-set", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Precision screwdriver set", description: "24-bit precision set for electronics, glasses, and furniture. Includes Phillips, flathead, and Torx.",
    resourceType: ResourceType.ITEM, category: Category.TOOLS_REPAIR,
    tags: ["screwdriver", "tools", "repair", "precision"], condition: ResourceCondition.GOOD,
    location: LOC.westLab, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Count the bits before returning.",
    pickupInstructions: "West Labs maker space.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-hex-keys", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Allen/hex key set", description: "Metric + imperial hex keys. Good for furniture assembly.",
    resourceType: ResourceType.ITEM, category: Category.TOOLS_REPAIR,
    tags: ["hex", "allen", "tools", "furniture"], condition: ResourceCondition.FAIR,
    location: LOC.westLab, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day.",
    pickupInstructions: "West Labs maker space drawer 3.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-tape-measure", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "25ft tape measure", description: "Standard retractable tape measure.",
    resourceType: ResourceType.ITEM, category: Category.TOOLS_REPAIR,
    tags: ["tape measure", "tools", "measure"], condition: ResourceCondition.GOOD,
    location: LOC.engineering, availabilityStatus: AvailabilityStatus.UNAVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Currently being repaired.",
    pickupInstructions: "Engineering Hall room 120.",
    compatibility: emptyCompat(),
  },

  // --- Kitchen & household --------------------------------------------------
  {
    id: "res-kettle", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "Electric kettle (1.7L)", description: "Fast-boil electric kettle for events or study sessions.",
    resourceType: ResourceType.ITEM, category: Category.KITCHEN_HOUSEHOLD,
    tags: ["kettle", "kitchen", "hot water"], condition: ResourceCondition.GOOD,
    location: LOC.eastQuad, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Empty and dry before returning.",
    pickupInstructions: "East Quad common kitchen.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-coffee-urn", communityId: DEMO_COMMUNITY_ID, ownerId: "user-maya",
    title: "30-cup coffee urn", description: "Large coffee urn for events. Heavy when full.",
    resourceType: ResourceType.ITEM, category: Category.KITCHEN_HOUSEHOLD,
    tags: ["coffee", "urn", "event", "kitchen"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.BORROWED, availabilityWindows: [],
    exclusive: true, lendingRules: "Clean thoroughly after use.",
    pickupInstructions: "Union storage closet.",
    compatibility: emptyCompat(),
  },

  // --- Event equipment ------------------------------------------------------
  {
    id: "res-folding-table", communityId: DEMO_COMMUNITY_ID, ownerId: "user-maya",
    title: "6ft folding table", description: "Lightweight folding table for events and bake sales.",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["folding table", "table", "event"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Two people recommended to carry.",
    pickupInstructions: "Union loading area.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-extension-cord", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "50ft extension cord", description: "Heavy-gauge outdoor-rated extension cord with 3 outlets.",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["extension cord", "power", "event", "cord"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Coil neatly before returning.",
    pickupInstructions: "Union AV cabinet.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-clicker", communityId: DEMO_COMMUNITY_ID, ownerId: "user-iris",
    title: "Presentation clicker (Logitech)", description: "Wireless presenter with laser pointer and USB receiver.",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["clicker", "presenter", "presentation", "remote"], condition: ResourceCondition.GOOD,
    location: LOC.library, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return the USB receiver too.",
    pickupInstructions: "Library help desk.",
    compatibility: { sourcePorts: [Port.USB_A], sinkPorts: [], attributes: [] },
  },
  {
    id: "res-microphone", communityId: DEMO_COMMUNITY_ID, ownerId: "user-theo",
    title: "Wireless handheld microphone", description: "Handheld wireless mic with receiver. Good for small events; needs a powered speaker.",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["microphone", "mic", "audio", "event"], condition: ResourceCondition.GOOD,
    location: LOC.engineering, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return batteries charged.",
    pickupInstructions: "Engineering Hall AV room.",
    compatibility: { sourcePorts: [], sinkPorts: [Port.AUX_3_5MM], attributes: [] },
  },
  {
    id: "res-tripod", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "Camera/phone tripod", description: "Adjustable tripod with a phone mount. Good for recording talks.",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["tripod", "camera", "phone", "recording"], condition: ResourceCondition.GOOD,
    location: LOC.artBuilding, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day.",
    pickupInstructions: "Arts Building media cage.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-projector", communityId: DEMO_COMMUNITY_ID, ownerId: "user-theo",
    title: "Portable HDMI projector", description: "Compact projector with an HDMI input. You'll need an HDMI source (or an adapter from your laptop).",
    resourceType: ResourceType.ITEM, category: Category.EVENT_EQUIPMENT,
    tags: ["projector", "hdmi", "event", "presentation"], condition: ResourceCondition.GOOD,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Handle the lens carefully.",
    pickupInstructions: "Union AV cabinet, tag P2.",
    compatibility: { sourcePorts: [Port.HDMI], sinkPorts: [], attributes: [] },
  },

  // --- Outdoor & weather ----------------------------------------------------
  {
    id: "res-umbrella", communityId: DEMO_COMMUNITY_ID, ownerId: "user-devin",
    title: "Large golf umbrella", description: "Big umbrella that covers two people. Great for a sudden downpour.",
    resourceType: ResourceType.ITEM, category: Category.OUTDOOR_WEATHER,
    tags: ["umbrella", "rain", "weather"], condition: ResourceCondition.GOOD,
    location: LOC.northDorm, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Shake it out before returning.",
    pickupInstructions: "North Residence front desk.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-rain-poncho", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Spare rain poncho", description: "One-size reusable rain poncho.",
    resourceType: ResourceType.ITEM, category: Category.OUTDOOR_WEATHER,
    tags: ["poncho", "rain", "weather"], condition: ResourceCondition.FAIR,
    location: LOC.recCenter, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return dry.",
    pickupInstructions: "Rec Center desk.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-cooler", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "Insulated cooler (48qt)", description: "Keeps drinks cold for event tabling.",
    resourceType: ResourceType.ITEM, category: Category.OUTDOOR_WEATHER,
    tags: ["cooler", "event", "outdoor"], condition: ResourceCondition.GOOD,
    location: LOC.southCafe, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Dry it out before returning.",
    pickupInstructions: "South Cafe storage.",
    compatibility: emptyCompat(),
  },

  // --- Moving & physical assistance (ASSISTANCE) ----------------------------
  {
    id: "res-help-tables", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Help setting up event tables", description: "I can help carry and set up tables/chairs for an event. Available on short notice near the union.",
    resourceType: ResourceType.ASSISTANCE, category: Category.MOVING_PHYSICAL,
    tags: ["help", "setup", "tables", "event", "hands"], condition: ResourceCondition.NA,
    location: LOC.union, availabilityStatus: AvailabilityStatus.AVAILABLE,
    availabilityWindows: [], windowOffsets: [[-10, 120]],
    exclusive: false, lendingRules: "Happy to help for up to an hour.",
    pickupInstructions: "Text me when you're ready; meet at the union entrance.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["physical-help"] },
  },
  {
    id: "res-help-boxes", communityId: DEMO_COMMUNITY_ID, ownerId: "user-devin",
    title: "Help carrying boxes between buildings", description: "Can help move a few boxes across campus. I have a hand cart.",
    resourceType: ResourceType.ASSISTANCE, category: Category.MOVING_PHYSICAL,
    tags: ["help", "move", "boxes", "cart", "hands"], condition: ResourceCondition.NA,
    location: LOC.northDorm, availabilityStatus: AvailabilityStatus.AVAILABLE,
    availabilityWindows: [], windowOffsets: [[30, 240]],
    exclusive: false, lendingRules: "Reasonable loads only, please.",
    pickupInstructions: "Meet at North Residence lobby.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["physical-help", "has-cart"] },
  },
  {
    id: "res-help-notes", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "Note-taking help for a lecture", description: "Offering to share clear notes or sit in to take notes for a class you can't attend.",
    resourceType: ResourceType.ASSISTANCE, category: Category.OTHER_HELP,
    tags: ["help", "notes", "lecture", "study"], condition: ResourceCondition.NA,
    location: LOC.library, availabilityStatus: AvailabilityStatus.AVAILABLE,
    availabilityWindows: [], windowOffsets: [[60, 600]],
    exclusive: false, lendingRules: "Give me a day's notice when possible.",
    pickupInstructions: "We can meet at the library.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["academic-help"] },
  },
  {
    id: "res-help-ride", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "Help jump-starting a car", description: "I have jumper cables and can help jump a dead battery in the south lot.",
    resourceType: ResourceType.ASSISTANCE, category: Category.OTHER_HELP,
    tags: ["help", "car", "jump", "battery"], condition: ResourceCondition.NA,
    location: LOC.southCafe, availabilityStatus: AvailabilityStatus.UNAVAILABLE,
    availabilityWindows: [], windowOffsets: [],
    exclusive: false, lendingRules: "Only during daylight hours.",
    pickupInstructions: "South lot.",
    compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["physical-help"] },
  },

  // --- A couple more items for breadth --------------------------------------
  {
    id: "res-first-aid", communityId: DEMO_COMMUNITY_ID, ownerId: "user-iris",
    title: "Basic first-aid kit", description: "Bandages, antiseptic, and basic supplies for minor scrapes.",
    resourceType: ResourceType.ITEM, category: Category.OTHER_HELP,
    tags: ["first aid", "safety", "kit"], condition: ResourceCondition.GOOD,
    location: LOC.recCenter, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Tell me what you use so I can restock.",
    pickupInstructions: "Rec Center desk.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-sewing-kit", communityId: DEMO_COMMUNITY_ID, ownerId: "user-lena",
    title: "Mini sewing kit", description: "Needles, thread, safety pins — for a quick costume or button fix.",
    resourceType: ResourceType.ITEM, category: Category.OTHER_HELP,
    tags: ["sewing", "repair", "kit"], condition: ResourceCondition.GOOD,
    location: LOC.artBuilding, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: false, lendingRules: "Return pins and needles.",
    pickupInstructions: "Arts Building costume shop.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-dolly", communityId: DEMO_COMMUNITY_ID, ownerId: "user-sam",
    title: "Hand truck / dolly", description: "Folding hand truck for moving heavy boxes or equipment.",
    resourceType: ResourceType.ITEM, category: Category.MOVING_PHYSICAL,
    tags: ["dolly", "hand truck", "move", "cart"], condition: ResourceCondition.GOOD,
    location: LOC.westLab, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Return same day.",
    pickupInstructions: "West Labs loading dock.",
    compatibility: emptyCompat(),
  },
  {
    id: "res-moving-blankets", communityId: DEMO_COMMUNITY_ID, ownerId: "user-omar",
    title: "Moving blankets (set of 4)", description: "Padded blankets to protect furniture and electronics while moving.",
    resourceType: ResourceType.ITEM, category: Category.MOVING_PHYSICAL,
    tags: ["moving", "blankets", "padding"], condition: ResourceCondition.FAIR,
    location: LOC.southCafe, availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
    exclusive: true, lendingRules: "Shake out before returning.",
    pickupInstructions: "South Cafe storage.",
    compatibility: emptyCompat(),
  },
];

export interface SeedBundle {
  users: User[];
  resources: Resource[];
  requests: Request[];
  communityRequests: CommunityRequest[];
  offers: Offer[];
  notifications: Notification[];
  conversations: Conversation[];
  messages: Message[];
  pointTransactions: PointTransaction[];
}

/** Build the full seed relative to `now` (fresh windows + timestamps). */
export function buildSeed(now: Date = new Date()): SeedBundle {
  const resources: Resource[] = RESOURCE_DEFS.map((def, idx) => {
    const { windowOffsets, ...rest } = def;
    const windows = (windowOffsets ?? []).map(([s, e]) => ({
      start: iso(s, now),
      end: iso(e, now),
    }));
    return {
      ...rest,
      availabilityWindows: windows,
      createdAt: iso(-(idx + 1) * 60, now),
      updatedAt: iso(-(idx + 1) * 30, now),
    };
  });

  // A few seeded requests spanning states (privacy-conscious community feed +
  // realistic dashboard). Reference real resource/owner ids.
  const requests: Request[] = [
    {
      id: "seedreq-1", communityId: DEMO_COMMUNITY_ID,
      resourceId: "res-folding-table", resourceOwnerId: "user-maya", requesterId: "user-devin",
      status: RequestStatus.PENDING, requestedTime: iso(90, now),
      pickupContext: "For a club bake sale on the east quad.", message: "Could I grab this around 3pm?",
      createdAt: iso(-25, now), updatedAt: iso(-25, now),
    },
    {
      id: "seedreq-2", communityId: DEMO_COMMUNITY_ID,
      resourceId: "res-usbc-hdmi-2", resourceOwnerId: "user-theo", requesterId: "user-iris",
      status: RequestStatus.ACCEPTED, requestedTime: iso(30, now),
      pickupContext: "Presentation in the library.", message: "Thanks so much!",
      createdAt: iso(-180, now), updatedAt: iso(-60, now),
    },
    {
      id: "seedreq-3", communityId: DEMO_COMMUNITY_ID,
      resourceId: "res-umbrella", resourceOwnerId: "user-devin", requesterId: "user-sam",
      status: RequestStatus.COMPLETED, requestedTime: iso(-1440, now),
      pickupContext: "Caught in the rain yesterday.", message: "Lifesaver, returned it dry!",
      createdAt: iso(-1500, now), updatedAt: iso(-1400, now),
    },
    {
      id: "seedreq-4", communityId: DEMO_COMMUNITY_ID,
      resourceId: "res-screwdriver-set", resourceOwnerId: "user-sam", requesterId: "user-lena",
      status: RequestStatus.DECLINED, requestedTime: iso(-2880, now),
      pickupContext: "", message: "Needed to fix a chair.",
      createdAt: iso(-3000, now), updatedAt: iso(-2900, now),
    },
  ];

  // Open community requests — "I need X" posts not tied to a listed resource.
  const communityRequests: CommunityRequest[] = [
    {
      id: "creq-pencil", communityId: DEMO_COMMUNITY_ID, requesterId: "user-devin",
      title: "a pencil for a quiz", description: "Blanking — forgot my pencil case and the quiz starts soon. A single pencil would save me!",
      category: Category.SCHOOL_SUPPLIES, quantity: 1, urgency: "CRITICAL",
      deadline: iso(20, now), location: LOC.library,
      status: CommunityRequestStatus.OPEN, createdAt: iso(-8, now), updatedAt: iso(-8, now),
    },
    {
      id: "creq-chairs", communityId: DEMO_COMMUNITY_ID, requesterId: "user-maya",
      title: "4 folding chairs for tonight's meeting", description: "Running a club meeting in the union and we're short a few chairs. Can return them tomorrow.",
      category: Category.EVENT_EQUIPMENT, quantity: 4, urgency: "SOON",
      deadline: iso(240, now), location: LOC.union,
      status: CommunityRequestStatus.OPEN, createdAt: iso(-40, now), updatedAt: iso(-40, now),
    },
    {
      id: "creq-jumpstart", communityId: DEMO_COMMUNITY_ID, requesterId: "user-lena",
      title: "a jump start in the east lot", description: "Left my lights on. Battery's dead. Anyone with cables nearby?",
      category: Category.OTHER_HELP, quantity: 1, urgency: "SOON",
      location: LOC.eastQuad,
      status: CommunityRequestStatus.MATCHED, acceptedOfferId: "offer-jump-1",
      createdAt: iso(-120, now), updatedAt: iso(-90, now),
    },
    {
      id: "creq-move", communityId: DEMO_COMMUNITY_ID, requesterId: "user-iris",
      title: "a hand carrying a couch up one flight", description: "Thanks everyone — all set now!",
      category: Category.MOVING_PHYSICAL, quantity: 1, urgency: "FLEXIBLE",
      location: LOC.northDorm,
      status: CommunityRequestStatus.RESOLVED, acceptedOfferId: "offer-move-1",
      createdAt: iso(-2880, now), updatedAt: iso(-2800, now),
    },
  ];

  const offers: Offer[] = [
    {
      id: "offer-jump-1", communityRequestId: "creq-jumpstart", helperId: "user-omar",
      message: "I've got jumper cables and I'm two minutes away.", status: OfferStatus.ACCEPTED,
      createdAt: iso(-110, now), updatedAt: iso(-90, now),
    },
    {
      id: "offer-move-1", communityRequestId: "creq-move", helperId: "user-sam",
      message: "Happy to help — I do this all the time.", status: OfferStatus.ACCEPTED,
      createdAt: iso(-2860, now), updatedAt: iso(-2800, now),
    },
    {
      id: "offer-chairs-1", communityRequestId: "creq-chairs", helperId: "user-omar",
      message: "I can bring 4 from the south cafe storage.", status: OfferStatus.PENDING,
      createdAt: iso(-20, now), updatedAt: iso(-20, now),
    },
  ];

  // A couple of seeded notifications for the default demo user (Maya) so the
  // bell isn't empty on first load. Clearly part of the labeled demo data.
  const notifications: Notification[] = [
    {
      id: "ntf-seed-1", communityId: DEMO_COMMUNITY_ID, userId: "user-maya",
      type: NotificationType.NEW_OFFER, title: "Omar offered to help",
      body: 'For "4 folding chairs for tonight\'s meeting".',
      href: "/community/requests/creq-chairs", read: false, createdAt: iso(-19, now),
    },
    {
      id: "ntf-seed-2", communityId: DEMO_COMMUNITY_ID, userId: "user-maya",
      type: NotificationType.NEARBY_REQUEST, title: "Devin needs a pencil for a quiz",
      body: "Near Central Campus. You could help.",
      href: "/community/requests/creq-pencil", read: false, createdAt: iso(-8, now),
    },
  ];

  // A seeded conversation on the matched jump-start request (Lena ↔ Omar).
  const conversations: Conversation[] = [
    {
      id: "conv-jump", communityId: DEMO_COMMUNITY_ID,
      contextType: "COMMUNITY_REQUEST", contextId: "creq-jumpstart",
      subject: "a jump start in the east lot",
      participantIds: ["user-lena", "user-omar"],
      lastMessageAt: iso(-85, now), lastMessagePreview: "Perfect, I'm in the blue Civic by the north entrance.",
      lastReadBy: { "user-omar": iso(-84, now) },
      createdAt: iso(-100, now), updatedAt: iso(-85, now),
    },
  ];
  const messages: Message[] = [
    { id: "msg-j1", conversationId: "conv-jump", senderId: "user-omar", body: "On my way with cables — 2 minutes out. Where are you parked?", createdAt: iso(-95, now) },
    { id: "msg-j2", conversationId: "conv-jump", senderId: "user-lena", body: "Perfect, I'm in the blue Civic by the north entrance.", createdAt: iso(-85, now) },
  ];

  // Seeded point transactions — each tied to a real completed contribution
  // (the resolved move request + the completed umbrella loan), using the same
  // deterministic idempotency ids the service would generate. Clearly demo data.
  const pointTransactions: PointTransaction[] = [
    {
      id: "COMMUNITY_REQUEST_FULFILLED:creq-move:user-sam",
      communityId: DEMO_COMMUNITY_ID, userId: "user-sam", amount: 25,
      eventType: "COMMUNITY_REQUEST_FULFILLED", eventId: "creq-move",
      reason: "Fulfilled a community help request", createdAt: iso(-2800, now),
    },
    {
      id: "RESOURCE_LOAN_COMPLETED:seedreq-3:user-devin",
      communityId: DEMO_COMMUNITY_ID, userId: "user-devin", amount: 15,
      eventType: "RESOURCE_LOAN_COMPLETED", eventId: "seedreq-3",
      reason: "Completed a resource loan", createdAt: iso(-1400, now),
    },
    // A couple more historical contributions to make the community impact + a
    // profile or two feel lived-in (tied to distinct synthetic event ids).
    {
      id: "RESOURCE_LOAN_COMPLETED:hist-sam-1:user-sam",
      communityId: DEMO_COMMUNITY_ID, userId: "user-sam", amount: 15,
      eventType: "RESOURCE_LOAN_COMPLETED", eventId: "hist-sam-1",
      reason: "Completed a resource loan", createdAt: iso(-5000, now),
    },
    {
      id: "RESOURCE_LOAN_COMPLETED:hist-priya-1:user-priya",
      communityId: DEMO_COMMUNITY_ID, userId: "user-priya", amount: 15,
      eventType: "RESOURCE_LOAN_COMPLETED", eventId: "hist-priya-1",
      reason: "Completed a resource loan", createdAt: iso(-4300, now),
    },
    {
      id: "COMMUNITY_REQUEST_FULFILLED:hist-omar-1:user-omar",
      communityId: DEMO_COMMUNITY_ID, userId: "user-omar", amount: 25,
      eventType: "COMMUNITY_REQUEST_FULFILLED", eventId: "hist-omar-1",
      reason: "Fulfilled a community help request", createdAt: iso(-6000, now),
    },
  ];

  return {
    users: SEED_USERS, resources, requests, communityRequests, offers, notifications,
    conversations, messages, pointTransactions,
  };
}

export const RESOURCE_COUNT = RESOURCE_DEFS.length;
