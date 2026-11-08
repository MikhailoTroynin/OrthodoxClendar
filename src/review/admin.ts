// Керування логінами (лише для адміністратора).
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, inMemoryPersistence, initializeAuth, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { fbDb, LOGIN_RE, loginEmail, normLogin, wireEmulator } from './firebase';

export interface UserRow {
  uid: string;
  login: string;
  name: string;
  role: 'admin' | 'reviewer';
  active: boolean;
}

export function watchUsers(cb: (rows: UserRow[]) => void, onErr: (e: unknown) => void): () => void {
  return onSnapshot(
    collection(fbDb(), 'users'),
    (s) =>
      cb(
        s.docs
          .map((d) => {
            const x = d.data();
            return { uid: d.id, login: x.login ?? '', name: x.name ?? '', role: x.role === 'admin' ? 'admin' : 'reviewer', active: x.active === true } as UserRow;
          })
          .sort((a, b) => a.login.localeCompare(b.login)),
      ),
    onErr,
  );
}

/**
 * Створює логін. Акаунт реєструється через окремий тимчасовий екземпляр Firebase,
 * щоб адміністратор при цьому не вийшов зі свого облікового запису.
 */
export async function createUser(login: string, password: string, name: string, role: 'admin' | 'reviewer', by: string) {
  login = normLogin(login);
  if (!LOGIN_RE.test(login)) throw new Error('Логін: 3–32 символи — латиниця, цифри, «.», «-», «_»');
  if (password.length < 6) throw new Error('Пароль має містити щонайменше 6 символів');
  const tmp = initializeApp(firebaseConfig, 'create-' + Date.now());
  try {
    const auth = initializeAuth(tmp, { persistence: inMemoryPersistence });
    wireEmulator(tmp, auth);
    const cred = await createUserWithEmailAndPassword(auth, loginEmail(login), password);
    await setDoc(doc(fbDb(), 'users', cred.user.uid), {
      login,
      name: name.trim() || login,
      role,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: by,
    });
    await signOut(auth).catch(() => {});
  } finally {
    await deleteApp(tmp).catch(() => {});
  }
}

export const setActive = (uid: string, active: boolean) => updateDoc(doc(fbDb(), 'users', uid), { active });
export const setRole = (uid: string, role: 'admin' | 'reviewer') => updateDoc(doc(fbDb(), 'users', uid), { role });
