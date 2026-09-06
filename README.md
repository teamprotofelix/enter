# EQ오락실 (EQ Arcade)

![EQ오락실](PGlogo.jpg)

**https://enter.moip.ai.kr** — 심사품질 AI센터가 만든 즐거운 오락실 포털입니다.

특허·상표·디자인 심사 지식을 게임으로 즐기는 정적 사이트로, GitHub Pages에서 운영됩니다. 메인 사이트 [심사품질 AI센터(eqai.moip.ai.kr)](https://eqai.moip.ai.kr)와 같은 디자인 패밀리(네온 다크 테마)를 사용합니다.

## 🎮 게임 목록

| 게임 | 위치 | 설명 |
|---|---|---|
| **배틀최강전** | [`battles/`](battles/index.html) | 15인의 개성 넘치는 파이터가 펼치는 대전 격투 게임 |
| **심사기준 스트라이커** | [`exam_striker/`](exam_striker/index.html) | 특허·실용신안 심사기준 OX 퀴즈 슈팅 게임 |

게임은 계속 추가될 예정입니다.

## 📁 구조

```
├── index.html              ← EQ오락실 포털 (게임 선택 허브)
├── PGlogo.jpg              ← 포털 로고
├── img_character/          ← 게임 공용 캐릭터 이미지 (투명 PNG)
├── battles/                ← 게임: 배틀최강전
├── exam_striker/           ← 게임: 심사기준 스트라이커
```

## ✨ 포털 기능

- 게임 카드 선택(썸네일 이미지 없으면 캐릭터 콜라주로 자동 폴백)
- 15인 캐릭터 네온 마퀴(일시정지 버튼 지원)
- 「오늘은 이거다!」 무작위 게임 선택
- KO / EN 언어 전환, 다크 테마 + 파티클 배경
- 접근성 지원(스킵 링크, aria, `prefers-reduced-motion`, noscript 폴백)

## ▶️ 실행 방법

별도 설치·빌드가 필요 없는 순수 정적 사이트입니다.

- **로컬 확인**: `index.html`을 브라우저에서 열거나,
  ```
  python -m http.server 8000
  ```
  후 `http://localhost:8000` 접속
- **배포**: 저장소를 GitHub에 올리고 Settings → Pages에서 루트 브랜치를 선택하면 `enter.moip.ai.kr` 커스텀 도메인(CNAME)으로 연결할 수 있습니다.

## 🔗 사이트 흐름

```
심사품질 AI센터 (eqai.moip.ai.kr)
        │  "EQ오락실" 카드
        ▼
EQ오락실 (enter.moip.ai.kr)  ← 이 저장소
        ├──▶ 배틀최강전 (/battles/)
        └──▶ 심사기준 스트라이커 (/exam_striker/)
```

## ⚖️ 크레딧

심사품질연구회 AI센터 · TeamProtoFelix 설계 및 공익 서비스
