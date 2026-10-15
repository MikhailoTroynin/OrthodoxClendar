// Рантайм Metro: потрібен, щоб у веб-версії великі модулі (import()) довантажувались окремими файлами.
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
