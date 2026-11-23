#!/usr/bin/env python3
"""Build index.html from src/. Run: python3 build.py
CSS files in src/css and JS files in src/js are concatenated in filename order into src/template.html."""
import glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(p, encoding='utf-8').read()
css = '\n'.join(read(f) for f in sorted(glob.glob(os.path.join(here, 'src/css/*.css'))))
js = '\n'.join(read(f) for f in sorted(glob.glob(os.path.join(here, 'src/js/*.js'))))
if '</script' in js:
    sys.exit('error: "</script" appears inside the JS; escape it')
out = read(os.path.join(here, 'src/template.html')).replace('/*{{CSS}}*/', css).replace('/*{{JS}}*/', js)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out.encode()), 'bytes')
