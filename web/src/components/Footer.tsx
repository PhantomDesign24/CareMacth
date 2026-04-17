"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { FiPhone, FiMail, FiClock } from "react-icons/fi";
import {
  FaYoutube,
  FaBlog,
  FaInstagram,
  FaComment,
} from "react-icons/fa";
import { SITE } from "@/config/site";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
          {/* Brand / Logo */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-5">
              <Image
                src="/img/f_logo.png"
                alt="케어매치"
                width={140}
                height={36}
                className="h-9 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              인공지능 AI 간병 매칭 플랫폼
              <br />
              실시간 간병 연결 서비스
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.youtube.com/@caermatch1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-all duration-200"
                aria-label="YouTube"
              >
                <FaYoutube className="w-4 h-4" />
              </a>
              <a
                href="https://blog.naver.com/carematch11"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-800 hover:bg-green-600 flex items-center justify-center transition-all duration-200"
                aria-label="Naver Blog"
              >
                <FaBlog className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/carematch_official"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition-all duration-200"
                aria-label="Instagram"
              >
                <FaInstagram className="w-4 h-4" />
              </a>
              <a
                href="http://pf.kakao.com/_nnJxkxj"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-800 hover:bg-yellow-500 flex items-center justify-center transition-all duration-200"
                aria-label="KakaoTalk"
              >
                <FaComment className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Service links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              서비스
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/care-request"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  간병인 찾기
                </Link>
              </li>
              <li>
                <Link
                  href="/find-work"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  간병 일감 찾기
                </Link>
              </li>
              <li>
                <Link
                  href="/business"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  병원·기업회원
                </Link>
              </li>
              <li>
                <Link
                  href="/home-care"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  방문요양
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Policy */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              약관 및 정책
            </h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm text-gray-400 cursor-default">
                  회사소개
                </span>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors font-semibold text-white"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link
                  href="/location-terms"
                  className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
                >
                  위치기반서비스 이용약관
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer support */}
          <div className="col-span-2 sm:col-span-1">
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              고객센터
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`tel:${SITE.phone}`}
                  className="flex items-center gap-2 text-lg sm:text-xl font-bold text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <FiPhone className="w-5 h-5" />
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-gray-500">FAX</span> 02-535-6601
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-400">
                <FiMail className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                <a
                  href="mailto:wooritelceo@hanmail.net"
                  className="hover:text-primary-400 transition-colors"
                >
                  wooritelceo@hanmail.net
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-400">
                <FiClock className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />
                <span>
                  평일 09:30~17:30
                  <br />
                  (점심 12:00~13:00)
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-500 text-center md:text-left leading-relaxed">
              <p>
                케어매치 주식회사 | 대표 하만채 | 사업자등록번호 173-81-03376
              </p>
              <p>
                서울시 서초구 법원로3길 15 4층 406호
              </p>
            </div>
            <p className="text-xs text-gray-500">
              COPYRIGHT(C) 2024 케어매치 주식회사 ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
