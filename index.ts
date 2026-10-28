// Рантайм Metro: потрібен, щоб у веб-версії великі модулі (import()) довантажувались окремими файлами.
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import App from './src/App';
import { mountPhoneFrame, shouldFramePhone } from './src/webFrame';

// На широкому екрані у вебі показуємо застосунок у корпусі телефона (сам він вантажиться в iframe).
if (shouldFramePhone()) mountPhoneFrame();
else registerRootComponent(App);
