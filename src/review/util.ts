// Допоміжне без залежності від Firebase (щоб не вантажити SDK, поки не потрібен).
/** Допустимий логін: латиниця, цифри, крапка, дефіс, підкреслення; 3–32 символи. */
export const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;
export const normLogin = (s: string) => s.trim().toLowerCase();

/** Повідомлення про помилку Firebase українською. */
export function errText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Невірний логін або пароль',
    'auth/wrong-password': 'Невірний логін або пароль',
    'auth/user-not-found': 'Невірний логін або пароль',
    'auth/invalid-email': 'Недопустимий логін',
    'auth/user-disabled': 'Цей обліковий запис вимкнено',
    'auth/too-many-requests': 'Забагато спроб. Спробуйте пізніше',
    'auth/network-request-failed': 'Немає з’єднання з сервером',
    'auth/email-already-in-use': 'Такий логін уже існує',
    'auth/weak-password': 'Пароль має містити щонайменше 6 символів',
    'auth/operation-not-allowed': 'У Firebase не увімкнено вхід за паролем',
    'auth/configuration-not-found': 'У Firebase ще не увімкнено Authentication (Get started → Email/Password)',
    'permission-denied': 'Недостатньо прав',
    unavailable: 'Сервер недоступний. Перевірте з’єднання',
  };
  if (map[code]) return map[code];
  if (e instanceof Error && e.message === 'no-access') return 'Цей логін не має доступу';
  if (e instanceof Error && e.message === 'inactive') return 'Доступ для цього логіна вимкнено';
  return 'Помилка: ' + (code || (e instanceof Error ? e.message : String(e)));
}
