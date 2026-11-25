import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with tempfile.TemporaryDirectory() as data, sync_playwright() as playwright:
    env = dict(os.environ, DATA_DIR=data, SQLITE_DB_PATH='', NODE_ENV='production', PORT='4317', GEMINI_API_KEY='')
    server = subprocess.Popen(['node', 'server.ts'], env=env)
    try:
        for _ in range(60):
            try:
                with urllib.request.urlopen('http://localhost:4317/api/health') as response:
                    assert json.load(response)['ok']
                break
            except urllib.error.URLError:
                time.sleep(.25)
        else:
            raise AssertionError('server failed to boot')
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),
            args=os.environ.get('CHROMIUM_EXTRA_ARGS', '').split())
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://localhost:4317', wait_until='domcontentloaded')
        expect(page.get_by_role('button', name='Keyboard Skills Lab')).to_be_visible()
        page.get_by_role('button', name='Keyboard Skills Lab').click()
        typing = page.get_by_role('textbox', name='Typing exercise')
        typing.press_sequentially('xsdf jkl; asdf jkl;', delay=45)
        typing.press('Control+Home')
        typing.press('Delete')
        typing.press('a')
        expect(page.get_by_text('Exercise complete!')).to_be_visible()
        expect(page.get_by_text('Accuracy: 95%')).to_be_visible()
        assert page.evaluate("JSON.parse(localStorage.getItem('vos.typing.history')).length") == 1
        expect(page.get_by_role('button', name='a · 1/3 missed', exact=True)).to_be_visible()
        page.reload()
        page.get_by_role('button', name='Keyboard Skills Lab').click()
        page.get_by_role('button', name='a · 1/3 missed', exact=True).click()
        expect(page.get_by_text('Focused drill for a.', exact=False)).to_be_visible()
        page.get_by_role('textbox', name='Typing exercise').press_sequentially('aaa sas jaj lal', delay=40)
        expect(page.get_by_text('Exercise complete!')).to_be_visible()
        expect(page.get_by_role('button', name='a · 1/9 missed', exact=True)).to_be_visible()
        assert page.evaluate("JSON.parse(localStorage.getItem('vos.typing.history')).length") == 1
        page.get_by_role('button', name='Shortcut Trainer').click()
        shortcut = page.get_by_label('Shortcut practice area')
        shortcut.focus()
        shortcut.press('Control+Shift+l')
        expect(page.get_by_text('Correct!')).to_be_visible()
        shortcut.press('Tab')
        assert shortcut.evaluate('(element) => document.activeElement !== element')
        page.get_by_role('button', name='Next shortcut').click()
        page.get_by_role('button', name='Next shortcut').click()
        page.get_by_role('button', name='Ctrl', exact=True).click()
        page.get_by_role('button', name='T', exact=True).click()
        expect(page.get_by_text('Correct!')).to_be_visible()
        expect(page.get_by_text('Saved attempts for this shortcut: 1/1 correct', exact=True)).to_be_visible()
        page.get_by_role('button', name='T', exact=True).click()
        expect(page.get_by_text('Saved attempts for this shortcut: 1/2 correct', exact=True)).to_be_visible()
        page.reload()
        page.get_by_role('button', name='Keyboard Skills Lab').click()
        page.get_by_role('button', name='Shortcut Trainer').click()
        page.get_by_role('button', name='Review lowest-accuracy shortcut').click()
        expect(page.get_by_text('Excel: Insert table', exact=True)).to_be_visible()
        expect(page.get_by_text('Saved attempts for this shortcut: 1/2 correct', exact=True)).to_be_visible()
        page.clock.install()
        page.get_by_label('Practice app', exact=True).select_option('Jupyter')
        expect(page.get_by_text('Jupyter: Run cell and advance', exact=True)).to_be_visible()
        page.get_by_role('button', name='Start 10-second attempt').click()
        page.clock.fast_forward(2000)
        page.get_by_label('Shortcut practice area', exact=True).press('Shift+Enter')
        expect(page.get_by_text('Correct in', exact=False)).to_be_visible()
        expect(page.get_by_text('Average successful timed response:', exact=False)).to_be_visible()
        page.get_by_role('button', name='Start 10-second attempt').click()
        page.clock.fast_forward(11000)
        expect(page.get_by_text('Time is up. Try again.', exact=True)).to_be_visible()
        expect(page.get_by_text('Saved attempts for this shortcut: 1/2 correct', exact=True)).to_be_visible()
        page.get_by_label('Practice app', exact=True).select_option('All apps')
        page.get_by_text('Shortcut reference', exact=True).click()
        search = page.get_by_role('searchbox', name='Search shortcuts')
        search.fill('Ctrl+Shift+L')
        expect(page.get_by_role('list', name='Matching shortcuts').get_by_role('listitem')).to_have_count(1)
        search.fill('excel toggle filters')
        expect(page.get_by_role('list', name='Matching shortcuts').get_by_role('listitem')).to_have_count(1)
        page.get_by_role('button', name='Practice Excel Toggle filters').click()
        expect(page.get_by_text('Excel: Toggle filters', exact=True)).to_be_focused()
        search.fill('Chrome reopen')
        expect(page.get_by_text('Ctrl + Shift + T · On-screen simulation', exact=True)).to_be_visible()
        page.get_by_role('button', name='Practice Chrome Reopen closed tab').click()
        expect(page.get_by_text('Chrome: Reopen closed tab', exact=True)).to_be_focused()
        search.fill('no such shortcut')
        expect(page.get_by_text('No matching shortcuts.', exact=False)).to_be_visible()
        search.fill('')
        page.get_by_label('Mastery level', exact=True).select_option('Learning')
        page.get_by_role('button', name='Practice Excel Toggle filters').click()
        expect(page.get_by_text('Excel: Toggle filters', exact=True)).to_be_focused()
        expect(page.get_by_text('Mastery for this shortcut: Learning', exact=True)).to_be_visible()
        for _ in range(4):
            page.get_by_label('Shortcut practice area', exact=True).press('Control+Shift+l')
        expect(page.get_by_text('Mastery for this shortcut: Mastered', exact=True)).to_be_visible()
        page.get_by_label('Mastery level', exact=True).select_option('Mastered')
        expect(page.get_by_role('list', name='Matching shortcuts').get_by_role('listitem')).to_have_count(1)
        page.reload()
        page.get_by_role('button', name='Keyboard Skills Lab').click()
        page.get_by_role('button', name='Shortcut Trainer').click()
        expect(page.get_by_text('Mastery for this shortcut: Mastered', exact=True)).to_be_visible()
        page.get_by_label('Shortcut difficulty', exact=True).select_option('Advanced')
        expect(page.get_by_text('Excel: Insert table', exact=True)).to_be_visible()
        page.get_by_role('button', name='Review lowest-accuracy shortcut').click()
        expect(page.get_by_text('Excel: Insert table', exact=True)).to_be_visible()
        page.get_by_role('button', name='Next shortcut').click()
        expect(page.get_by_text('Windows 11: Show the desktop', exact=True)).to_be_visible()
        page.get_by_text('Shortcut reference', exact=True).click()
        expect(page.get_by_role('button', name='Practice Excel Toggle filters')).to_have_count(0)
        expect(page.get_by_role('button', name='Practice Chrome Reopen closed tab')).to_be_visible()
        page.get_by_label('Practice app', exact=True).select_option('Jupyter')
        expect(page.get_by_label('Shortcut difficulty', exact=True)).to_have_value('All difficulties')
        expect(page.get_by_role('option', name='Advanced', exact=True)).to_have_attribute('disabled', '')
        expect(page.get_by_text('Jupyter: Run cell and advance', exact=True)).to_be_visible()
        page.get_by_label('Practice app', exact=True).select_option('All apps')
        search = page.get_by_role('searchbox', name='Search shortcuts')
        search.fill('Ctrl+/')
        page.get_by_role('button', name='Practice VS Code Toggle line comment').click()
        expect(page.get_by_text('VS Code: Toggle line comment', exact=True)).to_be_focused()
        page.get_by_label('Shortcut practice area', exact=True).press('Control+/')
        expect(page.get_by_role('status').filter(has_text='Correct!')).to_be_visible()
        search.fill('fill formula down')
        page.get_by_role('button', name='Practice Excel Fill formula down').click()
        expect(page.get_by_text('Excel: Fill formula down', exact=True)).to_be_focused()
        page.get_by_role('button', name='Ctrl', exact=True).click()
        page.get_by_role('button', name='D', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Correct!')).to_be_visible()
        search.fill('Alt+Enter')
        page.get_by_role('button', name='Practice Jupyter Run cell and insert below').click()
        expect(page.get_by_text('Jupyter: Run cell and insert below', exact=True)).to_be_focused()
        page.get_by_label('Shortcut practice area', exact=True).press('Alt+Enter')
        expect(page.get_by_role('status').filter(has_text='Correct!')).to_be_visible()
        search.fill('google sheets paste values')
        page.get_by_role('button', name='Practice Google Sheets Paste values only').click()
        expect(page.get_by_text('Google Sheets: Paste values only', exact=True)).to_be_focused()
        page.get_by_role('button', name='Ctrl', exact=True).click()
        page.get_by_role('button', name='Shift', exact=True).click()
        page.get_by_role('button', name='V', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Correct!')).to_be_visible()
        timed = browser.new_page()
        timed.clock.install()
        timed.goto('http://localhost:4317')
        timed.get_by_role('button', name='Keyboard Skills Lab').click()
        timed.get_by_role('button', name='Timed Test', exact=True).click()
        timed.get_by_label('Tests per day', exact=True).select_option('1')
        timed.get_by_role('button', name='Start timed test').click()
        timed_input = timed.get_by_role('textbox', name='Timed typing input')
        timed_input.press_sequentially('Xhe sales')
        timed_input.press('Control+Home')
        timed_input.press('Delete')
        timed_input.press('T')
        timed.clock.fast_forward(31000)
        expect(timed.get_by_text('Test complete · 4 WPM · 90% accuracy', exact=True)).to_be_visible()
        expect(timed_input).to_be_disabled()
        expect(timed.get_by_text('1 of 1 timed tests completed today · Goal reached', exact=True)).to_be_visible()
        expect(timed.get_by_text('Best recent result: 4 WPM', exact=True)).to_be_visible()
        timed.reload()
        timed.get_by_role('button', name='Keyboard Skills Lab').click()
        timed.get_by_role('button', name='Timed Test', exact=True).click()
        expect(timed.get_by_role('listitem').filter(has_text='30s · 4 WPM · 90% accuracy')).to_be_visible()
        expect(timed.get_by_label('Tests per day', exact=True)).to_have_value('1')
        expect(timed.get_by_text('1 of 1 timed tests completed today · Goal reached', exact=True)).to_be_visible()
        timed.get_by_label('Test duration', exact=True).select_option('60')
        expect(timed.get_by_text('Complete a 60-second test to see progress for this duration.', exact=True)).to_be_visible()
        timed.get_by_role('button', name='Start timed test').click()
        expect(timed.get_by_label('Typing test time remaining')).to_have_text('60s')
        timed.get_by_role('button', name='Cancel test').click()
        timed.clock.fast_forward(61000)
        expect(timed.get_by_text('Test cancelled.', exact=True)).to_be_visible()
        assert timed.evaluate("JSON.parse(localStorage.getItem('vos.typing.timed.v1')).length") == 1
        timed.clock.fast_forward(86400000)
        expect(timed.get_by_text("0 of 1 timed tests completed today", exact=True)).to_be_visible()
        timed.reload()
        timed.get_by_role('button', name='Keyboard Skills Lab').click()
        timed.get_by_role('button', name='Timed Test', exact=True).click()
        expect(timed.get_by_text('0 of 1 timed tests completed today', exact=True)).to_be_visible()
        page.get_by_role('button', name='Communication Studio').click()
        page.get_by_role('button', name='Start session').click()
        expect(page.get_by_label('Time remaining')).to_have_text(re.compile(r'40:00|39:59'))
        page.get_by_label('Your transcript').fill('I track merchant leads.')
        page.get_by_role('button', name='Review rubric').click()
        expect(page.get_by_text('Start with your current role', exact=False)).to_be_visible()
        page.wait_for_timeout(1100)
        page.get_by_role('button', name='Save and end session').click()
        expect(page.get_by_role('listitem').filter(has_text='Self-introduction')).to_be_visible()
        page.reload()
        page.get_by_role('button', name='Communication Studio').click()
        expect(page.get_by_role('listitem').filter(has_text='Self-introduction')).to_be_visible()
        page.get_by_role('button', name='Communication Studio').click()
        page.get_by_role('button', name='Analytics Tutor').click()
        expect(page.get_by_role('heading', name='Analytics Tutor')).to_be_visible()
        with page.expect_response(lambda response: '/api/ai/assist' in response.url) as request:
            page.get_by_label('Provider').select_option('gemini')
            page.get_by_placeholder('Ask SQL, Excel, Python, Stats, BA, or Telugu explanation...').fill('Help with a business KPI')
            page.get_by_role('button', name='Send prompt').click()
        assert request.value.status == 503, request.value.status
        expect(page.get_by_text('Gemini unavailable', exact=False)).to_be_visible()
        result = page.request.post('http://localhost:4317/api/sql/execute', data={'sql':'SELECT region, COUNT(*) AS orders FROM retail_sales GROUP BY region ORDER BY region'})
        assert result.ok and len(result.json()['results'][0]['rows']) == 4, result.text()
        evaluation = page.request.post('http://localhost:4317/api/sql/evaluate', data={
            'challengeId': 'retail-revenue-by-region',
            'userSql': 'SELECT region, SUM(revenue) AS total_revenue FROM retail_sales GROUP BY region ORDER BY total_revenue DESC, region'
        })
        assert evaluation.ok and evaluation.json()['passed'], evaluation.text()
        assert not page.request.post('http://localhost:4317/api/sql/evaluate', data={
            'challengeId': 'missing', 'userSql': 'SELECT 1'
        }).ok
        page.get_by_role('button', name='Close AI panel').click()
        page.get_by_role('button', name='Excel Studio', exact=True).click()
        page.get_by_placeholder('Enter Excel formula', exact=False).fill('=SUM(2,3)')
        expect(page.get_by_text('Result:', exact=False).filter(has=page.get_by_text('5', exact=True))).to_be_visible()
        page.reload()
        page.get_by_role('button', name='SQL Studio', exact=True).click()
        page.get_by_role('button', name='Challenges', exact=True).click()
        page.get_by_role('button', name='Keep customers with no returns', exact=False).click()
        page.get_by_text('Show hint', exact=True).click()
        expect(page.get_by_text('Aggregate all orders and returned orders separately', exact=False)).to_be_visible()
        page.get_by_role('button', name='Verify Solution', exact=True).click()
        expect(page.get_by_text('Column count mismatch', exact=False)).to_be_visible()
        for title in ('Find returned orders in Q1', 'Compare returns by acquisition channel', 'Keep customers with no returns', 'Build a running monthly sales report'):
            page.get_by_role('button', name=title, exact=False).click()
            page.get_by_role('button', name='Load Solution', exact=True).click()
            page.get_by_role('button', name='Verify Solution', exact=True).click()
            expect(page.get_by_text('Verified! Your SQL query output matches', exact=False)).to_be_visible()
        alternative = page.request.post('http://localhost:4317/api/sql/evaluate', data={
            'challengeId': 'ecommerce-customer-left-join',
            'userSql': 'SELECT customer_id, COUNT(*) AS orders, SUM(returned) AS returns FROM ecommerce_orders GROUP BY customer_id ORDER BY customer_id;'
        })
        assert alternative.ok and alternative.json()['passed'], alternative.text()
        expect(page.get_by_text('5 of 6 SQL challenges verified', exact=True)).to_be_visible()
        page.reload()
        page.get_by_role('button', name='SQL Studio', exact=True).click()
        page.get_by_role('button', name='Challenges', exact=True).click()
        expect(page.get_by_text('5 of 6 SQL challenges verified', exact=True)).to_be_visible()
        page.get_by_role('button', name='File Manager', exact=False).click()
        page.get_by_text('Generate a synthetic dataset').click()
        page.get_by_label('Scenario').select_option('payments')
        page.get_by_label('Rows', exact=True).fill('60')
        page.get_by_text('Add data quality issues').click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Download synthetic JSON').click()
        generated = download.value
        assert generated.suggested_filename == 'synthetic_payments_2026_dirty.json'
        with open(generated.path()) as file:
            rows = json.load(file)
        assert len(rows) == 60 and rows[5]['territory'] is None and rows[18] == rows[17]
        page.locator('input[type=file]').set_input_files({'name':generated.suggested_filename,'mimeType':'application/json','buffer':json.dumps(rows).encode()})
        expect(page.get_by_role('button', name='synthetic_payments_2026_dirty', exact=True)).to_be_visible()
        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        mobile.goto('http://localhost:4317')
        mobile.get_by_role('button', name='Communication Studio').click()
        expect(mobile.get_by_role('heading', name='Communication Studio')).to_be_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth === innerWidth')
        page.get_by_role('button', name='Career Prep').click()
        page.get_by_label('Company').fill('Sample employer')
        page.get_by_label('Role', exact=True).fill('Data Analyst')
        page.get_by_role('button', name='Add application').click()
        page.get_by_label('Status for Sample employer Data Analyst').select_option('Interview')
        page.get_by_label('Job description', exact=True).fill('SQL. Experience with Power BI required.')
        page.get_by_label('Resume text').fill('SQL, Excel, and reporting.')
        page.get_by_label('Keywords, separated', exact=False).fill('SQL, Power BI')
        assert page.get_by_role('row').filter(has_text='power bi').inner_text().split()[-2:] == ['Present', 'Missing']
        page.reload()
        page.get_by_role('button', name='Career Prep').click()
        expect(page.get_by_label('Status for Sample employer Data Analyst')).to_have_value('Interview')
        progress = page.request.post('http://localhost:4317/api/learning', data={
            'topic_id': 'smoke-test-lesson', 'status': 'completed', 'score': 100
        })
        assert progress.ok
        server.terminate()
        server.wait(timeout=10)
        original = Path(data) / 'venky_os.sqlite'
        restored = Path(data) / 'restored.sqlite'
        shutil.copy2(original, restored)
        with sqlite3.connect(restored) as connection:
            assert connection.execute('PRAGMA integrity_check').fetchone() == ('ok',)
        env['SQLITE_DB_PATH'] = str(restored)
        server = subprocess.Popen(['node', 'server.ts'], env=env)
        for _ in range(60):
            try:
                with urllib.request.urlopen('http://localhost:4317/api/bootstrap') as response:
                    workspace = json.load(response)
                break
            except urllib.error.URLError:
                time.sleep(.25)
        else:
            raise AssertionError('server failed to restart')
        assert any(entry['topic_id'] == 'smoke-test-lesson' and entry['score'] == 100 for entry in workspace['learning'])
        assert any('synthetic_payments' in entry['name'] for entry in workspace['datasets'])
        verified = [entry for entry in workspace['learning'] if entry['topic_id'].startswith('sql-challenge:')]
        assert len(verified) == 5 and all(entry['status'] == 'completed' for entry in verified)
        degraded = browser.new_page()
        degraded.route('**/api/bootstrap', lambda route: route.fulfill(status=503, json={'error': 'Test backend outage'}))
        degraded.goto('http://localhost:4317')
        expect(degraded.get_by_role('heading', name='Workspace Initialization Error')).to_be_visible()
        degraded.get_by_role('button', name='Keyboard Skills Lab').click()
        expect(degraded.get_by_text('Type the sample exactly', exact=False)).to_be_visible()
        pyodide_assets = os.environ.get('PYODIDE_ASSET_DIR')
        if pyodide_assets:
            notebook = browser.new_page()
            requests = []
            notebook.on('request', lambda request: requests.append(request.url))
            def serve_pyodide(route):
                file = Path(pyodide_assets) / route.request.url.rsplit('/', 1)[-1]
                if file.is_file():
                    route.fulfill(path=file, headers={'Access-Control-Allow-Origin': '*'})
                else:
                    route.abort()
            notebook.route('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/*', serve_pyodide)
            notebook.goto('http://localhost:4317')
            notebook.get_by_role('button', name='Python Studio', exact=True).click()
            requests.clear()
            notebook.get_by_role('button', name='Boot Python Kernel').click()
            expect(notebook.get_by_role('button', name='Kernel Ready')).to_be_visible(timeout=30000)
            assert not [url for url in requests if '?limit=2000' in url or url.endswith('.whl')]
            cell = notebook.locator('textarea').nth(1)
            cell.fill("print(6 * 7)")
            notebook.get_by_role('button', name='Run', exact=True).first.click()
            expect(notebook.get_by_text('42', exact=True)).to_be_visible(timeout=15000)
            assert not [url for url in requests if '?limit=2000' in url or url.endswith('.whl')]
            cell.fill("import csv\nwith open('/workspace/retail_sales.csv') as file:\n    print('Retail rows:', len(list(csv.DictReader(file))))")
            notebook.get_by_role('button', name='Run', exact=True).first.click()
            expect(notebook.get_by_text('Retail rows:', exact=False)).to_be_visible(timeout=15000)
            assert len([url for url in requests if '?limit=2000' in url]) == 1
            notebook.get_by_role('button', name='Run', exact=True).first.click()
            expect(notebook.get_by_role('button', name='Kernel Ready')).to_be_visible(timeout=15000)
            assert len([url for url in requests if '?limit=2000' in url]) == 1
            print('PASS: real Pyodide browser execution, on-demand CSV and reuse', flush=True)
        assert not errors, errors
        print('PASS: production boot, Chromium desktop and mobile, typing metrics, timed results and persistence, keyboard chord and simulation, speaking timer, history and text rubric, Gemini SDK unavailable fallback, SQL grouping and grading, an Excel formula, synthetic data download and import, career tracker and keyword review, practice during a bootstrap failure, and SQLite backup restoration', flush=True)
    finally:
        server.terminate()
        server.wait(timeout=10)
