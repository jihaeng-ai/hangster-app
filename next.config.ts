import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Vercel 배포본은 data/samples/의 샘플 파일을 읽는다 — 서버 코드와 함께 올라가도록 포함시킨다
  outputFileTracingIncludes: {
    "/*": ["./data/samples/**/*"],
  },
  experimental: {
    // proxy를 거치는 요청 본문 한도 — 10MB 파일 + 양식 부가 데이터가 잘리지 않게 (보안 검토 참고 항목)
    proxyClientMaxBodySize: "11mb",
  },
  // 보안 헤더 (보안 검토 L2): 다른 사이트의 프레임 안에 넣기 금지, 파일 형식 추측 금지, 주소 노출 최소화
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
