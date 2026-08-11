# English Talk MVP

A static, text-first English conversation practice demo built with Vite, React, and TypeScript. It needs no account, API key, backend, or network service after installation.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production bundle with `npm run build`. Run the behavior tests with `npm test` and TypeScript validation with `npm run typecheck`.

## 60-day learning flow

- Choose any Day or curriculum topic and work through its 10 sentences in order. Answer checks accept only the stored sentence or its declared alternatives; topic/level/priority metadata, phrase slots, and the day's real mini dialogue are shown in the practice view.
- The last Day and sentence position, completed sentences, attempt counts, review queue, and favorites are saved after each answer. Reloading resumes from that position.
- Existing version 1 `english-talk.learning` data is migrated to version 2 on load. Mastered sentences, custom sentences, and completed challenge dates are preserved while the new sequential fields are initialized safely.

## Privacy and browser behavior

- Practice history stays only in this browser's `localStorage`; clearing browser site data removes it.
- The app does not send messages or audio anywhere and does not use API keys.
- Text input is the primary interaction. Voice dictation is optional and starts only after the learner presses the microphone button in browsers offering `SpeechRecognition` or `webkitSpeechRecognition`.
- Browsers may not support speech recognition, may require microphone permission, or may reject permission. In all cases text input remains available.
- Read-aloud is optional browser TTS triggered only by the learner; there is no automatic recording, playback, or sending. The app prefers an available `en-US`/`en-GB` voice whose name indicates Natural, Online, or Neural quality and uses a slightly slower learning pace. The final voice quality still depends on the browser and operating system; a cloud TTS provider would be required to guarantee a specific native voice.
