// 사람 픽토그램 + 연두색 조끼 (전임간부 조직도용, 2026-11-20 사용자 요청)
// 사용자가 보내 준 선 그림(동그란 머리, 둥근 어깨의 몸통, 팔 구분선)을 바탕으로 그렸다
const VEST = "#8fd14f"; // 연두색 조끼
const LINE = "#1f2937"; // 선 색 (진한 회색)

export function PersonIcon({ size = 56, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 120 112"
      width={size}
      height={(size * 112) / 120}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 몸통: 둥근 어깨의 사각형 */}
      <path
        d="M26 104 V76 a16 16 0 0 1 16 -16 h36 a16 16 0 0 1 16 16 V104 Z"
        fill="#ffffff"
        stroke={LINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* 연두색 조끼: 가운데 몸통을 덮고, 목 부분은 V자로 파였다 */}
      <path
        d="M44 61 H52 L60 76 L68 61 H76 V104 H44 Z"
        fill={VEST}
        stroke={LINE}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      {/* 조끼의 반사띠 느낌을 주는 옅은 줄 */}
      <path d="M45 90 H75" stroke="#e8f8d8" strokeWidth={3} strokeLinecap="round" />
      {/* 팔 구분선 */}
      <path d="M44 88 V104 M76 88 V104" stroke={LINE} strokeWidth={5} strokeLinecap="round" />
      {/* 머리 */}
      <circle cx={60} cy={32} r={18} fill="#ffffff" stroke={LINE} strokeWidth={5} />
    </svg>
  );
}
