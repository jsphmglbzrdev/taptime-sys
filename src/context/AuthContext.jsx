// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { useLoading } from "./LoadingContext";

const AuthContext = createContext();
const AUTH_SYNC_CHANNEL = "taptime-auth-sync-v1";
const AUTH_SYNC_REQUEST = "session:request";
const AUTH_SYNC_RESPONSE = "session:response";
const AUTH_SYNC_UPDATE = "session:update";
const AUTH_SYNC_CLEAR = "session:clear";
const AUTH_SYNC_TIMEOUT_MS = 1500;

function createPeerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSyncSession(session) {
  if (!session?.access_token || !session?.refresh_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const { setLoading } = useLoading();
  const peerIdRef = useRef(createPeerId());
  const suppressBroadcastUntilRef = useRef(0);
  const pendingRequestRef = useRef(null);

  const fetchProfile = async (authId) => {
    if (!authId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_id", authId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    const syncChannel =
      typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(AUTH_SYNC_CHANNEL)
        : null;
    let isMounted = true;

    const shouldSuppressBroadcast = () =>
      Date.now() < suppressBroadcastUntilRef.current;

    const suppressBroadcast = (durationMs = 1500) => {
      suppressBroadcastUntilRef.current = Date.now() + durationMs;
    };

    const resolvePendingRequest = (session) => {
      const pending = pendingRequestRef.current;
      if (!pending) return;

      window.clearTimeout(pending.timeoutId);
      pendingRequestRef.current = null;
      pending.resolve(session);
    };

    const requestSessionFromPeer = () => {
      if (!syncChannel) return Promise.resolve(null);

      return new Promise((resolve) => {
        const requestId = createPeerId();
        const timeoutId = window.setTimeout(
          () => resolvePendingRequest(null),
          AUTH_SYNC_TIMEOUT_MS,
        );

        pendingRequestRef.current = { requestId, resolve, timeoutId };
        syncChannel.postMessage({
          type: AUTH_SYNC_REQUEST,
          requestId,
          sourceId: peerIdRef.current,
        });
      });
    };

    const applyIncomingSession = async (nextSession) => {
      if (!nextSession?.access_token || !nextSession?.refresh_token) return;

      const { data: currentData } = await supabase.auth.getSession();
      if (currentData.session?.access_token === nextSession.access_token) return;

      suppressBroadcast();
      const { error } = await supabase.auth.setSession(nextSession);
      if (error) {
        console.warn("Failed to apply synced auth session.", error.message);
      }
    };

    const clearLocalSession = async () => {
      suppressBroadcast();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.warn("Failed to clear synced auth session.", error.message);
      }
    };

    const handleSyncMessage = async (event) => {
      const message = event.data;
      if (!message || message.sourceId === peerIdRef.current) return;

      if (message.type === AUTH_SYNC_REQUEST) {
        const { data } = await supabase.auth.getSession();
        const session = toSyncSession(data.session);
        if (!session) return;

        syncChannel?.postMessage({
          type: AUTH_SYNC_RESPONSE,
          requestId: message.requestId,
          sourceId: peerIdRef.current,
          session,
        });
        return;
      }

      if (
        message.type === AUTH_SYNC_RESPONSE &&
        pendingRequestRef.current?.requestId === message.requestId
      ) {
        resolvePendingRequest(message.session ?? null);
        return;
      }

      if (message.type === AUTH_SYNC_UPDATE) {
        await applyIncomingSession(message.session);
        return;
      }

      if (message.type === AUTH_SYNC_CLEAR) {
        await clearLocalSession();
      }
    };

    syncChannel?.addEventListener("message", handleSyncMessage);

    const checkSession = async () => {
      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const existingSession = data.session ?? null;

        if (existingSession?.user) {
          setUser(existingSession.user);
          await fetchProfile(existingSession.user.id);
          return;
        }

        const syncedSession = await requestSessionFromPeer();
        if (syncedSession) {
          await applyIncomingSession(syncedSession);
          const { data: refreshedData } = await supabase.auth.getSession();
          if (isMounted) {
            setUser(refreshedData.session?.user ?? null);
            if (refreshedData.session?.user) {
              await fetchProfile(refreshedData.session.user.id);
            }
          }
          return;
        }

        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;

        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        if (!syncChannel || shouldSuppressBroadcast()) {
          return;
        }

        const syncSession = toSyncSession(session);
        if (syncSession) {
          syncChannel.postMessage({
            type: AUTH_SYNC_UPDATE,
            sourceId: peerIdRef.current,
            session: syncSession,
          });
          return;
        }

        syncChannel.postMessage({
          type: AUTH_SYNC_CLEAR,
          sourceId: peerIdRef.current,
        });
      },
    );

    return () => {
      isMounted = false;
      const pending = pendingRequestRef.current;
      if (pending) {
        window.clearTimeout(pending.timeoutId);
        pending.resolve(null);
        pendingRequestRef.current = null;
      }
      syncChannel?.removeEventListener("message", handleSyncMessage);
      syncChannel?.close();
      listener.subscription.unsubscribe();
    };
  }, [setLoading]);

  return (
    <AuthContext.Provider value={{ user, profile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
