// Avatar người chơi: 12 mẫu phi hành gia vẽ bằng SVG (giới tính, tuổi, màu da khác nhau) hoặc ảnh người chơi tự tải lên.
const SKIN = { fair: '#f6d5bd', light: '#eec3a0', tan: '#d9a074', brown: '#a8693f', dark: '#6b4128', deep: '#4a2c1d' };
const SUIT = ['#3b9cff', '#ff7b6a', '#4cc46a', '#ffc94a', '#9a5cff', '#ff7fb0', '#35c7c0', '#ff9a4a', '#7f8cff', '#8fd04a', '#ff5a8a', '#5ab0ff'];

// age: 'young' | 'adult' | 'elder'; hair: kiểu tóc; hc: màu tóc.
export const AVATARS = [
  { skin: 'fair', age: 'adult', g: 'm', hair: 'short', hc: '#3a2a20' },
  { skin: 'light', age: 'adult', g: 'f', hair: 'long', hc: '#6b3f22' },
  { skin: 'tan', age: 'adult', g: 'm', hair: 'buzz', hc: '#15110f' },
  { skin: 'tan', age: 'adult', g: 'f', hair: 'bun', hc: '#15110f' },
  { skin: 'dark', age: 'adult', g: 'm', hair: 'afro', hc: '#14100e' },
  { skin: 'deep', age: 'adult', g: 'f', hair: 'puffs', hc: '#14100e' },
  { skin: 'fair', age: 'elder', g: 'm', hair: 'bald', hc: '#e9e6df', beard: true },
  { skin: 'light', age: 'elder', g: 'f', hair: 'bun', hc: '#e9e6df' },
  { skin: 'brown', age: 'young', g: 'm', hair: 'spiky', hc: '#1c130e' },
  { skin: 'tan', age: 'young', g: 'f', hair: 'pony', hc: '#8a3b22' },
  { skin: 'light', age: 'adult', g: 'm', hair: 'side', hc: '#17120f' },
  { skin: 'light', age: 'adult', g: 'f', hair: 'bob', hc: '#17120f' },
];

function hairBack(a) {
  const c = a.hc;
  switch (a.hair) {
    case 'long': return `<path d="M30 52c0-22 12-32 20-32s20 10 20 32v26H64V56H36v22H30z" fill="${c}"/>`;
    case 'afro': return `<circle cx="50" cy="40" r="26" fill="${c}"/>`;
    case 'puffs': return `<circle cx="29" cy="34" r="10" fill="${c}"/><circle cx="71" cy="34" r="10" fill="${c}"/>`;
    case 'pony': return `<path d="M66 34c14 2 16 18 8 34-2-10-6-16-12-20z" fill="${c}"/>`;
    case 'bob': return `<path d="M30 40c0-16 10-22 20-22s20 6 20 22v22H62V44H38v18H30z" fill="${c}"/>`;
    default: return '';
  }
}
function hairFront(a) {
  const c = a.hc;
  switch (a.hair) {
    case 'short': return `<path d="M34 42c0-14 8-20 16-20s16 6 16 20c-6-6-10-8-16-8s-10 2-16 8z" fill="${c}"/>`;
    case 'side': return `<path d="M34 44c0-14 8-21 17-21 9 0 15 7 15 21-3-8-8-11-16-11-5 0-11 2-16 11z" fill="${c}"/>`;
    case 'buzz': return `<path d="M35 42c0-11 7-17 15-17s15 6 15 17c-5-4-10-6-15-6s-10 2-15 6z" fill="${c}" opacity=".85"/>`;
    case 'spiky': return `<path d="M34 42l3-12 5 7 4-12 5 10 5-10 4 12 5-7 3 12c-6-6-10-8-17-8s-12 2-17 8z" fill="${c}"/>`;
    case 'long': case 'bob': return `<path d="M34 44c4-8 9-12 16-12s12 4 16 12c-5-3-10-4-16-4s-11 1-16 4z" fill="${c}"/>`;
    case 'bun': return `<circle cx="50" cy="20" r="7" fill="${c}"/><path d="M34 44c0-13 7-20 16-20s16 7 16 20c-5-5-10-7-16-7s-11 2-16 7z" fill="${c}"/>`;
    case 'pony': return `<path d="M34 44c0-13 7-20 16-20s16 7 16 20c-5-5-10-7-16-7s-11 2-16 7z" fill="${c}"/>`;
    case 'afro': return `<path d="M33 44c0-12 8-18 17-18s17 6 17 18c-6-5-11-7-17-7s-11 2-17 7z" fill="${c}"/>`;
    case 'puffs': return `<path d="M34 44c0-12 7-18 16-18s16 6 16 18c-5-5-10-7-16-7s-11 2-16 7z" fill="${c}"/>`;
    case 'bald': return `<path d="M33 46c0-3 1-5 3-7-1 5 0 8 1 10zM67 46c0-3-1-5-3-7 1 5 0 8-1 10z" fill="${c}"/>`;
    default: return '';
  }
}

// Trả chuỗi SVG (viewBox 100) của mẫu `i`.
export function avatarSvg(i) {
  const a = AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length];
  const skin = SKIN[a.skin];
  const suit = SUIT[i % SUIT.length];
  const young = a.age === 'young';
  const elder = a.age === 'elder';
  const headR = young ? 17.5 : 16;
  const eyeY = young ? 51 : 49;
  const eyes = young ? 2.6 : 2.1;
  const wr = elder ? `<path d="M40 44q4-2 8 0M52 44q4-2 8 0M39 57q2 1 3 4M61 57q-2 1-3 4" stroke="#0004" stroke-width="1" fill="none"/>` : '';
  const beard = a.beard ? `<path d="M36 54c0 14 6 20 14 20s14-6 14-20c-4 6-8 8-14 8s-10-2-14-8z" fill="${a.hc}"/>` : '';
  const lips = a.g === 'f' ? `<path d="M45 58q5 3 10 0" stroke="#b0453f" stroke-width="2" fill="none" stroke-linecap="round"/>` : `<path d="M45 58q5 2.600 10 0" stroke="#0007" stroke-width="1.600" fill="none" stroke-linecap="round"/>`;
  const lash = a.g === 'f' ? `<path d="M39 47l-2-1.500M61 47l2-1.500" stroke="#000a" stroke-width="1.200" stroke-linecap="round"/>` : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
<defs><radialGradient id="avbg${i}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#2a3358"/><stop offset="1" stop-color="#0b0d18"/></radialGradient></defs>
<rect width="100" height="100" fill="url(#avbg${i})"/>
<g fill="#fff"><circle cx="12" cy="16" r="1"/><circle cx="85" cy="12" r="1.200"/><circle cx="90" cy="48" r=".8"/><circle cx="8" cy="60" r=".8"/><circle cx="76" cy="26" r=".7" opacity=".7"/></g>
${hairBack(a)}
<path d="M14 100c0-18 14-27 36-27s36 9 36 27z" fill="${suit}"/>
<path d="M14 100c0-18 14-27 36-27" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>
<rect x="20" y="86" width="12" height="5" rx="2" fill="#fff" opacity=".85"/><circle cx="76" cy="86" r="4" fill="#d4413a"/>
<rect x="43" y="64" width="14" height="12" rx="4" fill="${skin}"/>
<path d="M43 70h14v4a7 7 0 0 1-14 0z" fill="#0003"/>
<ellipse cx="50" cy="50" rx="${headR}" ry="${headR + 2.5}" fill="${skin}"/>
<ellipse cx="${50 - headR}" cy="51" rx="2.600" ry="4" fill="${skin}"/><ellipse cx="${50 + headR}" cy="51" rx="2.600" ry="4" fill="${skin}"/>
${hairFront(a)}
<circle cx="43" cy="${eyeY}" r="${eyes}" fill="#1b1411"/><circle cx="57" cy="${eyeY}" r="${eyes}" fill="#1b1411"/>
<circle cx="43.800" cy="${eyeY - 0.8}" r=".7" fill="#fff"/><circle cx="57.800" cy="${eyeY - 0.8}" r=".7" fill="#fff"/>
${lash}${wr}${beard}${lips}
<ellipse cx="50" cy="48" rx="31" ry="33" fill="#9fd8ff" opacity=".12"/>
<ellipse cx="50" cy="48" rx="31" ry="33" fill="none" stroke="#dfe7f2" stroke-width="3.500"/>
<ellipse cx="50" cy="48" rx="33" ry="35" fill="none" stroke="${suit}" stroke-width="1.600" opacity=".8"/>
<path d="M30 34q4-12 16-14" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>
</svg>`;
}

// Nội dung avatar để đặt vào ô tròn .avatar: ảnh người chơi nếu có, không thì mẫu SVG.
export function avatarNode(player) {
  const box = document.createElement('span');
  box.className = 'av-fill';
  if (player.photo) {
    const img = document.createElement('img');
    img.src = player.photo;
    img.alt = '';
    img.draggable = false;
    box.append(img);
  } else {
    box.innerHTML = avatarSvg(player.avatar || 0);
  }
  return box;
}

// Đọc ảnh người chơi chọn, cắt vuông giữa, thu về 128px JPEG (data URL nhỏ, lưu thẳng trong save). Trả Promise<string>.
export function photoFromFile(file, size = 128) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad_image'));
    };
    img.src = url;
  });
}
