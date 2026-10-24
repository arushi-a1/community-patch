/**
 * Public projections. Strip owner-private and pickup-sensitive data before
 * returning resources to clients (SR §2/§3).
 */
import { PublicResource, Resource } from "./types";

export function toPublicResource(
  resource: Resource,
  ownerDisplayName: string,
): PublicResource {
  // Omit pickupInstructions entirely from the public shape.
  const { pickupInstructions: _pickupInstructions, ...rest } = resource;
  void _pickupInstructions;
  return { ...rest, ownerDisplayName };
}
