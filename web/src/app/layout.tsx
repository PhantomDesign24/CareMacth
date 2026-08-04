import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomTabBar from "@/components/BottomTabBar";
import ToastContainer from "@/components/Toast";
import ChannelTalk from "@/components/ChannelTalk";
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
    // 네이버 서치어드바이저 사이트 소유확인 (2026-08-04 등록)
    other: { "naver-site-verification": "b5b4bed3a1406f3ab532f053c26ff3ad20c52c57" },
    // 구글 서치콘솔 확인 코드 받으면 여기 추가:
    // google: "xxxxxxxx",
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
        <main className="flex-1 pt-16 md:pt-[104px]">{children}</main>
        <Footer />
        <Suspense fallback={null}>
          <BottomTabBar />
        </Suspense>

        {/* 채널톡 상담 버튼 */}
        <ChannelTalk />
      </body>
    </html>
  );
}
