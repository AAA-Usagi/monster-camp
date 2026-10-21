"""Build a small original app icon with only the Python standard library."""
import math, pathlib, struct, zlib

root = pathlib.Path(__file__).resolve().parents[1] / 'assets'
root.mkdir(exist_ok=True)
size, scale = 256, 2
n = size * scale
pixels = bytearray(n * n * 4)

def ellipse(cx, cy, rx, ry, color):
    for y in range(max(0, int((cy-ry)*scale)), min(n, int((cy+ry)*scale)+1)):
        for x in range(max(0, int((cx-rx)*scale)), min(n, int((cx+rx)*scale)+1)):
            if ((x/scale-cx)/rx)**2+((y/scale-cy)/ry)**2 <= 1:
                p=(y*n+x)*4
                pixels[p:p+4]=bytes(color)

ink=(65,83,52,255)
ellipse(128,146,101,99,ink)
ellipse(128,146,94,92,(182,204,127,255))
ellipse(71,64,23,39,ink)
ellipse(71,64,17,33,(182,204,127,255))
ellipse(182,60,24,41,ink)
ellipse(182,60,18,35,(182,204,127,255))
ellipse(127,163,68,60,(209,223,163,255))
ellipse(92,134,8,12,ink)
ellipse(165,134,8,12,ink)
ellipse(67,158,17,10,(229,166,135,255))
ellipse(188,158,17,10,(229,166,135,255))
ellipse(129,159,13,12,ink)
ellipse(129,153,15,12,(209,223,163,255))
ellipse(72,225,23,13,ink)
ellipse(184,225,23,13,ink)
ellipse(72,222,18,10,(182,204,127,255))
ellipse(184,222,18,10,(182,204,127,255))
rows=bytearray()
for y in range(size):
    rows.append(0)
    for x in range(size):
        for c in range(4):
            rows.append(sum(pixels[((y*scale+dy)*n+x*scale+dx)*4+c] for dy in range(scale) for dx in range(scale))//(scale*scale))
def chunk(name,data):
    return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')
(root/'icon.png').write_bytes(png)
(root/'icon.ico').write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(png),22)+png)
print('Generated assets/icon.png and assets/icon.ico')
