declare const GEMINI_API_KEY: string;
declare const NYT_API_KEY: string;
declare const GUARDIAN_API_KEY: string;

interface Window {
  aistudio: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}
