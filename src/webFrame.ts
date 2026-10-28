// Веб-версія на широкому екрані: замість розтягнутого на все вікно застосунку
// показуємо «корпус телефона», а сам застосунок вантажимо всередину нього в iframe.
// Так усередині вікно має справжні мобільні розміри (useWindowDimensions, модальні вікна тощо).
import { Platform } from 'react-native';

const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 14;
// Вужче за це вікно вважаємо телефоном/планшетом і показуємо застосунок як є.
const MIN_FRAME_WIDTH = 700;

export function shouldFramePhone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  let embedded = true;
  try {
    embedded = window.self !== window.top;
  } catch {
    embedded = true;
  }
  if (embedded) return false;
  if (/[?&]noframe\b/.test(window.location.search)) return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return window.innerWidth >= MIN_FRAME_WIDTH && !coarse;
}

export function mountPhoneFrame(): void {
  const css = `
    html, body, #root { height: 100%; margin: 0; }
    body {
      background: radial-gradient(ellipse at top, #3a2f24 0%, #1c1712 70%);
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .pf-phone {
      position: relative; flex: none;
      width: ${SCREEN_W + BEZEL * 2}px; height: ${SCREEN_H + BEZEL * 2}px;
      padding: ${BEZEL}px; box-sizing: border-box; border-radius: 56px;
      background: linear-gradient(145deg, #2b2b2e, #0d0d0f);
      box-shadow: 0 0 0 2px #4a4a50, 0 0 0 4px #1a1a1c, 0 30px 80px rgba(0,0,0,.6);
      transform-origin: center center;
    }
    .pf-phone::before, .pf-phone::after {
      content: ''; position: absolute; width: 4px; border-radius: 2px; background: #3a3a3f;
    }
    .pf-phone::before { left: -6px; top: 160px; height: 60px; box-shadow: 0 80px 0 #3a3a3f; }
    .pf-phone::after { right: -6px; top: 210px; height: 90px; }
    .pf-screen {
      position: relative; width: 100%; height: 100%;
      border-radius: 42px; overflow: hidden; background: #f6f1ea;
    }
    .pf-screen iframe { width: 100%; height: 100%; border: 0; display: block; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const phone = document.createElement('div');
  phone.className = 'pf-phone';
  const screen = document.createElement('div');
  screen.className = 'pf-screen';
  const frame = document.createElement('iframe');
  frame.title = document.title;
  frame.src = window.location.href;
  screen.appendChild(frame);
  phone.appendChild(screen);

  const root = document.getElementById('root') ?? document.body;
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'center';
  root.replaceChildren(phone);

  // Якщо вікно нижче за телефон — пропорційно зменшуємо корпус.
  const fit = () => {
    const scale = Math.min(1, (window.innerHeight - 32) / (SCREEN_H + BEZEL * 2));
    phone.style.transform = scale < 1 ? `scale(${scale})` : '';
  };
  fit();
  window.addEventListener('resize', fit);
}
