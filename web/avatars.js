// Character faces (SVG, 100x100). The expression follows the agent's mood from its last decision.
(function () {
  const INK = "#0a0c10";
  const EYES = {
    euphoric: `<path d="M32 52 Q38 43 44 52 M56 52 Q62 43 68 52" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
    confident: `<circle cx="38" cy="49" r="4.6" fill="${INK}"/><circle cx="62" cy="49" r="4.6" fill="${INK}"/><circle cx="39.6" cy="47.4" r="1.4" fill="#fff"/><circle cx="63.6" cy="47.4" r="1.4" fill="#fff"/>`,
    calm: `<circle cx="38" cy="50" r="4.2" fill="${INK}"/><circle cx="62" cy="50" r="4.2" fill="${INK}"/>`,
    nervous: `<circle cx="38" cy="50" r="5.5" fill="#fff"/><circle cx="62" cy="50" r="5.5" fill="#fff"/><circle cx="38" cy="51" r="2.6" fill="${INK}"/><circle cx="62" cy="51" r="2.6" fill="${INK}"/><path d="M76 34 q4 8 0 11 q-4 -3 0 -11z" fill="#9fe3ff"/>`,
    salty: `<circle cx="38" cy="51" r="4.2" fill="${INK}"/><circle cx="62" cy="51" r="4.2" fill="${INK}"/><path d="M30 40 L45 45 M70 40 L55 45" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    smug: `<path d="M32 50 L44 50 M56 50 L68 50" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M31 43 L45 41 M55 43 L69 45" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  };
  const MOUTH = {
    euphoric: `<path d="M37 63 Q50 80 63 63 Z" fill="${INK}"/><path d="M43 71 Q50 75 57 71" stroke="#ff7b8a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    confident: `<path d="M39 64 Q50 73 61 64" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    calm: `<path d="M42 67 Q50 71 58 67" stroke="${INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`,
    nervous: `<path d="M37 68 q3.25 -4 6.5 0 t6.5 0 t6.5 0 t6.5 0" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    salty: `<path d="M40 71 Q50 62 60 71" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    smug: `<path d="M41 68 Q53 71 61 62" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  };
  // [behind the head, on top of the face, hides the eyes?]
  const GEAR = {
    rocket: [
      `<path d="M28 34 L33 12 L41 26 L50 6 L58 25 L67 11 L72 34 Z" fill="#ffb21f"/>`,
      `<rect x="27" y="42" width="21" height="14" rx="5" fill="${INK}"/><rect x="52" y="42" width="21" height="14" rx="5" fill="${INK}"/><path d="M48 47 L52 47" stroke="${INK}" stroke-width="3"/><path d="M31 45 L37 45" stroke="#5a6372" stroke-width="2.5" stroke-linecap="round"/><path d="M56 45 L62 45" stroke="#5a6372" stroke-width="2.5" stroke-linecap="round"/>`,
      true],
    boomer: [
      "",
      `<path d="M22 33 Q50 6 78 33 L82 37 Q50 30 18 37 Z" fill="#2f3d55"/><rect x="18" y="33" width="64" height="5" rx="2.5" fill="#24304a"/>
       <circle cx="38" cy="50" r="9" fill="none" stroke="${INK}" stroke-width="2.6"/><circle cx="62" cy="50" r="9" fill="none" stroke="${INK}" stroke-width="2.6"/><path d="M47 50 L53 50" stroke="${INK}" stroke-width="2.6"/>
       <path d="M37 61 Q44 56 50 61 Q56 56 63 61 Q57 66 50 63 Q43 66 37 61 Z" fill="#e8e8e8"/>`,
      false],
    sigma: [
      "",
      `<path d="M20 38 Q24 16 50 15 Q74 15 80 36 Q66 26 46 27 Q34 28 20 38 Z" fill="#14563f"/>
       <rect x="28" y="43" width="20" height="13" rx="2" fill="none" stroke="${INK}" stroke-width="2.4"/><rect x="52" y="43" width="20" height="13" rx="2" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M48 48 L52 48" stroke="${INK}" stroke-width="2.4"/>`,
      false],
    doomer: [
      `<path d="M10 100 L14 50 Q16 8 50 8 Q84 8 86 50 L90 100 Z" fill="#2a2140"/>`,
      `<path d="M31 57 Q38 60 45 57 M55 57 Q62 60 69 57" stroke="#5a3f8f" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      false],
    hype: [
      `<path d="M14 54 Q14 10 50 10 Q86 10 86 54" stroke="#2b2f37" stroke-width="7" fill="none"/>`,
      `<rect x="9" y="44" width="13" height="24" rx="6" fill="#2b2f37"/><rect x="78" y="44" width="13" height="24" rx="6" fill="#2b2f37"/><path d="M84 66 Q84 82 66 80" stroke="#2b2f37" stroke-width="3" fill="none"/><circle cx="64" cy="80" r="4" fill="#2b2f37"/>`,
      false],
    monkey: [
      `<circle cx="17" cy="50" r="11" fill="#8a5f3c"/><circle cx="17" cy="50" r="6" fill="#d9a77a"/><circle cx="83" cy="50" r="11" fill="#8a5f3c"/><circle cx="83" cy="50" r="6" fill="#d9a77a"/>`,
      `<ellipse cx="50" cy="66" rx="20" ry="15" fill="#d9a77a"/><circle cx="46" cy="60" r="1.8" fill="${INK}"/><circle cx="54" cy="60" r="1.8" fill="${INK}"/>`,
      false],
  };
  window.avatar = function (id, mood, color) {
    const m = EYES[mood] ? mood : "calm";
    const [back, front, hidesEyes] = GEAR[id] || ["", "", false];
    const head = id === "monkey" ? "#a8764b" : color;
    const mouth = id === "monkey" ? MOUTH[m].replace(/translate\([^)]*\)/, "") : MOUTH[m];
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${back}
      <circle cx="50" cy="54" r="34" fill="${head}"/>
      <ellipse cx="50" cy="40" rx="20" ry="9" fill="#fff" opacity=".13"/>
      ${hidesEyes ? "" : EYES[m]}${id === "monkey" ? front + `<g transform="translate(0 4)">${mouth}</g>` : front + mouth}
    </svg>`;
  };
})();
