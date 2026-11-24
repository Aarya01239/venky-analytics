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
        page.get_by_role('button', name='Communication Studio').click()
        page.get_by_role('button', name='Start session').click()
        expect(page.get_by_label('Time remaining')).to_have_text(re.compile(r'40:00|39:59'))
        page.get_by_label('Your transcript').fill('I track merchant leads.')
        page.get_by_role('button', name='Review rubric').click()
        expect(page.get_by_text('Start with your current role', exact=False)).to_be_visible()
        page.get_by_role('button', name='End timer').click()
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
        degraded = browser.new_page()
        degraded.route('**/api/bootstrap', lambda route: route.fulfill(status=503, json={'error': 'Test backend outage'}))
        degraded.goto('http://localhost:4317')
        expect(degraded.get_by_role('heading', name='Workspace Initialization Error')).to_be_visible()
        degraded.get_by_role('button', name='Keyboard Skills Lab').click()
        expect(degraded.get_by_text('Type the sample exactly', exact=False)).to_be_visible()
        assert not errors, errors
        print('PASS: production boot, Chromium desktop and mobile, typing metrics and persistence, keyboard chord and simulation, speaking timer and text rubric, Gemini SDK unavailable fallback, SQL grouping and grading, an Excel formula, synthetic data download and import, career tracker and keyword review, practice during a bootstrap failure, and SQLite backup restoration', flush=True)
    finally:
        server.terminate()
        server.wait(timeout=10)
