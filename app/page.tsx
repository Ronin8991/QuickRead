"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_WPM = 320;
const DEFAULT_PIVOT = 2;
const DEFAULT_SCALE = 11;

const STORAGE_KEYS = {
  consent: "qr_consent",
  onboarded: "qr_onboarded",
  settings: "qr_settings",
  session: "qr_session"
} as const;

const MUSIC_SRC =
  "https://orangefreesounds.com/wp-content/uploads/2023/01/Ambient-relaxing-music.mp3";
const MUSIC_CREDIT_URL =
  "https://orangefreesounds.com/ambient-relaxing-music/";

const ORP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4];

type PivotMode = "auto" | "fixed";
type Theme = "light" | "dark" | "low";
type Lang = "en" | "it";
type Consent = "unknown" | "granted" | "denied";

type ParsedFile = {
  name: string;
  text: string;
};

type SavedSettings = {
  wpm: number;
  pivotMode: PivotMode;
  fixedPivot: number;
  wordScale: number;
  theme: Theme;
  lang: Lang;
  isMuted: boolean;
  demoText?: { en: string; it: string };
};

type SavedSession = {
  rawText: string;
  fileName: string | null;
  currentIndex: number;
};

const DEMO_TEXT = {
  en: "QuickRead is a calm demonstration. Keep your gaze on the red pivot letter while words flow. Adjust speed, size, and theme in settings.",
  it: "QuickRead è una dimostrazione calma. Tieni lo sguardo sulla lettera rossa mentre le parole scorrono. Regola velocità, dimensione e tema nelle impostazioni."
} as const;

const STRINGS = {
  en: {
    settings: "Settings",
    close: "Close",
    fileInput: "Load a file",
    fileHint: "PDF, DOCX, EPUB, TXT, MD",
    demoTitle: "Demo text",
    useDemo: "Use demo text",
    playback: "Playback",
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    back: "Back",
    forward: "Forward",
    wpm: "Words per minute",
    wordSize: "Word size",
    pivotMode: "Pivot mode",
    pivotAuto: "Auto (ORP)",
    pivotFixed: "Fixed letter",
    pivotIndex: "Pivot letter position",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeLow: "Low contrast",
    language: "Language",
    cookiesTitle: "Memory",
    cookiesAllow: "Allow saving settings & last position",
    cookiesOff: "Saving is off",
    clearSession: "Clear saved session",
    shortcuts: "Shortcuts",
    shortcutsText: "Space: play/pause · ←/→: word back/forward",
    musicTitle: "Background music",
    musicCredit: "Ambient Relaxing Music — Alexander Blu (CC BY 4.0)",
    mute: "Mute",
    unmute: "Unmute",
    status: "Status",
    statusText: "Loaded",
    noFile: "No file loaded",
    progress: "Progress",
    onboarding: {
      langTitle: "Choose your language",
      cookiesTitle: "Cookies & memory",
      cookiesBody: "Allow QuickRead to remember your settings and last word?",
      allow: "Allow",
      deny: "Not now",
      aboutTitle: "A focused demonstration",
      aboutBody:
        "QuickRead is a demonstration-experience designed for focus. Words appear one by one around a red pivot letter.",
      epilepsy:
        "Epilepsy warning: rapid or flashing text can trigger seizures in sensitive users.",
      soundTitle: "Sound & focus",
      soundBody:
        "For a softer atmosphere, use headphones. You can mute the music with the icon at the top right.",
      rotateTitle: "Rotate your screen",
      rotateBody: "On phones, rotate your screen horizontally for the best reading flow.",
      loadTitle: "Load a file",
      loadBody: "Upload a document or start with a short demo.",
      continue: "Continue",
      start: "Start"
    }
  },
  it: {
    settings: "Impostazioni",
    close: "Chiudi",
    fileInput: "Carica un file",
    fileHint: "PDF, DOCX, EPUB, TXT, MD",
    demoTitle: "Testo demo",
    useDemo: "Usa testo demo",
    playback: "Riproduzione",
    play: "Avvia",
    pause: "Pausa",
    restart: "Ricomincia",
    back: "Indietro",
    forward: "Avanti",
    wpm: "Parole al minuto",
    wordSize: "Dimensione parola",
    pivotMode: "Modalità pivot",
    pivotAuto: "Auto (ORP)",
    pivotFixed: "Lettera fissa",
    pivotIndex: "Posizione lettera pivot",
    theme: "Tema",
    themeLight: "Chiaro",
    themeDark: "Scuro",
    themeLow: "Basso contrasto",
    language: "Lingua",
    cookiesTitle: "Memoria",
    cookiesAllow: "Consenti di salvare impostazioni e posizione",
    cookiesOff: "Salvataggio disattivato",
    clearSession: "Cancella sessione salvata",
    shortcuts: "Scorciatoie",
    shortcutsText: "Spazio: avvia/pausa · ←/→: parola indietro/avanti",
    musicTitle: "Musica di sottofondo",
    musicCredit: "Ambient Relaxing Music — Alexander Blu (CC BY 4.0)",
    mute: "Muto",
    unmute: "Audio",
    status: "Stato",
    statusText: "Caricato",
    noFile: "Nessun file caricato",
    progress: "Progresso",
    onboarding: {
      langTitle: "Scegli la lingua",
      cookiesTitle: "Cookie & memoria",
      cookiesBody: "Consenti a QuickRead di ricordare impostazioni e ultima parola?",
      allow: "Consenti",
      deny: "Non ora",
      aboutTitle: "Una dimostrazione focalizzata",
      aboutBody:
        "QuickRead è una demonstration-experience pensata per la concentrazione. Le parole appaiono una alla volta intorno alla lettera pivot rossa.",
      epilepsy:
        "Avviso epilessia: testo rapido o lampeggiante può scatenare crisi in utenti sensibili.",
      soundTitle: "Suono & focus",
      soundBody:
        "Per un’atmosfera morbida, usa le cuffie. Puoi disattivare la musica con l’icona in alto a destra.",
      rotateTitle: "Ruota lo schermo",
      rotateBody: "Su mobile, ruota lo schermo in orizzontale per una lettura migliore.",
      loadTitle: "Carica un file",
      loadBody: "Carica un documento o avvia la demo.",
      continue: "Continua",
      start: "Inizia"
    }
  }
} as const;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function pivotForWord(word: string, mode: PivotMode, fixedPivot: number) {
  if (!word) return 0;
  if (mode === "fixed") {
    return Math.min(Math.max(fixedPivot, 0), word.length - 1);
  }
  const length = Math.min(word.length, ORP_TABLE.length - 1);
  return ORP_TABLE[length] ?? Math.floor(word.length / 2);
}

function splitWord(word: string, pivotIndex: number) {
  const clamped = Math.min(Math.max(pivotIndex, 0), Math.max(word.length - 1, 0));
  return {
    left: word.slice(0, clamped),
    pivot: word.charAt(clamped) || "",
    right: word.slice(clamped + 1)
  };
}

function getWordDelay(word: string, wpm: number) {
  const base = Math.max(60000 / Math.max(wpm, 1), 40);
  const trimmed = word.trim();
  if (!trimmed) return base;

  let pause = 0;
  if (/[.!?]$/.test(trimmed)) pause += 320;
  if (/[,:;]$/.test(trimmed)) pause += 180;
  if (/—|--/.test(trimmed)) pause += 160;
  const extraLength = Math.max(trimmed.length - 6, 0);
  pause += extraLength * 14;

  return base + pause;
}

async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf");
  const pdfjs = (pdfjsModule as { default?: any }).default ?? pdfjsModule;
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js";

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    text += ` ${pageText}`;
  }
  return text;
}

async function parseDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function parseEpub(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const epubModule = await import("epubjs");
  const ePub = epubModule.default ?? epubModule;
  const book = ePub(buffer);
  await book.ready;

  const parts: string[] = [];
  const spineItems = (book as any)?.spine?.spineItems ?? [];
  for (const item of spineItems as any[]) {
    try {
      await item.load(book.load.bind(book));
      const text = item?.document?.documentElement?.textContent ?? "";
      parts.push(text);
    } finally {
      item.unload();
    }
  }
  return parts.join(" ");
}

async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase();
  let text = "";

  if (ext === "pdf") {
    text = await parsePdf(file);
  } else if (ext === "docx") {
    text = await parseDocx(file);
  } else if (ext === "epub") {
    text = await parseEpub(file);
  } else {
    text = await file.text();
  }

  return { name, text };
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [pivotMode, setPivotMode] = useState<PivotMode>("auto");
  const [fixedPivot, setFixedPivot] = useState(DEFAULT_PIVOT);
  const [wordScale, setWordScale] = useState(DEFAULT_SCALE);
  const [pivotOffset, setPivotOffset] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLang] = useState<Lang>("en");
  const [consent, setConsent] = useState<Consent>("unknown");
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [demoText, setDemoText] = useState<{ en: string; it: string }>({
    en: DEMO_TEXT.en,
    it: DEMO_TEXT.it
  });

  const wordRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const t = STRINGS[lang];
  const displayWord = words[currentIndex] ?? "";
  const hasSession = Boolean(rawText && words.length > 0);

  const pivotIndex = useMemo(
    () => pivotForWord(displayWord, pivotMode, fixedPivot),
    [displayWord, pivotMode, fixedPivot]
  );

  const { left, pivot, right } = useMemo(
    () => splitWord(displayWord, pivotIndex),
    [displayWord, pivotIndex]
  );

  const percent = words.length
    ? Math.round(((currentIndex + 1) / words.length) * 100)
    : 0;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const setMuteState = (next: boolean) => {
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
      if (!next) {
        audioRef.current.play().catch(() => undefined);
      }
    }
  };

  useEffect(() => {
    if (!isPlaying || words.length === 0) {
      clearTimer();
      return;
    }

    const delay = getWordDelay(displayWord, wpm);
    timerRef.current = window.setTimeout(() => {
      setCurrentIndex((prev) => {
        if (prev + 1 >= words.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return clearTimer;
  }, [isPlaying, wpm, currentIndex, words.length, displayWord]);

  useEffect(() => {
    if (!wordRef.current || !displayWord) {
      setPivotOffset(0);
      return;
    }

    const style = window.getComputedStyle(wordRef.current);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.font = font;
    const leftWidth = ctx.measureText(left).width;
    const pivotWidth = ctx.measureText(pivot).width;
    setPivotOffset(leftWidth + pivotWidth / 2);
  }, [displayWord, left, pivot, wordScale]);

  useEffect(() => {
    document.body.classList.remove("theme-dark", "theme-low-contrast");
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
    } else if (theme === "low") {
      document.body.classList.add("theme-low-contrast");
    }
  }, [theme]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const savedConsent = localStorage.getItem(STORAGE_KEYS.consent);
    if (savedConsent === "granted" || savedConsent === "denied") {
      setConsent(savedConsent);
    }

    const savedOnboarding = localStorage.getItem(STORAGE_KEYS.onboarded);
    if (savedOnboarding === "true") {
      setShowOnboarding(false);
    }

    if (savedConsent === "granted") {
      try {
        const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings) as SavedSettings;
          setWpm(parsed.wpm ?? DEFAULT_WPM);
          setPivotMode(parsed.pivotMode ?? "auto");
          setFixedPivot(parsed.fixedPivot ?? DEFAULT_PIVOT);
          setWordScale(parsed.wordScale ?? DEFAULT_SCALE);
          setTheme(parsed.theme ?? "light");
          setLang(parsed.lang ?? "en");
          setIsMuted(parsed.isMuted ?? true);
          if (parsed.demoText) {
            setDemoText({
              en: parsed.demoText.en ?? DEMO_TEXT.en,
              it: parsed.demoText.it ?? DEMO_TEXT.it
            });
          }
        }

        const savedSession = localStorage.getItem(STORAGE_KEYS.session);
        if (savedSession) {
          const parsedSession = JSON.parse(savedSession) as SavedSession;
          const normalized = normalizeText(parsedSession.rawText || "");
          if (normalized) {
            const nextWords = normalized.split(" ");
            setRawText(normalized);
            setWords(nextWords);
            setCurrentIndex(
              Math.min(parsedSession.currentIndex ?? 0, nextWords.length - 1)
            );
            setFileName(parsedSession.fileName ?? "Previous session");
          }
        }
      } catch {
        // Ignore corrupted storage
      }
    }
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    const payload: SavedSettings = {
      wpm,
      pivotMode,
      fixedPivot,
      wordScale,
      theme,
      lang,
      isMuted,
      demoText
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload));
  }, [consent, wpm, pivotMode, fixedPivot, wordScale, theme, lang, isMuted, demoText]);

  useEffect(() => {
    if (consent !== "granted") return;
    if (!rawText) return;
    const payload: SavedSession = {
      rawText,
      fileName,
      currentIndex
    };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(payload));
  }, [consent, rawText, currentIndex, fileName]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (event.code === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(prev + 1, words.length - 1));
      } else if (event.code === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.code === "Escape") {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [words.length]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);

    try {
      const parsed = await parseFile(file);
      const normalized = normalizeText(parsed.text);

      if (!normalized) {
        throw new Error("No readable text found in this file.");
      }

      const nextWords = normalized.split(" ");
      setFileName(parsed.name);
      setRawText(normalized);
      setWords(nextWords);
      setCurrentIndex(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read file.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const useDemoText = () => {
    const demo = demoText[lang];
    const normalized = normalizeText(demo);
    const nextWords = normalized.split(" ");
    setFileName("Demo");
    setRawText(normalized);
    setWords(nextWords);
    setCurrentIndex(0);
  };

  const togglePlay = () => {
    if (words.length === 0) return;
    setIsPlaying((prev) => !prev);
  };

  const restart = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const jump = (offset: number) => {
    setCurrentIndex((prev) => {
      const next = prev + offset;
      return Math.min(Math.max(next, 0), Math.max(words.length - 1, 0));
    });
  };

  const handleConsent = (value: Consent) => {
    setConsent(value);
    localStorage.setItem(STORAGE_KEYS.consent, value);
    if (value === "denied") {
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.session);
    }
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(STORAGE_KEYS.onboarded, "true");
  };

  const goNext = () => {
    setOnboardingStep((prev) => Math.min(prev + 1, 5));
  };

  const goPrev = () => {
    setOnboardingStep((prev) => Math.max(prev - 1, 0));
  };

  const currentThemeClass =
    theme === "dark" ? "theme-dark" : theme === "low" ? "theme-low-contrast" : "";

  const renderOnboarding = () => {
    if (!showOnboarding) return null;

    return (
      <div className={`overlay ${currentThemeClass}`}>
        <div className="panel onboarding">
          {onboardingStep === 0 && (
            <div className="slide">
              <h2>{t.onboarding.langTitle}</h2>
              <div className="slide-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setLang("en");
                    goNext();
                  }}
                >
                  English
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setLang("it");
                    goNext();
                  }}
                >
                  Italiano
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="slide">
              <h2>{t.onboarding.cookiesTitle}</h2>
              <p>{t.onboarding.cookiesBody}</p>
              <div className="slide-actions">
                <button
                  className="primary"
                  onClick={() => {
                    handleConsent("granted");
                    goNext();
                  }}
                >
                  {t.onboarding.allow}
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    handleConsent("denied");
                    goNext();
                  }}
                >
                  {t.onboarding.deny}
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="slide">
              <h2>{t.onboarding.aboutTitle}</h2>
              <p>{t.onboarding.aboutBody}</p>
              <p className="warning">{t.onboarding.epilepsy}</p>
              <div className="slide-actions">
                <button className="primary" onClick={goNext}>
                  {t.onboarding.continue}
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="slide">
              <h2>{t.onboarding.soundTitle}</h2>
              <p>{t.onboarding.soundBody}</p>
              <div className="slide-actions">
                <button
                  className="ghost"
                  onClick={() => setMuteState(!isMuted)}
                >
                  {isMuted ? t.unmute : t.mute}
                </button>
                <button className="primary" onClick={goNext}>
                  {t.onboarding.continue}
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 4 && (
            <div className="slide">
              <h2>{t.onboarding.rotateTitle}</h2>
              <p>{t.onboarding.rotateBody}</p>
              <div className="slide-actions">
                <button className="primary" onClick={goNext}>
                  {t.onboarding.continue}
                </button>
              </div>
            </div>
          )}

          {onboardingStep === 5 && (
            <div className="slide">
              <h2>{t.onboarding.loadTitle}</h2>
              <p>{t.onboarding.loadBody}</p>
              <div className="demo-block">
                <div className="demo-title">{t.demoTitle}</div>
                <div className="demo-text">{demoText[lang]}</div>
                <button className="ghost" onClick={useDemoText}>
                  {t.useDemo}
                </button>
              </div>
              <div className="slide-actions">
                <label className="file-button">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.epub,.text"
                    onChange={onFileChange}
                  />
                  {t.fileInput}
                </label>
                <button
                  className="primary"
                  onClick={() => {
                    completeOnboarding();
                    setIsSettingsOpen(true);
                  }}
                >
                  {t.onboarding.start}
                </button>
              </div>
              <div className="slide-actions muted">
                <button className="ghost" onClick={goPrev}>
                  {t.back}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="shell">
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" />

      <header className="topbar">
        <div className="brand-logo">
          <div className="brand-title">
            Qu<span className="brand-i">i</span>ckRead<span className="brand-dot">.</span>
          </div>
          <div className="brand-line" aria-hidden="true" />
        </div>
        <div className="icon-row">
          <button
            className="icon-button"
            onClick={() => setMuteState(!isMuted)}
            aria-label={isMuted ? t.unmute : t.mute}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 9v6h4l5 4V5L8 9H4zm11.5 3 3.5 3.5m0-3.5-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 9v6h4l5 4V5L8 9H4zm10.5-1.5a6 6 0 0 1 0 9m2.5-11a9 9 0 0 1 0 13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <button
            className="icon-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label={t.settings}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.5 3.5a6.7 6.7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a6.9 6.9 0 0 0-2-1.2l-.4-2.6h-4l-.4 2.6a6.9 6.9 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a6.7 6.7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a6.9 6.9 0 0 0 2 1.2l.4 2.6h4l.4-2.6a6.9 6.9 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <section className="reader-stage" style={{ ["--word-scale" as any]: `${wordScale}vw` }}>
        <div className="reader-line" aria-hidden="true" />
        <span
          ref={wordRef}
          className="reader-word"
          style={{ transform: `translateX(${-pivotOffset}px)` }}
        >
          <span className="reader-left">{left}</span>
          <span className="reader-pivot">{pivot}</span>
          <span className="reader-right">{right}</span>
        </span>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {hasSession && !isPlaying && (
          <button className="resume-button" onClick={togglePlay}>
            {t.play}
          </button>
        )}
      </section>

      <footer className="signature">
        <div className="signature-line" aria-hidden="true" />
        Massimo Burigana | ©2026, All rights reserved.
      </footer>

      {renderOnboarding()}

      {isSettingsOpen && (
        <div className={`overlay ${currentThemeClass}`}>
          <div className="panel settings">
            <div className="settings-header">
              <h2>{t.settings}</h2>
              <button className="ghost" onClick={() => setIsSettingsOpen(false)}>
                {t.close}
              </button>
            </div>

            <div className="settings-grid">
              <div className="settings-section">
                <div className="section-title">{t.fileInput}</div>
                <div className="section-note">{t.fileHint}</div>
                <label className="file-button">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.epub,.text"
                    onChange={onFileChange}
                  />
                  {isLoading ? "Loading..." : t.fileInput}
                </label>
                <button className="ghost" onClick={useDemoText}>
                  {t.useDemo}
                </button>
                <div className="status-row">
                  <strong>{t.status}:</strong>
                  <span>
                    {fileName
                      ? `${t.statusText}: ${fileName}`
                      : t.noFile}
                  </span>
                </div>
                {error && <div className="error-text">{error}</div>}
              </div>

              <div className="settings-section">
                <div className="section-title">{t.playback}</div>
                <div className="button-row">
                  <button className="primary" onClick={togglePlay}>
                    {isPlaying ? t.pause : t.play}
                  </button>
                  <button className="ghost" onClick={restart}>
                    {t.restart}
                  </button>
                  <button className="ghost" onClick={() => jump(-1)}>
                    {t.back}
                  </button>
                  <button className="ghost" onClick={() => jump(1)}>
                    {t.forward}
                  </button>
                </div>
                <div className="status-row">
                  <strong>{t.progress}:</strong>
                  <span>
                    {words.length
                      ? `${currentIndex + 1} / ${words.length} · ${percent}%`
                      : "0 / 0"}
                  </span>
                </div>
                <div className="setting">
                  <label htmlFor="wpm">{t.wpm}</label>
                  <input
                    id="wpm"
                    type="range"
                    min={120}
                    max={900}
                    value={wpm}
                    onChange={(event) => setWpm(Number(event.target.value))}
                  />
                  <div className="setting-value">{wpm} wpm</div>
                </div>
                <div className="setting">
                  <label htmlFor="scale">{t.wordSize}</label>
                  <input
                    id="scale"
                    type="range"
                    min={6}
                    max={16}
                    value={wordScale}
                    onChange={(event) => setWordScale(Number(event.target.value))}
                  />
                  <div className="setting-value">{wordScale} vw</div>
                </div>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.pivotMode}</div>
                <div className="setting">
                  <label htmlFor="pivot">{t.pivotMode}</label>
                  <select
                    id="pivot"
                    value={pivotMode}
                    onChange={(event) => setPivotMode(event.target.value as PivotMode)}
                  >
                    <option value="auto">{t.pivotAuto}</option>
                    <option value="fixed">{t.pivotFixed}</option>
                  </select>
                </div>
                <div className="setting">
                  <label htmlFor="pivotIndex">{t.pivotIndex}</label>
                  <input
                    id="pivotIndex"
                    type="range"
                    min={0}
                    max={6}
                    value={fixedPivot}
                    onChange={(event) => setFixedPivot(Number(event.target.value))}
                  />
                  <div className="setting-value">{fixedPivot + 1}</div>
                </div>
                <div className="setting">
                  <label htmlFor="theme">{t.theme}</label>
                  <select
                    id="theme"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as Theme)}
                  >
                    <option value="light">{t.themeLight}</option>
                    <option value="dark">{t.themeDark}</option>
                    <option value="low">{t.themeLow}</option>
                  </select>
                </div>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.language}</div>
                <div className="button-row">
                  <button
                    className={lang === "en" ? "primary" : "ghost"}
                    onClick={() => setLang("en")}
                  >
                    English
                  </button>
                  <button
                    className={lang === "it" ? "primary" : "ghost"}
                    onClick={() => setLang("it")}
                  >
                    Italiano
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.demoTitle}</div>
                <div className="setting">
                  <label htmlFor="demo-en">Demo (EN)</label>
                  <textarea
                    id="demo-en"
                    value={demoText.en}
                    onChange={(event) =>
                      setDemoText((prev) => ({ ...prev, en: event.target.value }))
                    }
                  />
                </div>
                <div className="setting">
                  <label htmlFor="demo-it">Demo (IT)</label>
                  <textarea
                    id="demo-it"
                    value={demoText.it}
                    onChange={(event) =>
                      setDemoText((prev) => ({ ...prev, it: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.cookiesTitle}</div>
                <div className="setting">
                  <label>{t.cookiesAllow}</label>
                  <div className="button-row">
                    <button
                      className={consent === "granted" ? "primary" : "ghost"}
                      onClick={() => handleConsent("granted")}
                    >
                      {t.onboarding.allow}
                    </button>
                    <button
                      className={consent === "denied" ? "primary" : "ghost"}
                      onClick={() => handleConsent("denied")}
                    >
                      {t.onboarding.deny}
                    </button>
                  </div>
                  {consent === "denied" && (
                    <div className="section-note">{t.cookiesOff}</div>
                  )}
                </div>
                <button
                  className="ghost"
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEYS.session);
                    setRawText("");
                    setWords([]);
                    setCurrentIndex(0);
                    setFileName(null);
                  }}
                >
                  {t.clearSession}
                </button>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.musicTitle}</div>
                <div className="button-row">
                  <button className="ghost" onClick={() => setMuteState(!isMuted)}>
                    {isMuted ? t.unmute : t.mute}
                  </button>
                </div>
                <div className="section-note">
                  <a href={MUSIC_CREDIT_URL} target="_blank" rel="noreferrer">
                    {t.musicCredit}
                  </a>
                </div>
              </div>

              <div className="settings-section">
                <div className="section-title">{t.shortcuts}</div>
                <div className="section-note">{t.shortcutsText}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
