// Kerjo auth context — Emergent Google Auth (mobile + web).
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { storage } from "@/src/utils/storage";
import {
  AUTH_TOKEN_KEY,
  exchangeSession,
  fetchMe,
  logoutApi,
  setAuthToken,
} from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  has_profile?: boolean;
} | null;

type AuthState = {
  user: User;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export const useAuth = () => useContext(AuthContext);

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const handled = useRef<Set<string>>(new Set());

  async function processSessionId(sessionId: string) {
    if (handled.current.has(sessionId)) return;
    handled.current.add(sessionId);
    try {
      const { session_token, user: u } = await exchangeSession(sessionId);
      setAuthToken(session_token);
      await storage.secureSet(AUTH_TOKEN_KEY, session_token);
      setUser(u);
    } catch (e) {
      console.error("[auth] exchange failed", e);
    }
  }

  async function refreshUser() {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      // ignore
    }
  }

  // Bootstrap: process any session_id present, else validate stored token.
  useEffect(() => {
    let urlSub: { remove: () => void } | null = null;

    (async () => {
      // Web: parse session_id from URL first
      if (Platform.OS === "web") {
        const href = typeof window !== "undefined" ? window.location.href : "";
        const sid = extractSessionId(href);
        if (sid) {
          await processSessionId(sid);
          // clean URL after success
          try {
            const url = new URL(window.location.href);
            url.hash = "";
            url.searchParams.delete("session_id");
            window.history.replaceState(window.history.state, "", url.toString());
          } catch {}
          setLoading(false);
          return;
        }
      } else {
        // Mobile: cold start deep link
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) {
          await processSessionId(sid);
          setLoading(false);
          return;
        }
        urlSub = Linking.addEventListener("url", (ev) => {
          const s = extractSessionId(ev.url);
          if (s) processSessionId(s);
        });
      }

      // Existing session
      const stored = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
      if (stored) {
        setAuthToken(stored);
        try {
          const me = await fetchMe();
          setUser(me);
        } catch {
          setAuthToken(null);
          await storage.secureRemove(AUTH_TOKEN_KEY);
          setUser(null);
        }
      }
      setLoading(false);
    })();

    return () => {
      urlSub?.remove();
    };
  }, []);

  async function signIn() {
    setSigningIn(true);
    try {
      if (Platform.OS === "web") {
        const redirectUrl = window.location.origin + "/";
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
        window.location.href = authUrl;
        return;
      }

      const redirectUrl = Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      let captured: string | null = null;
      const sub = Linking.addEventListener("url", (ev) => {
        const s = extractSessionId(ev.url);
        if (s) captured = s;
      });

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      sub.remove();

      let sid: string | null = null;
      if (result.type === "success" && "url" in result) {
        sid = extractSessionId((result as any).url);
      }
      if (!sid) sid = captured;
      if (!sid) sid = extractSessionId(await Linking.getInitialURL());

      if (sid) {
        await processSessionId(sid);
      }
    } catch (e) {
      console.error("[auth] signIn failed", e);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    try {
      await logoutApi();
    } catch {}
    setAuthToken(null);
    await storage.secureRemove(AUTH_TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signingIn, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
