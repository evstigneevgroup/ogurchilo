#!/usr/bin/env python3
"""Аватар бота «Огурчило»: живой огурец кричит «ПРИЗЫЫЫЫ!».
Запуск: python3 branding/make_avatar.py"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

SS = 4
S = 512
BIG = S * SS
FONT_SIZE = 34          # подбор: 34 влезает в облачко 285px с полями
TEXT = 'ПРИЗЫЫЫЫ!'
OUT = os.path.join(os.path.dirname(__file__), 'bot-avatar.png')

bg = Image.new('RGB', (BIG, BIG), (242, 238, 222))
bloom = Image.new('RGBA', (BIG, BIG), (0,0,0,0))
bd = ImageDraw.Draw(bloom)
for (bx, by, br, col) in [
    (0.20, 0.20, 0.30, (142,212,111,110)),
    (0.85, 0.25, 0.24, (244,185,66,80)),
    (0.25, 0.85, 0.34, (89,185,60,90)),
    (0.80, 0.85, 0.26, (142,212,111,95)),
]:
    r = br * BIG
    bd.ellipse([bx*BIG-r, by*BIG-r, bx*BIG+r, by*BIG+r], fill=col)
bloom = bloom.filter(ImageFilter.GaussianBlur(BIG // 24))
bg = bg.convert('RGBA'); bg.alpha_composite(bloom)

CUKE_W, CUKE_H = int(150*SS), int(330*SS)
cuke = Image.new('RGBA', (CUKE_W + 40*SS, CUKE_H + 40*SS), (0,0,0,0))
cw, ch = cuke.size
cd = ImageDraw.Draw(cuke)
mask = Image.new('L', cuke.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([20*SS, 20*SS, 20*SS+CUKE_W, 20*SS+CUKE_H], radius=CUKE_W//2, fill=255)
ox, oy = 20*SS, 20*SS
stops = [(0.0,(46,107,28)), (0.3,(87,168,51)), (0.5,(111,194,63)), (0.7,(87,168,51)), (1.0,(36,87,22))]
grad = Image.new('RGB', cuke.size); gd = ImageDraw.Draw(grad)
for x in range(cw):
    t = x / cw
    for i in range(len(stops)-1):
        t0,c0 = stops[i]; t1,c1 = stops[i+1]
        if t0 <= t <= t1:
            k = (t-t0)/(t1-t0)
            gd.line([(x,0),(x,ch)], fill=tuple(int(c0[j]+(c1[j]-c0[j])*k) for j in range(3)))
            break
cuke.paste(grad, (0,0), mask)
for i in range(18):
    px = ox + (0.1 + (i%4)*0.27 + 0.02*math.sin(i*9))*CUKE_W
    py = oy + (0.08 + (i//4)*0.23 + 0.015*((i*13)%7))*CUKE_H
    if py > oy + CUKE_H*0.62: continue
    cd.ellipse([px-5.5*SS, py-5.5*SS, px+5.5*SS, py+5.5*SS], fill=(255,255,255,70))
    cd.ellipse([px-3*SS, py-2*SS, px+2.5*SS, py+3*SS], fill=(10,30,4,45))
sp_x = ox + CUKE_W*0.19; sp_w = CUKE_W*0.13
cd.rounded_rectangle([sp_x, oy+CUKE_H*0.08, sp_x+sp_w, oy+CUKE_H*0.9], radius=sp_w//2, fill=(255,255,255,60))
tx, ty = ox+CUKE_W//2, oy-6*SS
cd.rounded_rectangle([tx-13*SS, ty-20*SS, tx+13*SS, ty+6*SS], radius=8*SS, fill=(60,95,42,255))
leaf = Image.new('RGBA', (90*SS, 46*SS), (0,0,0,0))
ImageDraw.Draw(leaf).ellipse([0,0,90*SS,46*SS], fill=(111,187,74,255))
leaf = leaf.rotate(-26, expand=True, resample=Image.BICUBIC)
cuke.alpha_composite(leaf, (tx+8*SS, ty-44*SS))
cuke = cuke.rotate(-7, expand=True, resample=Image.BICUBIC)
bg.alpha_composite(cuke, (175*SS - cuke.size[0]//2, 300*SS - cuke.size[1]//2))
sh = Image.new('RGBA', bg.size, (0,0,0,0))
ImageDraw.Draw(sh).ellipse([55*SS, 462*SS, 315*SS, 505*SS], fill=(29,58,18,60))
bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10*SS)))
d = ImageDraw.Draw(bg, 'RGBA')

def eye(ex, ey):
    r = 30*SS
    d.ellipse([ex-r, ey-r*1.05, ex+r, ey+r*1.05], fill=(255,253,245,255))
    d.ellipse([ex-r, ey-r*1.05, ex+r, ey+r*1.05], outline=(29,58,18,220), width=3*SS)
    pr = 13*SS; px, py = ex+7*SS, ey-5*SS
    d.ellipse([px-pr, py-pr, px+pr, py+pr], fill=(25,45,15,255))
    d.ellipse([px+2*SS, py-9*SS, px+9*SS, py-2*SS], fill=(255,255,255,230))
eye(158*SS, 235*SS); eye(215*SS, 235*SS)
d.line([126*SS, 178*SS, 186*SS, 160*SS], fill=(29,58,18,255), width=6*SS)
d.line([190*SS, 160*SS, 250*SS, 178*SS], fill=(29,58,18,255), width=6*SS)
mx, my = 187*SS, 335*SS
d.ellipse([mx-42*SS, my-34*SS, mx+42*SS, my+38*SS], fill=(30,15,8,255))
d.ellipse([mx-18*SS, my+2*SS, mx+18*SS, my+32*SS], fill=(226,84,63,255))

bub = Image.new('RGBA', bg.size, (0,0,0,0)); bd2 = ImageDraw.Draw(bub)
bw, bh = 285*SS, 112*SS; bx, by = 375*SS, 105*SS
sh2 = Image.new('RGBA', bg.size, (0,0,0,0))
ImageDraw.Draw(sh2).rounded_rectangle([bx-bw//2+8*SS, by-bh//2+12*SS, bx+bw//2+8*SS, by+bh//2+12*SS],
    radius=36*SS, fill=(29,58,18,70))
bg.alpha_composite(sh2.filter(ImageFilter.GaussianBlur(8*SS)))
bd2.rounded_rectangle([bx-bw//2, by-bh//2, bx+bw//2, by+bh//2], radius=36*SS, fill=(255,253,245,255))
bd2.polygon([(bx-120*SS, by+bh//2-4*SS), (bx-55*SS, by+bh//2+12*SS), (mx+78*SS, my-58*SS)], fill=(255,253,245,255))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', FONT_SIZE*SS)
except Exception:
    font = ImageFont.load_default()
tb = bd2.textbbox((0,0), TEXT, font=font)
bd2.text((bx-(tb[2]-tb[0])/2-tb[0], by-(tb[3]-tb[1])/2-tb[1]+2*SS), TEXT, font=font, fill=(29,58,18,255))
bg.alpha_composite(bub)

def star(scx, scy, r, color=(244,185,66,230)):
    pts2 = []
    for k in range(16):
        rr2 = (r*0.38 if k%2 else r); a = k*math.pi/8
        pts2.append((scx+math.cos(a)*rr2, scy+math.sin(a)*rr2))
    ImageDraw.Draw(bg, 'RGBA').polygon(pts2, fill=color)
star(60*SS, 130*SS, 20*SS); star(430*SS, 400*SS, 22*SS)

bg.convert('RGB').resize((S, S), Image.LANCZOS).save(OUT, "PNG")
print("OK:", OUT)
