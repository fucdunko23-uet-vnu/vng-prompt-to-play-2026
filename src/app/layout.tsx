import type { Metadata } from "next";
import { Be_Vietnam_Pro, Roboto_Mono } from "next/font/google";
import "./globals.css";

const primaryFont = Be_Vietnam_Pro({ 
  weight: ["300", "400", "500", "700"],
  subsets: ["vietnamese"], 
  variable: "--font-outfit" 
});
const monoFont = Roboto_Mono({ 
  weight: "400", 
  subsets: ["vietnamese"], 
  variable: "--font-press-start-2p",
  display: "swap"
});

export const metadata: Metadata = {
  title: "AI Boss Evolution | 2D Action Game",
  description:
    "Boss AI học hỏi lối chơi của bạn, tiến hóa sau mỗi màn. Một trò chơi hành động 2D phá vỡ bức tường thứ 4.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${primaryFont.variable} ${monoFont.variable}`}>
      <body className="font-sans antialiased bg-[#0a0a0a] text-white">
        {children}
      </body>
    </html>
  );
}
