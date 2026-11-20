// 검색엔진 수집 금지 (보안 점검 SEC-05) — /robots.txt 로 제공된다
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
