import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "with-ai | 아이디어에서 완료까지",
  description:
    "프로젝트 계획, 작업 카드와 진행 메모를 관리하고 AI 작업 요청문을 준비하세요.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
