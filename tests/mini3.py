import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(viewport={'width':900,'height':600}).new_page()
    pg.add_init_script("Object.defineProperty(window,'documentPictureInPicture',{value:undefined})")
    pg.goto('file://'+PATH); to_menu(pg,'game'); go(pg)
    pg.evaluate("()=>document.getElementById('popChk').click()"); pg.wait_for_timeout(300)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(2800)
    pg.screenshot(path='/tmp/mini_f.png', clip={'x':560,'y':440,'width':340,'height':160})
    b.close()
