// Рантайм Metro: потрібен, щоб у веб-версії великі модулі (import()) довантажувались окремими файлами.
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import App from './src/App';
import { mountMobileFrame, mountPhoneFrame, shouldFrameMobile, shouldFramePhone } from './src/webFrame';

// На широкому екрані у вебі показуємо застосунок у корпусі телефона (сам він вантажиться в iframe).
// На телефоні — на весь екран, але теж в iframe, щоб поверх працювало рецензування.
if (shouldFramePhone()) mountPhoneFrame();
else if (shouldFrameMobile()) mountMobileFrame();
else registerRootComponent(App);
