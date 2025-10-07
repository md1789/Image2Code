import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "../lib/firebase.client";

type AuthState = {
  user: User | null;
  loading: boolean;
  error?: Error;
};

export function useFirebaseAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const provider = useMemo(() => new GoogleAuthProvider(), []);

  useEffect(() => {
    if (!auth) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => setState({ user, loading: false }),
      (error) => setState({ user: null, loading: false, error })
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (!auth) return;
    await signInWithPopup(auth, provider);
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return {
    ...state,
    signIn: handleSignIn,
    signOut: handleSignOut,
  };
}
