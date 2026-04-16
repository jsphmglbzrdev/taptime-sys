import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const supabaseAvatarAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "supabase-avatar-session",
    },
  },
);

export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_SIZE_LABEL = "5 MB";
export const AVATAR_UPDATED_EVENT = "avatar-updated";

function isRemoteAvatarRef(avatarRef) {
  return /^https?:\/\//i.test(String(avatarRef ?? "").trim());
}

function getAvatarExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function cleanupAvatarFolder({ authId, keepPath = "" }) {
  const folder = String(authId ?? "").trim();
  if (!folder) return;

  const filesToDelete = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabaseAvatarAdmin.storage
      .from("avatars")
      .list(folder, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.warn("Failed to inspect avatar folder for cleanup.", {
        authId: folder,
        message: error.message,
      });
      return;
    }

    const files = data ?? [];
    files.forEach((entry) => {
      const path = `${folder}/${entry.name}`;
      if (entry.name && path !== keepPath) {
        filesToDelete.push(path);
      }
    });

    if (files.length < limit) break;
    offset += files.length;
  }

  if (filesToDelete.length === 0) return;

  const { error } = await supabaseAvatarAdmin.storage
    .from("avatars")
    .remove(filesToDelete);

  if (error) {
    console.warn("Failed to remove old avatar files.", {
      authId: folder,
      message: error.message,
    });
  }
}

export function emitAvatarUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT));
  }
}

export function validateAvatarFile(file) {
  if (!file) return "Please choose an image file.";
  if (!file.type?.startsWith("image/")) {
    return "Please upload an image file.";
  }
  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    return `Profile pictures must be ${AVATAR_MAX_SIZE_LABEL} or smaller.`;
  }
  return "";
}

export async function resolveAvatarSrc(avatarRef) {
  const ref = String(avatarRef ?? "").trim();
  if (!ref) return "";
  if (isRemoteAvatarRef(ref)) return ref;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(ref, 60 * 60);
  if (error) {
    console.warn("Failed to resolve avatar signed URL.", {
      avatarRef: ref,
      message: error.message,
    });
    return "";
  }
  return data?.signedUrl ?? "";
}

export async function saveAvatarForUser({ authId, file, previousAvatarRef }) {
  if (!authId) throw new Error("authId is required.");
  if (!file) throw new Error("Avatar file is required.");

  const ext = getAvatarExtension(file.type);
  const nextPath = `${authId}/avatar-${Date.now()}.${ext}`;

  const uploadRes = await supabase.storage
    .from("avatars")
    .upload(nextPath, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
  if (uploadRes.error) throw uploadRes.error;

  const storedPath = uploadRes.data?.path ?? nextPath;

  const { data: updatedProfile, error: updateError } = await supabaseAvatarAdmin
    .from("user_profiles")
    .update({ avatar_url: storedPath })
    .eq("auth_id", authId)
    .select("auth_id, avatar_url")
    .maybeSingle();

  if (updateError) {
    await supabase.storage.from("avatars").remove([storedPath]);
    throw updateError;
  }
  if (!updatedProfile?.auth_id) {
    await supabase.storage.from("avatars").remove([storedPath]);
    throw new Error("Profile was not found while saving the avatar.");
  }

  const previousRef = String(previousAvatarRef ?? "").trim();
  if (previousRef && previousRef !== storedPath && !isRemoteAvatarRef(previousRef)) {
    await supabaseAvatarAdmin.storage.from("avatars").remove([previousRef]);
  }
  await cleanupAvatarFolder({ authId, keepPath: storedPath });

  emitAvatarUpdated();
  return storedPath;
}

export async function deleteAvatarForUser({ authId, avatarRef }) {
  if (!authId) throw new Error("authId is required.");

  const { data: updatedProfile, error: updateError } = await supabaseAvatarAdmin
    .from("user_profiles")
    .update({ avatar_url: null })
    .eq("auth_id", authId)
    .select("auth_id, avatar_url")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedProfile?.auth_id) {
    throw new Error("Profile was not found while deleting the avatar.");
  }

  const ref = String(avatarRef ?? "").trim();
  if (ref && !isRemoteAvatarRef(ref)) {
    await supabaseAvatarAdmin.storage.from("avatars").remove([ref]);
  }
  await cleanupAvatarFolder({ authId, keepPath: "" });

  emitAvatarUpdated();
}
