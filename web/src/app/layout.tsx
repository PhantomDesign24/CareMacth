import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ToastContainer from "@/components/Toast";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: SITE.titleTemplate,
  },
  description: SITE.description,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  applicationName: SITE.name,
  category: "Healthcare",
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE.url,
  },
  openGraph: {
    title: `${SITE.name} - AI 간병 매칭 플랫폼`,
    description: SITE.description,
    url: SITE.url,
    siteName: `${SITE.name} ${SITE.nameEn}`,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: SITE.ogImage,
        width: 1200,
        height: 630,
        alt: `${SITE.name} - AI 간병 매칭 플랫폼`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} - AI 간병 매칭 플랫폼`,
    description: "검증된 간병인과 보호자를 AI가 실시간 매칭",
    images: [SITE.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // 네이버·구글 사이트 확인 코드 받으면 여기 추가:
    // google: "xxxxxxxx",
    // other: { "naver-site-verification": "xxxxxxxx" },
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
        <meta name="theme-color" content="#FF922E" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE.name,
              alternateName: SITE.nameEn,
              url: SITE.url,
              logo: `${SITE.url}${SITE.logo}`,
              description: "AI 간병 매칭 플랫폼",
              contactPoint: {
                "@type": "ContactPoint",
                telephone: `+82-${SITE.phone}`,
                contactType: "customer service",
                areaServed: "KR",
                availableLanguage: ["Korean"],
              },
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE.name,
              url: SITE.url,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE.url}/find-work?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": SITE.url,
              name: SITE.name,
              image: `${SITE.url}${SITE.ogImage}`,
              priceRange: "₩₩",
              telephone: `+82-${SITE.phone}`,
              address: {
                "@type": "PostalAddress",
                addressCountry: SITE.address.country,
                addressLocality: SITE.address.locality,
              },
              url: SITE.url,
            }),
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <Header />
        <ToastContainer />
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
