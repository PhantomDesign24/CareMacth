import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "케어매치 | 인공지능 AI 간병 매칭 플랫폼",
  description:
    "실시간 간병 연결 서비스. 검증된 간병인과 보호자를 안전하게 매칭해드립니다. 병원간병, 재택간병, 방문요양, 생활돌봄 모두 지원합니다.",
  keywords:
    "간병, 간병인, 간병매칭, 케어매치, 병원간병, 재택간병, 방문요양, 생활돌봄, AI매칭, 케어코디",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "케어매치 - 인공지능 AI 간병 매칭 플랫폼",
    description:
      "실시간 간병 연결 서비스. 검증된 간병인과 보호자를 안전하게 매칭해드립니다.",
    url: "https://care-match.kr",
    siteName: "케어매치 CareMatch",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <Header />
        <main className="flex-1 pt-16 md:pt-20">{children}</main>
        <Footer />

        {/* ChannelTalk Script Placeholder */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ChannelTalk Boot Script Placeholder
              // Replace CHANNEL_PLUGIN_KEY with your actual Channel Talk plugin key
              /*
              (function(){
                var w = window;
                if (w.ChannelIO) return;
                var ch = function(){ ch.c(arguments); };
                ch.q = [];
                ch.c = function(args){ ch.q.push(args); };
                w.ChannelIO = ch;
                function l(){
                  if (w.ChannelIOInitialized) return;
                  w.ChannelIOInitialized = true;
                  var s = document.createElement('script');
                  s.type = 'text/javascript';
                  s.async = true;
                  s.src = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
                  var x = document.getElementsByTagName('script')[0];
                  if(x.parentNode) x.parentNode.insertBefore(s, x);
                }
                if (document.readyState === 'complete') { l(); }
                else { w.addEventListener('DOMContentLoaded', l); w.addEventListener('load', l); }
              })();

              ChannelIO('boot', {
                "pluginKey": "CHANNEL_PLUGIN_KEY"
              });
              */
            `,
          }}
        />
      </body>
    </html>
  );
}
