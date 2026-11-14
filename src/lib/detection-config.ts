// Classes do modelo COCO-SSD que podem ser marcadas como "proibidas".
// Nomes em inglês = nome que o modelo retorna; label = texto exibido.
export const DETECTABLE_CLASSES: { id: string; label: string }[] = [
  { id: "person", label: "Pessoa" },
  { id: "cell phone", label: "Celular" },
  { id: "knife", label: "Faca" },
  { id: "scissors", label: "Tesoura" },
  { id: "bottle", label: "Garrafa" },
  { id: "laptop", label: "Notebook" },
  { id: "book", label: "Livro" },
  { id: "dog", label: "Cachorro" },
  { id: "cat", label: "Gato" },
];

// Marcadas por padrão ao abrir a página.
export const DEFAULT_FORBIDDEN = ["cell phone", "knife", "scissors"];

// Confiança mínima (0 a 1) para considerar uma detecção.
export const MIN_SCORE = 0.6;

// Tempo mínimo entre dois alertas da mesma classe (ms).
export const ALERT_COOLDOWN_MS = 5000;

// Intervalo entre análises de quadros (ms). Menor = mais CPU.
export const DETECT_INTERVAL_MS = 300;

export function labelFor(id: string): string {
  return DETECTABLE_CLASSES.find((c) => c.id === id)?.label ?? id;
}
