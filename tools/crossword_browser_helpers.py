def clue_ids(page):
 return page.locator('[data-cw=clue]').evaluate_all('(es)=>es.map(e=>e.dataset.entry)')
def choose_clue(page,number):
 button=page.locator(f'[data-cw=clue][data-entry="{number}"]')
 if not button.is_visible():page.locator('[data-cw=toggle-clues]').click()
 button.click()
 page.wait_for_function('document.activeElement?.matches("[data-crossword-input],[data-crossword-3d-input]")')
def fill_word(page,number,answer):
 choose_clue(page,number)
 page.keyboard.insert_text(answer)
def fill_grid(page,mapping):
 for number in clue_ids(page):
  choose_clue(page,number)
  page.keyboard.insert_text(mapping[page.locator('[data-cw-current-clue]').inner_text()])
def word_value(page,number):
 return page.locator(f'[data-cw=clue][data-entry="{number}"]').evaluate('(e)=>e.dataset.cwKeys.split(",").map(k=>document.querySelector(`[data-crossword-input][data-cell="${k}"]`).value||" ").join("")')
def square_values(page):
 return page.locator('[data-crossword-input]').evaluate_all('(es)=>Object.fromEntries(es.map(e=>[e.dataset.cell,e.value]))')
def check_grid(page):
 page.locator('[data-cw-check]').click()
 page.wait_for_selector('[data-cw-result]:not([hidden])')
