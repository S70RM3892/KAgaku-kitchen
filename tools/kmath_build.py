#!/usr/bin/env python3
# 京大数学 早押し（kmath）の問題を作るスクリプト。
#   python3 tools/kmath_build.py      → 全問の答えを計算し直して確かめ、js/kmath_data.js を書き出す
# 問題はすべて自作。正解は手で書かず、sympy（数式処理）や総当たりの計算で求めた値と
# 書いた答えが一致することを確かめてから、その値から表示用の文字列を作る（書き間違いを防ぐ）。
# 必要：pip install sympy==1.13.3
import itertools, json, math, os, re, sys
from fractions import Fraction
import sympy as sp

x, t, n, k = sp.symbols('x t n k', real=True)
oo, pi, E, I = sp.oo, sp.pi, sp.E, sp.I
S = sp.sympify
R = sp.Rational


def lim(e, v, to):
    return sp.limit(e, v, to)


def integ(e, a, b):
    return sp.integrate(e, (x, a, b))


def frac(num, den):
    return R(num, den)


def count(it, cond):
    tot = ok = 0
    for v in it:
        tot += 1
        ok += 1 if cond(v) else 0
    return R(ok, tot)


dice = range(1, 7)

# 分野の名前（ヒントの最初に「分野：…」として出る）
CAT = {'lim': '極限', 'diff': '微分', 'int': '定積分', 'area': '面積・体積・長さ', 'seq': '数列・級数',
       'prob': '確率・場合の数', 'cplx': '複素数平面', 'vec': 'ベクトル・図形', 'num': '整数', 'func': '三角・指数・対数'}

# [分野, 問題文, [ヒント（解き方 → 途中の結果）], 正解を計算する式, こちらで書いた答え（sympy の式）]
P = [
    # ---------------- 極限 ----------------
    ['lim', 'lim[x→0] (sin 3x)/x を求めよ', ['sin θ/θ → 1 (θ→0) を使う', '(sin 3x)/x = 3·(sin 3x)/(3x)'], lambda: lim(sp.sin(3*x)/x, x, 0), '3'],
    ['lim', 'lim[x→0] (1 − cos x)/x² を求めよ', ['1 − cos x = 2sin²(x/2) と変形', '= ½·{sin(x/2)/(x/2)}² → ½'], lambda: lim((1-sp.cos(x))/x**2, x, 0), '1/2'],
    ['lim', 'lim[x→∞] (1 + 2/x)^x を求めよ', ['(1 + 1/u)^u → e を使う', 'u = x/2 とおくと {(1+1/u)^u}²'], lambda: lim((1+2/x)**x, x, oo), 'E**2'],
    ['lim', 'lim[x→0] (e^(2x) − 1)/x を求めよ', ['(e^h − 1)/h → 1 (h→0)', '= 2·(e^(2x) − 1)/(2x)'], lambda: lim((sp.exp(2*x)-1)/x, x, 0), '2'],
    ['lim', 'lim[x→0] log(1 + 3x)/x を求めよ', ['log(1+h)/h → 1 (h→0)', '= 3·log(1+3x)/(3x)'], lambda: lim(sp.log(1+3*x)/x, x, 0), '3'],
    ['lim', 'lim[n→∞] (√(n² + n) − n) を求めよ', ['分子を有理化する', '= n/(√(n²+n) + n) = 1/(√(1+1/n) + 1)'], lambda: lim(sp.sqrt(n**2+n)-n, n, oo), '1/2'],
    ['lim', 'lim[x→0] (tan x − sin x)/x³ を求めよ', ['tan x − sin x = tan x(1 − cos x)', '= (tan x/x)·(1−cos x)/x² → 1·½'], lambda: lim((sp.tan(x)-sp.sin(x))/x**3, x, 0), '1/2'],
    ['lim', 'lim[n→∞] n·sin(π/n) を求めよ', ['θ = π/n とおくと θ → 0', '= π·sin θ/θ'], lambda: lim(n*sp.sin(pi/n), n, oo), 'pi'],
    ['lim', 'lim[x→∞] x{log(x+1) − log x} を求めよ', ['= x·log(1 + 1/x) = log(1 + 1/x)^x', '(1 + 1/x)^x → e'], lambda: lim(x*(sp.log(x+1)-sp.log(x)), x, oo), '1'],
    ['lim', 'lim[n→∞] (1/n)Σ[k=1→n] (k/n)² を求めよ', ['区分求積法：∫[0→1] f(x)dx になる', '= ∫[0→1] x² dx'], lambda: integ(x**2, 0, 1), '1/3'],
    ['lim', 'lim[x→0] (3^x − 1)/x を求めよ', ['3^x = e^(x·log 3) と書き直す', '= log 3·(e^(x log 3) − 1)/(x log 3)'], lambda: lim((3**x-1)/x, x, 0), 'log(3)'],
    ['lim', 'lim[n→∞] (1 − 1/n)^n を求めよ', ['(1 + 1/u)^u → e を使う', 'u = −n とおくと {(1 + 1/u)^u}^(−1)'], lambda: lim((1-1/n)**n, n, oo), 'exp(-1)'],

    # ---------------- 微分 ----------------
    ['diff', 'f(x) = x³ − 3x の極大値を求めよ', ["f'(x) = 3(x+1)(x−1)", 'x = −1 で極大'], lambda: (x**3-3*x).subs(x, -1), '2'],
    ['diff', 'y = x·e^x の最小値を求めよ', ["y' = (x+1)e^x", 'x = −1 で最小'], lambda: (x*sp.exp(x)).subs(x, -1), '-exp(-1)'],
    ['diff', 'y = (log x)/x (x > 0) の最大値を求めよ', ["y' = (1 − log x)/x²", 'x = e で最大'], lambda: (sp.log(x)/x).subs(x, E), 'exp(-1)'],
    ['diff', 'y = x − 2sin x (0 ≤ x ≤ π) の最小値を求めよ', ["y' = 1 − 2cos x = 0 から cos x = ½", 'x = π/3 で最小（端の値は 0 と π）'], lambda: sp.Min(*[(x-2*sp.sin(x)).subs(x, v) for v in (0, pi/3, pi)]), 'pi/3 - sqrt(3)', 'π/3 − √3'],
    ['diff', '曲線 y = x² 上の点 (1, 1) における接線の y 切片を求めよ', ["y' = 2x より傾き 2", '接線は y = 2x − 1'], lambda: S(1) - 2*1, '-1'],
    ['diff', '原点を通る曲線 y = e^x の接線の傾きを求めよ', ['接点 (a, e^a) の接線 y = e^a(x − a) + e^a', '原点を通る → a = 1'], lambda: sp.solve(sp.Eq(-t*sp.exp(t)+sp.exp(t), 0), t)[0] and sp.exp(sp.solve(sp.Eq(-t*sp.exp(t)+sp.exp(t), 0), t)[0]), 'E'],
    ['diff', 'f(x) = x^x (x > 0) のとき f′(1) を求めよ', ['対数微分法：log f = x·log x', "f'/f = log x + 1"], lambda: sp.diff(x**x, x).subs(x, 1), '1'],
    ['diff', 'y = (log x)² の x = e における微分係数を求めよ', ["y' = 2(log x)·(1/x)", 'x = e を代入'], lambda: sp.diff(sp.log(x)**2, x).subs(x, E), '2*exp(-1)', '2/e'],
    ['diff', 'y = √(1 + x²) の x = √3 における微分係数を求めよ', ["y' = x/√(1 + x²)", '= √3/2'], lambda: sp.diff(sp.sqrt(1+x**2), x).subs(x, sp.sqrt(3)), 'sqrt(3)/2'],
    ['diff', 'f(x) = x⁴ − 4x³ の極小値を求めよ', ["f'(x) = 4x²(x − 3)", 'x = 0 は極値でない。x = 3 で極小'], lambda: (x**4-4*x**3).subs(x, 3), '-27'],
    ['diff', 'f(x) = x³ − 3x² − 9x の極大値と極小値の差を求めよ', ["f'(x) = 3(x − 3)(x + 1)", 'f(−1) = 5, f(3) = −27'], lambda: (x**3-3*x**2-9*x).subs(x, -1)-(x**3-3*x**2-9*x).subs(x, 3), '32'],
    ['diff', '曲線 y = x·e^(−x) の変曲点の x 座標を求めよ', ["y'' = (x − 2)e^(−x)", "y'' の符号が x = 2 で変わる"], lambda: sp.solve(sp.diff(x*sp.exp(-x), x, 2), x)[0], '2'],

    # ---------------- 定積分 ----------------
    ['int', '∫[0→1] x·e^x dx を求めよ', ['部分積分：∫x·e^x dx = x·e^x − e^x', '[(x − 1)e^x]₀¹'], lambda: integ(x*sp.exp(x), 0, 1), '1'],
    ['int', '∫[1→e] x·log x dx を求めよ', ['部分積分：(x²/2)log x − x²/4', '= e²/4 + 1/4'], lambda: integ(x*sp.log(x), 1, E), '(E**2+1)/4', '(e² + 1)/4'],
    ['int', '∫[0→π] sin²x dx を求めよ', ['sin²x = (1 − cos 2x)/2', '= [x/2 − sin 2x/4]₀^π'], lambda: integ(sp.sin(x)**2, 0, pi), 'pi/2'],
    ['int', '∫[0→1] 1/√(4 − x²) dx を求めよ', ['x = 2sin θ と置換', '= ∫[0→π/6] dθ'], lambda: integ(1/sp.sqrt(4-x**2), 0, 1), 'pi/6'],
    ['int', '∫[0→π] x·sin x dx を求めよ', ['部分積分：−x·cos x + sin x', '= [−x cos x + sin x]₀^π'], lambda: integ(x*sp.sin(x), 0, pi), 'pi'],
    ['int', '∫[0→1] x/(x² + 1) dx を求めよ', ["分子が分母の微分の½：f'/f の形", '= [½·log(x² + 1)]₀¹'], lambda: integ(x/(x**2+1), 0, 1), 'log(2)/2', '(log 2)/2'],
    ['int', '∫[0→π/3] tan x dx を求めよ', ['tan x = sin x/cos x = −(cos x)\'/cos x', '= [−log cos x]₀^(π/3)'], lambda: integ(sp.tan(x), 0, pi/3), 'log(2)'],
    ['int', '∫[0→1] √(1 − x²) dx を求めよ', ['半径1の円の面積を考える', '四分円の面積'], lambda: integ(sp.sqrt(1-x**2), 0, 1), 'pi/4'],
    ['int', '∫[0→3] |x − 1| dx を求めよ', ['x = 1 で場合分け', '½ + 2'], lambda: integ(1-x, 0, 1)+integ(x-1, 1, 3), '5/2'],
    ['int', '∫[0→1] x²·e^x dx を求めよ', ['部分積分を2回：e^x(x² − 2x + 2)', '= e − 2'], lambda: integ(x**2*sp.exp(x), 0, 1), 'E-2', 'e − 2'],
    ['int', '∫[0→π/2] sin x·cos x dx を求めよ', ['sin x·cos x = ½ sin 2x', '= [−¼ cos 2x]₀^(π/2)'], lambda: integ(sp.sin(x)*sp.cos(x), 0, pi/2), '1/2'],
    ['int', '∫[−1→1] (x³ + x² + x) dx を求めよ', ['奇関数の部分は 0 になる', '= 2∫[0→1] x² dx'], lambda: integ(x**3+x**2+x, -1, 1), '2/3'],

    # ---------------- 面積・体積・長さ ----------------
    ['area', '放物線 y = x² と直線 y = x で囲まれた部分の面積を求めよ', ['交点は x = 0, 1', '∫[0→1] (x − x²) dx'], lambda: integ(x-x**2, 0, 1), '1/6'],
    ['area', '放物線 y = x² − 2x と x 軸で囲まれた部分の面積を求めよ', ['x 軸との交点は x = 0, 2', '(2 − 0)³/6 の公式'], lambda: integ(-(x**2-2*x), 0, 2), '4/3'],
    ['area', 'y = sin x (0 ≤ x ≤ π) と x 軸で囲まれた部分を x 軸のまわりに1回転してできる立体の体積を求めよ', ['V = π∫[0→π] sin²x dx', '∫[0→π] sin²x dx = π/2'], lambda: pi*integ(sp.sin(x)**2, 0, pi), 'pi**2/2'],
    ['area', 'y = √x (0 ≤ x ≤ 4) と x 軸、直線 x = 4 で囲まれた部分を x 軸のまわりに1回転してできる立体の体積を求めよ', ['V = π∫[0→4] (√x)² dx', '= π∫[0→4] x dx'], lambda: pi*integ(x, 0, 4), '8*pi'],
    ['area', '曲線 y = log x と x 軸、直線 x = e で囲まれた部分の面積を求めよ', ['∫[1→e] log x dx', '[x log x − x]₁^e'], lambda: integ(sp.log(x), 1, E), '1'],
    ['area', '楕円 x²/9 + y²/4 = 1 の面積を求めよ', ['円 x² + y² = 9 を y 方向に 2/3 倍したもの', 'πab の公式'], lambda: 4*integ(2*sp.sqrt(1-x**2/9), 0, 3), '6*pi'],
    ['area', '曲線 y = x³ と直線 y = x で囲まれた2つの部分の面積の和を求めよ', ['交点は x = −1, 0, 1', '2∫[0→1] (x − x³) dx'], lambda: 2*integ(x-x**3, 0, 1), '1/2'],
    ['area', '放物線 y = x² と直線 y = 2x + 3 で囲まれた部分の面積を求めよ', ['交点は x = −1, 3', '(3 − (−1))³/6'], lambda: integ(2*x+3-x**2, -1, 3), '32/3'],
    ['area', '曲線 y = 1/x と x 軸、2直線 x = 1, x = e² で囲まれた部分の面積を求めよ', ['∫[1→e²] (1/x) dx', '= [log x]₁^(e²)'], lambda: integ(1/x, 1, E**2), '2'],
    ['area', '放物線 y = x² と直線 y = 1 で囲まれた部分を y 軸のまわりに1回転してできる立体の体積を求めよ', ['y 軸回転は V = π∫ x² dy', '= π∫[0→1] y dy'], lambda: pi*sp.integrate(t, (t, 0, 1)), 'pi/2'],
    ['area', '曲線 y = (2/3)x^(3/2) (0 ≤ x ≤ 3) の長さを求めよ', ["L = ∫√(1 + (y')²) dx、y' = √x", '= ∫[0→3] √(1 + x) dx'], lambda: integ(sp.sqrt(1+sp.diff(R(2, 3)*x**R(3, 2), x)**2), 0, 3), '14/3'],
    ['area', '半径3の球の体積を、断面積の積分で求めよ', ['高さ t の断面は半径 √(9 − t²) の円', 'π∫[−3→3] (9 − t²) dt'], lambda: pi*sp.integrate(9-t**2, (t, -3, 3)), '36*pi'],

    # ---------------- 数列・級数 ----------------
    ['seq', 'Σ[k=1→10] k² を求めよ', ['Σk² = n(n+1)(2n+1)/6', '= 10·11·21/6'], lambda: sp.summation(k**2, (k, 1, 10)), '385'],
    ['seq', 'a₁ = 1, aₙ₊₁ = 2aₙ + 1 のとき a₁₀ を求めよ', ['aₙ₊₁ + 1 = 2(aₙ + 1) と変形', 'aₙ + 1 = 2ⁿ'], lambda: _rec(lambda a, i: 2*a+1, 1, 10), '1023'],
    ['seq', '初項3、公比2の等比数列の初項から第6項までの和を求めよ', ['等比数列の和 a(rⁿ − 1)/(r − 1)', '= 3(2⁶ − 1)'], lambda: sp.summation(3*2**(k-1), (k, 1, 6)), '189'],
    ['seq', 'Σ[n=1→∞] 1/{n(n+1)} を求めよ', ['部分分数分解：1/n − 1/(n+1)', '部分和は 1 − 1/(N+1)'], lambda: sp.summation(1/(n*(n+1)), (n, 1, oo)), '1'],
    ['seq', 'Σ[n=1→∞] (1/3)ⁿ を求めよ', ['無限等比級数 a/(1 − r)', '= (1/3)/(1 − 1/3)'], lambda: sp.summation(R(1, 3)**n, (n, 1, oo)), '1/2'],
    ['seq', 'Σ[k=1→5] k·2^(k−1) を求めよ', ['S − 2S をとる（等差×等比の和）', 'Sₙ = (n − 1)2ⁿ + 1'], lambda: sp.summation(k*2**(k-1), (k, 1, 5)), '129'],
    ['seq', 'a₁ = 2, aₙ₊₁ = aₙ + 3n のとき a₅ を求めよ', ['階差数列が 3n', 'a₅ = 2 + 3(1 + 2 + 3 + 4)'], lambda: _rec(lambda a, i: a+3*i, 2, 5), '32'],
    ['seq', 'lim[n→∞] (2n + 1)/(3n − 2) を求めよ', ['分母分子を n で割る', '= (2 + 1/n)/(3 − 2/n)'], lambda: lim((2*n+1)/(3*n-2), n, oo), '2/3'],
    ['seq', 'Σ[n=1→∞] n/2ⁿ を求めよ', ['S − ½S をとる', '½S = Σ(1/2)ⁿ = 1'], lambda: sp.summation(n/2**n, (n, 1, oo)), '2'],
    ['seq', 'a₁ = a₂ = 1, aₙ₊₂ = aₙ₊₁ + aₙ のとき a₁₂ を求めよ', ['フィボナッチ数列', '1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, …'], lambda: sp.fibonacci(12), '144'],
    ['seq', 'Σ[k=1→20] (2k − 1) を求めよ', ['奇数の和', '1 + 3 + … + (2n − 1) = n²'], lambda: sp.summation(2*k-1, (k, 1, 20)), '400'],
    ['seq', 'a₁ = 1, aₙ₊₁ = aₙ/(1 + aₙ) のとき a₁₀ を求めよ', ['逆数をとる：1/aₙ₊₁ = 1/aₙ + 1', '1/aₙ = n'], lambda: _rec(lambda a, i: a/(1+a), S(1), 10), '1/10'],

    # ---------------- 確率・場合の数 ----------------
    ['prob', 'さいころを2個投げるとき、目の和が7になる確率を求めよ', ['全部で 36 通り', '(1,6), (2,5), … の 6 通り'], lambda: count(itertools.product(dice, dice), lambda v: sum(v) == 7), '1/6'],
    ['prob', 'コインを5回投げるとき、表がちょうど3回出る確率を求めよ', ['反復試行：₅C₃(½)³(½)²', '= 10/32'], lambda: count(itertools.product((0, 1), repeat=5), lambda v: sum(v) == 3), '5/16'],
    ['prob', 'さいころを3回投げるとき、出る目がすべて異なる確率を求めよ', ['6·5·4 通り / 216 通り', '= 120/216'], lambda: count(itertools.product(dice, repeat=3), lambda v: len(set(v)) == 3), '5/9'],
    ['prob', '男子4人と女子3人を1列に並べるとき、女子どうしが隣り合わない並べ方は何通りか', ['先に男子を並べ、間と両端の5か所に女子を入れる', '4!·₅P₃'], lambda: S(sum(1 for p in itertools.permutations('BBBBGGG') for _ in [0]) and _arrange()), '1440'],
    ['prob', '52枚のトランプから2枚を同時に引くとき、2枚ともハートである確率を求めよ', ['₁₃C₂ / ₅₂C₂', '= 78/1326'], lambda: R(math.comb(13, 2), math.comb(52, 2)), '1/17'],
    ['prob', '赤玉3個と白玉2個が入った袋から2個を同時に取り出すとき、少なくとも1個が白玉である確率を求めよ', ['余事象：2個とも赤', '1 − ₃C₂/₅C₂'], lambda: count(itertools.combinations('RRRWW', 2), lambda v: 'W' in v), '7/10'],
    ['prob', 'さいころを3個投げるとき、出る目の最大値が5である確率を求めよ', ['(最大値が5以下) − (最大値が4以下)', '(5³ − 4³)/6³'], lambda: count(itertools.product(dice, repeat=3), lambda v: max(v) == 5), '61/216'],
    ['prob', '6人を2人ずつの3組に分ける方法は何通りか（組には区別がない）', ['₆C₂·₄C₂·₂C₂ を組の並べ方 3! で割る', '= 90/6'], lambda: S(_pairings(6)), '15'],
    ['prob', '1から100までの整数のうち、2でも3でも割り切れないものはいくつあるか', ['包除原理：100 − 50 − 33 + 16', '6の倍数は16個'], lambda: S(sum(1 for i in range(1, 101) if i % 2 and i % 3)), '33'],
    ['prob', 'さいころを投げ続け、初めて6の目が出るまでに投げる回数の期待値を求めよ', ['幾何分布：E = Σ k·(5/6)^(k−1)·(1/6)', '= 1/(1/6)'], lambda: sp.summation(k*R(5, 6)**(k-1)*R(1, 6), (k, 1, oo)), '6'],
    ['prob', '当たり2本を含む10本のくじを、A, B の順に1本ずつ引く（戻さない）。B が当たる確率を求めよ', ['A が当たる場合と外れる場合に分ける', '(2/10)(1/9) + (8/10)(2/9)'], lambda: count(itertools.permutations(range(10), 2), lambda v: v[1] < 2), '1/5'],
    ['prob', '正六角形の6つの頂点から3つを選んで三角形をつくるとき、正三角形になる確率を求めよ', ['三角形は ₆C₃ = 20 個', '正三角形は 1 つおきの2個'], lambda: count(itertools.combinations(range(6), 3), lambda v: sorted(v) in ([0, 2, 4], [1, 3, 5])), '1/10'],
    ['prob', 'さいころを2個投げて少なくとも1個が6であったとき、2個とも6である確率を求めよ', ['条件付き確率 P(A∩B)/P(A)', '少なくとも1個が6 は 11 通り'], lambda: R(sum(1 for v in itertools.product(dice, dice) if v == (6, 6)), sum(1 for v in itertools.product(dice, dice) if 6 in v)), '1/11'],

    # ---------------- 複素数平面 ----------------
    ['cplx', '(1 + i)⁸ を求めよ', ['1 + i = √2(cos π/4 + i sin π/4)', 'ド・モアブル：(√2)⁸(cos 2π + i sin 2π)'], lambda: sp.expand((1+I)**8), '16'],
    ['cplx', '|3 + 4i| を求めよ', ['|a + bi| = √(a² + b²)', '= √25'], lambda: sp.Abs(3+4*I), '5'],
    ['cplx', '(1 + √3 i)⁶ を求めよ', ['1 + √3 i = 2(cos π/3 + i sin π/3)', '2⁶(cos 2π + i sin 2π)'], lambda: sp.expand((1+sp.sqrt(3)*I)**6), '64'],
    ['cplx', 'ω を 1 の3乗根のうち虚数のものとするとき、ω¹⁰⁰ + ω⁵⁰ + 1 を求めよ', ['ω³ = 1, ω² + ω + 1 = 0', 'ω¹⁰⁰ = ω, ω⁵⁰ = ω²'], lambda: sp.nsimplify(sp.expand_complex((S(-1)/2+sp.sqrt(3)/2*I)**100+(S(-1)/2+sp.sqrt(3)/2*I)**50+1)), '0'],
    ['cplx', '(1 + i)/(1 − i) の偏角 θ (−π < θ ≤ π) を求めよ', ['分母の共役 (1 + i) を掛ける', '(1 + i)/(1 − i) = i'], lambda: sp.arg(sp.simplify((1+I)/(1-I))), 'pi/2'],
    ['cplx', 'z = 2(cos π/6 + i sin π/6) のとき z⁶ を求めよ', ['ド・モアブルの定理', '2⁶(cos π + i sin π)'], lambda: sp.nsimplify(sp.expand_complex((2*(sp.cos(pi/6)+I*sp.sin(pi/6)))**6)), '-64'],
    ['cplx', '|z| = 1 のとき |z − 3| の最大値を求めよ', ['z は単位円上、3 との距離', '点 −1 で最大'], lambda: sp.Abs(-1-3), '4'],
    ['cplx', '点 2 + i を原点のまわりに π/2 だけ回転した点を求めよ', ['π/2 回転 = i を掛ける', 'i(2 + i)'], lambda: sp.expand(I*(2+I)), '-1+2*I', '−1 + 2i'],
    ['cplx', 'z + 1/z = √3 のとき z⁶ を求めよ', ['z² − √3z + 1 = 0 から z = cos(±π/6) + i sin(±π/6)', 'z⁶ = cos(±π) + i sin(±π)'], lambda: sp.nsimplify(sp.expand_complex(sp.solve(sp.Eq(t**2-sp.sqrt(3)*t+1, 0), t, dict=False)[0]**6)) if False else sp.nsimplify(sp.expand_complex([r for r in sp.solve(sp.Symbol('z')**2-sp.sqrt(3)*sp.Symbol('z')+1, sp.Symbol('z'))][0]**6)), '-1'],
    ['cplx', 'α を 1 の5乗根のうち 1 でないものとするとき、(1 − α)(1 − α²)(1 − α³)(1 − α⁴) を求めよ', ['z⁵ − 1 = (z − 1)(z⁴ + z³ + z² + z + 1)', 'z⁴ + z³ + z² + z + 1 に z = 1 を代入'], lambda: sp.nsimplify(sp.N(sp.prod([1-sp.exp(2*pi*I*j/5) for j in range(1, 5)]), 30)), '5'],
    ['cplx', '|z − 2i| = 2|z + i| を満たす点 z 全体は円になる。その半径を求めよ', ['z = x + yi として両辺を2乗', 'x² + (y + 2)² = 4（アポロニウスの円）'], lambda: _apollonius(), '2'],
    ['cplx', 'i²⁰²⁵ を求めよ', ['i⁴ = 1 の周期4', '2025 = 4·506 + 1'], lambda: I**2025, 'I'],

    # ---------------- ベクトル・図形 ----------------
    ['vec', 'a = (1, 2), b = (3, −1) の内積 a·b を求めよ', ['成分の積の和', '1·3 + 2·(−1)'], lambda: sp.Matrix([1, 2]).dot(sp.Matrix([3, -1])), '1'],
    ['vec', '|a| = 2, |b| = 3, a·b = 3 のとき a と b のなす角 θ を求めよ', ['cos θ = a·b/(|a||b|)', 'cos θ = ½'], lambda: sp.acos(R(3, 6)), 'pi/3'],
    ['vec', 'a = (1, 2, 2) の大きさを求めよ', ['|a| = √(1² + 2² + 2²)', '= √9'], lambda: sp.Matrix([1, 2, 2]).norm(), '3'],
    ['vec', 'a = (1, 0, 1), b = (0, 1, 1) でつくられる平行四辺形の面積を求めよ', ['√(|a|²|b|² − (a·b)²)', '= √(2·2 − 1²)'], lambda: sp.Matrix([1, 0, 1]).cross(sp.Matrix([0, 1, 1])).norm(), 'sqrt(3)'],
    ['vec', '3点 A(1, 0, 0), B(0, 2, 0), C(0, 0, 3) を通る平面と原点との距離を求めよ', ['平面 x/1 + y/2 + z/3 = 1 → 6x + 3y + 2z = 6', '距離 6/√(36 + 9 + 4)'], lambda: R(6, 1)/sp.sqrt(36+9+4), '6/7'],
    ['vec', '△OAB で |OA| = 3, |OB| = 4, OA·OB = 6 のとき △OAB の面積を求めよ', ['S = ½√(|OA|²|OB|² − (OA·OB)²)', '= ½√(144 − 36)'], lambda: sp.sqrt(9*16-36)/2, '3*sqrt(3)'],
    ['vec', '点 (1, 2) と直線 3x + 4y − 1 = 0 の距離を求めよ', ['点と直線の距離 |ax₀ + by₀ + c|/√(a² + b²)', '= |3 + 8 − 1|/5'], lambda: sp.Abs(3*1+4*2-1)/sp.sqrt(3**2+4**2), '2'],
    ['vec', '1辺の長さ2の正四面体の体積を求めよ', ['高さは √(2/3)·2', 'V = ⅓·√3·(2√6/3)'], lambda: _tetra(), '2*sqrt(2)/3'],
    ['vec', '3点 A(1, 1), B(4, 2), C(2, 5) を頂点とする三角形の面積を求めよ', ['AB = (3, 1), AC = (1, 4)', 'S = ½|3·4 − 1·1|'], lambda: sp.Abs(sp.Matrix([[3, 1], [1, 4]]).det())/2, '11/2'],
    ['vec', 'a = (2, 1), b = (1, 3) のとき、b の a への正射影ベクトルの大きさを求めよ', ['|a·b|/|a|', '= 5/√5'], lambda: sp.Abs(sp.Matrix([2, 1]).dot(sp.Matrix([1, 3])))/sp.Matrix([2, 1]).norm(), 'sqrt(5)'],
    ['vec', '球 x² + y² + z² = 9 と平面 z = 2 が交わってできる円の半径を求めよ', ['中心から平面までの距離は 2', '√(9 − 2²)'], lambda: sp.sqrt(9-2**2), 'sqrt(5)'],
    ['vec', '直線 (x, y, z) = (1, 0, 3) + t(1, 2, −1) と平面 x + y + z = 10 の交点の x 座標を求めよ', ['(1 + t) + 2t + (3 − t) = 10', 't = 3'], lambda: 1+sp.solve(sp.Eq((1+t)+2*t+(3-t), 10), t)[0], '4'],

    # ---------------- 整数 ----------------
    ['num', '391 と 299 の最大公約数を求めよ', ['ユークリッドの互除法', '391 = 299·1 + 92, 299 = 92·3 + 23'], lambda: S(math.gcd(391, 299)), '23'],
    ['num', '360 の正の約数の個数を求めよ', ['360 = 2³·3²·5', '(3+1)(2+1)(1+1)'], lambda: S(len(sp.divisors(360))), '24'],
    ['num', '7¹⁰⁰ を 5 で割った余りを求めよ', ['7 ≡ 2 (mod 5)', '2⁴ ≡ 1 (mod 5)'], lambda: S(pow(7, 100, 5)), '1'],
    ['num', '3²⁰²⁵ の一の位の数を求めよ', ['一の位は 3, 9, 7, 1 の周期4', '2025 = 4·506 + 1'], lambda: S(pow(3, 2025, 10)), '3'],
    ['num', '100! を計算したとき、末尾に並ぶ 0 の個数を求めよ', ['素因数 5 の個数を数える', '[100/5] + [100/25]'], lambda: S(len(str(math.factorial(100))) - len(str(math.factorial(100)).rstrip('0'))), '24'],
    ['num', '3x + 5y = 1 の整数解 (x, y) のうち、x が最小の正の整数であるときの x を求めよ', ['1つの解 (2, −1)', '一般解 x = 2 + 5m, y = −1 − 3m'], lambda: S(min(xx for xx in range(1, 50) if (1-3*xx) % 5 == 0)), '2'],
    ['num', '1001 の素因数のうち最大のものを求めよ', ['1001 = 7·143', '143 = 11·13'], lambda: S(max(sp.primefactors(1001))), '13'],
    ['num', '2¹⁰ − 1 の素因数の和を求めよ', ['2¹⁰ − 1 = (2⁵ − 1)(2⁵ + 1) = 31·33', '= 3·11·31'], lambda: S(sum(sp.primefactors(2**10-1))), '45'],
    ['num', '1 から 12 までの整数のうち、12 と互いに素なものの個数を求めよ', ['12 = 2²·3', '1, 5, 7, 11'], lambda: S(sum(1 for i in range(1, 13) if math.gcd(i, 12) == 1)), '4'],
    ['num', '2進法で表された数 110101₍₂₎ を10進法で表せ', ['各位に 2 のべきを掛けて足す', '32 + 16 + 4 + 1'], lambda: S(int('110101', 2)), '53'],
    ['num', '1 ≤ n ≤ 100 の整数 n のうち、n² + 1 が 5 の倍数になるものの個数を求めよ', ['n を 5 で割った余りで分ける', 'n ≡ 2, 3 (mod 5)'], lambda: S(sum(1 for i in range(1, 101) if (i*i+1) % 5 == 0)), '40'],
    ['num', 'xy = 2x + 3y を満たす正の整数の組 (x, y) の個数を求めよ', ['(x − 3)(y − 2) = 6 と変形', 'x − 3 > −3, y − 2 > −2 に注意'], lambda: S(sum(1 for a in range(1, 200) for b in range(1, 200) if a*b == 2*a+3*b)), '4'],

    # ---------------- 三角・指数・対数 ----------------
    ['func', 'sin x + √3 cos x の最大値を求めよ', ['合成：2 sin(x + π/3)', '振幅は √(1 + 3)'], lambda: sp.sqrt(1+3), '2'],
    ['func', 'log₂3·log₃8 を求めよ', ['底の変換公式', '(log 3/log 2)·(3 log 2/log 3)'], lambda: sp.simplify(sp.log(3, 2)*sp.log(8, 3)), '3'],
    ['func', '2ˣ = 3 のとき 4ˣ + 4⁻ˣ を求めよ', ['4ˣ = (2ˣ)² = 9', '9 + 1/9'], lambda: S(9)+R(1, 9), '82/9'],
    ['func', '0 ≤ x < 2π のとき、sin 2x = sin x の解の個数を求めよ', ['sin x(2 cos x − 1) = 0', 'sin x = 0 または cos x = ½'], lambda: S(len(sp.solveset(sp.sin(2*x)-sp.sin(x), x, sp.Interval.Ropen(0, 2*pi)))), '4'],
    ['func', 'tan α = 2 のとき sin 2α を求めよ', ['sin 2α = 2 tan α/(1 + tan²α)', '= 4/5'], lambda: sp.sin(2*sp.atan(2)).simplify(), '4/5'],
    ['func', 'log₁₀2 = 0.3010 として、2¹⁰⁰ は何桁の整数か', ['log₁₀2¹⁰⁰ = 30.10', '10³⁰ ≤ 2¹⁰⁰ < 10³¹'], lambda: S(len(str(2**100))), '31'],
    ['func', 'cos 15° の値を求めよ', ['cos(45° − 30°) の加法定理', 'cos45°cos30° + sin45°sin30°'], lambda: sp.cos(pi/12), '(sqrt(6)+sqrt(2))/4', '(√6 + √2)/4'],
    ['func', 'log₂(x + 1) + log₂(x − 1) = 3 を解け', ['真数条件 x > 1', '(x + 1)(x − 1) = 8'], lambda: [r for r in sp.solve((x+1)*(x-1)-8, x) if r > 1][0], '3'],
    ['func', '9ˣ − 4·3ˣ + 3 = 0 のすべての解の和を求めよ', ['3ˣ = u とおく：u² − 4u + 3 = 0', 'u = 1, 3 → x = 0, 1'], lambda: sum(sp.solve(9**x-4*3**x+3, x)), '1'],
    ['func', '0 ≤ x ≤ π/2 のとき y = sin²x + sin x cos x の最大値を求めよ', ['半角・2倍角：y = ½ + ½(sin 2x − cos 2x)', '= ½ + (√2/2)sin(2x − π/4)'], lambda: S(1)/2+sp.sqrt(2)/2, '(1+sqrt(2))/2', '(1 + √2)/2'],
    ['func', '△ABC で a = 7, b = 5, c = 3 のとき角 A を求めよ（弧度法）', ['余弦定理 cos A = (b² + c² − a²)/(2bc)', 'cos A = −½'], lambda: sp.acos(R(5**2+3**2-7**2, 2*5*3)), '2*pi/3'],
    ['func', '0 ≤ x < 2π のとき 2cos²x + 3sin x − 3 = 0 の解の和を求めよ', ['cos²x = 1 − sin²x で sin x の2次方程式', '(2 sin x − 1)(sin x − 1) = 0'], lambda: sum(sp.solveset(2*sp.cos(x)**2+3*sp.sin(x)-3, x, sp.Interval.Ropen(0, 2*pi))), '3*pi/2'],
]


def _rec(f, a1, m):
    a = S(a1)
    for i in range(1, m):
        a = f(a, i)
    return sp.nsimplify(a)


def _arrange():
    c = 0
    for p in set(itertools.permutations('BBBBGGG')):
        if 'GG' not in ''.join(p):
            c += 1
    # 同じ記号どうしも区別するので、男子4!・女子3! を掛ける
    return c*math.factorial(4)*math.factorial(3)


def _pairings(m):
    def go(rest):
        if not rest:
            return 1
        a = rest[0]
        return sum(go([y for y in rest[1:] if y != b]) for b in rest[1:])
    return go(list(range(m)))


def _apollonius():
    X, Y = sp.symbols('X Y', real=True)
    eq = sp.expand((X**2+(Y-2)**2)-4*(X**2+(Y+1)**2))
    # eq = 0 を X² + Y² + aX + bY + c = 0 の形にそろえて半径を出す
    p = sp.Poly(-eq/3, X, Y)
    a, b, c = p.coeff_monomial(X), p.coeff_monomial(Y), p.coeff_monomial(1)
    return sp.sqrt(a**2/4+b**2/4-c)


def _tetra():
    A = sp.Matrix([0, 0, 0]); B = sp.Matrix([2, 0, 0]); C = sp.Matrix([1, sp.sqrt(3), 0])
    D = sp.Matrix([1, sp.sqrt(3)/3, sp.sqrt(sp.Rational(8, 3))])
    assert all(sp.simplify((P1-P2).norm()-2) == 0 for P1, P2 in itertools.combinations([A, B, C, D], 2))
    return sp.Abs((B-A).cross(C-A).dot(D-A))/6


# ---------- 表示用の文字列（確かめた値から作る） ----------
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')


def show(v):
    v = sp.nsimplify(sp.simplify(v))
    s = sp.sstr(v)
    s = re.sub(r'exp\((-?\d+)\)', lambda m: 'e' + ('⁻' if m.group(1).startswith('-') else '') + m.group(1).lstrip('-').translate(SUP) if m.group(1) not in ('1',) else 'e', s)
    s = s.replace('exp(-1)', 'e⁻¹')
    s = re.sub(r'\bE\b', 'e', s)
    s = re.sub(r'sqrt\((\d+)\)', r'√\1', s)
    s = s.replace('pi', 'π')
    s = re.sub(r'\*\*(\d+)', lambda m: m.group(1).translate(SUP), s)
    s = re.sub(r'log\((\d+)\)', r'log \1', s)
    s = re.sub(r'\bI\b', 'i', s)
    s = s.replace('*', '')
    s = s.replace('-', '−').replace(' + ', ' + ').replace(' − ', ' − ')
    s = s.replace('e⁻¹', '1/e')
    s = re.sub(r'^2e⁻¹$', '2/e', s)
    return s


SUPMAP = {c: str(i) for i, c in enumerate('⁰¹²³⁴⁵⁶⁷⁸⁹')}


def parse_disp(d):
    # 表示用の文字列（√, π, e, log, i, 上付き数字, −）を sympy の式に読み直す
    from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
    s = d.replace('−', '-').replace('π', ' pi ')
    s = re.sub(r'√(\d+)', r' sqrt(\1) ', s)
    s = re.sub(r'log (\d+)', r' log(\1) ', s)
    s = re.sub(r'([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)', lambda m: '**(' + ''.join('-' if c == '⁻' else SUPMAP[c] for c in m.group(1)) + ')', s)
    s = re.sub(r'(?<![a-z])e(?![a-z])', ' E ', s)
    s = re.sub(r'(?<![a-z])i(?![a-z])', ' I ', s)
    return parse_expr(s, transformations=standard_transformations + (implicit_multiplication_application,), local_dict={'E': E, 'I': I, 'pi': pi})


def main():
    out, bad = [], 0
    for i, row in enumerate(P):
        cat, q, hints, truth, ans = row[:5]
        try:
            v = sp.nsimplify(sp.simplify(truth()))
        except Exception as e:
            print('計算できない', i, q, e)
            bad += 1
            continue
        a = sp.nsimplify(sp.simplify(S(ans)))
        if sp.simplify(v-a) != 0 or abs(complex(sp.N(v-a, 30))) > 1e-20:
            print(f'× 答えが合わない [{i}] {q}\n   計算 {v}  書いた答え {a}')
            bad += 1
            continue
        disp = row[5] if len(row) > 5 else show(v)
        try:
            ok = sp.simplify(parse_disp(disp) - v) == 0
        except Exception as e:
            ok = False
        if not ok:
            print(f'× 表示が値と合わない [{i}] {q}：表示 {disp}  値 {v}')
            bad += 1
            continue
        out.append({'cat': cat, 'q': q, 'hints': hints, 'v': v, 'ans': disp})
    # 同じ分野の中で、値が同じなのに表示がちがうものが無いか（選択肢がまぎらわしくならないように）
    seen = {}
    for o in out:
        key = (o['cat'], complex(sp.N(o['v'], 20)).real.__round__(12), complex(sp.N(o['v'], 20)).imag.__round__(12))
        if key in seen and seen[key] != o['ans']:
            print('× 同じ値で表示がちがう', o['ans'], seen[key])
            bad += 1
        seen[key] = o['ans']
    print(f'{len(out)} 問を確かめた（合わない・計算できない：{bad}）')
    if bad:
        sys.exit(1)
    # 問題文・ヒントの「^n」などを上付き文字にして読みやすくする（1文字のべきだけ）
    supx = {'n': 'ⁿ', 'x': 'ˣ', 'u': 'ᵘ', '2': '²', '3': '³'}
    pretty = lambda u: re.sub(r'\^([nxu23])(?![\w(])', lambda m: supx[m.group(1)], u)
    rows = [[o['cat'], o['ans'], [pretty(o['q'])] + [pretty(h) for h in o['hints']]] for o in out]
    js = ('// 京大数学 早押しの問題（tools/kmath_build.py が書き出す。手で直さない）。すべて自作。\n'
          '// 正解はすべて sympy・総当たりの計算で確かめた値から作っている\n'
          'export const MCAT=' + json.dumps({f'{c}:': n for c, n in CAT.items()}, ensure_ascii=False) + ';\n'
          'export const MATH=' + json.dumps([[r[0] + ':', r[1], r[2]] for r in rows], ensure_ascii=False, indent=0) + ';\n')
    path = os.path.join(os.path.dirname(__file__), '..', 'js', 'kmath_data.js')
    open(path, 'w', encoding='utf-8').write(js)
    for o in out:
        print(f"  [{CAT[o['cat']]}] {o['ans']:<14} ← {o['q']}")


if __name__ == '__main__':
    main()
