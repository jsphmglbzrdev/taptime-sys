import { supabase } from "./supabase";

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
  if (error) throw error;
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

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: nextPath })
    .eq("auth_id", authId);

  if (updateError) {
    await supabase.storage.from("avatars").remove([nextPath]);
    throw updateError;
  }

  const previousRef = String(previousAvatarRef ?? "").trim();
  if (previousRef && previousRef !== nextPath && !isRemoteAvatarRef(previousRef)) {
    await supabase.storage.from("avatars").remove([previousRef]);
  }

  emitAvatarUpdated();
  return nextPath;
}

export async function deleteAvatarForUser({ authId, avatarRef }) {
  if (!authId) throw new Error("authId is required.");

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: null })
    .eq("auth_id", authId);
  if (updateError) throw updateError;

  const ref = String(avatarRef ?? "").trim();
  if (ref && !isRemoteAvatarRef(ref)) {
    await supabase.storage.from("avatars").remove([ref]);
  }

  emitAvatarUpdated();
}
