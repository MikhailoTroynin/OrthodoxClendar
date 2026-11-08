// Ініціалізація Firebase (підвантажується лише в режимі корпусу телефона на широкому екрані).
import { FirebaseApp, initializeApp, getApps } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig, LOGIN_DOMAIN } from './config';
import { normLogin } from './util';

export { LOGIN_RE, normLogin, errText } from './util';

let app: FirebaseApp | null = null;

/** Локальна перевірка з емуляторами Firebase: http://localhost:…/?emu */
const useEmulator =
  typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu\b/.test(location.search);

export function fbApp(): FirebaseApp {
  if (!app) {
    app = getApps().find((a) => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig);
    if (useEmulator) {
      connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
    }
  }
  return app;
}
export const fbAuth = (): Auth => getAuth(fbApp());
export const fbDb = (): Firestore => getFirestore(fbApp());
/** Для тимчасового екземпляра (створення логінів адміністратором). */
export function wireEmulator(a: FirebaseApp, auth: Auth) {
  if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export const loginEmail = (login: string) => `${normLogin(login)}@${LOGIN_DOMAIN}`;
export const emailLogin = (email: string | null | undefined) => (email ?? '').split('@')[0];
