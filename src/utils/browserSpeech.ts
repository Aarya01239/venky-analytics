export function stopSpeech(): void {
  window.speechSynthesis?.cancel();
}

export function speak(text: string, language: 'en' | 'te', rate: number, onError: (message: string) => void): void {
  const synthesis = window.speechSynthesis;
  if (!synthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    onError('Speech playback is unavailable. Read the transcript on this device.');
    return;
  }

  const voice = synthesis.getVoices().find(candidate => candidate.lang.toLowerCase().split(/[-_]/)[0] === language);
  if (language === 'te' && !voice) {
    onError('A Telugu voice is unavailable on this device right now. Read the Telugu text or try again after browser voices load.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'te' ? 'te-IN' : 'en-IN';
  utterance.rate = rate;
  if (voice) utterance.voice = voice;
  utterance.onerror = event => {
    if (event.error !== 'canceled' && event.error !== 'interrupted') onError('Playback failed. The transcript is available below.');
  };
  synthesis.cancel();
  synthesis.speak(utterance);
}

export interface BrowserRecognition {
  lang: string;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export function createRecognition(): BrowserRecognition | null {
  const browser = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}
