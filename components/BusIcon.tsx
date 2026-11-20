// 버스 픽토그램 (노동조합 차량 지원 화면용, 2026-11-20 사용자 요청)
// 앞에서 비스듬히 본 단순한 버스: 네이비 몸통, 흰 창문, 바퀴 2개
const BODY = "#162556"; // 앱 주 색 (네이비)
const LINE = "#0d1838";

export function BusIcon({ size = 72, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      width={size}
      height={(size * 96) / 120}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 몸통 */}
      <rect x="8" y="10" width="104" height="66" rx="12" fill={BODY} stroke={LINE} strokeWidth={3} />
      {/* 지붕 표시등 */}
      <rect x="46" y="4" width="28" height="8" rx="3" fill="#8fd14f" stroke={LINE} strokeWidth={2} />
      {/* 창문 3칸 */}
      <rect x="18" y="20" width="24" height="22" rx="4" fill="#ffffff" />
      <rect x="48" y="20" width="24" height="22" rx="4" fill="#ffffff" />
      <rect x="78" y="20" width="24" height="22" rx="4" fill="#ffffff" />
      {/* 옆 줄무늬 */}
      <rect x="8" y="50" width="104" height="6" fill="#8fd14f" />
      {/* 전조등 */}
      <circle cx="20" cy="66" r="4" fill="#fde68a" />
      <circle cx="100" cy="66" r="4" fill="#fde68a" />
      {/* 바퀴 */}
      <circle cx="32" cy="80" r="11" fill="#1f2937" stroke="#ffffff" strokeWidth={3} />
      <circle cx="88" cy="80" r="11" fill="#1f2937" stroke="#ffffff" strokeWidth={3} />
    </svg>
  );
}
