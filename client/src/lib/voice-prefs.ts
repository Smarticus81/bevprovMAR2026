export function getVoicePrefs(): { voice: string; speed: number } {
  return {
    voice: localStorage.getItem("bevpro-voice") ?? "ash",
    speed: parseFloat(localStorage.getItem("bevpro-speed") ?? "0.9"),
  };
}

export function setVoicePrefs(voice: string, speed: number) {
  localStorage.setItem("bevpro-voice", voice);
  localStorage.setItem("bevpro-speed", String(speed));
}
