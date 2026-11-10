#!/usr/bin/env python3
# 酸化還元・電池 早押し（kredox）の問題を作るスクリプト。
#   python3 tools/kredox_build.py      → 全問を確かめて js/kredox_data.js を書き出す（-v で一覧を表示）
# 問題はすべて自作。正解は「手で書いた式」と「機械的に作った式・規則で決めた答え」の二重チェックが一致したものだけ書き出す。
#   - 半反応式：変化（例 MnO4^- -> Mn^2+）から「O を H2O → H を H+ →（塩基性なら OH- を足す）→ 電荷を e- 」の手順で組み立てた式と、
#     手で書いた式が（項の順番を除いて）同じであること。原子と電荷のつり合いも確かめる
#   - イオン反応式：2つの半反応式の e- をそろえて足し、両辺の同じものを消した式と、手で書いた式が同じであること
#   - 化学反応式：原子のつり合いに加え、電離させて両辺の同じイオンを消すと、イオン反応式と同じになること
#   - 酸化数：決まっている酸化数（H +1, O −2 …）から方程式で解いた値と、手で書いた値が同じであること
#   - 電池：負極（e- を出す）と正極（e- を受け取る）の式を足すと、手で書いた全体の式になること
#   - 電気分解：電極の材料・イオンの種類から規則で決めた電極反応と、手で書いた式が同じであること
#   - イオン化傾向：イオン化列で決めた「反応する・しない」が、問題の答えと合うこと
# まちがいの選択肢は「e- の数のまちがい」「H+ の数のまちがい」「生成物のまちがい（条件ちがい）」など、よくある間違いから作る。
# 原子や電荷がつり合ってしまう選択肢は、手で「条件ちがいの式」として書いたものだけ許す（正解がもう1つ紛れ込むのを防ぐ）。
# 問題を足すときは必ず末尾に足す（問題の番号が学習記録のキーになっているため）。
import json, os, re, sys
from collections import Counter
from fractions import Fraction

SUB = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
SUP = str.maketrans('0123456789+-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻')
CAT = {'ox': '酸化数', 'role': '酸化剤・還元剤のはたらき', 'know': '酸化還元の基本', 'half:o': '半反応式（酸化剤）', 'half:r': '半反応式（還元剤）',
       'ionic': 'イオン反応式', 'full': '化学反応式（酸化還元）', 'metal': '金属のイオン化傾向', 'cell': '電池', 'elec': '電気分解'}


# ───────── 化学式・反応式 ─────────
def parse_formula(f):
    """'MnO4^-' → (Counter({'Mn':1,'O':4}), -1)。'e^-' は原子なし・電荷 −1"""
    m = re.fullmatch(r'(.*?)(?:\^(\d*)([+-]))?', f)
    body, n, sg = m.group(1), m.group(2), m.group(3)
    q = 0 if not sg else (int(n) if n else 1) * (1 if sg == '+' else -1)
    if body == 'e':
        return Counter(), q
    stack, i = [Counter()], 0
    while i < len(body):
        ch = body[i]
        if ch in '([':
            stack.append(Counter()); i += 1
        elif ch in ')]':
            i += 1
            d = re.match(r'\d*', body[i:]).group(); i += len(d)
            top = stack.pop()
            for k, v in top.items():
                stack[-1][k] += v * (int(d) if d else 1)
        else:
            m2 = re.match(r'([A-Z][a-z]?)(\d*)', body[i:])
            if not m2:
                raise ValueError('読めない化学式: ' + f)
            stack[-1][m2.group(1)] += int(m2.group(2)) if m2.group(2) else 1
            i += len(m2.group(0))
    assert len(stack) == 1, f
    return stack[0], q


def disp_formula(f):
    m = re.fullmatch(r'(.*?)(?:\^(\d*[+-]))?', f)
    body, ch = m.group(1), m.group(2)
    out = re.sub(r'(?<=[A-Za-z\)\]])(\d+)', lambda x: x.group(1).translate(SUB), body)
    return out + (ch.translate(SUP) if ch else '')


def parse_side(s):
    out = []
    for t in s.split(' + '):
        t = t.strip()
        m = re.fullmatch(r'(\d*)(.+)', t)
        out.append([int(m.group(1)) if m.group(1) else 1, m.group(2)])
    return out


def parse_eq(s):
    l, r = s.split(' -> ')
    return parse_side(l), parse_side(r)


def show_side(side):
    return ' + '.join((str(c) if c != 1 else '') + disp_formula(f) for c, f in side)


def show_eq(eq):
    return show_side(eq[0]) + ' → ' + show_side(eq[1])


def show_eq_ascii(eq):
    f = lambda side: ' + '.join((str(c) if c != 1 else '') + x for c, x in side)
    return f(eq[0]) + ' -> ' + f(eq[1])


def T(s):
    """文章の中の [[式]] を表示用（下付き・上付き文字）にする"""
    def rep(m):
        x = m.group(1)
        return show_eq(parse_eq(x)) if ' -> ' in x else (show_side(parse_side(x)) if ' + ' in x else disp_formula(x))
    return re.sub(r'\[\[(.+?)\]\]', rep, s)


def tally(side):
    a, q = Counter(), 0
    for c, f in side:
        at, ch = parse_formula(f)
        for k, v in at.items():
            a[k] += c * v
        q += c * ch
    return a, q


def balanced(eq):
    (al, ql), (ar, qr) = tally(eq[0]), tally(eq[1])
    return +al == +ar and ql == qr


def canon(eq):
    """項の順番によらない形（同じものは足し、両辺にあるものは消す）"""
    l, r = Counter(), Counter()
    for c, f in eq[0]:
        l[f] += c
    for c, f in eq[1]:
        r[f] += c
    for f in set(l) & set(r):
        m = min(l[f], r[f]); l[f] -= m; r[f] -= m
    return (frozenset((+l).items()), frozenset((+r).items()))


def from_counter(l, r):
    order = lambda f: (f in ('H2O', 'H^+', 'OH^-', 'e^-'), ['H2O', 'H^+', 'OH^-', 'e^-'].index(f) if f in ('H2O', 'H^+', 'OH^-', 'e^-') else 0)
    return ([[c, f] for f, c in sorted((+l).items(), key=lambda x: order(x[0])) if c],
            [[c, f] for f, c in sorted((+r).items(), key=lambda x: order(x[0])) if c])


def proportional(a, b):
    """a が b の定数倍（2倍など）か"""
    (la, ra), (lb, rb) = canon(a), canon(b)
    la, ra, lb, rb = dict(la), dict(ra), dict(lb), dict(rb)
    if set(la) != set(lb) or set(ra) != set(rb):
        return False
    ks = [Fraction(la[f], lb[f]) for f in la] + [Fraction(ra[f], rb[f]) for f in ra]
    return len(set(ks)) == 1


# ───────── 半反応式を手順どおりに組み立てる ─────────
def build_half(core, medium='acid'):
    """core: 'MnO4^- -> Mn^2+'（O・H 以外の原子はつり合わせてある）。手順ごとの式（表示用）と、できあがった式を返す"""
    eq = parse_eq(core)
    l, r = Counter(), Counter()
    for c, f in eq[0]:
        l[f] += c
    for c, f in eq[1]:
        r[f] += c
    (al, _), (ar, _) = tally(eq[0]), tally(eq[1])
    for k in set(al) | set(ar):
        if k not in ('O', 'H'):
            assert al[k] == ar[k], f'{core}: {k} がつり合っていない'
    steps = []
    side = lambda: from_counter(l, r)
    o = tally(side()[0])[0]['O'] - tally(side()[1])[0]['O']
    if o:
        (r if o > 0 else l)['H2O'] += abs(o)
        steps.append(('O の数を H₂O で合わせる', show_eq(side())))
    h = tally(side()[0])[0]['H'] - tally(side()[1])[0]['H']
    if h:
        (r if h > 0 else l)['H^+'] += abs(h)
        steps.append(('H の数を H⁺ で合わせる', show_eq(side())))
    if medium == 'base' and (l['H^+'] or r['H^+']):
        n = l['H^+'] or r['H^+']
        l['OH^-'] += n; r['OH^-'] += n
        for X in (l, r):
            w = min(X['H^+'], X['OH^-']); X['H^+'] -= w; X['OH^-'] -= w; X['H2O'] += w
        w = min(l['H2O'], r['H2O']); l['H2O'] -= w; r['H2O'] -= w
        steps.append((f'塩基性なので両辺に OH⁻ を {n} 個ずつ足し、H⁺ と OH⁻ を H₂O にして整理する', show_eq(side())))
    q = tally(side()[0])[1] - tally(side()[1])[1]
    if q:
        (l if q > 0 else r)['e^-'] += abs(q)
    out = side()
    assert balanced(out), core
    return steps, out


def combine(ox, red):
    """酸化剤の半反応式（e- が左）と還元剤の半反応式（e- が右）の e- をそろえて足す"""
    def ecount(eq, side):
        return sum(c for c, f in eq[side] if f == 'e^-')
    a, b = ecount(ox, 0), ecount(red, 1)
    assert a and b, 'e- の向きがおかしい'
    from math import lcm
    m = lcm(a, b)
    l, r = Counter(), Counter()
    for k, eq in ((m // a, ox), (m // b, red)):
        for c, f in eq[0]:
            l[f] += c * k
        for c, f in eq[1]:
            r[f] += c * k
    for f in set(l) & set(r):
        w = min(l[f], r[f]); l[f] -= w; r[f] -= w
    assert not l['e^-'] and not r['e^-']
    return (m // a, m // b), from_counter(l, r)


def naive(ox, red, a, b):
    """e- をそろえずに（×a と ×b で）足し、e- を消した式。原子はつり合うが電荷がつり合わない、よくある間違い"""
    l, r = Counter(), Counter()
    for k, eq in ((a, ox), (b, red)):
        for c, f in eq[0]:
            l[f] += c * k
        for c, f in eq[1]:
            r[f] += c * k
    l['e^-'] = r['e^-'] = 0
    for f in set(l) & set(r):
        w = min(l[f], r[f]); l[f] -= w; r[f] -= w
    return from_counter(l, r)


def naive_alts(ox, red, a, b, hand):
    out = []
    for x, y in ((1, 1), (b, a), (1, 2), (2, 1)):
        if Fraction(x, y) == Fraction(a, b):
            continue
        e = naive(ox, red, x, y)
        if not balanced(e) and not proportional(e, hand):
            # 手で書いた式と同じ項の並びにそろえる（見た目で区別できないように）
            out.append(reorder(e, hand))
    return out


def reorder(e, hand):
    def order(side, ref):
        names = [f for c, f in ref]
        return sorted(side, key=lambda t: names.index(t[1]) if t[1] in names else 99)
    return (order(e[0], hand[0]), order(e[1], hand[1]))


# 電離のしかた（化学反応式 → イオン反応式の確かめ用）
ION = {'KMnO4': 'K^+ + MnO4^-', 'H2SO4': '2H^+ + SO4^2-', 'MnSO4': 'Mn^2+ + SO4^2-', 'K2SO4': '2K^+ + SO4^2-', 'FeSO4': 'Fe^2+ + SO4^2-',
       'Fe2(SO4)3': '2Fe^3+ + 3SO4^2-', 'K2Cr2O7': '2K^+ + Cr2O7^2-', 'Cr2(SO4)3': '2Cr^3+ + 3SO4^2-', 'KI': 'K^+ + I^-', 'KCl': 'K^+ + Cl^-',
       'HCl': 'H^+ + Cl^-', 'MnCl2': 'Mn^2+ + 2Cl^-', 'Cu(NO3)2': 'Cu^2+ + 2NO3^-', 'HNO3': 'H^+ + NO3^-', 'CuSO4': 'Cu^2+ + SO4^2-',
       'KOH': 'K^+ + OH^-', 'NaClO': 'Na^+ + ClO^-', 'NaCl': 'Na^+ + Cl^-', 'ZnSO4': 'Zn^2+ + SO4^2-', 'AgNO3': 'Ag^+ + NO3^-',
       'NaOH': 'Na^+ + OH^-', 'ZnCl2': 'Zn^2+ + 2Cl^-'}


def ionize(eq):
    out = []
    for side in eq:
        s = []
        for c, f in side:
            if f in ION:
                for c2, f2 in parse_side(ION[f]):
                    s.append([c * c2, f2])
            else:
                s.append([c, f])
        out.append(s)
    return tuple(out)


# ───────── 酸化数 ─────────
FIXED = {'H': 1, 'O': -2, 'Li': 1, 'Na': 1, 'K': 1, 'Mg': 2, 'Ca': 2, 'Ba': 2, 'Al': 3, 'F': -1}


def oxnum(formula, el, fixed=None):
    at, q = parse_formula(formula)
    fx = dict(FIXED); fx.update(fixed or {})
    fx.pop(el, None)
    rest = 0
    for k, v in at.items():
        if k == el:
            continue
        if k not in fx:
            raise ValueError(f'{formula}: {k} の酸化数が決まっていない')
        rest += fx[k] * v
    x = Fraction(q - rest, at[el])
    assert x.denominator == 1, f'{formula} の {el} が整数にならない'
    return int(x), at, q, fx


def sgn(v):
    return '0' if v == 0 else (f'+{v}' if v > 0 else f'−{-v}')


# ───────── 問題 ─────────
P = []


def add(cat, ans, q, hints, wrong, src=None):
    P.append(dict(cat=cat, ans=ans, q=q, hints=hints, wrong=wrong, src=src))


def eq_wrongs(hand, alts=(), n=5, salt=0):
    """反応式のまちがいの選択肢：手で書いた条件ちがいの式 → e- の数・H+ の数・H2O の数・係数のまちがい"""
    out, seen = [], {canon(hand)}

    def push(eq, ok_balanced=False):
        c = canon(eq)
        if c in seen:
            return
        if balanced(eq) and not ok_balanced:
            return
        if proportional(eq, hand):
            return
        seen.add(c); out.append(show_eq(eq))
    for a in alts:
        push(parse_eq(a), True)
    cand = []
    for si in (0, 1):
        for ti, (c, f) in enumerate(hand[si]):
            for d in ((1, -1) if f in ('e^-', 'H^+', 'H2O', 'OH^-') else (1,)):
                if c + d < 1:
                    continue
                e = [[x[:] for x in hand[0]], [x[:] for x in hand[1]]]
                e[si][ti][0] = c + d
                pri = {'e^-': 0, 'H^+': 1, 'OH^-': 1, 'H2O': 2}.get(f, 3)
                cand.append((pri, e))
            if f == 'e^-':   # e- を反対側に書く
                e = [[x[:] for x in hand[0]], [x[:] for x in hand[1]]]
                t = e[si].pop(ti); e[1 - si].append(t)
                cand.append((0, e))
            if f == 'H^+' and c % 2 == 0 and c >= 4:   # H+ を O の数だけにしてしまう
                e = [[x[:] for x in hand[0]], [x[:] for x in hand[1]]]
                e[si][ti][0] = c // 2
                cand.append((1, e))
    cand.sort(key=lambda x: x[0])
    # 種類がかたよらないように、優先度ごとに順番に取る
    groups = {}
    for p, e in cand:
        groups.setdefault(p, []).append(e)
    for g in groups.values():
        k = salt % len(g)
        g[:] = g[k:] + g[:k]
    while len(out) < n and any(groups.values()):
        for p in sorted(groups):
            if groups[p] and len(out) < n:
                push(groups[p].pop(0))
    return out


# 1) 半反応式 ───────────────────────────────
HALF = []   # 一覧表（覚える用）：[名前, 条件, 式, 'o'|'r']


def half(cat, name, cond, core, hand, medium='acid', alts=(), key=None, q=None, table=True):
    steps, built = build_half(core, medium)
    he = parse_eq(hand)
    if canon(he) != canon(built):
        raise AssertionError(f'半反応式が合わない：{name}\n  手 {hand}\n  組立 {show_eq(built)}')
    assert balanced(he), hand
    ce = parse_eq(core)
    hints = []
    if key:
        el, a, b = key[:3]
        fx = key[3] if len(key) > 3 else None
        x, y = oxnum(a, el, fx), oxnum(b, el, fx)
        hints.append(T(f'変化：[[{core}]]（{el} の酸化数 {sgn(x[0])} → {sgn(y[0])}）'))
    else:
        hints.append('変化：' + show_eq(ce))
    for t, s in steps:
        hints.append(f'{t}：{s}')
    hints.append('最後に、両辺の電荷が等しくなるように e⁻ を加える')
    role = '酸化剤' if cat == 'half:o' else '還元剤'
    qq = q or (T(f'{name}（{cond}）が{role}としてはたらくときの半反応式は？') if cond else T(f'{name}が{role}としてはたらくときの半反応式は？'))
    add(cat, show_eq(he), qq, hints, eq_wrongs(he, alts, salt=len(P)))
    if table:
        HALF.append([T(name), cond, show_eq(he), cat[-1]])
    return he


H = {}
H['MnO4'] = half('half:o', '過マンガン酸カリウム [[KMnO4]]', '硫酸酸性', 'MnO4^- -> Mn^2+', 'MnO4^- + 8H^+ + 5e^- -> Mn^2+ + 4H2O',
                 alts=['MnO4^- + 4H^+ + 3e^- -> MnO2 + 2H2O'], key=('Mn', 'MnO4^-', 'Mn^2+'))
H['MnO4b'] = half('half:o', '過マンガン酸カリウム [[KMnO4]]', '中性・塩基性', 'MnO4^- -> MnO2', 'MnO4^- + 2H2O + 3e^- -> MnO2 + 4OH^-', 'base',
                  alts=['MnO4^- + 8H^+ + 5e^- -> Mn^2+ + 4H2O'], key=('Mn', 'MnO4^-', 'MnO2'))
H['Cr2O7'] = half('half:o', '二クロム酸カリウム [[K2Cr2O7]]', '硫酸酸性', 'Cr2O7^2- -> 2Cr^3+', 'Cr2O7^2- + 14H^+ + 6e^- -> 2Cr^3+ + 7H2O',
                  key=('Cr', 'Cr2O7^2-', 'Cr^3+'))
H['H2O2o'] = half('half:o', '過酸化水素 [[H2O2]]', '酸性', 'H2O2 -> 2H2O', 'H2O2 + 2H^+ + 2e^- -> 2H2O',
                  alts=['H2O2 -> O2 + 2H^+ + 2e^-'], key=('O', 'H2O2', 'H2O'))
H['O3'] = half('half:o', 'オゾン [[O3]]', '酸性', 'O3 -> O2', 'O3 + 2H^+ + 2e^- -> O2 + H2O')
H['Cl2'] = half('half:o', '塩素 [[Cl2]]', '', 'Cl2 -> 2Cl^-', 'Cl2 + 2e^- -> 2Cl^-', key=('Cl', 'Cl2', 'Cl^-'))
H['I2'] = half('half:o', 'ヨウ素 [[I2]]', '', 'I2 -> 2I^-', 'I2 + 2e^- -> 2I^-', key=('I', 'I2', 'I^-'))
H['HNO3c'] = half('half:o', '濃硝酸 [[HNO3]]', '', 'HNO3 -> NO2', 'HNO3 + H^+ + e^- -> NO2 + H2O',
                  alts=['HNO3 + 3H^+ + 3e^- -> NO + 2H2O'], key=('N', 'HNO3', 'NO2'))
H['HNO3d'] = half('half:o', '希硝酸 [[HNO3]]', '', 'HNO3 -> NO', 'HNO3 + 3H^+ + 3e^- -> NO + 2H2O',
                  alts=['HNO3 + H^+ + e^- -> NO2 + H2O'], key=('N', 'HNO3', 'NO'))
H['H2SO4'] = half('half:o', '熱濃硫酸 [[H2SO4]]', '', 'H2SO4 -> SO2', 'H2SO4 + 2H^+ + 2e^- -> SO2 + 2H2O',
                  alts=['H2SO4 + 6H^+ + 6e^- -> S + 4H2O'], key=('S', 'H2SO4', 'SO2'))
H['SO2o'] = half('half:o', '二酸化硫黄 [[SO2]]', '硫化水素に対して', 'SO2 -> S', 'SO2 + 4H^+ + 4e^- -> S + 2H2O',
                 alts=['SO2 + 2H2O -> SO4^2- + 4H^+ + 2e^-'], key=('S', 'SO2', 'S'))
H['Fe3'] = half('half:o', '鉄(III)イオン [[Fe^3+]]', '', 'Fe^3+ -> Fe^2+', 'Fe^3+ + e^- -> Fe^2+')
H['MnO2'] = half('half:o', '酸化マンガン(IV) [[MnO2]]', '塩酸と加熱', 'MnO2 -> Mn^2+', 'MnO2 + 4H^+ + 2e^- -> Mn^2+ + 2H2O', key=('Mn', 'MnO2', 'Mn^2+'))
H['ClO'] = half('half:o', '次亜塩素酸イオン [[ClO^-]]', '酸性', 'ClO^- -> Cl^-', 'ClO^- + 2H^+ + 2e^- -> Cl^- + H2O', key=('Cl', 'ClO^-', 'Cl^-'))
H['O2a'] = half('half:o', '酸素 [[O2]]', '酸性', 'O2 -> H2O', 'O2 + 4H^+ + 4e^- -> 2H2O', alts=['O2 + 2H2O + 4e^- -> 4OH^-'])
H['O2b'] = half('half:o', '酸素 [[O2]]', '塩基性', 'O2 -> H2O', 'O2 + 2H2O + 4e^- -> 4OH^-', 'base', alts=['O2 + 4H^+ + 4e^- -> 2H2O'])
H['PbO2'] = half('half:o', '酸化鉛(IV) [[PbO2]]', '希硫酸中・鉛蓄電池の正極', 'PbO2 + SO4^2- -> PbSO4', 'PbO2 + 4H^+ + SO4^2- + 2e^- -> PbSO4 + 2H2O',
                 alts=['PbO2 + 4H^+ + 2e^- -> Pb^2+ + 2H2O'], key=('Pb', 'PbO2', 'PbSO4', {'S': 6}))
H['Ag2O'] = half('half:o', '酸化銀 [[Ag2O]]', '塩基性・酸化銀電池の正極', 'Ag2O -> 2Ag', 'Ag2O + H2O + 2e^- -> 2Ag + 2OH^-', 'base',
                 alts=['Ag2O + 2H^+ + 2e^- -> 2Ag + H2O'], key=('Ag', 'Ag2O', 'Ag'))
H['Br2'] = half('half:o', '臭素 [[Br2]]', '', 'Br2 -> 2Br^-', 'Br2 + 2e^- -> 2Br^-')

H['H2O2r'] = half('half:r', '過酸化水素 [[H2O2]]', '過マンガン酸カリウムに対して', 'H2O2 -> O2', 'H2O2 -> O2 + 2H^+ + 2e^-',
                  alts=['H2O2 + 2H^+ + 2e^- -> 2H2O'], key=('O', 'H2O2', 'O2'))
H['SO2r'] = half('half:r', '二酸化硫黄 [[SO2]]', '過マンガン酸カリウムなどに対して', 'SO2 -> SO4^2-', 'SO2 + 2H2O -> SO4^2- + 4H^+ + 2e^-',
                 alts=['SO2 + 4H^+ + 4e^- -> S + 2H2O'], key=('S', 'SO2', 'SO4^2-'))
H['H2S'] = half('half:r', '硫化水素 [[H2S]]', '', 'H2S -> S', 'H2S -> S + 2H^+ + 2e^-', alts=['H2S + 4H2O -> SO4^2- + 10H^+ + 8e^-'], key=('S', 'H2S', 'S'))
H['COOH'] = half('half:r', 'シュウ酸 [[(COOH)2]]', '', '(COOH)2 -> 2CO2', '(COOH)2 -> 2CO2 + 2H^+ + 2e^-',
                 alts=['(COOH)2 -> CO2 + CO + H2O'], key=('C', '(COOH)2', 'CO2'))
H['Fe2'] = half('half:r', '鉄(II)イオン [[Fe^2+]]', '', 'Fe^2+ -> Fe^3+', 'Fe^2+ -> Fe^3+ + e^-')
H['Sn2'] = half('half:r', 'スズ(II)イオン [[Sn^2+]]', '', 'Sn^2+ -> Sn^4+', 'Sn^2+ -> Sn^4+ + 2e^-')
H['I'] = half('half:r', 'ヨウ化物イオン [[I^-]]', '', '2I^- -> I2', '2I^- -> I2 + 2e^-')
H['S2O3'] = half('half:r', 'チオ硫酸イオン [[S2O3^2-]]', 'ヨウ素滴定', '2S2O3^2- -> S4O6^2-', '2S2O3^2- -> S4O6^2- + 2e^-',
                 alts=['S2O3^2- + 5H2O -> 2SO4^2- + 10H^+ + 8e^-'])
H['H2a'] = half('half:r', '水素 [[H2]]', '酸性', 'H2 -> 2H^+', 'H2 -> 2H^+ + 2e^-', alts=['H2 + 2OH^- -> 2H2O + 2e^-'])
H['H2b'] = half('half:r', '水素 [[H2]]', '塩基性', 'H2 -> 2H^+', 'H2 + 2OH^- -> 2H2O + 2e^-', 'base', alts=['H2 -> 2H^+ + 2e^-'])
H['Pb'] = half('half:r', '鉛 [[Pb]]', '希硫酸中・鉛蓄電池の負極', 'Pb + SO4^2- -> PbSO4', 'Pb + SO4^2- -> PbSO4 + 2e^-', alts=['Pb -> Pb^2+ + 2e^-'])
H['Cl'] = half('half:r', '塩化物イオン [[Cl^-]]', '', '2Cl^- -> Cl2', '2Cl^- -> Cl2 + 2e^-')
H['Znb'] = half('half:r', '亜鉛 [[Zn]]', '塩基性・酸化銀電池の負極', 'Zn -> ZnO', 'Zn + 2OH^- -> ZnO + H2O + 2e^-', 'base',
                alts=['Zn -> Zn^2+ + 2e^-'])
H['H2Ox'] = half('half:r', '水 [[H2O]]', '中性・酸性の水溶液の陽極', 'H2O -> O2', '2H2O -> O2 + 4H^+ + 4e^-', alts=['2H2O + 2e^- -> H2 + 2OH^-'],
                 q='中性・酸性の水溶液の電気分解で、陽極で水 H₂O が酸化されて O₂ が発生するときの半反応式は？')
H['OH'] = half('half:r', '水酸化物イオン [[OH^-]]', '塩基性の水溶液の陽極', 'H2O -> O2', '4OH^- -> O2 + 2H2O + 4e^-', 'base',
               q='塩基性の水溶液の電気分解で、陽極で OH⁻ が酸化されて O₂ が発生するときの半反応式は？')
H['H2Or'] = half('half:o', '水 [[H2O]]', '中性・塩基性の水溶液の陰極', '2H^+ -> H2', '2H2O + 2e^- -> H2 + 2OH^-', 'base', alts=['2H2O -> O2 + 4H^+ + 4e^-'],
                 q='中性・塩基性の水溶液の電気分解で、陰極で水 H₂O が還元されて H₂ が発生するときの半反応式は？')
H['Hp'] = half('half:o', '水素イオン [[H^+]]', '酸性の水溶液の陰極', '2H^+ -> H2', '2H^+ + 2e^- -> H2',
               q='酸性の水溶液の電気分解で、陰極で H⁺ が還元されて H₂ が発生するときの半反応式は？')
H['O3b'] = half('half:o', 'オゾン [[O3]]', '中性・ヨウ化カリウム水溶液中', 'O3 -> O2', 'O3 + H2O + 2e^- -> O2 + 2OH^-', 'base', alts=['O3 + 2H^+ + 2e^- -> O2 + H2O'])

# 2) 酸化数 ───────────────────────────────
# よくある間違い「イオンの電荷を忘れる」の値：電荷を外した式で解き直す（整数にならないときは使わない）
def _forget_charge(formula, el, fixed):
    try:
        return oxnum(re.sub(r'\^.*', '', formula), el, fixed)[0]
    except AssertionError:
        return None


def ox(formula, el, ans, fixed=None, name=''):
    x, at, q, fx = oxnum(formula, el, fixed)
    assert x == ans, f'酸化数が合わない {formula} {el}: 計算 {x} 手 {ans}'
    others = [k for k in at if k != el]
    terms = []
    for k in at:
        n = at[k]
        terms.append(('x' if k == el else f'({sgn(fx[k])})') if n == 1 else (f'{n}x' if k == el else f'{n}×({sgn(fx[k])})'))
    hints = ['決まっている酸化数：' + '、'.join(f'{k} {sgn(fx[k])}' for k in others) if others else '単体の原子の酸化数は 0',
             f'酸化数の合計 = {"イオンの電荷 " + sgn(q) if q else "0（化合物・単体）"}',
             f'{el} の酸化数を x とすると {" + ".join(terms)} = {sgn(q) if q else 0}']
    cands = [-x, _forget_charge(formula, el, fixed) if q else None, x * at[el] if at[el] > 1 else None,
             x + 1, x - 1, x + 2, x - 2, x + 3, x - 3, x + 4, x - 4]
    ws = []
    for v in cands:
        if v is None or v == x or v in ws or abs(v) > 8:
            continue
        ws.append(v)
    add('ox', sgn(x), T(f'{name + " " if name else ""}[[{formula}]] の {el} の酸化数は？'), hints, [sgn(v) for v in ws[:5]])


ox('H2SO4', 'S', 6, name='硫酸')
ox('SO2', 'S', 4, name='二酸化硫黄')
ox('H2S', 'S', -2, name='硫化水素')
ox('Na2S2O3', 'S', 2, name='チオ硫酸ナトリウム')
ox('SO3^2-', 'S', 4, name='亜硫酸イオン')
ox('KMnO4', 'Mn', 7, name='過マンガン酸カリウム')
ox('MnO2', 'Mn', 4, name='酸化マンガン(IV)')
ox('K2MnO4', 'Mn', 6, name='マンガン酸カリウム')
ox('K2Cr2O7', 'Cr', 6, name='二クロム酸カリウム')
ox('CrO4^2-', 'Cr', 6, name='クロム酸イオン')
ox('HNO3', 'N', 5, name='硝酸')
ox('NO2', 'N', 4, name='二酸化窒素')
ox('NO', 'N', 2, name='一酸化窒素')
ox('NH3', 'N', -3, name='アンモニア')
ox('NH4^+', 'N', -3, name='アンモニウムイオン')
ox('N2O', 'N', 1, name='一酸化二窒素')
ox('HClO', 'Cl', 1, name='次亜塩素酸')
ox('NaClO3', 'Cl', 5, name='塩素酸ナトリウム')
ox('HClO4', 'Cl', 7, name='過塩素酸')
ox('Cl2', 'Cl', 0, name='塩素')
ox('H2O2', 'O', -1, name='過酸化水素')
ox('OF2', 'O', 2, name='二フッ化酸素')
ox('NaH', 'H', -1, name='水素化ナトリウム')
ox('(COOH)2', 'C', 3, name='シュウ酸')
ox('CH4', 'C', -4, name='メタン')
ox('HCHO', 'C', 0, name='ホルムアルデヒド')
ox('CO', 'C', 2, name='一酸化炭素')
ox('Fe2O3', 'Fe', 3, name='酸化鉄(III)')
ox('PbO2', 'Pb', 4, name='酸化鉛(IV)')
ox('PbSO4', 'Pb', 2, fixed={'S': 6}, name='硫酸鉛(II)')
ox('Cu2O', 'Cu', 1, name='酸化銅(I)')
ox('H3PO4', 'P', 5, name='リン酸')
ox('[Fe(CN)6]^3-', 'Fe', 3, fixed={'C': 2, 'N': -3}, name='ヘキサシアニド鉄(III)酸イオン')

# 3) 酸化剤・還元剤のはたらき（反応の前後の酸化数で決める） ─────────
ROLES = ['酸化剤', '還元剤', '酸化剤でも還元剤でもある', '酸化剤でも還元剤でもない']


def role(eq, sp, el, prods, ans, fixed=None):
    e = parse_eq(eq)
    assert balanced(e), eq
    assert any(f == sp for c, f in e[0]), sp
    x = oxnum(sp, el, fixed)[0]
    ys = [oxnum(p, el, fixed)[0] for p in prods]
    up, down = any(y > x for y in ys), any(y < x for y in ys)
    got = ROLES[2] if up and down else ROLES[0] if down else ROLES[1] if up else ROLES[3]
    assert got == ans, f'はたらきが合わない {eq} {sp}: {got}'
    ch = '、'.join(f'{disp_formula(p)} では {sgn(y)}' for p, y in zip(prods, ys))
    hints = [T(f'{el} の酸化数：[[{sp}]] では {sgn(x)} → {ch}'),
             '酸化数が減る＝還元される＝相手を酸化する（酸化剤）／酸化数が増える＝酸化される（還元剤）']
    add('role', ans, T(f'反応 [[{eq}]] で、[[{sp}]] のはたらきは？'), hints, [r for r in ROLES if r != ans])


role('SO2 + 2H2S -> 3S + 2H2O', 'SO2', 'S', ['S'], '酸化剤')
role('SO2 + 2H2S -> 3S + 2H2O', 'H2S', 'S', ['S'], '還元剤')
role('2KMnO4 + 5H2O2 + 3H2SO4 -> 2MnSO4 + K2SO4 + 5O2 + 8H2O', 'H2O2', 'O', ['O2'], '還元剤')
role('H2O2 + 2KI + H2SO4 -> I2 + K2SO4 + 2H2O', 'H2O2', 'O', ['H2O'], '酸化剤')
role('I2 + SO2 + 2H2O -> 2HI + H2SO4', 'SO2', 'S', ['H2SO4'], '還元剤')
role('Cl2 + H2O -> HCl + HClO', 'Cl2', 'Cl', ['HCl', 'HClO'], '酸化剤でも還元剤でもある')
role('3NO2 + H2O -> 2HNO3 + NO', 'NO2', 'N', ['HNO3', 'NO'], '酸化剤でも還元剤でもある')
role('MnO2 + 4HCl -> MnCl2 + Cl2 + 2H2O', 'MnO2', 'Mn', ['MnCl2'], '酸化剤', fixed={'Cl': -1})
role('Cu + 2H2SO4 -> CuSO4 + SO2 + 2H2O', 'H2SO4', 'S', ['SO2'], '酸化剤')
role('2Na + 2H2O -> 2NaOH + H2', 'H2O', 'H', ['H2'], '酸化剤')
role('Fe2O3 + 3CO -> 2Fe + 3CO2', 'CO', 'C', ['CO2'], '還元剤')
role('Cl2 + 2KI -> 2KCl + I2', 'Cl2', 'Cl', ['KCl'], '酸化剤')
role('2H2O2 -> 2H2O + O2', 'H2O2', 'O', ['H2O', 'O2'], '酸化剤でも還元剤でもある')

# 4) 酸化還元の基本（知識。答えは教科書の定義どおり） ─────────
add('know', '電子を失う', '酸化されるとはどういうことか（電子の受け渡しで）', ['酸素を受け取る・水素を失う、と同じ側', '酸化数は増える'],
    ['電子を受け取る', '陽子を失う', '中性子を受け取る', '水素を受け取る'])
add('know', '相手を酸化し、自身は還元される物質', '酸化剤とは？', ['酸化剤は相手から電子を奪う', '自身の酸化数は減る'],
    ['相手を還元し、自身は酸化される物質', '相手を酸化し、自身も酸化される物質', '自身は変化せず反応を速める物質', '水素イオンを与える物質'])
add('know', T('[[H2O2]] と [[SO2]]'), '酸化剤としても還元剤としてもはたらく物質の組は？', ['相手しだいで、はたらきが変わる', T('[[KMnO4]] には還元剤、[[H2S]] には酸化剤（[[SO2]]）')],
    [T('[[KMnO4]] と [[K2Cr2O7]]'), T('[[H2S]] と [[(COOH)2]]'), T('[[KMnO4]] と [[H2S]]'), T('[[Fe^3+]] と [[I^-]]')])
add('know', T('[[MnO4^-]] の赤紫色が消えずに残ったとき'), T('[[KMnO4]] を滴下する酸化還元滴定の終点は？'),
    [T('[[MnO4^-]] は赤紫色、[[Mn^2+]] はほぼ無色'), '指示薬はいらない'],
    ['溶液が青紫色になったとき', '溶液が無色になったとき', '沈殿が生じたとき', 'フェノールフタレインが赤くなったとき'])
add('know', T('塩酸の [[Cl^-]] は酸化され、硝酸は自身が酸化剤だから'), T('[[KMnO4]] の滴定で、酸性にするのに塩酸や硝酸を使わず硫酸を使う理由は？'),
    [T('塩酸：[[2Cl^- -> Cl2 + 2e^-]] が起こってしまう'), '硝酸：それ自身が強い酸化剤'],
    ['塩酸や硝酸は弱酸だから', '硫酸は揮発しやすいから', T('硫酸は [[MnO4^-]] を還元するから'), '塩酸や硝酸は電離しないから'])
add('know', 'デンプン（青紫色が消えたところ）', T('ヨウ素 [[I2]] をチオ硫酸ナトリウムで滴定するときの指示薬は？'),
    ['ヨウ素デンプン反応', T('[[I2 + 2S2O3^2- -> 2I^- + S4O6^2-]]')], ['フェノールフタレイン', 'メチルオレンジ', T('[[KMnO4]]（赤紫色が残る）'), 'ブロモチモールブルー'])
add('know', '橙赤色 → 緑色', T('硫酸酸性の [[K2Cr2O7]] が還元されるときの色の変化は？'), [T('[[Cr2O7^2-]] は橙赤色'), T('[[Cr^3+]] は緑色')],
    ['赤紫色 → ほぼ無色', '黄色 → 橙赤色', '緑色 → 橙赤色', '無色 → 褐色'])
add('know', 'イオン化傾向', '金属の単体が水溶液中で電子を失って陽イオンになろうとする性質を何というか', ['大きいほど酸化されやすい', 'K > Ca > Na > Mg > Al > Zn > Fe …'],
    ['電気陰性度', 'イオン化エネルギー', '電子親和力', '酸化数'])
add('know', T('[[Fe]]・[[Ni]]・[[Al]]'), '濃硝酸に入れると表面に酸化物の膜ができて溶けない（不動態になる）金属の組は？', ['不動態', '表面にち密な酸化物の膜'],
    [T('[[Cu]]・[[Ag]]・[[Hg]]'), T('[[Na]]・[[K]]・[[Ca]]'), T('[[Zn]]・[[Sn]]・[[Pb]]'), T('[[Au]]・[[Pt]]・[[Ag]]')])
add('know', T('[[Au]] と [[Pt]]'), '王水（濃硝酸：濃塩酸 = 1：3）にしか溶けない金属は？', ['イオン化傾向が最も小さい2つ', '熱濃硫酸や硝酸にも溶けない'],
    [T('[[Cu]] と [[Ag]]'), T('[[Fe]] と [[Al]]'), T('[[Hg]] と [[Ag]]'), T('[[Pb]] と [[Sn]]')])
add('know', 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂', '酸化還元反応でないものはどれか', ['どの原子の酸化数も変わらない反応を探す', '酸と塩（弱酸の塩）の反応'],
    [T('[[Zn + 2HCl -> ZnCl2 + H2]]'), T('[[2Mg + O2 -> 2MgO]]'), T('[[Cl2 + 2KI -> 2KCl + I2]]'), T('[[Cu + 2H2SO4 -> CuSO4 + SO2 + 2H2O]]')])
assert balanced(parse_eq('CaCO3 + 2HCl -> CaCl2 + H2O + CO2'))

# 5) イオン反応式（2つの半反応式を足す） ─────────
def ionic(ox_, red_, hand, q, alts=(), hint_extra=None):
    (a, b), got = combine(H[ox_], H[red_])
    he = parse_eq(hand)
    if canon(he) != canon(got):
        raise AssertionError(f'イオン反応式が合わない {q}\n  手 {hand}\n  計算 {show_eq(got)}')
    hints = ['酸化剤：' + show_eq(H[ox_]), '還元剤：' + show_eq(H[red_]),
             f'e⁻ の数をそろえる：酸化剤の式 ×{a}、還元剤の式 ×{b} を足し、両辺の同じものを消す']
    if hint_extra:
        hints.append(hint_extra)
    na = [show_eq_ascii(x) for x in naive_alts(H[ox_], H[red_], a, b, he)]
    add('ionic', show_eq(he), T(q), hints, eq_wrongs(he, list(alts) + na[:2], salt=len(P)))
    return he


I = {}
I['MnH2O2'] = ionic('MnO4', 'H2O2r', '2MnO4^- + 5H2O2 + 6H^+ -> 2Mn^2+ + 5O2 + 8H2O', '硫酸酸性で [[MnO4^-]] と [[H2O2]] が反応するときのイオン反応式は？')
I['MnFe'] = ionic('MnO4', 'Fe2', 'MnO4^- + 5Fe^2+ + 8H^+ -> Mn^2+ + 5Fe^3+ + 4H2O', '硫酸酸性で [[MnO4^-]] と [[Fe^2+]] が反応するときのイオン反応式は？')
I['MnCOOH'] = ionic('MnO4', 'COOH', '2MnO4^- + 5(COOH)2 + 6H^+ -> 2Mn^2+ + 10CO2 + 8H2O', '硫酸酸性で [[MnO4^-]] とシュウ酸 [[(COOH)2]] が反応するときのイオン反応式は？')
I['MnSO2'] = ionic('MnO4', 'SO2r', '2MnO4^- + 5SO2 + 2H2O -> 2Mn^2+ + 5SO4^2- + 4H^+', '[[MnO4^-]] の水溶液に [[SO2]] を通じたときのイオン反応式は？')
I['CrFe'] = ionic('Cr2O7', 'Fe2', 'Cr2O7^2- + 6Fe^2+ + 14H^+ -> 2Cr^3+ + 6Fe^3+ + 7H2O', '硫酸酸性で [[Cr2O7^2-]] と [[Fe^2+]] が反応するときのイオン反応式は？')
I['CrH2O2'] = ionic('Cr2O7', 'H2O2r', 'Cr2O7^2- + 3H2O2 + 8H^+ -> 2Cr^3+ + 3O2 + 7H2O', '硫酸酸性で [[Cr2O7^2-]] と [[H2O2]] が反応するときのイオン反応式は？')
I['CrCOOH'] = ionic('Cr2O7', 'COOH', 'Cr2O7^2- + 3(COOH)2 + 8H^+ -> 2Cr^3+ + 6CO2 + 7H2O', '硫酸酸性で [[Cr2O7^2-]] とシュウ酸が反応するときのイオン反応式は？')
I['H2O2I'] = ionic('H2O2o', 'I', 'H2O2 + 2I^- + 2H^+ -> I2 + 2H2O', '硫酸酸性で [[H2O2]] と [[I^-]] が反応するときのイオン反応式は？')
I['I2SO2'] = ionic('I2', 'SO2r', 'I2 + SO2 + 2H2O -> 2I^- + SO4^2- + 4H^+', 'ヨウ素 [[I2]] の水溶液に [[SO2]] を通じたときのイオン反応式は？')
I['I2S2O3'] = ionic('I2', 'S2O3', 'I2 + 2S2O3^2- -> 2I^- + S4O6^2-', 'ヨウ素 [[I2]] とチオ硫酸イオン [[S2O3^2-]] が反応するときのイオン反応式は？')
I['SO2H2S'] = ionic('SO2o', 'H2S', 'SO2 + 2H2S -> 3S + 2H2O', '[[SO2]] と [[H2S]] が反応するときの反応式は？')
I['Cl2I'] = ionic('Cl2', 'I', 'Cl2 + 2I^- -> 2Cl^- + I2', '塩素 [[Cl2]] をヨウ化物イオン [[I^-]] の水溶液に通じたときのイオン反応式は？')
I['FeSn'] = ionic('Fe3', 'Sn2', '2Fe^3+ + Sn^2+ -> 2Fe^2+ + Sn^4+', '[[Fe^3+]] と [[Sn^2+]] が反応するときのイオン反応式は？')
I['FeI'] = ionic('Fe3', 'I', '2Fe^3+ + 2I^- -> 2Fe^2+ + I2', '[[Fe^3+]] と [[I^-]] が反応するときのイオン反応式は？')
I['MnO2Cl'] = ionic('MnO2', 'Cl', 'MnO2 + 4H^+ + 2Cl^- -> Mn^2+ + Cl2 + 2H2O', '[[MnO2]] に濃塩酸を加えて加熱したときのイオン反応式は？')
I['ClOCl'] = ionic('ClO', 'Cl', 'ClO^- + Cl^- + 2H^+ -> Cl2 + H2O', '塩素系漂白剤（[[ClO^-]]）と酸性の洗剤（[[HCl]]）を混ぜると塩素が出る。そのイオン反応式は？',
                   hint_extra='「まぜるな危険」の理由')
I['O3I'] = ionic('O3b', 'I', 'O3 + 2I^- + H2O -> O2 + I2 + 2OH^-', 'オゾン [[O3]] をヨウ化カリウム水溶液に通じたときのイオン反応式は？')

# 金属と酸化剤（イオン化傾向・酸）: 金属の半反応式は機械的に作る
def metal_half(m, n):
    return parse_eq(f'{m} -> {m}^{n if n > 1 else ""}+ + {str(n) if n > 1 else ""}e^-')


for m, n in (('Zn', 2), ('Cu', 2), ('Fe', 2), ('Al', 3), ('Ag', 1), ('Mg', 2)):
    H['M_' + m] = metal_half(m, n)
    assert balanced(H['M_' + m])
for m, n in (('Cu', 2), ('Ag', 1)):
    H['I_' + m] = parse_eq(f'{m}^{n if n > 1 else ""}+ + {str(n) if n > 1 else ""}e^- -> {m}')
    assert balanced(H['I_' + m])

I['CuHNO3d'] = ionic('HNO3d', 'M_Cu', '3Cu + 2HNO3 + 6H^+ -> 3Cu^2+ + 2NO + 4H2O', '銅 [[Cu]] を希硝酸に溶かしたときの反応を、[[HNO3]] と [[H^+]] を使ったイオン反応式で書くと？',
                     alts=['Cu + 2HNO3 + 2H^+ -> Cu^2+ + 2NO2 + 2H2O'])
I['CuHNO3c'] = ionic('HNO3c', 'M_Cu', 'Cu + 2HNO3 + 2H^+ -> Cu^2+ + 2NO2 + 2H2O', '銅 [[Cu]] を濃硝酸に溶かしたときの反応を、[[HNO3]] と [[H^+]] を使ったイオン反応式で書くと？',
                     alts=['3Cu + 2HNO3 + 6H^+ -> 3Cu^2+ + 2NO + 4H2O'])
I['CuH2SO4'] = ionic('H2SO4', 'M_Cu', 'Cu + H2SO4 + 2H^+ -> Cu^2+ + SO2 + 2H2O', '銅 [[Cu]] を熱濃硫酸に溶かしたときの反応を、[[H2SO4]] と [[H^+]] を使ったイオン反応式で書くと？')

# 6) 化学反応式（電離させて同じイオンを消すとイオン反応式になる） ─────────
def full(hand, ion_key, q, hint, alts=()):
    he = parse_eq(hand)
    assert balanced(he), hand
    if ion_key:
        a = ionize(he)
        b = ionize(I[ion_key])
        if canon(a) != canon(b) and not proportional(a, b):   # 2倍などは同じ反応
            raise AssertionError(f'化学反応式がイオン反応式と合わない {hand}\n  {canon(a)}\n  {canon(b)}')
        hints = ['イオン反応式：' + show_eq(I[ion_key]), hint]
    else:
        hints = [hint]
    add('full', show_eq(he), T(q), hints, eq_wrongs(he, alts, salt=len(P)))


full('2KMnO4 + 5H2O2 + 3H2SO4 -> 2MnSO4 + K2SO4 + 5O2 + 8H2O', 'MnH2O2', '硫酸酸性の [[KMnO4]] と [[H2O2]] の反応の化学反応式は？', 'K⁺ と SO₄²⁻ を両辺に補う')
full('2KMnO4 + 5(COOH)2 + 3H2SO4 -> 2MnSO4 + K2SO4 + 10CO2 + 8H2O', 'MnCOOH', '硫酸酸性の [[KMnO4]] とシュウ酸の反応の化学反応式は？', 'K⁺ と SO₄²⁻ を両辺に補う')
full('2KMnO4 + 10FeSO4 + 8H2SO4 -> 2MnSO4 + 5Fe2(SO4)3 + K2SO4 + 8H2O', 'MnFe', '硫酸酸性の [[KMnO4]] と [[FeSO4]] の反応の化学反応式は？', 'Fe³⁺ は Fe₂(SO₄)₃ にまとめるので、Fe²⁺ の係数は偶数にそろえる')
full('K2Cr2O7 + 6FeSO4 + 7H2SO4 -> Cr2(SO4)3 + 3Fe2(SO4)3 + K2SO4 + 7H2O', 'CrFe', '硫酸酸性の [[K2Cr2O7]] と [[FeSO4]] の反応の化学反応式は？', 'K⁺ と SO₄²⁻ を両辺に補う')
full('H2O2 + 2KI + H2SO4 -> I2 + K2SO4 + 2H2O', 'H2O2I', '硫酸酸性で [[H2O2]] と [[KI]] が反応するときの化学反応式は？', 'K⁺ と SO₄²⁻ を両辺に補う')
full('3Cu + 8HNO3 -> 3Cu(NO3)2 + 2NO + 4H2O', 'CuHNO3d', '銅 [[Cu]] と希硝酸の反応の化学反応式は？', '酸としてはたらく HNO₃（NO₃⁻ のまま残る）も数える',
     alts=['Cu + 4HNO3 -> Cu(NO3)2 + 2NO2 + 2H2O'])
full('Cu + 4HNO3 -> Cu(NO3)2 + 2NO2 + 2H2O', 'CuHNO3c', '銅 [[Cu]] と濃硝酸の反応の化学反応式は？', '酸としてはたらく HNO₃（NO₃⁻ のまま残る）も数える',
     alts=['3Cu + 8HNO3 -> 3Cu(NO3)2 + 2NO + 4H2O'])
full('Cu + 2H2SO4 -> CuSO4 + SO2 + 2H2O', 'CuH2SO4', '銅 [[Cu]] と熱濃硫酸の反応の化学反応式は？', '酸としてはたらく H₂SO₄ も数える',
     alts=['Cu + H2SO4 -> CuSO4 + H2'])
full('MnO2 + 4HCl -> MnCl2 + Cl2 + 2H2O', 'MnO2Cl', '[[MnO2]] と濃塩酸を加熱して塩素をつくる反応の化学反応式は？', 'Mn²⁺ は MnCl₂ にまとめる')
full('Cl2 + 2KI -> 2KCl + I2', 'Cl2I', '塩素 [[Cl2]] を [[KI]] 水溶液に通じたときの化学反応式は？', 'K⁺ を両辺に補う')
full('2KMnO4 + 5SO2 + 2H2O -> 2MnSO4 + K2SO4 + 2H2SO4', 'MnSO2', '[[KMnO4]] 水溶液に [[SO2]] を通じたときの化学反応式は？', 'SO₄²⁻ は MnSO₄・K₂SO₄・H₂SO₄ に分ける')
full('NaClO + 2HCl -> NaCl + Cl2 + H2O', 'ClOCl', '次亜塩素酸ナトリウム [[NaClO]] と塩酸の反応の化学反応式は？', 'Na⁺ と Cl⁻ を両辺に補う')
full('O3 + 2KI + H2O -> O2 + I2 + 2KOH', 'O3I', 'オゾン [[O3]] をヨウ化カリウム水溶液に通じたときの化学反応式は？', 'K⁺ を両辺に補う（OH⁻ は KOH に）')

# 7) 金属のイオン化傾向 ─────────
SERIES = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au']
SALT = {'CuSO4': 'Cu', 'AgNO3': 'Ag', 'ZnSO4': 'Zn', 'FeSO4': 'Fe', 'MgSO4': 'Mg', 'Pb(NO3)2': 'Pb', 'SnCl2': 'Sn'}
reacts = lambda m, salt: SERIES.index(m) < SERIES.index(SALT[salt])
combo = lambda m, s: T(f'[[{m}]] 板を [[{s}]] 水溶液に入れる')


def deposit(yes, nos, want=True):
    for m, s in [yes]:
        assert reacts(m, s) == want, (m, s)
    for m, s in nos:
        assert reacts(m, s) != want, (m, s)
    q = '金属が析出するのはどれか' if want else '何も変化が起こらないのはどれか'
    add('metal', combo(*yes), q, ['イオン化列：K > Ca > Na > Mg > Al > Zn > Fe > Ni > Sn > Pb > (H₂) > Cu > Hg > Ag > Pt > Au',
                                   '板の金属のほうがイオン化傾向が大きいときだけ、板が溶けて水溶液中の金属が析出する'], [combo(*x) for x in nos])


deposit(('Zn', 'CuSO4'), [('Cu', 'ZnSO4'), ('Ag', 'CuSO4'), ('Cu', 'FeSO4'), ('Fe', 'MgSO4')])
deposit(('Cu', 'AgNO3'), [('Ag', 'CuSO4'), ('Cu', 'ZnSO4'), ('Pb', 'ZnSO4'), ('Cu', 'Pb(NO3)2')])
deposit(('Fe', 'CuSO4'), [('Cu', 'FeSO4'), ('Zn', 'MgSO4'), ('Ag', 'Pb(NO3)2'), ('Sn', 'ZnSO4')])
deposit(('Zn', 'Pb(NO3)2'), [('Pb', 'ZnSO4'), ('Cu', 'SnCl2'), ('Fe', 'MgSO4'), ('Ag', 'CuSO4')])
deposit(('Cu', 'ZnSO4'), [('Zn', 'CuSO4'), ('Fe', 'CuSO4'), ('Cu', 'AgNO3'), ('Mg', 'ZnSO4')], want=False)
deposit(('Ag', 'CuSO4'), [('Cu', 'AgNO3'), ('Zn', 'FeSO4'), ('Mg', 'CuSO4'), ('Fe', 'SnCl2')], want=False)
for m in ['Cu', 'Ag']:
    assert SERIES.index(m) > SERIES.index('H')
for m in ['Zn', 'Fe', 'Mg', 'Al', 'Ni']:
    assert SERIES.index(m) < SERIES.index('H')
add('metal', T('[[Cu]]'), '希塩酸に溶けない金属はどれか', ['水素よりイオン化傾向の小さい金属は、ふつうの酸（H⁺）には溶けない', 'Cu・Ag は酸化力のある酸（硝酸・熱濃硫酸）なら溶ける'],
    [T(f'[[{m}]]') for m in ['Zn', 'Fe', 'Mg', 'Al', 'Ni']])
add('metal', T('[[Ag]]'), '希硫酸に溶けない金属はどれか', ['水素よりイオン化傾向の小さい金属を探す', 'Ag は硝酸には溶ける'],
    [T(f'[[{m}]]') for m in ['Zn', 'Fe', 'Mg', 'Al', 'Ni']])
for m in ['Na', 'Ca', 'K']:
    assert SERIES.index(m) <= SERIES.index('Na')
add('metal', T('[[Na]]'), '常温の水と激しく反応して水素を発生する金属はどれか', ['K・Ca・Na は常温の水と反応', 'Mg は熱水、Al・Zn・Fe は高温の水蒸気と反応'],
    [T(f'[[{m}]]') for m in ['Mg', 'Al', 'Zn', 'Fe', 'Cu']])


def mfull(hand, q, hint, alts=()):
    he = parse_eq(hand)
    assert balanced(he), hand
    add('metal', show_eq(he), T(q), [hint], eq_wrongs(he, alts, salt=len(P)))


def mionic(mk, ik, hand, q):
    (a, b), got = combine(H[ik], H[mk])
    he = parse_eq(hand)
    assert canon(he) == canon(got), (hand, show_eq(got))
    na = [show_eq_ascii(x) for x in naive_alts(H[ik], H[mk], a, b, he)]
    add('metal', show_eq(he), T(q), ['金属：' + show_eq(H[mk]), 'イオン：' + show_eq(H[ik]), f'e⁻ をそろえて足す（×{b} と ×{a}）'], eq_wrongs(he, na[:2], salt=len(P)))


H['I_H'] = H['Hp']
mionic('M_Zn', 'I_Cu', 'Zn + Cu^2+ -> Zn^2+ + Cu', '[[Zn]] 板を [[CuSO4]] 水溶液に入れたときのイオン反応式は？')
mionic('M_Cu', 'I_Ag', 'Cu + 2Ag^+ -> Cu^2+ + 2Ag', '[[Cu]] 線を [[AgNO3]] 水溶液に入れたときのイオン反応式は？（銀樹）')
mionic('M_Fe', 'I_Cu', 'Fe + Cu^2+ -> Fe^2+ + Cu', '[[Fe]] くぎを [[CuSO4]] 水溶液に入れたときのイオン反応式は？')
mionic('M_Al', 'I_H', '2Al + 6H^+ -> 2Al^3+ + 3H2', '[[Al]] を塩酸に入れたときのイオン反応式は？')
mionic('M_Mg', 'I_H', 'Mg + 2H^+ -> Mg^2+ + H2', '[[Mg]] を塩酸に入れたときのイオン反応式は？')
mfull('2Na + 2H2O -> 2NaOH + H2', '[[Na]] と水の反応の化学反応式は？', 'Na は常温の水と反応し、水酸化物と水素ができる', alts=['2Na + H2O -> Na2O + H2'])
mfull('Mg + 2H2O -> Mg(OH)2 + H2', '[[Mg]] と熱水の反応の化学反応式は？', 'Mg は熱水と反応して水酸化物と水素ができる', alts=['Mg + H2O -> MgO + H2'])
mfull('3Fe + 4H2O -> Fe3O4 + 4H2', '[[Fe]] と高温の水蒸気の反応の化学反応式は？', '高温の水蒸気とは四酸化三鉄 Fe₃O₄ と水素ができる', alts=['Fe + 2H2O -> Fe(OH)2 + H2'])
mfull('Zn + 2HCl -> ZnCl2 + H2', '[[Zn]] と塩酸の反応の化学反応式は？', '水素よりイオン化傾向が大きいので、H⁺ を還元して H₂ が出る', alts=['Zn + HCl -> ZnCl + H'])
mfull('2Al + 2NaOH + 6H2O -> 2Na[Al(OH)4] + 3H2', '[[Al]] を水酸化ナトリウム水溶液に入れたときの化学反応式は？', 'Al は両性金属。テトラヒドロキシドアルミン酸ナトリウムと水素ができる')

# 8) 電池（負極 + 正極 = 全体） ─────────
CELLS = []


def cell(name, neg, pos, overall, desc, ion_overall=None, qs=('neg', 'pos', 'all'), alts=None):
    ne, pe = parse_eq(neg), parse_eq(pos)
    assert balanced(ne) and balanced(pe), name
    assert any(f == 'e^-' for c, f in ne[1]), f'{name}: 負極は e- を出す（酸化）'
    assert any(f == 'e^-' for c, f in pe[0]), f'{name}: 正極は e- を受け取る（還元）'
    (a, b), got = combine(pe, ne)
    oe = parse_eq(overall)
    assert balanced(oe), overall
    if canon(oe) != canon(got) and canon(ionize(oe)) != canon(ionize(got)):
        raise AssertionError(f'{name} の全体の式が合わない\n  手 {overall}\n  計算 {show_eq(got)}')
    CELLS.append((name, ne, pe))
    alts = alts or {}
    if 'neg' in qs:
        add('cell', show_eq(ne), T(f'{name}（{desc}）の負極の反応は？'), ['負極：電子を出す＝酸化が起こる（e⁻ は右辺）', '正極：' + show_eq(pe)],
            eq_wrongs(ne, alts.get('neg', ()), salt=len(P)))
    if 'pos' in qs:
        add('cell', show_eq(pe), T(f'{name}（{desc}）の正極の反応は？'), ['正極：電子を受け取る＝還元が起こる（e⁻ は左辺）', '負極：' + show_eq(ne)],
            eq_wrongs(pe, alts.get('pos', ()), salt=len(P)))
    if 'all' in qs:
        add('cell', show_eq(oe), T(f'{name}（{desc}）の放電のときの全体の反応は？'),
            ['負極：' + show_eq(ne), '正極：' + show_eq(pe), f'e⁻ をそろえて足す（正極 ×{a}、負極 ×{b}）'], eq_wrongs(oe, alts.get('all', ()), salt=len(P)))


cell('ダニエル電池', 'Zn -> Zn^2+ + 2e^-', 'Cu^2+ + 2e^- -> Cu', 'Zn + Cu^2+ -> Zn^2+ + Cu', '(−) Zn | ZnSO₄aq | CuSO₄aq | Cu (+)',
     alts={'pos': ['2H^+ + 2e^- -> H2'], 'neg': ['Cu -> Cu^2+ + 2e^-']})
cell('ボルタ電池', 'Zn -> Zn^2+ + 2e^-', '2H^+ + 2e^- -> H2', 'Zn + 2H^+ -> Zn^2+ + H2', '(−) Zn | H₂SO₄aq | Cu (+)',
     qs=('pos', 'all'), alts={'pos': ['Cu^2+ + 2e^- -> Cu', 'O2 + 4H^+ + 4e^- -> 2H2O']})
cell('鉛蓄電池', 'Pb + SO4^2- -> PbSO4 + 2e^-', 'PbO2 + 4H^+ + SO4^2- + 2e^- -> PbSO4 + 2H2O', 'Pb + PbO2 + 2H2SO4 -> 2PbSO4 + 2H2O',
     '(−) Pb | H₂SO₄aq | PbO₂ (+)', alts={'neg': ['Pb -> Pb^2+ + 2e^-'], 'pos': ['PbO2 + 4H^+ + 2e^- -> Pb^2+ + 2H2O'], 'all': ['Pb + PbO2 + 4H^+ -> 2Pb^2+ + 2H2O']})
cell('燃料電池（リン酸形）', 'H2 -> 2H^+ + 2e^-', 'O2 + 4H^+ + 4e^- -> 2H2O', '2H2 + O2 -> 2H2O', '(−) H₂ | H₃PO₄aq | O₂ (+)',
     alts={'neg': ['H2 + 2OH^- -> 2H2O + 2e^-'], 'pos': ['O2 + 2H2O + 4e^- -> 4OH^-']})
cell('燃料電池（アルカリ形）', 'H2 + 2OH^- -> 2H2O + 2e^-', 'O2 + 2H2O + 4e^- -> 4OH^-', '2H2 + O2 -> 2H2O', '(−) H₂ | KOHaq | O₂ (+)',
     qs=('neg', 'pos'), alts={'neg': ['H2 -> 2H^+ + 2e^-'], 'pos': ['O2 + 4H^+ + 4e^- -> 2H2O']})
cell('酸化銀電池', 'Zn + 2OH^- -> ZnO + H2O + 2e^-', 'Ag2O + H2O + 2e^- -> 2Ag + 2OH^-', 'Zn + Ag2O -> ZnO + 2Ag', '(−) Zn | KOHaq | Ag₂O (+)',
     alts={'neg': ['Zn -> Zn^2+ + 2e^-'], 'pos': ['Ag^+ + e^- -> Ag']})
# 鉛蓄電池の充電（放電の逆向き）
chg_neg, chg_pos = parse_eq('PbSO4 + 2e^- -> Pb + SO4^2-'), parse_eq('PbSO4 + 2H2O -> PbO2 + 4H^+ + SO4^2- + 2e^-')
for e, dis in ((chg_neg, 'Pb + SO4^2- -> PbSO4 + 2e^-'), (chg_pos, 'PbO2 + 4H^+ + SO4^2- + 2e^- -> PbSO4 + 2H2O')):
    d = parse_eq(dis)
    assert canon((e[1], e[0])) == canon(d), '充電は放電の逆向き'
add('cell', show_eq(chg_neg), '鉛蓄電池を充電するとき、外部電源の負極につないだ電極（鉛蓄電池の負極）で起こる反応は？',
    ['充電は放電の逆向きの反応', '負極側は電子を受け取る（還元）'], eq_wrongs(chg_neg, ['Pb + SO4^2- -> PbSO4 + 2e^-', 'Pb^2+ + 2e^- -> Pb'], salt=len(P)))
add('cell', show_eq(chg_pos), '鉛蓄電池を充電するとき、鉛蓄電池の正極で起こる反応は？',
    ['充電は放電の逆向きの反応', '正極側は電子を出す（酸化）'], eq_wrongs(chg_pos, ['PbO2 + 4H^+ + SO4^2- + 2e^- -> PbSO4 + 2H2O'], salt=len(P)))
# 電池の知識
add('cell', '負極では酸化、正極では還元', '電池の放電で、負極と正極で起こる反応の組み合わせは？', ['負極は電子を出す', '電子は外部の導線を負極 → 正極へ流れる'],
    ['負極では還元、正極では酸化', '両極とも酸化', '両極とも還元'])
add('cell', '両極とも質量が増え、硫酸の濃度は下がる', '鉛蓄電池を放電すると、電極の質量と電解液の濃度はどうなるか',
    ['両極とも PbSO₄ になって表面につく', T('全体：[[Pb + PbO2 + 2H2SO4 -> 2PbSO4 + 2H2O]]')],
    ['両極とも質量が減り、硫酸の濃度は上がる', '負極だけ質量が増え、硫酸の濃度は上がる', '正極だけ質量が減り、硫酸の濃度は変わらない', '両極とも変わらず、硫酸の濃度は下がる'])
add('cell', '約 1.1 V', 'ダニエル電池の起電力はおよそいくらか', ['Zn と Cu のイオン化傾向の差による', '鉛蓄電池（約 2.0 V）より小さい'], ['約 0.5 V', '約 1.5 V', '約 2.0 V', '約 3.7 V'])
add('cell', '約 2.0 V', '鉛蓄電池（1セル）の起電力はおよそいくらか', ['自動車のバッテリーは 6 セルで約 12 V', '二次電池'], ['約 1.1 V', '約 1.5 V', '約 1.2 V', '約 3.7 V'])
add('cell', 'リチウムイオン電池', '次のうち二次電池（充電してくり返し使える電池）はどれか', ['鉛蓄電池・ニッケル水素電池も二次電池', '一次電池は使い切り'],
    ['マンガン乾電池', 'アルカリマンガン乾電池', '酸化銀電池', 'リチウム電池（一次電池）'])
add('cell', '正極：コバルト酸リチウム LiCoO₂、負極：黒鉛（C）', 'リチウムイオン電池の正極と負極の材料の組み合わせは？',
    ['充電すると Li⁺ が黒鉛の層の間に入る', '放電で Li⁺ が正極へ移る'],
    ['正極：黒鉛（C）、負極：コバルト酸リチウム LiCoO₂', '正極：酸化マンガン(IV) MnO₂、負極：亜鉛 Zn', '正極：酸化鉛(IV) PbO₂、負極：鉛 Pb', '正極：酸化銀 Ag₂O、負極：亜鉛 Zn'])
add('cell', '負極：亜鉛 Zn、正極：酸化マンガン(IV) MnO₂', 'マンガン乾電池・アルカリマンガン乾電池の負極と正極の活物質は？',
    ['起電力は約 1.5 V', 'アルカリマンガン乾電池の電解液は KOH 水溶液'],
    ['負極：酸化マンガン(IV) MnO₂、正極：亜鉛 Zn', '負極：鉛 Pb、正極：酸化鉛(IV) PbO₂', '負極：亜鉛 Zn、正極：酸化銀 Ag₂O', '負極：黒鉛 C、正極：亜鉛 Zn'])
add('cell', 'イオン化傾向の差が大きい2種類の金属を使う', '2種類の金属で電池をつくるとき、起電力を大きくするには？', ['イオン化傾向の大きいほうが負極', '差が大きいほど起電力は大きい'],
    ['イオン化傾向の近い2種類の金属を使う', '同じ金属を2枚使う', '電解液の量を増やす', '金属板を大きくする'])

# 9) 電気分解（電極の材料・イオンから規則で決める） ─────────
EL_OX = {'H2O': '2H2O -> O2 + 4H^+ + 4e^-', 'OH': '4OH^- -> O2 + 2H2O + 4e^-', 'Cl': '2Cl^- -> Cl2 + 2e^-', 'I': '2I^- -> I2 + 2e^-',
         'Cu': 'Cu -> Cu^2+ + 2e^-', 'Ag': 'Ag -> Ag^+ + e^-', 'Pt': 'Pt -> Pt^2+ + 2e^-', 'Br': '2Br^- -> Br2 + 2e^-'}
EL_RED = {'H2O': '2H2O + 2e^- -> H2 + 2OH^-', 'H': '2H^+ + 2e^- -> H2', 'Cu': 'Cu^2+ + 2e^- -> Cu', 'Ag': 'Ag^+ + e^- -> Ag',
          'Na': 'Na^+ + e^- -> Na', 'Al': 'Al^3+ + 3e^- -> Al', 'K': 'K^+ + e^- -> K'}
SAME = [{'2H2O -> O2 + 4H^+ + 4e^-', '4OH^- -> O2 + 2H2O + 4e^-'}, {'2H2O + 2e^- -> H2 + 2OH^-', '2H^+ + 2e^- -> H2'}]   # 同じ変化の別の書き方（選択肢に並べない）
for d in (EL_OX, EL_RED):
    for v in d.values():
        assert balanced(parse_eq(v)), v


def predict(cat, an, anode, cathode, molten):
    """電極の材料とイオンから、陽極・陰極の反応を規則で決める"""
    if anode not in ('Pt', 'C'):
        a = anode                          # 陽極が溶ける
    elif an in ('Cl', 'I', 'Br'):
        a = an                             # ハロゲン化物イオンが酸化される
    elif an == 'OH':
        a = 'OH'
    else:
        a = 'H2O'                          # SO4^2-・NO3^- は酸化されず、水が酸化される
    if molten:
        c = cat
    elif cat == 'H':
        c = 'H'
    elif SERIES.index(cat) > SERIES.index('H'):
        c = cat                            # Cu・Ag はイオンが還元されて析出
    elif SERIES.index(cat) <= SERIES.index('Al'):
        c = 'H2O'                          # K〜Al のイオンは還元されず、水が還元される
    else:
        raise ValueError('この規則では決めない')
    return a, c


def elec(name, cat, an, anode, cathode, hand_a, hand_c, molten=False, qs=('a', 'c')):
    a, c = predict(cat, an, anode, cathode, molten)
    assert canon(parse_eq(EL_OX[a])) == canon(parse_eq(hand_a)), f'{name} 陽極：規則 {EL_OX[a]} 手 {hand_a}'
    assert canon(parse_eq(EL_RED[c])) == canon(parse_eq(hand_c)), f'{name} 陰極：規則 {EL_RED[c]} 手 {hand_c}'
    elname = {'Pt': '白金', 'C': '炭素', 'Cu': '銅', 'Ag': '銀', 'Fe': '鉄'}
    setup = f'{name}（陽極 {elname[anode]}・陰極 {elname[cathode]}）'
    for side, hand, pool, rule in (('a', hand_a, EL_OX, '陽極：電子を奪われる＝酸化。白金・炭素は溶けない。それ以外の金属なら電極自身が溶ける'),
                                   ('c', hand_c, EL_RED, '陰極：電子を受け取る＝還元。Cu²⁺・Ag⁺ は析出、K⁺〜Al³⁺ は還元されず水（酸なら H⁺）が還元される')):
        if side not in qs:
            continue
        same = next((s for s in SAME if hand in s), {hand})
        other = EL_RED if side == 'a' else EL_OX
        # もっともらしい間違い：反対の極の反応・電極が溶ける／溶けない取りちがえ・水溶液中の陽イオンの析出・水の反応
        likely = [hand_c if side == 'a' else hand_a]
        if side == 'a':
            likely += [EL_OX['Pt']] if anode == 'Pt' else []
            likely += [EL_OX['H2O'], EL_OX[cat]] if cat in EL_OX else [EL_OX['H2O']]
            likely += [EL_OX[an]] if an in EL_OX and EL_OX[an] != hand else []
        else:
            likely += [EL_RED[cat]] if cat in EL_RED else []
            likely += [EL_RED['H2O'], EL_RED['H']]
        cand = likely + [v for v in pool.values()] + [v for v in other.values()]
        ws = []
        for v in cand:
            if v in same or v == hand:
                continue
            sv = show_eq(parse_eq(v))
            if sv not in ws:
                ws.append(sv)
        hint2 = (f'水溶液中のイオン：{"陽イオン " + disp_formula(cat + ("^+" if cat in ("Na", "K", "Ag", "H") else "^3+" if cat == "Al" else "^2+"))}・'
                 f'{"陰イオン " + {"Cl": "Cl⁻", "I": "I⁻", "OH": "OH⁻", "SO4": "SO₄²⁻", "NO3": "NO₃⁻", "Br": "Br⁻"}[an]}' + ('（融解したもの）' if molten else ''))
        add('elec', show_eq(parse_eq(hand)), T(f'{setup}を電気分解したときの{"陽極" if side == "a" else "陰極"}の反応は？'), [rule, hint2], ws[:5])


elec('硫酸銅(II) [[CuSO4]] 水溶液', 'Cu', 'SO4', 'Pt', 'Pt', '2H2O -> O2 + 4H^+ + 4e^-', 'Cu^2+ + 2e^- -> Cu')
elec('硫酸銅(II) [[CuSO4]] 水溶液', 'Cu', 'SO4', 'Cu', 'Cu', 'Cu -> Cu^2+ + 2e^-', 'Cu^2+ + 2e^- -> Cu', qs=('a',))
elec('塩化ナトリウム [[NaCl]] 水溶液', 'Na', 'Cl', 'C', 'Fe', '2Cl^- -> Cl2 + 2e^-', '2H2O + 2e^- -> H2 + 2OH^-')
elec('水酸化ナトリウム [[NaOH]] 水溶液', 'Na', 'OH', 'Pt', 'Pt', '4OH^- -> O2 + 2H2O + 4e^-', '2H2O + 2e^- -> H2 + 2OH^-')
elec('希硫酸 [[H2SO4]]', 'H', 'SO4', 'Pt', 'Pt', '2H2O -> O2 + 4H^+ + 4e^-', '2H^+ + 2e^- -> H2')
elec('硝酸銀 [[AgNO3]] 水溶液', 'Ag', 'NO3', 'Pt', 'Pt', '2H2O -> O2 + 4H^+ + 4e^-', 'Ag^+ + e^- -> Ag')
elec('硝酸銀 [[AgNO3]] 水溶液', 'Ag', 'NO3', 'Ag', 'Pt', 'Ag -> Ag^+ + e^-', 'Ag^+ + e^- -> Ag', qs=('a',))
elec('ヨウ化カリウム [[KI]] 水溶液', 'K', 'I', 'Pt', 'Pt', '2I^- -> I2 + 2e^-', '2H2O + 2e^- -> H2 + 2OH^-')
elec('塩化銅(II) [[CuCl2]] 水溶液', 'Cu', 'Cl', 'C', 'C', '2Cl^- -> Cl2 + 2e^-', 'Cu^2+ + 2e^- -> Cu')
elec('硫酸ナトリウム [[Na2SO4]] 水溶液', 'Na', 'SO4', 'Pt', 'Pt', '2H2O -> O2 + 4H^+ + 4e^-', '2H2O + 2e^- -> H2 + 2OH^-')
elec('塩酸 [[HCl]]', 'H', 'Cl', 'C', 'C', '2Cl^- -> Cl2 + 2e^-', '2H^+ + 2e^- -> H2')
elec('融解した塩化ナトリウム [[NaCl]]', 'Na', 'Cl', 'C', 'Fe', '2Cl^- -> Cl2 + 2e^-', 'Na^+ + e^- -> Na', molten=True, qs=('c',))
elec('硝酸カリウム [[KNO3]] 水溶液', 'K', 'NO3', 'Pt', 'Pt', '2H2O -> O2 + 4H^+ + 4e^-', '2H2O + 2e^- -> H2 + 2OH^-', qs=('c',))
elec('臭化カリウム [[KBr]] 水溶液', 'K', 'Br', 'Pt', 'Pt', '2Br^- -> Br2 + 2e^-', '2H2O + 2e^- -> H2 + 2OH^-', qs=('a',))
# 電気分解の知識・全体の式
e = parse_eq('2NaCl + 2H2O -> 2NaOH + H2 + Cl2')
assert balanced(e)
(_, _), got = combine(parse_eq(EL_RED['H2O']), parse_eq(EL_OX['Cl']))
assert canon(ionize(e)) == canon(ionize((got[0] + [[2, 'Na^+']], got[1] + [[2, 'Na^+']]))), 'NaCl 電解の全体の式'
add('elec', show_eq(e), 'イオン交換膜法で塩化ナトリウム水溶液を電気分解するときの全体の反応は？',
    ['陽極：' + show_eq(parse_eq(EL_OX['Cl'])), '陰極：' + show_eq(parse_eq(EL_RED['H2O'])), 'Na⁺ は陽イオン交換膜を通って陰極側へ（NaOH ができる）'],
    eq_wrongs(e, ['2NaCl -> 2Na + Cl2', 'NaCl + H2O -> NaOH + HCl'], salt=len(P)))
add('elec', '陽極では酸化、陰極では還元', '電気分解で、陽極と陰極で起こる反応の組み合わせは？', ['陽極は電源の正極につなぐ', '陽極は電子を奪われる'],
    ['陽極では還元、陰極では酸化', '両極とも酸化', '両極とも還元'])
add('elec', '陽イオン交換膜', '塩化ナトリウム水溶液の電気分解で、純度の高い NaOH をつくるために両極の間に置く膜は？', ['Na⁺ だけを通す', 'OH⁻ や Cl⁻ は通さない'],
    ['陰イオン交換膜', '素焼き板', 'セロハン膜', '白金の網'])
add('elec', T('[[Ag]] や [[Au]]（陽極の下に陽極泥としてたまる）'), '銅の電解精錬で、粗銅に含まれる不純物のうち、溶けずに陽極の下にたまるものは？',
    ['イオン化傾向が Cu より小さい金属は溶け出さない', 'Fe・Ni・Zn は溶けてイオンのまま水溶液に残る'],
    [T('[[Fe]] や [[Zn]]（陽極泥になる）'), T('[[Ni]] や [[Fe]]（陰極に析出する）'), T('[[Ag]] や [[Au]]（陰極に析出する）'), T('[[Zn]] や [[Pb]]（気体になる）')])
add('elec', '融点を下げるため', 'アルミニウムの溶融塩電解で、酸化アルミニウムに氷晶石 Na₃AlF₆ を加える理由は？', ['Al₂O₃ の融点は約 2000℃', 'Al は水溶液の電気分解では得られない'],
    ['電気をよく通す電極にするため', 'アルミニウムを酸化から守るため', '陽極の炭素を溶かすため', '反応熱を吸収するため'])
assert canon(parse_eq(EL_RED[predict('Al', 'O', 'C', 'C', True)[1]])) == canon(parse_eq('Al^3+ + 3e^- -> Al'))
add('elec', 'Al³⁺ + 3e⁻ → Al', 'アルミニウムの溶融塩電解（ホール・エルー法）で、陰極で起こる反応は？', ['融解しているので水は無い', 'Al³⁺ が直接還元される'],
    eq_wrongs(parse_eq('Al^3+ + 3e^- -> Al'), ['2H2O + 2e^- -> H2 + 2OH^-', 'Al -> Al^3+ + 3e^-'], salt=len(P)))
add('elec', '9.65×10⁴ C/mol', 'ファラデー定数（電子 1 mol がもつ電気量の大きさ）は？', ['電気量 = 電流 × 時間', 'e⁻ 1 mol 分'],
    ['6.02×10²³ C/mol', '1.60×10⁻¹⁹ C/mol', '9.65×10³ C/mol', '96.5 C/mol'])


# ───────── 書き出し ─────────
def main():
    rows, bad = [], 0
    for i, p in enumerate(P):
        ws = [w for w in p['wrong'] if w != p['ans']]
        if len(ws) < 3 or len(set(ws)) != len(ws):
            print(f'× まちがいの選択肢が足りない・重なる [{i}] {p["q"]}: {ws}')
            bad += 1
            continue
        rows.append([p['cat'] + ':', p['ans'], [p['q']] + p['hints'], ws[:5]])
    print(f'{len(rows)} 問を確かめた（だめ：{bad}）  一覧表 {len(HALF)} 式')
    if bad:
        sys.exit(1)
    js = ('// 酸化還元・電池 早押しの問題（tools/kredox_build.py が書き出す。手で直さない）。すべて自作。\n'
          '// 正解は「手で書いた式」と「機械的に組み立てた式・規則で決めた答え」が一致したものだけ。[分野, 正解, [問題文, ヒント…], [まちがいの選択肢…]]\n'
          'export const RCAT=' + json.dumps({c + ':': n for c, n in CAT.items()}, ensure_ascii=False) + ';\n'
          'export const REDOX=' + json.dumps(rows, ensure_ascii=False, indent=0) + ';\n'
          '// 覚える用の一覧：[物質, 条件, 半反応式, o=酸化剤/r=還元剤]\n'
          'export const HALFS=' + json.dumps(HALF, ensure_ascii=False) + ';\n')
    open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'kredox_data.js'), 'w', encoding='utf-8').write(js)
    if '-v' in sys.argv:
        for r in rows:
            print(f'  [{CAT[r[0][:-1]]}] {r[1]}\n      ✗ ' + '\n      ✗ '.join(r[3]) + f'\n      ← {r[2][0]}\n      ヒント: ' + ' / '.join(r[2][1:]))


if __name__ == '__main__':
    main()
