// Усе, що працює з Firebase, — окремим модулем: SDK вантажиться лише коли рецензування налаштоване.
export { signIn, signOutUser, watchUser } from './auth';
export { createUser, setActive, setRole, watchUsers } from './admin';
export { addComment, addReply, removeComment, setResolved, watchComments } from './comments';
