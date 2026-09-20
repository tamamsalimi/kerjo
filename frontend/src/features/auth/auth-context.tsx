// kerjo.id auth context — direct Google OpenID Connect (mobile + web).
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

import {
  exchangeGoogleToken,
  fetchMe,
  logoutApi,
  type VerificationStatus,
} from "@/src/features/auth/services/auth-service";
import { AUTH_TOKEN_KEY, setAuthToken } from "@/src/services/http-client";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  has_profile?: boolean;
  verification_status?: VerificationStatus;
} | null;

type AuthState = {
  user: User;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export const useAuth = () => useContext(AuthContext);

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const unconfiguredClientId = "google-client-id-not-configured";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const handled = useRef<Set<string>>(new Set());

  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest(
    {
      webClientId: webClientId || unconfiguredClientId,
      iosClientId: iosClientId || unconfiguredClientId,
      androidClientId: androidClientId || unconfiguredClientId,
      scopes: ["openid", "profile", "email"],
      selectAccount: true,
      redirectUri:
        Platform.OS === "web" && typeof window !== "undefined"
          ? `${window.location.origin}/`
          : undefined,
    },
    { scheme: "kerjo" },
  );

  async function processIDToken(idToken: string) {
    if (handled.current.has(idToken)) return;
    handled.current.add(idToken);
    try {
      const { session_token, user: u } = await exchangeGoogleToken(idToken);
      setAuthToken(session_token);
      await storage.secureSet(AUTH_TOKEN_KEY, session_token);
      setUser(u);
      setAuthError(null);
    } catch (e) {
      handled.current.delete(idToken);
      setAuthError("Google login gagal. Periksa konfigurasi OAuth lalu coba lagi.");
      console.error("[auth] Google token exchange failed", e);
    } finally {
      setSigningIn(false);
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

  // Bootstrap an existing kerjo.id session.
  useEffect(() => {
    (async () => {
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
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;
      if (idToken) {
        void Promise.resolve().then(() => processIDToken(idToken));
        return;
      }
      void Promise.resolve().then(() => setAuthError("Google tidak mengembalikan ID token."));
    } else if (googleResponse.type === "error") {
      void Promise.resolve().then(() => setAuthError(googleResponse.error?.message || "Google login gagal."));
    }
    void Promise.resolve().then(() => setSigningIn(false));
  }, [googleResponse]);

  async function signIn() {
    const configuredClientId = Platform.select({
      web: webClientId,
      ios: iosClientId,
      android: androidClientId,
      default: "",
    });
    if (!configuredClientId) {
      setAuthError("Google OAuth belum dikonfigurasi untuk platform ini.");
      return;
    }
    if (!googleRequest) {
      setAuthError("Google login sedang disiapkan. Coba lagi sebentar.");
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await promptGoogle();
      if (result.type !== "success") {
        setSigningIn(false);
      }
    } catch (e) {
      console.error("[auth] signIn failed", e);
      setAuthError("Tidak dapat membuka Google login.");
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
    <AuthContext.Provider value={{ user, loading, signingIn, authError, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
