"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

// The parts of the Web Speech API used here. Chrome and Safari still prefix it, so it's read off
// window by hand rather than relying on the DOM types.
type SpeechResults = ArrayLike<ArrayLike<{ transcript: string }>>;

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: SpeechResults }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function getRecognitionClass() {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

const subscribeToNothing = () => () => {};

// Failures worth telling the user about; "no-speech" and "aborted" just end the session quietly.
const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Allow microphone access in your browser to use voice input.",
  "service-not-allowed": "Voice input is blocked in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

type MicButtonProps = {
  value: string;
  onChange: (value: string) => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
};

// Dictates into a text field: speech is added after the field's current text and updates live.
// Renders nothing in browsers without speech recognition, such as Firefox.
export default function MicButton({ value, onChange, onListeningChange, disabled }: MicButtonProps) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(getRecognitionClass()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  // Cuts the mic when the field gets disabled (the prompt was submitted) or the button unmounts,
  // so late results can't write into the field afterwards.
  useEffect(() => () => recognitionRef.current?.abort(), [disabled]);

  const updateListening = (next: boolean) => {
    setListening(next);
    onListeningChange?.(next);
  };

  const toggle = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const RecognitionClass = getRecognitionClass();
    if (!RecognitionClass) return;

    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language;

    const base = value.trimEnd();
    recognition.onresult = ({ results }) => {
      const spoken = Array.from(results, (result) => result[0].transcript).join("").trim();
      onChange(base && spoken ? `${base} ${spoken}` : base || spoken);
    };
    recognition.onerror = ({ error }) => {
      const message = ERROR_MESSAGES[error];
      if (message) toast.error(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      updateListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    updateListening(true);
  };

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      title={listening ? "Stop voice input" : "Start voice input"}
      className={cn(
        "rounded-full text-muted-foreground",
        listening && "animate-pulse bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
      )}
    >
      <Mic className="size-4" />
    </Button>
  );
}

// Named export too, for `import { MicButton } from "@/components/MicButton"`.
export { MicButton };
