// Вхід/вихід і профіль користувача (users/{uid}).
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ADMIN_LOGIN } from './config';
import { emailLogin, fbAuth, fbDb, loginEmail, normLogin } from './firebase';

export interface Profile {
  uid: string;
  login: string;
  name: string;
  role: 'admin' | 'reviewer';
  active: boolean;
}

export async function signIn(login: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(fbAuth(), loginEmail(login), password);
}

export const signOutUser = () => signOut(fbAuth());

/** Профіль поточного користувача; адміністратор створює собі профіль сам при першому вході. */
async function loadProfile(uid: string, email: string | null): Promise<Profile> {
  const ref = doc(fbDb(), 'users', uid);
  const snap = await getDoc(ref);
  const login = emailLogin(email);
  if (!snap.exists()) {
    if (login !== normLogin(ADMIN_LOGIN)) throw new Error('no-access');
    const p = { login, name: 'Адміністратор', role: 'admin' as const, active: true };
    await setDoc(ref, { ...p, createdAt: serverTimestamp() });
    return { uid, ...p };
  }
  const d = snap.data();
  if (d.active !== true) throw new Error('inactive');
  return { uid, login: d.login ?? login, name: d.name || d.login || login, role: d.role === 'admin' ? 'admin' : 'reviewer', active: true };
}

/** Стежить за входом. cb(null, err) — вийшли або доступу немає (тоді користувача розлогінюємо). */
export function watchUser(cb: (p: Profile | null, err?: unknown) => void): () => void {
  return onAuthStateChanged(fbAuth(), async (u) => {
    if (!u) return cb(null);
    try {
      cb(await loadProfile(u.uid, u.email));
    } catch (e) {
      // Спершу повідомляємо причину, потім виходимо (вихід викличе ще одне cb(null) — вже без помилки).
      cb(null, e);
      await signOut(fbAuth()).catch(() => {});
    }
  });
}
