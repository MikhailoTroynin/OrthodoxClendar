// Налаштування рецензування (веб-версія на GitHub Pages).
// Конфіг Firebase НЕ секретний: він потрапляє у браузер кожного відвідувача,
// а захищають дані правила Firestore (див. firestore.rules у корені репозиторію).
// Взяти: консоль Firebase → Project settings → Your apps → Web app → firebaseConfig.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

/** Логіни перетворюються на технічні адреси «логін@LOGIN_DOMAIN» — пошта насправді не використовується. */
export const LOGIN_DOMAIN = 'review.orthodoxcalendar.app';

/** Логін адміністратора: при першому вході він сам отримує права адміна (див. firestore.rules). */
export const ADMIN_LOGIN = 'admin';

export const isConfigured = () => !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
