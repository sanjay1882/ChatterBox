import { lookup } from "node:dns/promises";
import net from "node:net";
import { UnsafeUrlError, ValidationError } from "./errors.js";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + parts[3];
}

function isInCidr(ip, baseIp, prefixBits) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(baseIp);
  if (ipInt === null || baseInt === null) return false;
  const mask = prefixBits === 0 ? 0 : ((0xffffffff << (32 - prefixBits)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

export function isPrivateIp(ipAddress) {
  if (!ipAddress) return true;
  const zoneIndexTrimmed = ipAddress.split("%")[0];
  const ipVersion = net.isIP(zoneIndexTrimmed);
  if (ipVersion === 4) {
    return (
      isInCidr(zoneIndexTrimmed, "0.0.0.0", 8) ||
      isInCidr(zoneIndexTrimmed, "10.0.0.0", 8) ||
      isInCidr(zoneIndexTrimmed, "100.64.0.0", 10) ||
      isInCidr(zoneIndexTrimmed, "127.0.0.0", 8) ||
      isInCidr(zoneIndexTrimmed, "169.254.0.0", 16) ||
      isInCidr(zoneIndexTrimmed, "172.16.0.0", 12) ||
      isInCidr(zoneIndexTrimmed, "192.0.0.0", 24) ||
      isInCidr(zoneIndexTrimmed, "192.0.2.0", 24) ||
      isInCidr(zoneIndexTrimmed, "192.168.0.0", 16) ||
      isInCidr(zoneIndexTrimmed, "198.18.0.0", 15) ||
      isInCidr(zoneIndexTrimmed, "198.51.100.0", 24) ||
      isInCidr(zoneIndexTrimmed, "203.0.113.0", 24) ||
      isInCidr(zoneIndexTrimmed, "224.0.0.0", 4) ||
      isInCidr(zoneIndexTrimmed, "240.0.0.0", 4)
    );
  }

  if (ipVersion === 6) {
    const lower = zoneIndexTrimmed.toLowerCase();
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower)
    );
  }

  return true;
}

export function isBlockedHostname(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;
  return false;
}

function normalizeUserUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new ValidationError("url is required");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ValidationError("Invalid URL format");
  }

  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
    throw new UnsafeUrlError("Only http/https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed");
  }

  return parsed;
}

export async function validateAndResolveUrl(rawUrl) {
  const parsed = normalizeUserUrl(rawUrl);

  if (isBlockedHostname(parsed.hostname)) {
    throw new UnsafeUrlError("Blocked hostname");
  }

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion) {
    if (isPrivateIp(parsed.hostname)) {
      throw new UnsafeUrlError("Blocked private or loopback IP");
    }
    return parsed.toString();
  }

  let records;
  try {
    records = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Unable to resolve target hostname");
  }

  if (!records || records.length === 0) {
    throw new UnsafeUrlError("Hostname did not resolve to an IP");
  }

  const hasBlocked = records.some((record) => isPrivateIp(record.address));
  if (hasBlocked) {
    throw new UnsafeUrlError("Resolved hostname to private/internal address");
  }

  return parsed.toString();
}

export function assertSafeSubrequest(requestUrl) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }

  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
    return false;
  }

  if (isBlockedHostname(parsed.hostname)) return false;

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion && isPrivateIp(parsed.hostname)) return false;

  return true;
}
