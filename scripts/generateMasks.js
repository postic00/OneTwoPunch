import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../public/masks')

// 눈 구멍: 좌(170,210) 우(342,210) / 코입 구멍: (256,335)
function holes() {
  return `
    <mask id="h">
      <rect width="512" height="512" fill="white"/>
      <ellipse cx="170" cy="210" rx="52" ry="36" fill="black"/>
      <ellipse cx="342" cy="210" rx="52" ry="36" fill="black"/>
      <ellipse cx="256" cy="335" rx="46" ry="34" fill="black"/>
    </mask>`
}

function svg(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${holes()}
  </defs>
  <g mask="url(#h)">
${content}
  </g>
</svg>`
}

// ──────────── 동물별 SVG 내용 ────────────

const animals = [
  // 1. 쥐 (Rat)
  { name: 'rat', content: `
    <!-- 귀 -->
    <ellipse cx="155" cy="90" rx="55" ry="55" fill="#b0b0b0"/>
    <ellipse cx="357" cy="90" rx="55" ry="55" fill="#b0b0b0"/>
    <ellipse cx="155" cy="90" rx="35" ry="35" fill="#e8aab0"/>
    <ellipse cx="357" cy="90" rx="35" ry="35" fill="#e8aab0"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="290" rx="165" ry="195" fill="#c8c8c8"/>
    <!-- 주둥이 -->
    <ellipse cx="256" cy="360" rx="55" ry="38" fill="#b0b0b0"/>
    <!-- 수염 -->
    <line x1="130" y1="340" x2="195" y2="330" stroke="#888" stroke-width="3"/>
    <line x1="130" y1="355" x2="195" y2="350" stroke="#888" stroke-width="3"/>
    <line x1="317" y1="330" x2="382" y2="340" stroke="#888" stroke-width="3"/>
    <line x1="317" y1="350" x2="382" y2="355" stroke="#888" stroke-width="3"/>
  ` },

  // 2. 소 (Ox)
  { name: 'ox', content: `
    <!-- 뿔 -->
    <path d="M170,80 Q130,20 100,50 Q140,70 155,120" fill="#8B6914"/>
    <path d="M342,80 Q382,20 412,50 Q372,70 357,120" fill="#8B6914"/>
    <!-- 귀 -->
    <ellipse cx="110" cy="180" rx="45" ry="30" fill="#8B4513" transform="rotate(-20,110,180)"/>
    <ellipse cx="402" cy="180" rx="45" ry="30" fill="#8B4513" transform="rotate(20,402,180)"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="290" rx="170" ry="195" fill="#A0522D"/>
    <!-- 콧구멍 영역 -->
    <ellipse cx="256" cy="370" rx="65" ry="45" fill="#8B4513"/>
    <ellipse cx="230" cy="368" rx="14" ry="12" fill="#5a2d0c"/>
    <ellipse cx="282" cy="368" rx="14" ry="12" fill="#5a2d0c"/>
  ` },

  // 3. 호랑이 (Tiger)
  { name: 'tiger', content: `
    <!-- 귀 -->
    <polygon points="140,50 100,130 190,130" fill="#E8730A"/>
    <polygon points="372,50 412,130 322,130" fill="#E8730A"/>
    <polygon points="148,65 118,125 182,125" fill="#fff"/>
    <polygon points="364,65 394,125 330,125" fill="#fff"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="290" rx="170" ry="195" fill="#E8730A"/>
    <!-- 줄무늬 -->
    <path d="M120,180 Q180,160 200,200" stroke="#333" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M110,220 Q175,205 195,240" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M392,180 Q332,160 312,200" stroke="#333" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M402,220 Q337,205 317,240" stroke="#333" stroke-width="10" fill="none" stroke-linecap="round"/>
    <!-- 이마 줄무늬 -->
    <path d="M220,95 Q256,80 292,95" stroke="#333" stroke-width="10" fill="none"/>
    <!-- 흰 뺨 -->
    <ellipse cx="256" cy="340" rx="90" ry="70" fill="#fff8f0"/>
    <!-- 수염 -->
    <line x1="110" y1="335" x2="185" y2="320" stroke="#888" stroke-width="3"/>
    <line x1="110" y1="355" x2="185" y2="348" stroke="#888" stroke-width="3"/>
    <line x1="402" y1="335" x2="327" y2="320" stroke="#888" stroke-width="3"/>
    <line x1="402" y1="355" x2="327" y2="348" stroke="#888" stroke-width="3"/>
  ` },

  // 4. 토끼 (Rabbit)
  { name: 'rabbit', content: `
    <!-- 귀 (길고 높게) -->
    <ellipse cx="185" cy="30" rx="38" ry="110" fill="#e8e8e8"/>
    <ellipse cx="327" cy="30" rx="38" ry="110" fill="#e8e8e8"/>
    <ellipse cx="185" cy="30" rx="22" ry="90" fill="#f4b8c8"/>
    <ellipse cx="327" cy="30" rx="22" ry="90" fill="#f4b8c8"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="295" rx="160" ry="190" fill="#f0f0f0"/>
    <!-- 볼 -->
    <ellipse cx="165" cy="320" rx="40" ry="30" fill="#f4b8c8" opacity="0.6"/>
    <ellipse cx="347" cy="320" rx="40" ry="30" fill="#f4b8c8" opacity="0.6"/>
    <!-- 수염 -->
    <line x1="115" y1="335" x2="190" y2="325" stroke="#aaa" stroke-width="2"/>
    <line x1="115" y1="350" x2="190" y2="348" stroke="#aaa" stroke-width="2"/>
    <line x1="397" y1="335" x2="322" y2="325" stroke="#aaa" stroke-width="2"/>
    <line x1="397" y1="350" x2="322" y2="348" stroke="#aaa" stroke-width="2"/>
  ` },

  // 5. 용 (Dragon)
  { name: 'dragon', content: `
    <!-- 뿔 -->
    <path d="M195,60 L165,5 L210,70" fill="#4a9e4a"/>
    <path d="M317,60 L347,5 L302,70" fill="#4a9e4a"/>
    <!-- 작은 뿔들 -->
    <polygon points="155,100 140,55 175,95" fill="#3a8e3a"/>
    <polygon points="357,100 372,55 337,95" fill="#3a8e3a"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="285" rx="168" ry="192" fill="#5cb85c"/>
    <!-- 비늘 무늬 -->
    <ellipse cx="256" cy="200" rx="60" ry="40" fill="#4a9e4a" opacity="0.5"/>
    <ellipse cx="180" cy="260" rx="40" ry="28" fill="#4a9e4a" opacity="0.4"/>
    <ellipse cx="332" cy="260" rx="40" ry="28" fill="#4a9e4a" opacity="0.4"/>
    <!-- 콧구멍 -->
    <ellipse cx="235" cy="295" rx="12" ry="10" fill="#3a7a3a"/>
    <ellipse cx="277" cy="295" rx="12" ry="10" fill="#3a7a3a"/>
  ` },

  // 6. 뱀 (Snake)
  { name: 'snake', content: `
    <!-- 얼굴 (갸름한 타원) -->
    <ellipse cx="256" cy="285" rx="145" ry="200" fill="#7fb87f"/>
    <!-- 비늘 패턴 -->
    <ellipse cx="256" cy="190" rx="50" ry="30" fill="#6aaa6a" opacity="0.6"/>
    <ellipse cx="256" cy="250" rx="60" ry="30" fill="#6aaa6a" opacity="0.5"/>
    <ellipse cx="195" cy="230" rx="35" ry="22" fill="#6aaa6a" opacity="0.4"/>
    <ellipse cx="317" cy="230" rx="35" ry="22" fill="#6aaa6a" opacity="0.4"/>
    <!-- 갈라진 혀 -->
    <path d="M245,430 Q256,410 267,430" stroke="#cc2222" stroke-width="5" fill="none"/>
    <path d="M256,395 L256,430" stroke="#cc2222" stroke-width="6"/>
    <!-- 머리 무늬 -->
    <path d="M200,120 Q256,100 312,120" stroke="#4a8a4a" stroke-width="8" fill="none"/>
  ` },

  // 7. 말 (Horse)
  { name: 'horse', content: `
    <!-- 갈기 -->
    <path d="M140,80 Q120,200 130,350 Q160,300 155,200 Q170,150 185,100" fill="#5a3010"/>
    <!-- 귀 -->
    <polygon points="185,80 165,30 215,85" fill="#c8843a"/>
    <polygon points="327,80 347,30 297,85" fill="#c8843a"/>
    <polygon points="190,78 175,38 210,80" fill="#f4c8a0"/>
    <polygon points="322,78 337,38 302,80" fill="#f4c8a0"/>
    <!-- 얼굴 (긴 형태) -->
    <ellipse cx="256" cy="300" rx="145" ry="215" fill="#c8843a"/>
    <!-- 주둥이 -->
    <ellipse cx="256" cy="400" rx="80" ry="55" fill="#b07030"/>
    <ellipse cx="234" cy="400" rx="16" ry="13" fill="#7a4a18"/>
    <ellipse cx="278" cy="400" rx="16" ry="13" fill="#7a4a18"/>
  ` },

  // 8. 양 (Goat)
  { name: 'goat', content: `
    <!-- 뿔 (곡선) -->
    <path d="M175,100 Q120,40 145,10 Q175,50 185,110" fill="#c8c080"/>
    <path d="M337,100 Q392,40 367,10 Q337,50 327,110" fill="#c8c080"/>
    <!-- 귀 -->
    <ellipse cx="115" cy="195" rx="42" ry="28" fill="#ddd" transform="rotate(-25,115,195)"/>
    <ellipse cx="397" cy="195" rx="42" ry="28" fill="#ddd" transform="rotate(25,397,195)"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="285" rx="165" ry="195" fill="#e8e8e0"/>
    <!-- 수염 -->
    <path d="M235,430 Q256,460 277,430" stroke="#ccc" stroke-width="8" fill="none"/>
    <!-- 볼 -->
    <ellipse cx="165" cy="315" rx="38" ry="28" fill="#d8d8d0"/>
    <ellipse cx="347" cy="315" rx="38" ry="28" fill="#d8d8d0"/>
  ` },

  // 9. 원숭이 (Monkey)
  { name: 'monkey', content: `
    <!-- 귀 -->
    <ellipse cx="105" cy="220" rx="50" ry="50" fill="#c87840"/>
    <ellipse cx="407" cy="220" rx="50" ry="50" fill="#c87840"/>
    <ellipse cx="105" cy="220" rx="30" ry="30" fill="#e8a878"/>
    <ellipse cx="407" cy="220" rx="30" ry="30" fill="#e8a878"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="285" rx="165" ry="195" fill="#c87840"/>
    <!-- 얼굴 중심 (밝은색) -->
    <ellipse cx="256" cy="300" rx="110" ry="145" fill="#e8c8a0"/>
    <!-- 이마 털 -->
    <ellipse cx="256" cy="120" rx="80" ry="35" fill="#a06030"/>
  ` },

  // 10. 닭 (Rooster)
  { name: 'rooster', content: `
    <!-- 볏 -->
    <path d="M200,80 Q220,20 256,50 Q270,10 290,55 Q315,15 320,75" fill="#cc2222"/>
    <!-- 귀 깃털 -->
    <ellipse cx="110" cy="200" rx="38" ry="55" fill="#e8a020" transform="rotate(-15,110,200)"/>
    <ellipse cx="402" cy="200" rx="38" ry="55" fill="#e8a020" transform="rotate(15,402,200)"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="285" rx="160" ry="190" fill="#e8c060"/>
    <!-- 육수 (턱살) -->
    <ellipse cx="256" cy="420" rx="35" ry="28" fill="#cc2222"/>
    <!-- 부리 영역 강조 -->
    <ellipse cx="256" cy="350" rx="55" ry="40" fill="#d4a840"/>
  ` },

  // 11. 개 (Dog)
  { name: 'dog', content: `
    <!-- 귀 (늘어진 귀) -->
    <ellipse cx="140" cy="250" rx="55" ry="100" fill="#a0622a" transform="rotate(-10,140,250)"/>
    <ellipse cx="372" cy="250" rx="55" ry="100" fill="#a0622a" transform="rotate(10,372,250)"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="280" rx="165" ry="185" fill="#c0783a"/>
    <!-- 주둥이 -->
    <ellipse cx="256" cy="355" rx="80" ry="60" fill="#a0622a"/>
    <!-- 볼 -->
    <ellipse cx="165" cy="310" rx="40" ry="30" fill="#d4906a" opacity="0.6"/>
    <ellipse cx="347" cy="310" rx="40" ry="30" fill="#d4906a" opacity="0.6"/>
    <!-- 수염 점 -->
    <circle cx="210" cy="345" r="5" fill="#7a4a1a"/>
    <circle cx="232" cy="352" r="5" fill="#7a4a1a"/>
    <circle cx="280" cy="352" r="5" fill="#7a4a1a"/>
    <circle cx="302" cy="345" r="5" fill="#7a4a1a"/>
  ` },

  // 12. 돼지 (Pig)
  { name: 'pig', content: `
    <!-- 귀 -->
    <ellipse cx="165" cy="105" rx="58" ry="68" fill="#f4a0b0"/>
    <ellipse cx="347" cy="105" rx="58" ry="68" fill="#f4a0b0"/>
    <ellipse cx="165" cy="105" rx="38" ry="48" fill="#f4c0cc"/>
    <ellipse cx="347" cy="105" rx="38" ry="48" fill="#f4c0cc"/>
    <!-- 얼굴 -->
    <ellipse cx="256" cy="285" rx="168" ry="195" fill="#f4b8c0"/>
    <!-- 주둥이 -->
    <ellipse cx="256" cy="365" rx="75" ry="58" fill="#f09090"/>
    <ellipse cx="230" cy="368" rx="18" ry="14" fill="#d06060"/>
    <ellipse cx="282" cy="368" rx="18" ry="14" fill="#d06060"/>
    <!-- 볼 -->
    <ellipse cx="158" cy="310" rx="42" ry="32" fill="#f4a0b0" opacity="0.7"/>
    <ellipse cx="354" cy="310" rx="42" ry="32" fill="#f4a0b0" opacity="0.7"/>
  ` },
]

for (const animal of animals) {
  const content = svg(animal.content)
  writeFileSync(join(OUT, `${animal.name}.svg`), content, 'utf-8')
  console.log(`✓ ${animal.name}.svg`)
}
console.log('12지신 마스크 생성 완료!')
