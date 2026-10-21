// Original local SVG artwork. Inputs are numeric variants or internally defined state only.
export const monsterNames = Object.freeze(['叶芽怪','圆耳怪','雪团怪','角角怪','桃桃怪','长耳怪','蘑菇怪','云团怪','水滴怪','岩石怪','火苗怪','小龙怪']);
function newcomer(i, sleepy) {
  const eyes = sleepy ? '<path d="m35 57 5 2 5-2m11 0 5 2 5-2"/>' : '<path d="M40 54v4m21-4v4" stroke-width="3.6"/>';
  const face = `${eyes}<path d="M46 65q5 5 10 0"/><ellipse cx="31" cy="64" rx="5" ry="3" fill="#e6aaa0" stroke="none"/><ellipse cx="72" cy="64" rx="5" ry="3" fill="#e6aaa0" stroke="none"/>`;
  const artwork = [
    // Mushroom: wide spotted cap and a short, soft stem.
    '<path d="M33 42q-4 20-3 36-3 13 11 11l10-3q17 8 20-3l-5-41Z" fill="#efdec0"/><path d="M9 44Q15 14 48 12q30-1 43 32 4 10-12 11H22Q4 55 9 44Z" fill="#c88f80"/><path d="M16 47q36-8 68 0" stroke="#ad7567"/><ellipse cx="31" cy="31" rx="8" ry="6" fill="#f6e8cf" stroke="none"/><ellipse cx="65" cy="26" rx="6" ry="5" fill="#f6e8cf" stroke="none"/><circle cx="51" cy="39" r="4" fill="#f6e8cf" stroke="none"/>',
    // Cloud: scalloped silhouette with a little curl.
    '<path d="M21 79Q4 73 11 57 2 42 20 35q-1-18 17-16 13-17 27-2 21-3 21 18 19 8 8 25 9 20-12 24-9 10-24 2-20 10-30-7Z" fill="#d9e3e5"/><path d="M24 76q12 11 24 4m14 2q13 3 18-6" stroke="#b4c9cc"/><path d="M41 31q-5-9 4-11 10-2 11 6" stroke="#a7bcc0" fill="none"/>',
    // Water: a single pointed droplet with a reflected highlight.
    '<path d="M53 10Q44 30 25 45 9 61 21 79q10 14 30 12 22 1 30-18 9-21-8-35Q59 25 53 10Z" fill="#a9ccd2"/><path d="M29 73q6 14 24 11" stroke="#dcecef" stroke-width="5"/><path d="M34 44q7-7 10-13" stroke="#e8f3f2" stroke-width="4"/>',
    // Rock: faceted shoulders, a moss patch and tiny quartz.
    '<path d="m15 72 4-31 20-19 27 3 17 23 5 27-17 14-40-1Z" fill="#b7beb0"/><path d="m19 41 20-19 4 24-21 13m21-13 23-21 17 23-21-3m0 0 9 44-28-5-28-12" fill="#d1d6c2" stroke="#98a28d" stroke-width="1.8"/><path d="m30 29 5-13 7 3 3 8m13-2 4-12 7 3-2 12" fill="#e2e5d0"/><path d="M21 77q4-9 10-4 6-8 10-2l-2 11-14 1Z" fill="#91aa7c" stroke="none"/>',
    // Flame: asymmetric tips around a warm, rounded core.
    '<path d="M50 9q-4 18 12 27l8-17q-1 17 11 29 19 26-2 38-25 14-51 1Q7 77 16 57l10-15q-3 14 8 16Q29 29 50 9Z" fill="#e3ab78"/><path d="M49 46q-13 15-14 28-1 13 16 14 17-1 16-13-1-9-9-17l-2 11q-9-8-7-23Z" fill="#f6d8a3" stroke="none"/><path d="m39 32 4-8" stroke="#f4d5a0" stroke-width="3"/>',
    // Dragon: little wings, horns and a curled tail distinguish it from the old six.
    '<path d="M28 46 11 35l2 25 14 8m47-23 15-11 1 23-14 9" fill="#d5c6df"/><path d="M74 75q19 7 16-9 11 19-10 23l-15-6" fill="#b5abc9"/><path d="m29 32-3-18 14 13m18-1 13-14-1 22" fill="#e9d3a7"/><path d="M25 40q-2-18 21-18 29-3 29 22l5 29Q80 91 52 89 24 93 21 76Z" fill="#bdb1cf"/><ellipse cx="51" cy="73" rx="19" ry="14" fill="#e4d8e6" stroke="none"/><path d="m34 87-7 4m35-4 9 4" stroke-width="4"/><path d="m45 30 5-6 5 6" stroke="#9888b2"/>'
  ];
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="50" cy="91" rx="31" ry="4" fill="#34432e12"/><g stroke="#536044" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${artwork[i-6]}${i===6?`<g transform="translate(0 8)">${face}</g>`:face}</g></svg>`;
}
export function monster(variant=0, sleepy=false) {
  const i=Number.isFinite(Number(variant))?Math.abs(Math.trunc(Number(variant)))%12:0;
  if(i>=6)return newcomer(i,sleepy);
  const colors=['#b9cf8a','#ecc491','#b9cbd5','#d6bfdb','#e6af9e','#c7d596'];
  const bellies=['#dae5b7','#f5debb','#d9e4e9','#e9dcf0','#f4d2c5','#e3ebc1'];
  const bodies=[
    'M22 39Q12 10 26 12Q37 13 38 30Q48 25 61 30Q64 7 75 12Q88 17 77 39Q89 56 81 76Q72 91 50 88Q23 92 17 72Q11 54 22 39Z',
    'M21 43Q9 33 18 24Q25 20 34 30Q45 18 63 29Q75 18 82 28Q90 38 77 46Q87 66 76 81Q58 91 35 85Q11 79 17 57Z',
    'M19 45Q14 30 27 27Q30 13 42 24Q53 12 61 25Q80 21 82 41L86 69Q83 87 65 88L32 86Q15 82 15 65Z',
    'M18 41Q16 21 30 27L29 15Q39 10 47 29Q64 20 75 30Q93 31 82 49Q95 67 79 82Q62 94 36 86Q11 85 16 59Z',
    'M23 37Q22 17 35 22Q40 4 49 23Q59 12 69 25Q82 23 80 43Q91 60 81 79Q70 90 48 87Q22 90 16 72Q10 51 23 37Z',
    'M19 43Q11 19 25 21Q34 21 35 32Q51 20 65 31Q69 17 79 23Q89 30 78 43Q90 56 80 76Q72 90 50 87Q20 89 15 70Q12 57 19 43Z'
  ];
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="50" cy="89" rx="31" ry="5" fill="#34432e12"/><g stroke="#536044" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${bodies[i]}" fill="${colors[i]}"/><path d="M26 83Q22 95 37 91M66 84Q76 95 79 84" fill="${colors[i]}"/><ellipse cx="50" cy="67" rx="22" ry="18" fill="${bellies[i]}" stroke="none"/>${sleepy?'<path d="M32 52l7 2 7-2M58 52l7 2 7-2"/>':'<path d="M36 48v5M65 48v5" stroke-width="3.8"/>'}<path d="M46 58q5 6 10 0"/><ellipse cx="28" cy="59" rx="6" ry="3.8" fill="#e7a490" stroke="none"/><ellipse cx="75" cy="59" rx="6" ry="3.8" fill="#e7a490" stroke="none"/>${i===0?'<path d="M45 25q-3-10 7-11q4 8-7 11" fill="#7c9b64"/>':''}${i===2?'<path d="M40 33l3-4m12 3 3-3" stroke="#91aab8"/>':''}</g></svg>`;
}
export const coin = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#edc66f" stroke="#ab7b35" stroke-width="1.5"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff0bc" stroke-width="1.4"/><path d="m12 7 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.5L9 16l.6-3.2-2.4-2.3 3.3-.5Z" fill="#b48437"/></svg>`;
export function icon(name) {
  const paths={ plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',search:'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5-1 5 5',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 20h4',calendar:'M5 5h14v15H5ZM8 3v4M16 3v4M5 10h14',check:'m5 12 4 4L19 6',sword:'m4 4 11 5-6 6L4 4Zm7 9 7 7m-5-3 4-4',leaf:'M5 19C-1 7 10 3 21 3c0 13-8 17-16 16Zm0 0L16 8',edit:'m15 4 5 5M4 20l5-1L21 7l-4-4L5 15Z',trash:'M4 6h16M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7',back:'m9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7',clock:'M12 7v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',tent:'m2 20 10-17 10 17ZM8 20l4-8 4 8',arrow:'m8 5 7 7-7 7'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`;
}
export function campScene(unlocked=[]) {
  const has=n=>unlocked.includes(n);
  const tree=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 7v46" stroke="#87916c" stroke-width="5"/><path d="M-22 16Q-30-6-12-15Q-19-36 1-36Q20-37 18-17Q35-3 21 17Q3 30-22 16" fill="#c5d29c" stroke="#8fA277" stroke-width="2"/><path d="m0 33-9-14m9 5 10-14" stroke="#87916c" stroke-width="2" fill="none"/></g>`;
  return `<svg class="camp-illustration" viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="你的营地，已解锁${unlocked.length}处布置"><defs><pattern id="grass" width="48" height="35" patternUnits="userSpaceOnUse"><path d="m8 16 2-4 3 5m23 9 2-3" fill="none" stroke="#b0bf87" stroke-width="1.5" stroke-linecap="round"/></pattern></defs><rect width="600" height="340" rx="20" fill="#f2f0dc"/><circle cx="455" cy="61" r="29" fill="#f2dba0"/><path d="M45 70q-1-17 17-17 13-24 31-8 19-2 21 17H45m228-23q8-15 21-8 9-16 23-6 14-2 17 14Z" fill="#fffaf0"/><path d="M0 152Q106 78 208 140Q305 82 411 133Q526 81 600 126V340H0" fill="#e0e7c3"/><path d="M0 213Q131 146 264 178Q415 135 600 198V340H0" fill="#d0dca7"/><path d="M0 255Q158 212 322 250Q484 192 600 242V340H0" fill="#dae2ba"/><path d="M0 211Q150 159 301 184Q453 147 600 198V340H0" fill="url(#grass)"/><path d="M282 340q44-61 1-99t24-54" fill="none" stroke="#ede4be" stroke-width="30" stroke-linecap="round"/>${tree(53,156,.95)}${tree(543,153,1.2)}${tree(98,137,.7)}
    ${has(30)?`<g stroke="#87764e" stroke-width="2.4" stroke-linejoin="round"><ellipse cx="183" cy="233" rx="91" ry="12" fill="#92a07122" stroke="none"/><path d="m106 227 63-103 75 17 36 93-111-1Z" fill="#dcac6d"/><path d="m169 124 43 109H106Z" fill="#f3d4a0"/><path d="m140 232 29-69 22 70Z" fill="#8e8564"/><path d="m169 125 2-19m71 36 3-15M110 215l-18 22m178-18 18 19"/><path d="m180 133 52 12" stroke="#f8e2b9"/></g>`:`<g stroke="#a7b48a" fill="none" stroke-width="2" stroke-dasharray="5 6"><path d="m116 232 55-87 64 87Z"/><ellipse cx="174" cy="236" rx="75" ry="10"/></g>`}
    ${has(250)?`<g stroke="#7d8260" stroke-width="2.4" stroke-linejoin="round"><path d="M377 166h110v88H377Z" fill="#eadaba"/><path d="m361 169 71-62 72 63Z" fill="#9da978"/><path d="m420 116 57-3 28 54" fill="#b2ba88"/><path d="M397 206q14-18 29 0v48h-29Z" fill="#a48c66"/><path d="M446 191h23v25h-23Z" fill="#f4df9c"/><path d="M457 191v25m-11-12h23"/><circle cx="420" cy="232" r="2" fill="#f7deb1"/><path d="M479 119V96h-12v13" fill="#cfb793"/><path d="M383 184h95" stroke="#d8c7a1"/></g>`:''}
    ${has(100)?`<g transform="translate(312 255)" stroke-linecap="round" stroke-linejoin="round"><ellipse cy="13" rx="42" ry="12" fill="#b7c48c"/><path d="m-23 13 47-10m-45 1 42 12" stroke="#947451" stroke-width="9"/><path d="M-18 4Q-28-12-9-25Q-9-7 2-38Q25-20 21-1Q13 14-4 12Z" fill="#e9a05c" stroke="#bd8147" stroke-width="2"/><path d="M-6 7Q-10-1 2-17Q17 2 7 9Z" fill="#f7d18b"/><path d="m-31 14-8-1m67 3 8-2" stroke="#909978" stroke-width="5"/></g>`:''}
    ${has(500)?`<g stroke="#8d9c6d" stroke-width="2"><path d="m427 285 101-1m-88-16v36m20-38v37m21-40v39m22-40v38m20-41v39" stroke="#bfab7e" stroke-width="5"/>${[435,457,480,504,526].map((x,i)=>`<path d="M${x} 283v-21"/><circle cx="${x}" cy="258" r="8" fill="${i%2?'#e6b3ac':'#f1d58c'}"/><circle cx="${x}" cy="258" r="3" fill="#fff0bd"/>`).join('')}</g>`:''}
    <g transform="translate(58 231) scale(.65)">${monster(0).replace(/<svg[^>]*>|<\/svg>/g,'')}</g><path d="m348 99 4-5 5 5m8-8 4-4 5 4" stroke="#94a082" stroke-width="2" fill="none" stroke-linecap="round"/><g fill="#e7b39a"><ellipse cx="528" cy="301" rx="5" ry="3"/><ellipse cx="157" cy="280" rx="4" ry="3"/></g></svg>`;
}
