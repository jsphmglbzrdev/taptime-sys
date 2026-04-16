import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const supabaseAuditAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "supabase-audit-session",
    },
  },
);

let cachedIpPromise = null;

function sanitizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function sanitizeMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

async function getCurrentActorDetails() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return {
      auth_id: null,
      email: user?.email ?? null,
      name: null,
      role: null,
    };
  }

  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("auth_id, first_name, last_name, email, role")
      .eq("auth_id", user.id)
      .maybeSingle();

    const name =
      `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim() || null;

    return {
      auth_id: data?.auth_id ?? user.id,
      email: data?.email ?? user.email ?? null,
      name,
      role: data?.role ?? null,
    };
  } catch {
    return {
      auth_id: user.id,
      email: user.email ?? null,
      name: null,
      role: null,
    };
  }
}

export async function getClientIpAddress() {
  if (typeof window === "undefined") return null;
  if (!cachedIpPromise) {
    cachedIpPromise = (async () => {
      const providers = [
        "https://api.ipify.org?format=json",
        "https://api64.ipify.org?format=json",
      ];

      for (const url of providers) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          if (data?.ip) return data.ip;
        } catch {
          // Try the next provider.
        }
      }

      return null;
    })();
  }

  return cachedIpPromise;
}

export async function logAuditEvent({
  eventType = "info",
  module = "general",
  action,
  description,
  actor,
  target,
  metadata,
}) {
  try {
    const resolvedActor = actor?.auth_id || actor?.email
      ? actor
      : await getCurrentActorDetails();
    const ipAddress = await getClientIpAddress();

    const payload = {
      event_type: sanitizeText(eventType) ?? "info",
      module: sanitizeText(module) ?? "general",
      action: sanitizeText(action),
      description: sanitizeText(description),
      actor_auth_id: sanitizeText(resolvedActor?.auth_id),
      actor_email: sanitizeText(resolvedActor?.email),
      actor_name: sanitizeText(resolvedActor?.name),
      actor_role: sanitizeText(resolvedActor?.role),
      target_auth_id: sanitizeText(target?.auth_id),
      target_email: sanitizeText(target?.email),
      target_name: sanitizeText(target?.name),
      ip_address: sanitizeText(ipAddress),
      metadata: sanitizeMetadata(metadata),
    };

    const { error } = await supabaseAuditAdmin.from("audit_trails").insert(payload);
    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.warn("Failed to write audit trail event.", error);
    return { success: false, error: error?.message ?? "Unknown audit error" };
  }
}

export async function listNotificationAuditEvents({
  authId,
  role,
  limit = 40,
}) {
  try {
    if (!authId || !role) {
      return { success: true, data: [] };
    }

    let query = supabaseAuditAdmin
      .from("audit_trails")
      .select(
        "id, event_type, module, action, description, actor_auth_id, actor_email, actor_name, actor_role, target_auth_id, target_email, target_name, created_at, metadata",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (role === "Admin") {
      query = query.eq("actor_role", "Employee");
    } else {
      query = query.eq("target_auth_id", authId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: data ?? [] };
  } catch (error) {
    return {
      success: false,
      error: error?.message ?? "Failed to load notification audit events.",
    };
  }
}
