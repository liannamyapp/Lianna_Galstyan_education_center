/** Armenian → Latin (passport style), for names on the English certificate. */
const MAP: Record<string, string> = {
  ա: "a", բ: "b", գ: "g", դ: "d", ե: "e", զ: "z", է: "e", ը: "y", թ: "t", ժ: "zh", ի: "i", լ: "l", խ: "kh", ծ: "ts", կ: "k", հ: "h", ձ: "dz", ղ: "gh", ճ: "ch", մ: "m", յ: "y", ն: "n", շ: "sh", ո: "o", չ: "ch", պ: "p", ջ: "j", ռ: "r", ս: "s", վ: "v", տ: "t", ր: "r", ց: "ts", փ: "p", ք: "k", օ: "o", ֆ: "f", և: "ev",
};
export function hyToLatin(s: string) {
  return s.split(/(\s+|-)/).map((w) => {
    let out = "";
    const lw = w.toLowerCase();
    for (let i = 0; i < lw.length; i++) {
      const ch = lw[i], next = lw[i + 1];
      if (ch === "ո" && next === "ւ") { out += "u"; i++; continue; }
      if (i === 0 && ch === "ե") { out += "ye"; continue; }
      if (i === 0 && ch === "ո") { out += "vo"; continue; }
      out += MAP[ch] ?? ch;
    }
    return out ? out[0].toUpperCase() + out.slice(1) : out;
  }).join("");
}
