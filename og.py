import json,math
from PIL import Image,ImageDraw,ImageFont
W,H=1200,630
PAPER=(242,239,233); INK=(11,11,12); RED=(230,51,41); GREY=(111,106,99); LINE=(207,201,190)
img=Image.new("RGB",(W,H),PAPER); d=ImageDraw.Draw(img)
G=lambda s,w=600: ImageFont.truetype("fonts/InterTight.ttf",s).font_variant() if False else None
def g(sz,wt=600):
    f=ImageFont.truetype("fonts/InterTight.ttf",sz); f.set_variation_by_axes([wt]); return f
def m(sz): return ImageFont.truetype("fonts/IBMPlexMono.ttf",sz)
# top rule
d.text((44,34),"SIDEQUEST",font=g(30,600),fill=INK)
d.ellipse([24,42,40,58],fill=RED)
d.text((W-44-d.textlength("MUMBAI · 1—6 NOVEMBER 2026",font=m(14)),36),"MUMBAI · 1—6 NOVEMBER 2026",font=m(14),fill=GREY)
d.line([(24,78),(W-24,78)],fill=INK,width=2)
# headline
d.text((40,104),"Where to host",font=g(78,600),fill=INK)
d.text((40,178),"your ",font=g(78,600),fill=INK)
off=d.textlength("your ",font=g(78,600))
d.text((40+off,178),"side event",font=g(78,600),fill=RED)
d.text((40,252),"in Mumbai.",font=g(78,600),fill=INK)
d.text((42,352),"42 venues, researched and scored for one question:",font=g(21,400),fill=INK)
d.text((42,380),"can you actually hold your event here?",font=g(21,600),fill=INK)
# right: map panel
mx0,my0,mx1,my1=690,104,1160,436
d.rectangle([mx0,my0,mx1,my1],fill=INK)
V=json.load(open("data/venues.json"))["venues"]
lat0,lat1,lng0,lng1=18.96,19.155,72.79,72.94
def P(lat,lng): return mx0+(lng-lng0)/(lng1-lng0)*(mx1-mx0), my1-(lat-lat0)/(lat1-lat0)*(my1-my0)
A=[(19.1022079,72.8769625,"1"),(19.0630565,72.8670307,"2")]
kmpx=(mx1-mx0)/((lng1-lng0)*111.32*math.cos(math.radians(19.06)))
for lat,lng,_ in A:
    cx,cy=P(lat,lng); r=3*kmpx
    for i in range(0,120,2):
        a0=math.radians(i*3); d.arc([cx-r,cy-r,cx+r,cy+r],math.degrees(a0),math.degrees(a0)+1.6,fill=RED,width=2)
for v in V:
    x,y=P(v["lat"],v["lng"])
    d.rectangle([x-2,y-2,x+2,y+2],fill=PAPER)
for lat,lng,n in A:
    cx,cy=P(lat,lng)
    d.rectangle([cx-5,cy-5,cx+5,cy+5],fill=RED)
    d.text((cx-3,cy-8),n,font=m(13),fill=(255,255,255))
d.text((mx0+12,my1-26),"SAHAR → BKC · THE 9 KM AXIS",font=m(13),fill=(155,149,140))
# stat bar
bx=690; bw=(1160-690)
cells=[("42","VENUES","red"),("10","FACTORS EACH","ink"),(str(sum(len(v["evidence"]) for v in V)),"EVIDENCE POINTS","ink")]
cw=bw//3
for i,(big,lb,st) in enumerate(cells):
    x0=bx+i*cw; x1=x0+cw-(0 if i==2 else 0)
    d.rectangle([x0,456,x1-2,548],fill=RED if st=="red" else INK)
    d.text((x0+14,468),big,font=m(40),fill=(255,255,255))
    d.text((x0+14,522),lb,font=m(12),fill=(255,220,218) if st=="red" else (155,149,140))
# bottom rule
d.line([(24,574),(W-24,574)],fill=INK,width=2)
d.text((40,590),"01—02 IBW · FAIRMONT MUMBAI      03—06 DEVCON 8 · JIO WORLD CENTRE",font=m(15),fill=INK)
t="side-event-venues.vercel.app"
d.text((W-44-d.textlength(t,font=m(15)),590),t,font=m(15),fill=RED)
img.save("og.png",optimize=True); print("ok")
