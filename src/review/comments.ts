// Коментарі рецензентів: comments/{id}, відповіді — масивом у самому документі.
import { addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { fbDb } from './firebase';
import type { Profile } from './auth';

/** Прив'язка до тексту: сама цитата і по ~32 знаки до й після, щоб знайти саме це місце. */
export interface TextAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  where: string;
}

export interface Reply {
  text: string;
  author: string;
  authorUid: string;
  at: number;
}

export interface Comment extends TextAnchor {
  id: string;
  text: string;
  suggestion: string;
  author: string;
  authorLogin: string;
  authorUid: string;
  createdAt: number;
  resolved: boolean;
  resolvedBy: string;
  replies: Reply[];
}

const col = () => collection(fbDb(), 'comments');

export function watchComments(cb: (list: Comment[]) => void, onErr: (e: unknown) => void): () => void {
  return onSnapshot(
    query(col(), orderBy('createdAt', 'desc')),
    (s) =>
      cb(
        s.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            quote: x.quote ?? '',
            prefix: x.prefix ?? '',
            suffix: x.suffix ?? '',
            where: x.where ?? '',
            text: x.text ?? '',
            suggestion: x.suggestion ?? '',
            author: x.author ?? '',
            authorLogin: x.authorLogin ?? '',
            authorUid: x.authorUid ?? '',
            createdAt: x.createdAt?.toMillis?.() ?? Date.now(),
            resolved: x.resolved === true,
            resolvedBy: x.resolvedBy ?? '',
            replies: Array.isArray(x.replies) ? x.replies : [],
          };
        }),
      ),
    onErr,
  );
}

export const addComment = (me: Profile, a: TextAnchor, text: string, suggestion: string) =>
  addDoc(col(), {
    ...a,
    text: text.trim(),
    suggestion: suggestion.trim(),
    author: me.name,
    authorLogin: me.login,
    authorUid: me.uid,
    createdAt: serverTimestamp(),
    resolved: false,
    resolvedBy: '',
    replies: [],
  });

export const addReply = (me: Profile, id: string, text: string) =>
  updateDoc(doc(col(), id), { replies: arrayUnion({ text: text.trim(), author: me.name, authorUid: me.uid, at: Date.now() }) });

export const setResolved = (me: Profile, id: string, resolved: boolean) =>
  updateDoc(doc(col(), id), { resolved, resolvedBy: resolved ? me.name : '', resolvedAt: serverTimestamp() });

export const removeComment = (id: string) => deleteDoc(doc(col(), id));
