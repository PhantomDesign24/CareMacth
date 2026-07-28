"use client";

import { useEffect } from "react";

// 채널톡(Channel.io) 플러그인 키 — 클라이언트에 노출되는 공개 키
// (Access Secret 은 멤버 검증 해시용 서버 비밀키라 여기 두지 않음)
const PLUGIN_KEY = "ccaed329-de88-40b4-899c-d98f53e42b94";

// 공식 SDK 로더 (https://developers.channel.io)
function loadChannelSDK() {
  const w = window as any;
  if (w.ChannelIO) return;
  const ch = function () {
    // eslint-disable-next-line prefer-rest-params
    ch.c(arguments);
  } as any;
  ch.q = [];
  ch.c = function (args: any) {
    ch.q.push(args);
  };
  w.ChannelIO = ch;
  function load() {
    if (w.ChannelIOInitialized) return;
    w.ChannelIOInitialized = true;
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = "https://cdn.channel.io/plugin/ch-plugin-web.js";
    const x = document.getElementsByTagName("script")[0];
    if (x && x.parentNode) x.parentNode.insertBefore(s, x);
  }
  if (document.readyState === "complete") load();
  else {
    w.addEventListener("DOMContentLoaded", load);
    w.addEventListener("load", load);
  }
}

function readUser(): { name?: string; phone?: string; email?: string } | null {
  try {
    const raw = localStorage.getItem("cm_user") || localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ChannelTalk() {
  useEffect(() => {
    loadChannelSDK();

    const boot = () => {
      const u = readUser();
      // 로그인 상태면 상담원이 알아볼 수 있게 이름·전화만 프로필로 전달
      // (내부 placeholder 이메일 id_*@id.carematch.local 은 제외)
      const profile =
        u && (u.name || u.phone)
          ? {
              name: u.name || undefined,
              mobileNumber: u.phone || undefined,
              email:
                u.email && !String(u.email).endsWith("@id.carematch.local")
                  ? u.email
                  : undefined,
            }
          : undefined;

      (window as any).ChannelIO("boot", {
        pluginKey: PLUGIN_KEY,
        ...(profile ? { profile } : {}),
      });
    };

    boot();

    // 다른 탭/컴포넌트에서 로그인·로그아웃 시 프로필 갱신
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cm_user" || e.key === "user") boot();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        (window as any).ChannelIO?.("shutdown");
      } catch {}
    };
  }, []);

  return null;
}
