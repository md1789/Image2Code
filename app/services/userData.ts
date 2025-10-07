import { type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../lib/firebase.client";

export type UserProfile = {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  onboardingComplete?: boolean;
  updatedAt?: Date;
};

function assertDb() {
  if (!db) {
    throw new Error("Firestore is not available in the current environment.");
  }
}

export async function createOrUpdateUserProfile(user: User, profile?: Partial<UserProfile>) {
  assertDb();
  const ref = doc(collection(db, "users"), user.uid);

  await setDoc(
    ref,
    {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      onboardingComplete: profile?.onboardingComplete ?? false,
      updatedAt: serverTimestamp(),
      ...profile,
    },
    { merge: true }
  );
}

export async function fetchUserProfile(uid: string) {
  assertDb();
  const ref = doc(collection(db, "users"), uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return snapshot.data() as UserProfile;
}

export async function savePromptHistory(uid: string, promptId: string, payload: Record<string, unknown>) {
  assertDb();
  const ref = doc(collection(db, "users", uid, "prompts"), promptId);

  await setDoc(
    ref,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateLastSeen(uid: string) {
  assertDb();
  const ref = doc(collection(db, "users"), uid);
  await updateDoc(ref, { lastSeenAt: serverTimestamp() });
}
