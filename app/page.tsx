"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_WPM = 320;
const DEFAULT_PIVOT = 2;
const DEFAULT_SCALE = 11;

const ORP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4];

type PivotMode = "auto" | "fixed";

type ParsedFile = {
  name: string;
  text: string;
};

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
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js";

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
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
  const spineItems = book?.spine?.spineItems ?? [];
  for (const item of spineItems) {
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
  } else if (ext === "txt" || ext === "md" || ext === "text") {
    text = await file.text();
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

  const wordRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const displayWord = words[currentIndex] ?? "";

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
  }, [isPlaying, wpm, currentIndex, words.length]);

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
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (event.code === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(prev + 1, words.length - 1));
      } else if (event.code === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
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

  return (
    <main>
      <section className="header">
        <div className="brand">
          <h1>QuickRead</h1>
          <span>Lightning-fast reading for books, PDFs, and docs.</span>
        </div>
        <div className="notice">
          Upload a file and hit play. Space toggles play, arrows move a word at a
          time. No files are stored.
        </div>
      </section>

      <section className="panel dropzone">
        <div>
          <strong>File input</strong>
          <div className="notice">
            Supports PDF, DOCX, TXT, MD, EPUB. Other formats will try to load as
            plain text.
          </div>
        </div>
        <div className="transport">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.epub,.text"
            onChange={onFileChange}
          />
          <button onClick={togglePlay} disabled={!words.length || isLoading}>
            {isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={restart} className="ghost" disabled={!words.length}>
            Restart
          </button>
        </div>
        {fileName && (
          <div className="notice">
            Loaded: <strong>{fileName}</strong> ({words.length} words)
          </div>
        )}
        {error && <div className="notice">{error}</div>}
      </section>

      <section className="panel reader">
        <div className="reader-line" aria-hidden="true" />
        <span
          ref={wordRef}
          className="reader-word"
          style={{
            transform: `translateX(${-pivotOffset}px)`,
            fontSize: `clamp(38px, ${wordScale}vw, 140px)`
          }}
        >
          <span className="reader-left">{left}</span>
          <span className="reader-pivot">{pivot}</span>
          <span className="reader-right">{right}</span>
        </span>
      </section>

      <section className="panel">
        <div className="controls">
          <div className="control">
            <label htmlFor="wpm">Words per minute</label>
            <input
              id="wpm"
              type="range"
              min={120}
              max={900}
              value={wpm}
              onChange={(event) => setWpm(Number(event.target.value))}
            />
            <div>{wpm} wpm</div>
          </div>
          <div className="control">
            <label htmlFor="scale">Word size</label>
            <input
              id="scale"
              type="range"
              min={6}
              max={16}
              value={wordScale}
              onChange={(event) => setWordScale(Number(event.target.value))}
            />
            <div>{wordScale} vw</div>
          </div>
          <div className="control">
            <label htmlFor="pivot">Pivot mode</label>
            <select
              id="pivot"
              value={pivotMode}
              onChange={(event) =>
                setPivotMode(event.target.value as PivotMode)
              }
            >
              <option value="auto">Auto (ORP)</option>
              <option value="fixed">Fixed letter</option>
            </select>
          </div>
          <div className="control">
            <label htmlFor="pivotIndex">Pivot letter position</label>
            <input
              id="pivotIndex"
              type="range"
              min={0}
              max={6}
              value={fixedPivot}
              onChange={(event) => setFixedPivot(Number(event.target.value))}
            />
            <div>Index {fixedPivot + 1}</div>
          </div>
        </div>

        <div className="transport" style={{ marginTop: 16 }}>
          <button className="primary" onClick={togglePlay}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button className="ghost" onClick={() => jump(-1)}>
            Back
          </button>
          <button className="ghost" onClick={() => jump(1)}>
            Forward
          </button>
          <span className="progress">
            {words.length ? `${currentIndex + 1} / ${words.length}` : "0 / 0"} · {percent}%
          </span>
        </div>
      </section>

      {rawText && (
        <section className="panel notice">
          Tip: keep the red pivot letter steady; let the words flow. If the file
          looks empty, export it as text or PDF first.
        </section>
      )}
    </main>
  );
}
